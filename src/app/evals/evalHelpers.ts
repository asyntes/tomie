import { GrokService } from '../services/ai/grokService';
import { Mood } from '../types/mood';
import { MoodState, MoodPhase } from '../types/mood';
import {
    commitTurn,
    createInitialMoodState,
    getApproachLabel,
    getApproachThresholdForState,
} from '../core/moodStateMachine';
import { normalizeMoodState } from '../core/normalizeMoodState';
import { ConversationMessage } from '../types/ai';

export interface TomieTurnResult {
    responseText: string;
    detectedMood: Mood;
    responseMood: Mood;
    newState: MoodState;
    shouldChangeMood: boolean;
    userInput: string;
}

export interface SimulatedStep {
    modelTag: Mood;
    label?: string;
    userInput?: string;
}

export interface TransitionTraceRow {
    step: number;
    label: string;
    userInput: string;
    modelTag: Mood;
    expectedMood: Mood;
    expectedTransition: boolean;
    actualMood: Mood;
    actualTransition: boolean;
    phase: MoodPhase;
    pendingMood?: Mood;
    progress: number;
    ok: boolean;
}

export interface SimulatedRunLog {
    step: number;
    label: string;
    modelTag: Mood;
    before: { currentMood: Mood; phase: MoodPhase; pendingMood?: Mood; progress: number };
    after: { currentMood: Mood; phase: MoodPhase; pendingMood?: Mood; progress: number };
    shouldChangeMood: boolean;
}

export async function runTomieTurn(
    userInput: string,
    moodState: MoodState,
    messages: ConversationMessage[] = []
): Promise<TomieTurnResult> {
    const state = normalizeMoodState(moodState);
    const grok = GrokService.createFromEnv();
    const isApproaching = state.phase === 'approaching' || state.phase === 'cooling';

    const buildPayload = (s: MoodState, mood: Mood, approaching: boolean) => ({
        prompt: userInput,
        currentMood: s.currentMood,
        responseMood: mood,
        isApproaching: approaching,
        pendingMood: s.pendingMood,
        approachProgress: s.progressScore,
        approachThreshold: getApproachThresholdForState(s),
        approachLabel: getApproachLabel(s),
        messages,
    });

    const first = await grok.generateResponse({
        ...buildPayload(state, state.currentMood, isApproaching),
    });

    const commit = commitTurn(state, first.detectedMood, userInput);
    let responseText = first.response;
    let detectedMood = first.detectedMood;

    if (commit.shouldChangeMood && commit.transitionTarget) {
        const settled = await grok.generateResponse({
            ...buildPayload(commit.newState, commit.transitionTarget, false),
            currentMood: commit.transitionTarget,
            responseMood: commit.transitionTarget,
            isApproaching: false,
            pendingMood: undefined,
            approachProgress: 0,
            approachThreshold: undefined,
            approachLabel: undefined,
        });
        responseText = settled.response;
        detectedMood = settled.detectedMood;
    }

    return {
        responseText,
        detectedMood,
        responseMood: commit.newState.currentMood,
        newState: commit.newState,
        shouldChangeMood: commit.shouldChangeMood,
        userInput,
    };
}

export function runSimulatedScript(steps: SimulatedStep[]): {
    finalState: MoodState;
    log: SimulatedRunLog[];
} {
    let state = createInitialMoodState();
    const log: SimulatedRunLog[] = [];

    steps.forEach((step, index) => {
        const before = snapshot(state);
        const commit = commitTurn(state, step.modelTag, step.userInput);
        state = commit.newState;
        log.push({
            step: index + 1,
            label: step.label ?? step.modelTag,
            modelTag: step.modelTag,
            before,
            after: snapshot(state),
            shouldChangeMood: commit.shouldChangeMood,
        });
    });

    return { finalState: state, log };
}

function snapshot(state: MoodState) {
    return {
        currentMood: state.currentMood,
        phase: state.phase,
        pendingMood: state.pendingMood,
        progress: state.progressScore,
    };
}

