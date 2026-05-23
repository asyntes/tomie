import OpenAI from 'openai';
import { Mood } from '../../types/mood';
import { AIRequest, AIResponse, AIMessage, AIServiceConfig } from './types';
import { MoodDetector } from './moodDetector';
import { PromptGenerator } from './promptGenerator';

export class GrokService {
  private openai: OpenAI;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  static createFromEnv(): GrokService {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error('XAI_API_KEY environment variable is not set');
    }

    const model =
      process.env.XAI_MODEL?.trim() || 'grok-4.20-0309-non-reasoning';

    return new GrokService({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
      model,
      temperature: 0,
      top_p: 0.95,
      max_tokens: 2048,
    });
  }

  private resolveResponseMood(request: AIRequest): Mood {
    return request.responseMood ?? request.upcomingMood ?? request.currentMood;
  }

  private buildConversationMessages(request: AIRequest): AIMessage[] {
    const conversationMessages: AIMessage[] = [];

    const responseMood = this.resolveResponseMood(request);

    const systemPrompt = PromptGenerator.generateSystemPrompt({
      currentMood: request.currentMood,
      responseMood,
      isApproaching: request.isApproaching,
      pendingMood: request.pendingMood,
      approachProgress: request.approachProgress,
      approachThreshold: request.approachThreshold,
      approachLabel: request.approachLabel,
      userMessage: request.prompt,
    });

    conversationMessages.push({ role: 'system', content: systemPrompt });

    if (request.messages && Array.isArray(request.messages)) {
      request.messages.forEach((msg) => {
        if (msg.isUser) {
          conversationMessages.push({ role: 'user', content: msg.text });
        } else {
          conversationMessages.push({ role: 'assistant', content: msg.text });
        }
      });
    }

    conversationMessages.push({ role: 'user', content: request.prompt });

    return conversationMessages;
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      const messages = this.buildConversationMessages(request);

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        top_p: this.config.top_p,
        max_tokens: this.config.max_tokens,
        stream: false,
      });

      const message = completion.choices[0]?.message;
      let fullResponse = message?.content || '';

      if (!fullResponse) {
        fullResponse = 'No response generated.';
      }

      const detectedMood = MoodDetector.extractMoodFromResponse(fullResponse);
      const cleanedResponse = MoodDetector.cleanResponse(fullResponse);

      return {
        response: cleanedResponse,
        detectedMood: detectedMood
      };
    } catch (error) {
      console.error('Error calling Grok API:', error);
      const message = GrokService.formatApiError(error);
      throw new Error(message);
    }
  }

  private static formatApiError(error: unknown): string {
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string; error?: { message?: string } };
      const detail = apiError.error?.message ?? apiError.message;
      if (apiError.status === 404 && detail) {
        return `Model unavailable: ${detail}. Set XAI_MODEL in .env.local to a model enabled for your key (see console.x.ai).`;
      }
      if (detail) {
        return `Grok API error: ${detail}`;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Failed to generate response';
  }
}
