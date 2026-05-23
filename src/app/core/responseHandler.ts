import { Mood } from '../types/mood';
import { MoodState } from '../types/mood';
import { systemMessages } from './systemMessages';
import { commitTurn, getApproachLabel, getApproachThresholdForState } from './moodStateMachine';
import { normalizeMoodState } from './normalizeMoodState';

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
    messages: { isUser: boolean; text: string }[];
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
    state: MoodState,
    messages: { isUser: boolean; text: string }[]
): GrokApiPayload {
    const isApproaching = state.phase === 'approaching';
    const isCooling = state.phase === 'cooling';

    return {
        prompt: userInput,
        currentMood: state.currentMood,
        responseMood: state.currentMood,
        isApproaching: isApproaching || isCooling,
        pendingMood: state.pendingMood,
        approachProgress: state.progressScore,
        approachThreshold: getApproachThresholdForState(state),
        approachLabel: getApproachLabel(state),
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
        const first = await callGrokApi(buildApiPayload(userInput, state, messages));
        const commit = commitTurn(state, first.detectedMood, userInput);

        let introResponse = '';
        let aiResponse = first.response;
        let responseMood = commit.newState.currentMood;

        if (commit.shouldChangeMood && commit.transitionTarget) {
            introResponse = generatePredefinedResponse(commit.transitionTarget);
            responseMood = commit.transitionTarget;

            const settled = await callGrokApi({
                ...buildApiPayload(userInput, commit.newState, messages),
                currentMood: commit.transitionTarget,
                responseMood: commit.transitionTarget,
                isApproaching: false,
                pendingMood: undefined,
                approachProgress: 0,
                approachThreshold: undefined,
                approachLabel: undefined,
            });
            aiResponse = settled.response;
        }

        return {
            introResponse,
            aiResponse,
            responseMood,
            newState: commit.newState,
            shouldChangeMood: commit.shouldChangeMood,
            isApproaching: commit.newState.phase === 'approaching',
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
        };
    }
};
