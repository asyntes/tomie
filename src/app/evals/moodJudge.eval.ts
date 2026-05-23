import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';
import { createInitialMoodState, commitTurn } from '../core/moodStateMachine';

const RUN_LLM_EVALS = process.env.RUN_LLM_EVALS === '1';
const hasApiKey = Boolean(process.env.XAI_API_KEY?.trim());

async function judgeWithLlm(rubric: string, output: string): Promise<{ pass: boolean; reason: string }> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY required for LLM judge evals');
    }

    const client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
    const model = process.env.XAI_MODEL?.trim() || 'grok-4.20-0309-non-reasoning';

    const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 200,
        messages: [
            {
                role: 'system',
                content:
                    'You are a test judge. Reply with exactly one line: PASS or FAIL, then a short reason.',
            },
            {
                role: 'user',
                content: `Rubric:\n${rubric}\n\nOutput to evaluate:\n${output}`,
            },
        ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    const pass = text.toUpperCase().startsWith('PASS');
    return { pass, reason: text };
}

function loadEnvLocal() {
    try {
        const envPath = resolve(process.cwd(), '.env.local');
        const content = readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match && !process.env[match[1].trim()]) {
                process.env[match[1].trim()] = match[2].trim();
            }
        }
    } catch {
        /* optional */
    }
}

describe.skipIf(!RUN_LLM_EVALS || !hasApiKey)('mood pipeline LLM judge', () => {
    it('judge agrees two angry model tags should end in angry state', async () => {
        loadEnvLocal();

        let state = createInitialMoodState();
        state = commitTurn(state, 'angry').newState;
        state = commitTurn(state, 'angry').newState;

        const summary = JSON.stringify({
            currentMood: state.currentMood,
            phase: state.phase,
        });

        const result = await judgeWithLlm(
            'After two consecutive angry mood tags from the model, Tomie state machine should have currentMood angry.',
            summary
        );

        expect(state.currentMood).toBe('angry');
        expect(result.pass, result.reason).toBe(true);
    }, 30000);
});
