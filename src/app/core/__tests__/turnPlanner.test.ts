import { describe, it, expect } from 'vitest';
import { createInitialMoodState, commitTurn } from '../moodStateMachine';
import { computeResponseMood } from '../turnPlanner';

describe('turnPlanner', () => {
    it('uses neutral tone when romantic approaching angry', () => {
        let state = createInitialMoodState();
        state = commitTurn(state, 'romantic').newState;
        state = commitTurn(state, 'romantic').newState;
        expect(state.currentMood).toBe('romantic');

        const commit = commitTurn(state, 'angry');
        expect(commit.newState.pendingMood).toBe('angry');
        expect(computeResponseMood(commit)).toBe('neutral');
    });

    it('uses angry tone when romantic transitions to angry', () => {
        let state = createInitialMoodState();
        state = commitTurn(state, 'romantic').newState;
        state = commitTurn(state, 'romantic').newState;
        state = commitTurn(state, 'angry').newState;

        const commit = commitTurn(state, 'angry');
        expect(commit.shouldChangeMood).toBe(true);
        expect(computeResponseMood(commit)).toBe('angry');
    });
});
