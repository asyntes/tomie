import { Mood } from '../../types/mood';

const VALID: Mood[] = ['neutral', 'angry', 'romantic', 'excited', 'confused'];

export const USER_MOOD_CLASSIFIER_PROMPT = `You classify the USER message for a chat UI mood meter.

Reply with exactly ONE word from this list only: angry, romantic, excited, confused, neutral

Rules:
- angry: insults, swearing at the bot, hostility, hate, threats
- romantic: ti amo, ti desidero, love, desire, explicit flirt toward the bot
- excited: WOW, hype, celebration, many exclamation marks, great news energy
- confused: the message would confuse TOMIE (the bot) — nonsensical, contradictory, absurd, vague word salad, gibberish, impossible or unparsable requests. Tomie cannot tell what the user wants.
  Examples: "fai la cosa col coso di prima", random keyboard mash, paradoxes, mixing unrelated nonsense, "sposta il buffer nel martedì"
- neutral: normal chat, thanks, clear questions, help requests, user saying THEY are lost or don't understand ("non capisco", "sono perso", "spiegati", "cosa intendi") — Tomie should answer normally, not be confused herself

No punctuation. No explanation. One word only.`;

export function parseClassifierMood(text: string): Mood {
    const token = text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
    if (VALID.includes(token as Mood)) {
        return token as Mood;
    }
    return 'neutral';
}