export async function runLlmScript(
    inputs: { text: string; label: string }[],
    initialState: MoodState = createInitialMoodState()
): Promise<{ finalState: MoodState; turns: TomieTurnResult[] }> {
    let state = normalizeMoodState(initialState);
    const turns: TomieTurnResult[] = [];

    for (const { text, label } of inputs) {
        const turn = await runTomieTurn(text, state);
        turns.push({ ...turn, userInput: `${label}: ${text}` });
        state = turn.newState;
    }

    return { finalState: state, turns };
}

export function formatState(state: MoodState): string {
    return JSON.stringify({
        currentMood: state.currentMood,
        phase: state.phase,
        pendingMood: state.pendingMood ?? null,
        progressScore: state.progressScore,
    });
}

export function formatTraceTable(rows: TransitionTraceRow[]): string {
    const header =
        'step | label | expected→actual | transition | tag | phase | pending | prog | ok';
    const lines = rows.map((r) =>
        [
            String(r.step).padStart(4),
            r.label.padEnd(12),
            `${r.expectedMood}→${r.actualMood}`.padEnd(14),
            `${r.expectedTransition ? 'Y' : 'n'}→${r.actualTransition ? 'Y' : 'n'}`,
            r.modelTag.padEnd(8),
            r.phase.padEnd(11),
            (r.pendingMood ?? '-').padEnd(8),
            String(r.progress),
            r.ok ? 'OK' : 'FAIL',
        ].join(' | ')
    );
    return [header, ...lines].join('\n');
}

export async function runTracedConversation(
    steps: {
        label: string;
        userInput: string;
        expectedMood: Mood;
        expectedTransition: boolean;
    }[],
    initialState: MoodState = createInitialMoodState()
): Promise<{ rows: TransitionTraceRow[]; finalState: MoodState }> {
    let state = normalizeMoodState(initialState);
    const rows: TransitionTraceRow[] = [];
    let stepNum = 0;

    for (const step of steps) {
        stepNum += 1;
        const turn = await runTomieTurn(step.userInput, state);
        const row: TransitionTraceRow = {
            step: stepNum,
            label: step.label,
            userInput: step.userInput,
            modelTag: turn.detectedMood,
            expectedMood: step.expectedMood,
            expectedTransition: step.expectedTransition,
            actualMood: turn.newState.currentMood,
            actualTransition: turn.shouldChangeMood,
            phase: turn.newState.phase,
            pendingMood: turn.newState.pendingMood,
            progress: turn.newState.progressScore,
            ok:
                turn.newState.currentMood === step.expectedMood &&
                turn.shouldChangeMood === step.expectedTransition,
        };
        rows.push(row);
        state = turn.newState;
    }

    return { rows, finalState: state };
}

export function runTracedSimulated(
    steps: {
        label: string;
        userInput?: string;
        modelTag: Mood;
        expectedMood: Mood;
        expectedTransition: boolean;
    }[]
): { rows: TransitionTraceRow[]; finalState: MoodState } {
    let state = createInitialMoodState();
    const rows: TransitionTraceRow[] = [];

    steps.forEach((step, index) => {
        const commit = commitTurn(state, step.modelTag, step.userInput);
        state = commit.newState;
        const row: TransitionTraceRow = {
            step: index + 1,
            label: step.label,
            userInput: step.userInput ?? '',
            modelTag: step.modelTag,
            expectedMood: step.expectedMood,
            expectedTransition: step.expectedTransition,
            actualMood: state.currentMood,
            actualTransition: commit.shouldChangeMood,
            phase: state.phase,
            pendingMood: state.pendingMood,
            progress: state.progressScore,
            ok:
                state.currentMood === step.expectedMood &&
                commit.shouldChangeMood === step.expectedTransition,
        };
        rows.push(row);
    });

    return { rows, finalState: state };
}

export function assertTraceAllOk(rows: TransitionTraceRow[], context: string): void {
    const failed = rows.filter((r) => !r.ok);
    if (failed.length > 0) {
        throw new Error(
            `${context}\n${formatTraceTable(rows)}\nFailed steps: ${failed.map((r) => r.label).join(', ')}`
        );
    }
}
