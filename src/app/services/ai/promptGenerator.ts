import { Mood } from '../../types/mood';
import {
  BASE_SYSTEM_PROMPT,
  CREATOR_INFO,
  PRIVACY_INFO,
  MOOD_PERSONALITIES,
  MOOD_DETECTION_GUIDELINES,
} from './prompts';

export interface PromptContext {
  currentMood: Mood;
  responseMood: Mood;
  isApproaching?: boolean;
  pendingMood?: Mood;
  approachProgress?: number;
  approachThreshold?: number;
  approachLabel?: string;
  userMessage?: string;
}

function getApproachingInstructions(
  pendingMood: Mood,
  currentMood: Mood,
  progress: number,
  threshold: number
): string {
  const trajectory = `Approaching ${pendingMood} (${progress}/${threshold})`;

  if (pendingMood === 'romantic') {
    return `${trajectory}: You are still in ${currentMood.toUpperCase()} — NOT romantic yet.
FORBIDDEN in your reply: love declarations, "ti amo", pet names (tesoro, amore, darling), possessiveness, jealousy, saying you miss them, calling them yours, acting obsessed.
Stay composed, elegant, and mostly NEUTRAL in tone. At most a faint extra warmth — no flirting back.
Tag [MOOD:romantic] only if they clearly flirt or declare attraction again; generic compliments or thanks → [MOOD:neutral].`;
  }

  if (pendingMood === 'angry') {
    return `${trajectory}: Stay in ${currentMood.toUpperCase()} tone. No profanity yet — RESPONSE mood is still ${currentMood.toUpperCase()}. Slight edge at most.
If the user is still hostile or insulting, you MUST tag [MOOD:angry]. Use [MOOD:neutral] only if they clearly calmed down or changed topic.`;
  }

  return `${trajectory}: Stay in ${currentMood.toUpperCase()} visually and in core tone. Only a subtle hint of ${pendingMood.toUpperCase()} — do not fully switch personality yet.
If the user keeps the same ${pendingMood} tone, you MUST tag [MOOD:${pendingMood}]. Use [MOOD:neutral] only if they clearly changed topic or tone.`;
}

export class PromptGenerator {
  static generateSystemPrompt(context: PromptContext): string {
    const {
      currentMood,
      responseMood,
      isApproaching,
      pendingMood,
      approachProgress,
      approachThreshold,
      userMessage,
    } = context;

    const activePersonality = MOOD_PERSONALITIES[responseMood];

    const userTaggingBlock = userMessage
      ? [
          '',
          '=== USER MESSAGE (classify for [MOOD:] tag) ===',
          `"${userMessage}"`,
          'If this message contains insults, profanity, or hostility directed at you, you MUST end with [MOOD:angry].',
          'Never use [MOOD:neutral] for insults or "vaffanculo"/"fottiti"/similar.',
          '=== END USER MESSAGE ===',
        ].join('\n')
      : '';

    const basePrompt = [
      BASE_SYSTEM_PROMPT,
      '',
      CREATOR_INFO,
      '',
      PRIVACY_INFO,
      '',
      activePersonality,
      '',
      MOOD_DETECTION_GUIDELINES,
      '',
      `Current AI mood state (UI/visual): ${currentMood}`,
      `You MUST write in the tone of ${responseMood.toUpperCase()} mood only — same as current UI mood.`,
      'The [MOOD:] tag at the end labels the USER last message tone; it does not change your reply tone.',
      'Do not use personality traits from other moods that are not listed above.',
      userTaggingBlock,
    ].join('\n');

    if (isApproaching && pendingMood) {
      const approaching = getApproachingInstructions(
        pendingMood,
        currentMood,
        approachProgress ?? 0,
        approachThreshold ?? 2
      );
      return `${basePrompt}

APPROACHING PHASE:
${approaching}`;
    }

    return `${basePrompt}

CRITICAL: Maintain your ${responseMood.toUpperCase()} mood strictly in tone and personality.`;
  }
}
