import { describe, it, expect } from 'vitest';
import { createInitialMoodState, commitTurn } from '../moodStateMachine';

describe('cross-mood transitions (simulated tags)', () => {
    it('cannot jump angry to excited without neutral', () => {
        let s = createInitialMoodState();
        s = commitTurn(s, 'angry').newState;
        s = commitTurn(s, 'angry').newState;
        expect(s.currentMood).toBe('angry');

        s = commitTurn(s, 'excited').newState;
        expect(s.currentMood).toBe('angry');
        expect(s.phase).not.toBe('approaching');
    });

    it('angry then neutral x2 then excited x2', () => {
        let s = createInitialMoodState();
        s = commitTurn(s, 'angry').newState;
        s = commitTurn(s, 'angry').newState;
        s = commitTurn(s, 'neutral').newState;
        s = commitTurn(s, 'neutral').newState;
        expect(s.currentMood).toBe('neutral');

        s = commitTurn(s, 'excited').newState;
        s = commitTurn(s, 'excited').newState;
        expect(s.currentMood).toBe('excited');
    });

    it('switching romantic approaching to angry needs two insult tags', () => {
        let s = commitTurn(createInitialMoodState(), 'romantic').newState;
        expect(s.pendingMood).toBe('romantic');
        expect(s.progressScore).toBe(1);

        s = commitTurn(s, 'angry').newState;
        expect(s.pendingMood).toBe('angry');
        expect(s.progressScore).toBe(1);
        expect(s.currentMood).toBe('neutral');

        s = commitTurn(s, 'angry').newState;
        expect(s.currentMood).toBe('angry');
    });

    it('romantic stable plus two angry tags switches to angry', () => {
        let s = createInitialMoodState();
        s = commitTurn(s, 'romantic').newState;
        s = commitTurn(s, 'romantic').newState;
        s = commitTurn(s, 'romantic').newState;
        expect(s.currentMood).toBe('romantic');

        s = commitTurn(s, 'angry').newState;
        expect(s.currentMood).toBe('romantic');
        expect(s.pendingMood).toBe('angry');
        expect(s.phase).toBe('approaching');

        s = commitTurn(s, 'angry').newState;
        expect(s.currentMood).toBe('angry');
    });

    it('romantic approaching does not change currentMood until threshold', () => {
        let s = commitTurn(createInitialMoodState(), 'romantic').newState;
        expect(s.currentMood).toBe('neutral');
        s = commitTurn(s, 'romantic').newState;
        expect(s.currentMood).toBe('neutral');
        s = commitTurn(s, 'romantic').newState;
        expect(s.currentMood).toBe('romantic');
    });
});
