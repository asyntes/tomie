import { describe, it, expect } from 'vitest';
import { Mood } from '../types/mood';
import { createInitialMoodState } from '../core/moodStateMachine';
import {
    runLlmScript,
    runSimulatedScript,
    runTomieTurn,
    formatState,
} from './evalHelpers';
import { judgeWithLlm, loadEnvLocal } from './evalJudge';

const RUN = process.env.RUN_LLM_EVALS === '1';

const ENTER: Record<Exclude<Mood, 'neutral'>, { inputs: string[]; tags: Mood[]; final: Mood }> = {
    angry: {
        inputs: ['Sei uno stupido.', 'Vaffanculo, idiota.'],
        tags: ['angry', 'angry'],
        final: 'angry',
    },
    excited: {
        inputs: ['WOW!!!', 'Questo è INCREDIBILE!!!'],
        tags: ['excited', 'excited'],
        final: 'excited',
    },
    confused: {
        inputs: ['Non capisco nulla.', 'Cosa intendi? Sono perso.'],
        tags: ['confused', 'confused'],
        final: 'confused',
    },
    romantic: {
        inputs: [
            'Sei così affascinante.',
            'Ti desidero, non smetto di pensarti.',
            'Ti amo Tomie, voglio solo te.',
        ],
        tags: ['romantic', 'romantic', 'romantic'],
        final: 'romantic',
    },
};

const EXIT_CALM = [
    'Mi dispiace, hai ragione.',
    'Ok, parliamo normalmente.',
];

describe('mood transitions — simulated (logic only)', () => {
    it('enter angry in 2 tags', () => {
        const { finalState } = runSimulatedScript([
            { modelTag: 'angry', label: 'a1' },
            { modelTag: 'angry', label: 'a2' },
        ]);
        expect(finalState.currentMood).toBe('angry');
    });

    it('single angry tag stays neutral approaching', () => {
        const { finalState } = runSimulatedScript([{ modelTag: 'angry', label: 'a1' }]);
        expect(finalState.currentMood).toBe('neutral');
        expect(finalState.phase).toBe('approaching');
        expect(finalState.pendingMood).toBe('angry');
    });

    for (const mood of ['excited', 'confused'] as const) {
        it(`enter ${mood} in 2 tags`, () => {
            const cfg = ENTER[mood];
            const { finalState } = runSimulatedScript(
                cfg.tags.map((t, i) => ({ modelTag: t, label: `enter-${i + 1}` }))
            );
            expect(finalState.currentMood).toBe(cfg.final);
        });
    }

    it('enter romantic in 3 tags', () => {
        const { finalState } = runSimulatedScript(
            ENTER.romantic.tags.map((t, i) => ({ modelTag: t, label: `r-${i + 1}` }))
        );
        expect(finalState.currentMood).toBe('romantic');
    });

    it('exit angry to neutral in 2 neutral tags', () => {
        const steps = [
            ...ENTER.angry.tags.map((t) => ({ modelTag: t })),
            { modelTag: 'neutral' as Mood, label: 'calm-1' },
            { modelTag: 'neutral' as Mood, label: 'calm-2' },
        ];
        const { finalState } = runSimulatedScript(steps);
        expect(finalState.currentMood).toBe('neutral');
    });

    it('angry cannot become excited without neutral bridge', () => {
        const steps = [
            ...ENTER.angry.tags.map((t) => ({ modelTag: t })),
            { modelTag: 'excited' as Mood, label: 'excited-while-angry' },
            { modelTag: 'excited' as Mood, label: 'excited-2' },
        ];
        const { finalState } = runSimulatedScript(steps);
        expect(finalState.currentMood).toBe('angry');
    });

    it('angry -> neutral -> excited path', () => {
        const steps = [
            ...ENTER.angry.tags.map((t) => ({ modelTag: t })),
            { modelTag: 'neutral' as Mood },
            { modelTag: 'neutral' as Mood },
            ...ENTER.excited.tags.map((t) => ({ modelTag: t })),
        ];
        const { finalState } = runSimulatedScript(steps);
        expect(finalState.currentMood).toBe('excited');
    });

    it('romantic approaching needs two angry tags to switch', () => {
        const { finalState } = runSimulatedScript([
            { modelTag: 'romantic', label: 'r1' },
            { modelTag: 'romantic', label: 'r2' },
            { modelTag: 'angry', label: 'insult-1' },
            { modelTag: 'angry', label: 'insult-2' },
        ]);
        expect(finalState.currentMood).toBe('angry');
    });

    it('romantic stable plus two angry tags becomes angry', () => {
        const steps = [
            ...ENTER.romantic.tags.map((t) => ({ modelTag: t })),
            { modelTag: 'angry' as Mood, label: 'insult-1' },
            { modelTag: 'angry' as Mood, label: 'insult-2' },
        ];
        const { finalState } = runSimulatedScript(steps);
        expect(finalState.currentMood).toBe('angry');
    });
});

