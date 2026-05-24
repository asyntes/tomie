import { Mood } from '../types/mood';
import { MoodState } from '../types/mood';
import { systemMessages } from './systemMessages';
import {
    commitTurn,
    getApproachLabel,
    getApproachThresholdForState,
    TurnCommitResult,
} from './moodStateMachine';
import { normalizeMoodState } from './normalizeMoodState';
import { computeResponseMood } from './turnPlanner';

export const generatePredefinedResponse = (mood: Mood): string => {
    const moodResponses = systemMessages[mood];
    return moodResponses[Math.floor(Math.random() * moodResponses.length)];
};

export interface FullResponseResult {
    introResponse: string;
    aiResponse: string;
    responseMood: Mood;
    newState: MoodState;
    shouldChangeMood: boolean;
    isApproaching: boolean;
    classifiedMood: Mood;
}

interface GrokApiPayload {
    prompt: string;
    currentMood: Mood;
    responseMood: Mood;
    isApproaching?: boolean;
    pendingMood?: Mood;
    approachProgress?: number;
    approachThreshold?: number;
    approachLabel?: string;
    resolvedUserMood?: Mood;
    messages: { isUser: boolean; text: string }[];
}

async function classifyUserMood(userInput: string): Promise<Mood> {
    const response = await fetch('/api/grok/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userInput }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Mood classification failed');
    }

    const data = (await response.json()) as { mood: Mood };
    return data.mood;
}

async function callGrokApi(payload: GrokApiPayload): Promise<{ response: string; detectedMood: Mood }> {
    const response = await fetch('/api/grok', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Details:', errorText);
        let detail = errorText;
        try {
            const parsed = JSON.parse(errorText) as { error?: string };
            if (parsed.error) detail = parsed.error;
        } catch {
            /* keep raw */
        }
        throw new Error(detail);
    }

    const data = await response.json();
    return {
        response: data.response as string,
        detectedMood: data.detectedMood as Mood,
    };
}

function buildApiPayload(
    userInput: string,
    commit: TurnCommitResult,
    classifiedMood: Mood,
    messages: { isUser: boolean; text: string }[]
): GrokApiPayload {
    const s = commit.newState;
    const responseMood = computeResponseMood(commit);
    const isApproaching = s.phase === 'approaching' || s.phase === 'cooling';

    return {
        prompt: userInput,
        currentMood: s.currentMood,
        responseMood,
        isApproaching,
        pendingMood: s.pendingMood,
        approachProgress: s.progressScore,
        approachThreshold: getApproachThresholdForState(s),
        approachLabel: getApproachLabel(s),
        resolvedUserMood: classifiedMood,
        messages,
    };
}

export const generateFullResponse = async (
    userInput: string,
    moodState: MoodState,
    messages: { isUser: boolean; text: string }[] = []
): Promise<FullResponseResult> => {
    const state = normalizeMoodState(moodState);

    try {
        const classifiedMood = await classifyUserMood(userInput);
        const commit = commitTurn(state, classifiedMood);
        const responseMood = computeResponseMood(commit);

        let introResponse = '';
        if (commit.shouldChangeMood && commit.transitionTarget) {
            introResponse = generatePredefinedResponse(commit.transitionTarget);
        }

        const { response: aiResponse } = await callGrokApi(
            buildApiPayload(userInput, commit, classifiedMood, messages)
        );

        return {
            introResponse,
            aiResponse,
            responseMood,
            newState: commit.newState,
            shouldChangeMood: commit.shouldChangeMood,
            isApproaching: commit.newState.phase === 'approaching',
            classifiedMood,
        };
    } catch (error) {
        console.error('Error calling Grok API:', error);
        const detail =
            error instanceof Error ? error.message : 'Sorry, I encountered an error while processing your request.';
        return {
            introResponse: '',
            aiResponse: detail,
            responseMood: state.currentMood,
            newState: state,
            shouldChangeMood: false,
            isApproaching: false,
            classifiedMood: 'neutral',
        };
    }
};
