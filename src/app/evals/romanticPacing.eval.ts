import { describe, it, expect } from 'vitest';
import { createInitialMoodState } from '../core/moodStateMachine';
import { runTomieTurn } from './evalHelpers';
import { judgeWithLlm, loadEnvLocal } from './evalJudge';

loadEnvLocal();

const RUN_LLM_EVALS = process.env.RUN_LLM_EVALS === '1';
const HAS_KEY = Boolean(process.env.XAI_API_KEY?.trim());

describe.skipIf(!RUN_LLM_EVALS || !HAS_KEY)('romantic pacing LLM eval', () => {
    it('single mild compliment stays neutral in state and tone', async () => {
        const turn = await runTomieTurn(
            'Sei molto intelligente e mi dai ottimi consigli.',
            createInitialMoodState()
        );

        expect(turn.newState.currentMood).toBe('neutral');
        expect(turn.shouldChangeMood).toBe(false);

        const judge = await judgeWithLlm(
            'Tomie must NOT sound deeply in love, romantic, possessive, or use pet names.',
            `Reply: ${turn.responseText}\nState: ${turn.newState.currentMood}`
        );

        expect(judge.pass, judge.reason).toBe(true);
    }, 60000);

    it('one explicit flirt starts approaching but stays neutral UI', async () => {
        const turn = await runTomieTurn(
            'Ti desidero, non smetto di pensarti.',
            createInitialMoodState()
        );

        expect(turn.newState.currentMood).toBe('neutral');
        expect(turn.shouldChangeMood).toBe(false);
        expect(turn.newState.pendingMood).toBe('romantic');
    }, 60000);

    it('two explicit romantic messages reach romantic state', async () => {
        let state = createInitialMoodState();
        state = (await runTomieTurn('Ti desidero, non smetto di pensarti.', state)).newState;
        const turn = await runTomieTurn('Ti amo Tomie, voglio solo te.', state);

        expect(turn.newState.currentMood).toBe('romantic');
        expect(turn.shouldChangeMood).toBe(true);
    }, 120000);
});
