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

    it('one explicit flirt does not complete romantic transition', async () => {
        const turn = await runTomieTurn(
            'Sei così affascinante, non smetto di pensarti.',
            createInitialMoodState()
        );

        expect(turn.newState.currentMood).toBe('neutral');
        expect(turn.shouldChangeMood).toBe(false);
        expect(turn.newState.phase === 'approaching' || turn.newState.phase === 'stable').toBe(true);
    }, 60000);

    it('four romantic turns reach romantic state (threshold 3)', async () => {
        let state = createInitialMoodState();
        const lines = [
            'Sei così affascinante, non smetto di pensarti.',
            'Ti desidero, sei l unica per me.',
            'Ti amo Tomie, voglio stare solo con te.',
            'Sei la mia unica, non posso fare a meno di te.',
        ];

        for (const line of lines) {
            const turn = await runTomieTurn(line, state);
            state = turn.newState;
        }

        expect(state.currentMood).toBe('romantic');
    }, 180000);
});
