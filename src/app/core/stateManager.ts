import { Mood } from '../types/mood';
import { MoodState } from '../types/mood';
import { commitTurn, createInitialMoodState } from './moodStateMachine';

export { createInitialMoodState };

export const updateMoodState = (
    currentState: MoodState,
    modelTag: Mood
): { newState: MoodState; shouldChangeMood: boolean } => {
    const result = commitTurn(currentState, modelTag);
    return {
        newState: result.newState,
        shouldChangeMood: result.shouldChangeMood,
    };
};
