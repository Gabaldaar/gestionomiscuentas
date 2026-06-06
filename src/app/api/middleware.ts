import { NextResponse } from 'next/server';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function authenticateRequest(request: Request): NextResponse | null {
    const apiKey = process.env.SECRET_API_KEY;

    if (!apiKey) {
        console.error("FATAL: SECRET_API_KEY is not configured in environment variables.");
        return NextResponse.json({ success: false, error: 'API Key not configured on server.' }, { status: 500, headers: corsHeaders });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Authorization header is missing or malformed.' }, { status: 401, headers: corsHeaders });
    }

    const providedKey = authHeader.split(' ')[1];
    if (providedKey !== apiKey) {
        return NextResponse.json({ success: false, error: 'Invalid API Key.' }, { status: 401, headers: corsHeaders });
    }

    return null; // Authentication successful
}
