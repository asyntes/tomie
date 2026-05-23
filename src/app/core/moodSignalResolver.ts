import { Mood } from '../types/mood';
import { MoodSignal } from './moodStateMachine';

const DIRECTED_HOSTILITY =
    /\b(vaffanculo|vaffancul|fottiti|fottetevi|fuck\s*you|fuck\s*off|idiota|idioti|stupido|stupida|stupidi|stronzo|stronza|merda|bastardo|bastarda|pezzo\s+di\s+merda|cretino|imbecille|deficiente|ritardat[oa]|schifoso|schifosa|muori|muor|succhia|succhiamelo|troia|puttana|bastard|bitch|asshole|dickhead|shut\s+up|odio|ti\s+odio|sei\s+un[ao]?\s+\w*\s*(stupido|idiota|merda))\b/i;

export function inferHostileUserTone(userInput: string): Mood | null {
    const text = userInput.trim();
    if (!text) return null;
    if (DIRECTED_HOSTILITY.test(text)) return 'angry';
    return null;
}

export function resolveMoodSignal(modelTag: Mood, userInput?: string): MoodSignal {
    if (modelTag !== 'neutral' || !userInput?.trim()) {
        return { mood: modelTag, agreed: true };
    }

    const inferred = inferHostileUserTone(userInput);
    if (inferred) {
        return { mood: inferred, agreed: true };
    }

    return { mood: modelTag, agreed: true };
}
