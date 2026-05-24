import { Mood } from '../../types/mood';

const VALID: Mood[] = ['neutral', 'angry', 'romantic', 'excited', 'confused'];

export const USER_MOOD_CLASSIFIER_PROMPT = `You classify the emotional tone of a USER message for a chat UI mood meter.

Reply with exactly ONE word from this list only: angry, romantic, excited, confused, neutral

Rules:
- angry: insults, swearing at the bot, hostility, hate, threats
- romantic: ti amo, ti desidero, love, desire, explicit flirt toward the bot
- excited: WOW, hype, celebration, many exclamation marks, great news energy
- confused: non capisco, sono perso, what do you mean, needs clarification, lost
- neutral: normal chat, thanks, factual questions, mild compliments without strong emotion

No punctuation. No explanation. One word only.`;

export function parseClassifierMood(text: string): Mood {
    const token = text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
    if (VALID.includes(token as Mood)) {
        return token as Mood;
    }
    return 'neutral';
}
