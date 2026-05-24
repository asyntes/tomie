import { NextRequest, NextResponse } from 'next/server';
import { GrokService } from '../../../services';

export async function POST(request: NextRequest) {
    try {
        const { prompt } = (await request.json()) as { prompt?: string };
        if (!prompt?.trim()) {
            return NextResponse.json({ error: 'prompt required' }, { status: 400 });
        }

        const grok = GrokService.createFromEnv();
        const mood = await grok.classifyUserMood(prompt);

        return NextResponse.json({ mood });
    } catch (error) {
        console.error('Error in mood classify route:', error);
        const message = error instanceof Error ? error.message : 'Failed to classify mood';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
