import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/social/past-posts — recent posts on connected platforms via
// Upload-Post's unified analytics, normalized to a simple card shape
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = user.id.replace(/-/g, '_');

  try {
    const client = getUploadPostClient();
    const result: any = await client.getAnalytics(username);
    console.log('[social/past-posts] analytics response:', JSON.stringify(result).slice(0, 2000));

    // Shape is loosely documented — normalize anything that looks like a post
    const posts: Array<{ platform: string; text: string; url: string | null; image: string | null; date: string | null; likes: number | null }> = [];
    const scan = (platform: string, items: unknown) => {
      if (!Array.isArray(items)) return;
      for (const it of items.slice(0, 10)) {
        const p = (it || {}) as Record<string, any>;
        posts.push({
          platform,
          text: p.text || p.caption || p.title || p.message || '',
          url: p.url || p.permalink || p.link || null,
          image: p.image || p.thumbnail || p.media_url || p.picture || null,
          date: p.date || p.created_at || p.timestamp || p.published_at || null,
          likes: typeof p.likes === 'number' ? p.likes : (typeof p.like_count === 'number' ? p.like_count : null),
        });
      }
    };

    const data = result?.analytics || result?.data || result || {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const v = (value || {}) as Record<string, unknown>;
      scan(key, Array.isArray(value) ? value : v.posts || v.recent_posts || v.media || v.items);
    }

    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return NextResponse.json({ posts: posts.slice(0, 10) });
  } catch (err) {
    console.error('[social/past-posts] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ posts: [] });
  }
}
