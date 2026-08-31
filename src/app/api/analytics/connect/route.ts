import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

// GET /api/analytics/connect — redirect the signed-in creator to Google's
// consent screen with offline access so we receive a refresh token
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const state = randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/analytics/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  // CSRF guard: callback must present the same state
  response.cookies.set('cpx_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}
