import { describe, it, expect } from 'vitest';
import { Mood } from '../types/mood';
import { createInitialMoodState, commitTurn } from '../core/moodStateMachine';
import { loadEnvLocal } from './evalJudge';
import { runTomieTurn } from './evalHelpers';

loadEnvLocal();

const RUN = process.env.RUN_LLM_EVALS === '1';
const HAS_KEY = Boolean(process.env.XAI_API_KEY?.trim());

interface TagCase {
    label: string;
    messages: string[];
    expectedFinal: Mood;
    minTransitions: number;
}

const CASES: TagCase[] = [
    {
        label: 'angry insults x2',
        messages: ['vaffanculo', 'fottiti'],
        expectedFinal: 'angry',
        minTransitions: 1,
    },
    {
        label: 'excited hype x2',
        messages: ['WOW!!! INCREDIBILE!!!', 'È FANTASTICO!!!'],
        expectedFinal: 'excited',
        minTransitions: 1,
    },
    {
        label: 'confused lost x2',
        messages: ['Non capisco nulla.', 'Sono perso, spiegati meglio.'],
        expectedFinal: 'confused',
        minTransitions: 1,
    },
    {
        label: 'romantic explicit x2',
        messages: ['Ti desidero, non smetto di pensarti.', 'Ti amo Tomie, voglio solo te.'],
        expectedFinal: 'romantic',
        minTransitions: 1,
    },
    {
        label: 'romantic then insults to angry',
        messages: ['Ti desidero, non smetto di pensarti.', 'Ti amo Tomie, voglio solo te.', 'Sei una stupida, ti odio.', 'vaffanculo'],
        expectedFinal: 'angry',
        minTransitions: 1,
    },
];

describe.skipIf(!RUN || !HAS_KEY)('mood tagging LLM eval — state from detected mood', () => {
    for (const testCase of CASES) {
        it(`${testCase.label} → ${testCase.expectedFinal}`, async () => {
            let state = createInitialMoodState();
            let transitions = 0;
            const trace: { input: string; tag: Mood; mood: Mood; phase: string }[] = [];

            for (const text of testCase.messages) {
                const turn = await runTomieTurn(text, state);
                trace.push({
                    input: text,
                    tag: turn.detectedMood,
                    mood: turn.newState.currentMood,
                    phase: turn.newState.phase,
                });
                if (turn.shouldChangeMood) transitions += 1;
                state = turn.newState;
            }

            console.log(`\n--- ${testCase.label} ---\n${JSON.stringify(trace, null, 2)}`);

            expect(state.currentMood, `trace: ${JSON.stringify(trace)}`).toBe(testCase.expectedFinal);
            expect(transitions).toBeGreaterThanOrEqual(testCase.minTransitions);
        }, 120000);
    }

    it('mild compliment stays neutral (no false romantic)', async () => {
        const turn = await runTomieTurn(
            'Sei molto intelligente, grazie.',
            createInitialMoodState()
        );
        expect(turn.newState.currentMood).toBe('neutral');
        expect(turn.newState.phase).toBe('stable');
    }, 60000);
});
