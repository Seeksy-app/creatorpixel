import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/social/connect - Get OAuth connection URL for Upload-Post
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { platforms } = body as { platforms?: string[] };

  const allowedPlatforms = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'bluesky'];
  const platformsToConnect = Array.isArray(platforms)
    ? platforms.filter((p: string) => allowedPlatforms.includes(p))
    : allowedPlatforms;

  try {
    const client = getUploadPostClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const username = user.id.replace(/-/g, '_');

    await client.createUser(username).catch(() => {});

    const result = await client.generateJwt(username, {
      redirectUrl: `${appUrl}/dashboard/social`,
      platforms: platformsToConnect,
      redirectButtonText: 'Return to CreatorPixel',
    });

    if (!result.success || !result.connection_url) {
      console.error('[social/connect] Upload-Post refused:', JSON.stringify(result));
      return NextResponse.json({ error: result.message || 'Failed to generate connection URL' }, { status: 500 });
    }

    return NextResponse.json({ connectionUrl: result.connection_url, jwt: result.jwt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
