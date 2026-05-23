import { describe, it, expect } from 'vitest';
import { createInitialMoodState, commitTurn } from '../moodStateMachine';

function simulateThread(modelTags: Parameters<typeof commitTurn>[1][]) {
    let state = createInitialMoodState();
    const commits = [];
    for (const tag of modelTags) {
        const commit = commitTurn(state, tag);
        state = commit.newState;
        commits.push(commit);
    }
    return { state, commits };
}

describe('mood transition scenarios (model tags only)', () => {
    it('two angry tags reach angry', () => {
        const { state, commits } = simulateThread(['angry', 'angry']);
        expect(commits[0].shouldChangeMood).toBe(false);
        expect(commits[1].shouldChangeMood).toBe(true);
        expect(state.currentMood).toBe('angry');
    });

    it('single romantic tag stays neutral', () => {
        const { state } = simulateThread(['romantic']);
        expect(state.currentMood).toBe('neutral');
        expect(state.phase).toBe('approaching');
    });
});
