import { describe, it, expect } from 'vitest';
import {
  createInitialMoodState,
  commitTurn,
  previewTurn,
} from '../moodStateMachine';

describe('moodStateMachine', () => {
  it('does not transition to angry on first model angry tag', () => {
    const commit = commitTurn(createInitialMoodState(), 'angry');
    expect(commit.shouldChangeMood).toBe(false);
    expect(commit.newState.currentMood).toBe('neutral');
    expect(commit.newState.phase).toBe('approaching');
    expect(commit.newState.pendingMood).toBe('angry');
    expect(commit.newState.progressScore).toBe(1);
  });

  it('transitions to angry after two model angry tags', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'angry').newState;

    const preview = previewTurn(state);
    expect(preview.willTransition).toBe(true);
    expect(preview.responseMood).toBe('neutral');

    const commit = commitTurn(state, 'angry');
    expect(commit.shouldChangeMood).toBe(true);
    expect(commit.newState.currentMood).toBe('angry');
  });

  it('does not progress toward angry when model tags neutral', () => {
    const commit = commitTurn(createInitialMoodState(), 'neutral');
    expect(commit.shouldChangeMood).toBe(false);
    expect(commit.newState.phase).toBe('stable');
    expect(commit.newState.pendingMood).toBeUndefined();
  });

  it('holds romantic approaching progress when model returns neutral', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'romantic').newState;
    expect(state.progressScore).toBe(1);
    const commit = commitTurn(state, 'neutral');
    expect(commit.shouldChangeMood).toBe(false);
    expect(commit.newState.currentMood).toBe('neutral');
    expect(commit.newState.phase).toBe('approaching');
    expect(commit.newState.progressScore).toBe(1);
    expect(commit.newState.pendingMood).toBe('romantic');
  });

  it('requires two romantic tags to enter romantic', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'romantic').newState;
    expect(state.currentMood).toBe('neutral');
    const commit = commitTurn(state, 'romantic');
    expect(commit.shouldChangeMood).toBe(true);
    expect(commit.newState.currentMood).toBe('romantic');
  });

  it('requires two excited tags to enter excited', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'excited').newState;
    const commit = commitTurn(state, 'excited');
    expect(commit.shouldChangeMood).toBe(true);
    expect(commit.newState.currentMood).toBe('excited');
  });

    it('enters confused on first confused tag from neutral', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'confused').newState;
    expect(state.currentMood).toBe('neutral');
    expect(state.phase).toBe('approaching');
    expect(state.pendingMood).toBe('confused');

    const commit = commitTurn(state, 'confused');
    expect(commit.shouldChangeMood).toBe(true);
    expect(commit.newState.currentMood).toBe('confused');
  });

  it('exits angry to neutral after two model neutral tags', () => {
    let state = createInitialMoodState();
    state = commitTurn(state, 'angry').newState;
    state = commitTurn(state, 'angry').newState;
    expect(state.currentMood).toBe('angry');

    state = commitTurn(state, 'neutral').newState;
    const commit = commitTurn(state, 'neutral');
    expect(commit.shouldChangeMood).toBe(true);
    expect(commit.newState.currentMood).toBe('neutral');
  });

  it('romantic approaching does not change currentMood until threshold', () => {
    const commit = commitTurn(createInitialMoodState(), 'romantic');
    expect(commit.newState.currentMood).toBe('neutral');
    expect(commit.newState.phase).toBe('approaching');
  });
});
