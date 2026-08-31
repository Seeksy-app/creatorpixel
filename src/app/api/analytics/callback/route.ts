import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/analytics/callback — Google redirects here after consent.
// Exchange the code for tokens, look up the channel, store the connection.
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/dashboard/attention?error=${encodeURIComponent(reason)}`);

  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${appUrl}/auth/login`);

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const cookieState = request.cookies.get('cpx_oauth_state')?.value;
    if (!code) return fail(request.nextUrl.searchParams.get('error') || 'no_code');
    if (!state || state !== cookieState) return fail('state_mismatch');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return fail('not_configured');

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/analytics/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) return fail('token_exchange_failed');
    if (!tokens.refresh_token) return fail('no_refresh_token');

    // Identify the connected channel
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channels = await chRes.json();
    const channel = channels.items?.[0];
    if (!channel) return fail('no_channel');

    const admin = createAdminSupabase();
    const { error } = await admin.from('analytics_connections').upsert({
      profile_id: user.id,
      platform: 'youtube',
      external_account_id: channel.id,
      account_name: channel.snippet?.title || null,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      status: 'active',
      last_sync_error: null,
    }, { onConflict: 'profile_id,platform,external_account_id' });
    if (error) return fail('save_failed');

    const response = NextResponse.redirect(`${appUrl}/dashboard/attention?connected=youtube`);
    response.cookies.delete('cpx_oauth_state');
    return response;
  } catch (err) {
    console.error('Analytics callback error:', err);
    return fail('internal');
  }
}
