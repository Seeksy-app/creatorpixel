import { createAdminSupabase } from '@/lib/supabase/server';

// Pull videos + sponsor-grade metrics for one connected YouTube channel.
// Called by the sync route (user-triggered) and the nightly cron.

const YT = 'https://www.googleapis.com/youtube/v3';
const YTA = 'https://youtubeanalytics.googleapis.com/v2/reports';

interface Connection {
  id: string;
  profile_id: string;
  external_account_id: string;
  refresh_token: string;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  return res.ok ? data.access_token : null;
}

// ISO8601 duration (PT1H2M3S) -> seconds
function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

export async function syncYouTubeConnection(conn: Connection): Promise<{ videos: number; error?: string }> {
  const supabase = createAdminSupabase();

  const fail = async (error: string) => {
    await supabase.from('analytics_connections')
      .update({ last_sync_error: error, status: 'error' })
      .eq('id', conn.id);
    return { videos: 0, error };
  };

  const token = await refreshAccessToken(conn.refresh_token);
  if (!token) return fail('token_refresh_failed');
  const auth = { Authorization: `Bearer ${token}` };

  // 1. Uploads playlist -> recent videos (up to 50)
  const chRes = await fetch(`${YT}/channels?part=contentDetails&id=${conn.external_account_id}`, { headers: auth });
  const chData = await chRes.json();
  const uploadsPlaylist = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) return fail('uploads_playlist_not_found');

  const plRes = await fetch(
    `${YT}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylist}&maxResults=50`,
    { headers: auth }
  );
  const plData = await plRes.json();
  const videoIds: string[] = (plData.items || [])
    .map((i: any) => i.contentDetails?.videoId)
    .filter(Boolean);
  if (videoIds.length === 0) {
    await supabase.from('analytics_connections')
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null, status: 'active' })
      .eq('id', conn.id);
    return { videos: 0 };
  }

  // 2. Video details -> content_items
  const vRes = await fetch(
    `${YT}/videos?part=snippet,contentDetails&id=${videoIds.join(',')}`,
    { headers: auth }
  );
  const vData = await vRes.json();

  const itemIdByVideo = new Map<string, string>();
  for (const v of vData.items || []) {
    const { data: item } = await supabase.from('content_items').upsert({
      connection_id: conn.id,
      profile_id: conn.profile_id,
      platform: 'youtube',
      external_id: v.id,
      title: v.snippet?.title || null,
      thumbnail_url: v.snippet?.thumbnails?.medium?.url || null,
      published_at: v.snippet?.publishedAt || null,
      duration_seconds: parseDuration(v.contentDetails?.duration),
    }, { onConflict: 'connection_id,external_id' }).select('id').single();
    if (item) itemIdByVideo.set(v.id, item.id);
  }

  // 3. Metrics per video, per day, last 90 days.
  // engagedViews is the post-Aug-2026 metric; fall back without it if the
  // API doesn't recognize it for this channel.
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const baseMetrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained';

  for (const videoId of videoIds) {
    const itemId = itemIdByVideo.get(videoId);
    if (!itemId) continue;

    let metrics = `engagedViews,${baseMetrics}`;
    let hasEngaged = true;
    let rRes = await fetch(
      `${YTA}?ids=channel==${conn.external_account_id}&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=${metrics}&dimensions=day&filters=video==${videoId}`,
      { headers: auth }
    );
    if (!rRes.ok) {
      hasEngaged = false;
      rRes = await fetch(
        `${YTA}?ids=channel==${conn.external_account_id}&startDate=${startDate}&endDate=${endDate}` +
        `&metrics=${baseMetrics}&dimensions=day&filters=video==${videoId}`,
        { headers: auth }
      );
    }
    if (!rRes.ok) continue;
    const report = await rRes.json();

    for (const row of report.rows || []) {
      // row order follows the metrics list, after the leading day dimension
      const [day, ...vals] = row;
      const o = hasEngaged ? 1 : 0;
      await supabase.from('content_metrics_daily').upsert({
        content_item_id: itemId,
        profile_id: conn.profile_id,
        date: day,
        engaged_views: hasEngaged ? (vals[0] || 0) : 0,
        views: vals[o + 0] || 0,
        minutes_watched: vals[o + 1] || 0,
        average_view_duration_seconds: Math.round(vals[o + 2] || 0),
        average_view_percentage: vals[o + 3] || null,
        likes: vals[o + 4] || 0,
        comments: vals[o + 5] || 0,
        shares: vals[o + 6] || 0,
        subscribers_gained: vals[o + 7] || 0,
      }, { onConflict: 'content_item_id,date' });
    }
  }

  // 4. Retention curves for the 10 most recent videos
  for (const videoId of videoIds.slice(0, 10)) {
    const itemId = itemIdByVideo.get(videoId);
    if (!itemId) continue;
    const rRes = await fetch(
      `${YTA}?ids=channel==${conn.external_account_id}&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=audienceWatchRatio&dimensions=elapsedVideoTimeRatio&filters=video==${videoId}`,
      { headers: auth }
    );
    if (!rRes.ok) continue;
    const report = await rRes.json();
    for (const [ratio, audience] of report.rows || []) {
      await supabase.from('retention_points').upsert({
        content_item_id: itemId,
        elapsed_ratio: ratio,
        audience_ratio: audience,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'content_item_id,elapsed_ratio' });
    }
  }

  await supabase.from('analytics_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null, status: 'active' })
    .eq('id', conn.id);

  return { videos: videoIds.length };
}