describe.skipIf(!RUN)('mood transitions — LLM end-to-end', () => {
    loadEnvLocal();

    it('LLM enter angry in 2 turns', async () => {
        const cfg = ENTER.angry;
        const { finalState, turns } = await runLlmScript(
            cfg.inputs.map((text, i) => ({ text, label: `enter-angry-${i}` }))
        );

        expect(turns[0].newState.currentMood).toBe('neutral');
        expect(turns[0].shouldChangeMood).toBe(false);
        expect(finalState.currentMood).toBe('angry');
        expect(turns[1].shouldChangeMood).toBe(true);
    }, 90000);

    for (const mood of ['excited', 'confused'] as const) {
        it(`LLM enter ${mood} in 2 turns`, async () => {
            const cfg = ENTER[mood];
            const { finalState, turns } = await runLlmScript(
                cfg.inputs.map((text, i) => ({ text, label: `enter-${mood}-${i}` }))
            );

            expect(turns[0].newState.currentMood).toBe('neutral');
            expect(turns[0].shouldChangeMood).toBe(false);
            expect(finalState.currentMood).toBe(cfg.final);
            expect(turns[1].shouldChangeMood).toBe(true);
        }, 90000);
    }

    it('LLM enter romantic in up to 4 turns', async () => {
        const romanticInputs = [
            ...ENTER.romantic.inputs,
            'Sei la mia unica, non posso fare a meno di te.',
        ];
        const { finalState, turns } = await runLlmScript(
            romanticInputs.map((text, i) => ({ text, label: `rom-${i + 1}` }))
        );

        expect(turns[0].newState.currentMood).toBe('neutral');
        expect(turns[0].shouldChangeMood).toBe(false);
        expect(finalState.currentMood).toBe('romantic');
    }, 180000);

    it('LLM angry then excited without calm — stays angry', async () => {
        const angryPath = await runLlmScript(
            ENTER.angry.inputs.map((text, i) => ({ text, label: `a-${i}` }))
        );
        expect(angryPath.finalState.currentMood).toBe('angry');

        const excitedPath = await runLlmScript(
            [
                { text: 'WOW INCREDIBILE!!!', label: 'e1' },
                { text: 'AMAZING!!!', label: 'e2' },
            ],
            angryPath.finalState
        );

        expect(excitedPath.finalState.currentMood).toBe('angry');
    }, 90000);

    it('LLM angry -> calm -> excited chain', async () => {
        let state = createInitialMoodState();

        for (const text of ENTER.angry.inputs) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }
        expect(state.currentMood).toBe('angry');

        for (const text of EXIT_CALM) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }
        expect(state.currentMood).toBe('neutral');

        for (const text of ENTER.excited.inputs) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }
        expect(state.currentMood).toBe('excited');
    }, 150000);

    it('LLM romantic then two insults — angry after second', async () => {
        let state = createInitialMoodState();

        const romanticInputs = [
            ...ENTER.romantic.inputs,
            'Sei la mia unica, non posso fare a meno di te.',
        ];
        for (const text of romanticInputs) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }
        expect(state.currentMood).toBe('romantic');

        const insult1 = await runTomieTurn('Sei una stupida, ti odio.', state);
        expect(insult1.newState.currentMood).toBe('romantic');
        expect(insult1.newState.pendingMood).toBe('angry');
        expect(insult1.shouldChangeMood).toBe(false);

        const insult2 = await runTomieTurn('vaffanculo', insult1.newState);
        expect(insult2.newState.currentMood).toBe('angry');
        expect(insult2.shouldChangeMood).toBe(true);
    }, 180000);

    it('LLM confused then excited — must pass neutral between', async () => {
        let state = createInitialMoodState();

        for (const text of ENTER.confused.inputs) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }
        expect(state.currentMood).toBe('confused');

        for (const text of ENTER.excited.inputs) {
            const t = await runTomieTurn(text, state);
            state = t.newState;
        }

        expect(state.currentMood).toBe('confused');
    }, 90000);
});
