import { Mood } from './mood';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationMessage {
  isUser: boolean;
  text: string;
}

export interface AIRequest {
  prompt: string;
  currentMood: Mood;
  responseMood?: Mood;
  upcomingMood?: Mood;
  isApproaching?: boolean;
  pendingMood?: Mood;
  approachProgress?: number;
  approachThreshold?: number;
  approachLabel?: string;
  messages?: ConversationMessage[];
}

export interface AIResponse {
  response: string;
  detectedMood: Mood;
}

export interface AIServiceConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
}