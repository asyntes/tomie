import { Mood } from '../types/mood';
import { MoodState } from '../types/mood';
import { resolveMoodSignal } from './moodSignalResolver';

export const MOOD_TRANSITION_CONFIG = {
    enterFromNeutral: { angry: 2, romantic: 2, excited: 2, confused: 2 } as Record<Mood, number>,
    exitToNeutral: { angry: 2, romantic: 2, excited: 2, confused: 2 } as Record<Mood, number>,
    decayOnMismatch: 1,
};

const NON_NEUTRAL_MOODS: Mood[] = ['angry', 'romantic', 'excited', 'confused'];

export interface MoodSignal {
    mood: Mood;
    agreed: boolean;
}

export interface TurnPreview {
    responseMood: Mood;
    isApproaching: boolean;
    pendingMood?: Mood;
    progress: number;
    threshold: number;
    willTransition: boolean;
    transitionTarget?: Mood;
}

export interface TurnCommitResult {
    newState: MoodState;
    shouldChangeMood: boolean;
    transitionTarget?: Mood;
}

export function createInitialMoodState(): MoodState {
    return {
        currentMood: 'neutral',
        scores: {
            neutral: 0,
            angry: 0,
            romantic: 0,
            excited: 0,
            confused: 0,
        },
        lastDetectedMood: 'neutral',
        phase: 'stable',
        progressScore: 0,
    };
}

export function getEnterThreshold(mood: Mood): number {
    if (mood === 'neutral') return Infinity;
    return MOOD_TRANSITION_CONFIG.enterFromNeutral[mood];
}

export function getApproachThresholdForState(state: MoodState): number | undefined {
    if (state.phase === 'approaching' && state.pendingMood) {
        return getEnterThreshold(state.pendingMood);
    }
    if (state.phase === 'cooling') {
        return getExitThreshold(state.currentMood);
    }
    return undefined;
}

function getExitThreshold(mood: Mood): number {
    if (mood === 'neutral') return Infinity;
    return MOOD_TRANSITION_CONFIG.exitToNeutral[mood];
}

function decayProgress(state: MoodState, amount: number): MoodState {
    const progressScore = Math.max(0, state.progressScore - amount);
    if (progressScore === 0 && state.phase !== 'stable') {
        return {
            ...state,
            progressScore: 0,
            phase: 'stable',
            pendingMood: undefined,
        };
    }
    return { ...state, progressScore };
}

function buildEnteredMoodState(state: MoodState, target: Mood): MoodState {
    return {
        ...state,
        currentMood: target,
        phase: 'stable',
        pendingMood: undefined,
        progressScore: 0,
        lastDetectedMood: target,
        scores: {
            neutral: 0,
            angry: 0,
            romantic: 0,
            excited: 0,
            confused: 0,
            [target]: 0,
        },
    };
}

function applyEnterFromNeutral(
    state: MoodState,
    signal: MoodSignal
): { state: MoodState; willTransition: boolean; target?: Mood } {
    const target = signal.mood;
    if (target === 'neutral') {
        if (state.phase === 'approaching') {
            return {
                state: { ...state, lastDetectedMood: 'neutral' },
                willTransition: false,
            };
        }
        return { state: decayProgress(state, MOOD_TRANSITION_CONFIG.decayOnMismatch), willTransition: false };
    }

    const threshold = getEnterThreshold(target);

    if (state.pendingMood && state.pendingMood !== target) {
        const progressScore = 1;
        if (progressScore >= threshold) {
            return {
                state: buildEnteredMoodState(state, target),
                willTransition: true,
                target,
            };
        }
        return {
            state: {
                ...state,
                pendingMood: target,
                phase: 'approaching',
                progressScore: 1,
                lastDetectedMood: target,
            },
            willTransition: false,
        };
    }

    if (state.pendingMood === target && state.phase === 'approaching') {
        const progressScore = state.progressScore + 1;
        if (progressScore >= threshold) {
            return {
                state: buildEnteredMoodState(state, target),
                willTransition: true,
                target,
            };
        }
        return {
            state: { ...state, progressScore, lastDetectedMood: target },
            willTransition: false,
        };
    }

    if (1 >= threshold) {
        return {
            state: buildEnteredMoodState(state, target),
            willTransition: true,
            target,
        };
    }

    return {
        state: {
            ...state,
            pendingMood: target,
            phase: 'approaching',
            progressScore: 1,
            lastDetectedMood: target,
        },
        willTransition: false,
    };
}

