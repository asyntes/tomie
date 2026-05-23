import { NextRequest, NextResponse } from 'next/server';
import { GrokService, AIRequest } from '../../services';

export async function POST(request: NextRequest) {
    try {
        const grokService = GrokService.createFromEnv();
        const requestData: AIRequest = await request.json();

        const response = await grokService.generateResponse(requestData);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error in Grok API route:', error);
        
        if (error instanceof Error && error.message.includes('API key not configured')) {
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const message =
            error instanceof Error ? error.message : 'Failed to generate response';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}