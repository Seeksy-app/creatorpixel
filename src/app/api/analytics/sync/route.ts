import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { syncYouTubeConnection } from '@/lib/youtube-sync';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// POST /api/analytics/sync — signed-in creator syncs their own connections
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: conns } = await admin
    .from('analytics_connections')
    .select('id, profile_id, external_account_id, refresh_token')
    .eq('profile_id', user.id)
    .eq('platform', 'youtube');

  const results = [];
  for (const conn of conns || []) {
    results.push(await syncYouTubeConnection(conn));
  }
  return NextResponse.json({ status: 'ok', results });
}

// GET /api/analytics/sync — nightly cron syncs every active connection.
// Vercel Cron sends Authorization: Bearer $CRON_SECRET when configured.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: conns } = await admin
    .from('analytics_connections')
    .select('id, profile_id, external_account_id, refresh_token')
    .eq('platform', 'youtube')
    .neq('status', 'revoked');

  const results = [];
  for (const conn of conns || []) {
    results.push(await syncYouTubeConnection(conn));
  }
  return NextResponse.json({ status: 'ok', synced: results.length });
}
