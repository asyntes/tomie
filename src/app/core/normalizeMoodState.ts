import { MoodState } from '../types/mood';
import { createInitialMoodState } from './moodStateMachine';

export function normalizeMoodState(state: MoodState | null | undefined): MoodState {
    if (!state?.currentMood) {
        return createInitialMoodState();
    }

    const initial = createInitialMoodState();

    return {
        currentMood: state.currentMood,
        scores: { ...initial.scores, ...state.scores },
        lastDetectedMood: state.lastDetectedMood ?? state.currentMood,
        phase: state.phase ?? 'stable',
        pendingMood: state.pendingMood,
        progressScore: typeof state.progressScore === 'number' ? state.progressScore : 0,
    };
}