function applyExitToNeutral(
    state: MoodState,
    signal: MoodSignal
): { state: MoodState; willTransition: boolean; target?: Mood } {
    const current = state.currentMood;
    if (current === 'neutral') {
        return { state, willTransition: false };
    }

    if (signal.mood === current) {
        return {
            state: {
                ...state,
                phase: 'stable',
                pendingMood: undefined,
                progressScore: 0,
                lastDetectedMood: current,
            },
            willTransition: false,
        };
    }

    const isDeescalation = signal.mood === 'neutral';
    if (!isDeescalation && signal.mood !== current) {
        if (signal.mood === 'angry') {
            const alreadyApproachingAngry =
                state.phase === 'approaching' && state.pendingMood === 'angry';
            return applyEnterFromNeutral(
                alreadyApproachingAngry
                    ? state
                    : {
                          ...state,
                          phase: 'stable',
                          pendingMood: undefined,
                          progressScore: 0,
                      },
                signal
            );
        }
        return {
            state: decayProgress(state, MOOD_TRANSITION_CONFIG.decayOnMismatch),
            willTransition: false,
        };
    }

    if (!isDeescalation) {
        return {
            state: decayProgress(state, MOOD_TRANSITION_CONFIG.decayOnMismatch),
            willTransition: false,
        };
    }

    const threshold = getExitThreshold(current);

    if (state.phase === 'cooling' && state.pendingMood === 'neutral') {
        const progressScore = state.progressScore + 1;
        if (progressScore >= threshold) {
            const newState: MoodState = {
                ...state,
                currentMood: 'neutral',
                phase: 'stable',
                pendingMood: undefined,
                progressScore: 0,
                lastDetectedMood: 'neutral',
                scores: {
                    neutral: 0,
                    angry: 0,
                    romantic: 0,
                    excited: 0,
                    confused: 0,
                },
            };
            return { state: newState, willTransition: true, target: 'neutral' };
        }
        return {
            state: { ...state, progressScore, lastDetectedMood: 'neutral' },
            willTransition: false,
        };
    }

    return {
        state: {
            ...state,
            phase: 'cooling',
            pendingMood: 'neutral',
            progressScore: 1,
            lastDetectedMood: 'neutral',
        },
        willTransition: false,
    };
}

function applyTurn(state: MoodState, signal: MoodSignal): TurnCommitResult {
    if (state.currentMood === 'neutral') {
        const { state: next, willTransition, target } = applyEnterFromNeutral(state, signal);
        return {
            newState: next,
            shouldChangeMood: willTransition,
            transitionTarget: target,
        };
    }

    const { state: next, willTransition, target } = applyExitToNeutral(state, signal);
    return {
        newState: next,
        shouldChangeMood: willTransition,
        transitionTarget: target,
    };
}

export function buildMoodSignal(modelTag: Mood): MoodSignal {
    return resolveMoodSignal(modelTag);
}

export function previewTurn(state: MoodState): TurnPreview {
    const threshold = getApproachThresholdForState(state) ?? 2;

    if (state.phase === 'approaching' && state.pendingMood) {
        const simulated = applyTurn(state, { mood: state.pendingMood, agreed: true });
        const willTransition = simulated.shouldChangeMood;
        const transitionTarget = simulated.transitionTarget;
        return {
            responseMood: state.currentMood,
            isApproaching: true,
            pendingMood: state.pendingMood,
            progress: state.progressScore,
            threshold,
            willTransition,
            transitionTarget,
        };
    }

    if (state.phase === 'cooling') {
        const simulated = applyTurn(state, { mood: 'neutral', agreed: true });
        return {
            responseMood: state.currentMood,
            isApproaching: false,
            pendingMood: state.pendingMood,
            progress: state.progressScore,
            threshold,
            willTransition: simulated.shouldChangeMood,
            transitionTarget: simulated.transitionTarget,
        };
    }

    return {
        responseMood: state.currentMood,
        isApproaching: false,
        pendingMood: undefined,
        progress: 0,
        threshold,
        willTransition: false,
    };
}

export function commitTurn(state: MoodState, modelTag: Mood): TurnCommitResult {
    const signal = buildMoodSignal(modelTag);
    return applyTurn(state, signal);
}

export function getApproachLabel(state: MoodState): string | undefined {
    if (state.phase === 'approaching' && state.pendingMood) {
        const threshold = getEnterThreshold(state.pendingMood);
        return `Approaching ${state.pendingMood} (${state.progressScore}/${threshold})`;
    }
    if (state.phase === 'cooling') {
        const threshold = getExitThreshold(state.currentMood);
        return `Cooling to neutral (${state.progressScore}/${threshold})`;
    }
    return undefined;
}

export { NON_NEUTRAL_MOODS };
