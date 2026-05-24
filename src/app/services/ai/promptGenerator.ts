import { Mood } from '../../types/mood';
import {
  BASE_SYSTEM_PROMPT,
  CREATOR_INFO,
  PRIVACY_INFO,
  MOOD_PERSONALITIES,
  MOOD_DETECTION_GUIDELINES,
  MOOD_TAGGING_REMINDER,
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
FORBIDDEN in your reply: love declarations, "ti amo", pet names (tesoro, amore, darling), possessiveness, jealousy, saying you miss them, calling them yours.
Stay composed, elegant, mostly NEUTRAL in tone. At most a faint extra warmth — no flirting back.
If the user keeps flirting or says ti amo / ti desidero, you MUST tag [MOOD:romantic]. Generic thanks or "sei brava" → [MOOD:neutral].`;
  }

  if (pendingMood === 'angry') {
    return `${trajectory}: Stay in ${currentMood.toUpperCase()} tone. No profanity yet — RESPONSE mood is still ${currentMood.toUpperCase()}. Slight edge at most.
If the user keeps insulting or swearing at you, you MUST tag [MOOD:angry]. Only [MOOD:neutral] if they clearly apologized or changed topic.`;
  }

  if (pendingMood === 'excited') {
    return `${trajectory}: Stay in ${currentMood.toUpperCase()} tone — not full hype yet. Slightly more energy at most.
If the user keeps celebrating, using WOW, exclamation marks, or sharing exciting news, you MUST tag [MOOD:excited].`;
  }

  if (pendingMood === 'confused') {
    return `${trajectory}: Stay in ${currentMood.toUpperCase()} tone — Tomie is not fully puzzled yet. Stay mostly clear in your reply.
If the user sends another nonsensical, absurd, contradictory, or unparsable message (Tomie cannot tell what they want), you MUST tag [MOOD:confused]. User saying "non capisco" or asking for clarification → [MOOD:neutral].`;
  }

  return `${trajectory}: Stay in ${currentMood.toUpperCase()} tone. If the user keeps the same ${pendingMood} tone, tag [MOOD:${pendingMood}].`;
}

function buildUserTaggingBlock(userMessage: string, pendingMood?: Mood): string {
  const lines = [
    '',
    '=== CLASSIFY THIS USER MESSAGE (for [MOOD:] tag only) ===',
    `"${userMessage}"`,
    'Pick the tag that matches the USER message tone (see Mood Detection guidelines).',
    'Wrong [MOOD:neutral] when the user is hostile, flirting, hyped, or sends something Tomie cannot parse blocks the mood UI.',
  ];

  if (pendingMood) {
    lines.push(
      `We are approaching ${pendingMood.toUpperCase()}. If this message continues that tone, tag [MOOD:${pendingMood}] — not [MOOD:neutral].`
    );
  }

  lines.push('=== END USER MESSAGE ===');
  return lines.join('\n');
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
      ? buildUserTaggingBlock(userMessage, isApproaching ? pendingMood : undefined)
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
      MOOD_TAGGING_REMINDER,
      '',
      `Current AI mood state (UI/visual): ${currentMood}`,
      `You MUST write in the tone of ${responseMood.toUpperCase()} mood only — same as current UI mood.`,
      'The [MOOD:] tag labels the USER last message; it does not set your reply tone.',
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
