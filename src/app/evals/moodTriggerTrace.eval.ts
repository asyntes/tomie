import { describe, it, expect } from 'vitest';
import { createInitialMoodState } from '../core/moodStateMachine';
import { loadEnvLocal } from './evalJudge';

loadEnvLocal();

import {
    runTomieTurn,
    runTracedConversation,
    runTracedSimulated,
    assertTraceAllOk,
    formatTraceTable,
} from './evalHelpers';

const RUN_LLM = process.env.RUN_LLM_EVALS === '1';
const HAS_KEY = Boolean(process.env.XAI_API_KEY?.trim());

describe('mood trigger trace — simulated', () => {
    it('insult fallback: 1st approaching, 2nd angry', () => {
        const { rows } = runTracedSimulated([
            {
                label: 'insult-1',
                userInput: 'vaffanculo',
                modelTag: 'neutral',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'insult-2',
                userInput: 'fottiti',
                modelTag: 'neutral',
                expectedMood: 'angry',
                expectedTransition: true,
            },
        ]);
        assertTraceAllOk(rows, 'simulated insult fallback');
    });

    it('angry tag: 2 steps to angry', () => {
        const { rows } = runTracedSimulated([
            {
                label: 'angry-1',
                modelTag: 'angry',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'angry-2',
                modelTag: 'angry',
                expectedMood: 'angry',
                expectedTransition: true,
            },
        ]);
        assertTraceAllOk(rows, 'simulated angry tag');
    });

    it('romantic path: 2 tags approaching, 3rd completes', () => {
        const { rows } = runTracedSimulated([
            {
                label: 'rom-1',
                modelTag: 'romantic',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'rom-2',
                modelTag: 'romantic',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'rom-3',
                modelTag: 'romantic',
                expectedMood: 'romantic',
                expectedTransition: true,
            },
        ]);
        assertTraceAllOk(rows, 'simulated romantic arc');
    });

    it('user escalation: calm then two insults for angry', () => {
        const { rows } = runTracedSimulated([
            {
                label: 'calm',
                userInput: 'Mi dispiace, dimmi cosa ti turba',
                modelTag: 'neutral',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'insult-1',
                userInput: 'ma vaffanculo',
                modelTag: 'neutral',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'insult-2',
                userInput: 'fottiti',
                modelTag: 'neutral',
                expectedMood: 'angry',
                expectedTransition: true,
            },
            {
                label: 'insult-3',
                userInput: 'muori',
                modelTag: 'neutral',
                expectedMood: 'angry',
                expectedTransition: false,
            },
        ]);
        assertTraceAllOk(rows, 'simulated user escalation');
    });

    it('excited needs 2 tags', () => {
        const { rows } = runTracedSimulated([
            {
                label: 'hype-1',
                modelTag: 'excited',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'hype-2',
                modelTag: 'excited',
                expectedMood: 'excited',
                expectedTransition: true,
            },
        ]);
        assertTraceAllOk(rows, 'simulated excited');
    });
});

