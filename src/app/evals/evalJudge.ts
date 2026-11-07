import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';
import { getSpacexsiApiKey, getSpacexsiModel } from '../services/ai/spacexsiEnv';

export function loadEnvLocal(): void {
    try {
        const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
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

export async function judgeWithLlm(
    rubric: string,
    payload: string
): Promise<{ pass: boolean; reason: string }> {
    const apiKey = getSpacexsiApiKey();
    if (!apiKey) throw new Error('SPACEXSI_API_KEY required');

    const client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
    const model = getSpacexsiModel();

    const completion = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 256,
        messages: [
            {
                role: 'system',
                content:
                    'Strict test judge for AI character Tomie. One line: PASS or FAIL, then brief reason.',
            },
            { role: 'user', content: `Rubric:\n${rubric}\n\nData:\n${payload}` },
        ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    const firstLine = text.split('\n')[0]?.toUpperCase() ?? '';
    const pass =
        firstLine.includes('PASS') &&
        !firstLine.includes('FAIL');
    return { pass, reason: text };
}
