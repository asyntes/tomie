import { Mood } from '../types/mood';
import { MoodState } from '../types/mood';
import { TurnCommitResult } from './moodStateMachine';

export function computeResponseMood(commit: TurnCommitResult): Mood {
    if (commit.shouldChangeMood && commit.transitionTarget) {
        return commit.transitionTarget;
    }

    const s = commit.newState;
    if (
        (s.phase === 'approaching' || s.phase === 'cooling') &&
        s.pendingMood &&
        s.pendingMood !== s.currentMood
    ) {
        return 'neutral';
    }

    return s.currentMood;
}

export function buildPromptState(commit: TurnCommitResult): MoodState {
    return commit.newState;
}