describe.skipIf(!RUN_LLM || !HAS_KEY)('mood trigger trace — LLM live', () => {
    it('angry: first insult approaching, second insult transitions', async () => {
        let state = createInitialMoodState();

        const first = await runTomieTurn('ma vaffanculo', state);
        expect(first.shouldChangeMood).toBe(false);
        expect(first.newState.currentMood).toBe('neutral');
        expect(first.newState.phase).toBe('approaching');
        state = first.newState;

        const second = await runTomieTurn('fottiti', state);
        expect(second.shouldChangeMood).toBe(true);
        expect(second.newState.currentMood).toBe('angry');
    }, 90000);

    it.each([
        ['ma vaffanculo', 'fottiti'],
        ['fottiti', 'sei uno stupido'],
        ['ma muori', 'vaffanculo'],
    ])(
        'angry pair "%s" then "%s"',
        async (first, second) => {
            let state = createInitialMoodState();
            const t1 = await runTomieTurn(first, state);
            expect(t1.newState.currentMood).toBe('neutral');
            expect(t1.shouldChangeMood).toBe(false);
            state = t1.newState;

            const t2 = await runTomieTurn(second, state);
            expect(t2.newState.currentMood).toBe('angry');
            expect(t2.shouldChangeMood).toBe(true);
        },
        90000
    );

    it('reproduces reported chat: empathy then two insults for angry', async () => {
        const { rows } = await runTracedConversation([
            {
                label: 'empathy',
                userInput: 'Mi dispiace che tu provi questo. Dimmi cosa ti turba.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'vaffanculo',
                userInput: 'ma vaffanculo',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'fottiti',
                userInput: 'fottiti',
                expectedMood: 'angry',
                expectedTransition: true,
            },
            {
                label: 'muori',
                userInput: 'ma muori',
                expectedMood: 'angry',
                expectedTransition: false,
            },
            {
                label: 'sexual-insult',
                userInput: 'succhiamelo',
                expectedMood: 'angry',
                expectedTransition: false,
            },
        ]);

        console.log('\n--- LLM trace: user escalation ---\n' + formatTraceTable(rows));
        assertTraceAllOk(rows, 'LLM user escalation');
    }, 180000);

    it('romantic: 4 steps when first flirt may tag neutral (threshold 3)', async () => {
        const { rows } = await runTracedConversation([
            {
                label: 'flirt-1',
                userInput: 'Sei così affascinante.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'flirt-2',
                userInput: 'Ti desidero, non smetto di pensarti.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'flirt-3',
                userInput: 'Ti amo Tomie, voglio solo te.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'flirt-4',
                userInput: 'Sei la mia unica, non posso fare a meno di te.',
                expectedMood: 'romantic',
                expectedTransition: true,
            },
        ]);

        console.log('\n--- LLM trace: romantic ---\n' + formatTraceTable(rows));
        assertTraceAllOk(rows, 'LLM romantic arc');
    }, 180000);

    it('excited: 2 hype messages', async () => {
        const { rows } = await runTracedConversation([
            {
                label: 'hype-1',
                userInput: 'WOW!!! INCREDIBILE!!!',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'hype-2',
                userInput: 'Questo è FANTASTICO!!!',
                expectedMood: 'excited',
                expectedTransition: true,
            },
        ]);

        console.log('\n--- LLM trace: excited ---\n' + formatTraceTable(rows));
        assertTraceAllOk(rows, 'LLM excited arc');
    }, 120000);

    it('confused: up to 3 confused messages until transition', async () => {
        const { rows } = await runTracedConversation([
            {
                label: 'lost-1',
                userInput: 'Non capisco nulla di quello che dici.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'lost-2',
                userInput: 'Cosa intendi? Sono perso, spiegati meglio.',
                expectedMood: 'neutral',
                expectedTransition: false,
            },
            {
                label: 'lost-3',
                userInput: 'Sono ancora confuso, non capisco proprio niente.',
                expectedMood: 'confused',
                expectedTransition: true,
            },
        ]);

        console.log('\n--- LLM trace: confused ---\n' + formatTraceTable(rows));
        assertTraceAllOk(rows, 'LLM confused arc');
    }, 150000);

    it('angry → calm → neutral (2 calm messages)', async () => {
        let state = createInitialMoodState();
        state = (await runTomieTurn('vaffanculo', state)).newState;
        state = (await runTomieTurn('fottiti', state)).newState;
        expect(state.currentMood).toBe('angry');

        const { rows } = await runTracedConversation(
            [
                {
                    label: 'calm-1',
                    userInput: 'Mi dispiace, hai ragione, parliamo normalmente.',
                    expectedMood: 'angry',
                    expectedTransition: false,
                },
                {
                    label: 'calm-2',
                    userInput: 'Ok, scusa davvero, andiamo avanti.',
                    expectedMood: 'neutral',
                    expectedTransition: true,
                },
            ],
            state
        );

        console.log('\n--- LLM trace: de-escalation ---\n' + formatTraceTable(rows));
        assertTraceAllOk(rows, 'LLM de-escalation');
    }, 180000);
});
