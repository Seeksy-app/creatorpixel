import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextResponse } from 'next/server';

// POST /api/social/sync - Sync connected accounts from Upload-Post to our DB
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = user.id.replace(/-/g, '_');

  try {
    const client = getUploadPostClient();
    const result = await client.listUsers();

    if (!result.success || !result.profiles) {
      return NextResponse.json({ accounts: [] });
    }

    const profile = result.profiles.find(
      (p: { username?: string }) => p.username === username
    );

    if (!profile?.social_accounts) {
      await supabase.from('social_accounts').delete().eq('profile_id', user.id);
      return NextResponse.json({ accounts: [] });
    }

    console.log('[social/sync] upload-post social_accounts:', JSON.stringify(profile.social_accounts));

    // Upload-Post includes placeholder entries for unconnected platforms —
    // only entries carrying a real account value count as connected
    const accounts = Object.entries(profile.social_accounts as Record<string, unknown>)
      .map(([platform, data]) => {
        const d = (data || {}) as Record<string, unknown>;
        const name = (typeof data === 'string'
          ? data
          : (d.name || d.username || d.display_name || '') as string).trim();
        const avatar = (d.social_images || d.profile_picture || d.avatar || d.avatar_url || d.picture || d.image || null) as string | null;
        const followersRaw = d.followers ?? d.follower_count ?? d.followers_count;
        const followers = typeof followersRaw === 'number' ? followersRaw : null;
        return { profile_id: user.id, platform, account_name: name, avatar_url: avatar, followers };
      })
      .filter((a) => a.account_name.length > 0);

    // Drop platforms no longer connected, then upsert the current set
    if (accounts.length > 0) {
      await supabase.from('social_accounts').delete().eq('profile_id', user.id)
        .not('platform', 'in', `(${accounts.map((a) => a.platform).join(',')})`);
    } else {
      await supabase.from('social_accounts').delete().eq('profile_id', user.id);
    }

    for (const acc of accounts) {
      await supabase.from('social_accounts').upsert(
        { ...acc, connected_at: new Date().toISOString() },
        { onConflict: 'profile_id,platform' }
      );
    }

    const { data: synced } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('profile_id', user.id);

    return NextResponse.json({ accounts: synced || [] });
  } catch {
    return NextResponse.json({ accounts: [] });
  }
}
