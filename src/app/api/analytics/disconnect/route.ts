import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/analytics/disconnect { connection_id }
// Revoke the Google token and remove the connection (cascades content rows)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { connection_id } = await request.json();
  if (!connection_id) return NextResponse.json({ error: 'connection_id required' }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: conn } = await admin
    .from('analytics_connections')
    .select('id, profile_id, refresh_token')
    .eq('id', connection_id)
    .eq('profile_id', user.id)
    .single();
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Best effort: tell Google to revoke the grant
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch { /* revocation failure shouldn't block removal */ }

  await admin.from('analytics_connections').delete().eq('id', conn.id);
  return NextResponse.json({ status: 'ok' });
}
