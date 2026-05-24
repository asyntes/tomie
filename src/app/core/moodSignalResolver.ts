import { Mood } from '../types/mood';
import { MoodSignal } from './moodStateMachine';

export function resolveMoodSignal(modelTag: Mood): MoodSignal {
    return { mood: modelTag, agreed: true };
}
