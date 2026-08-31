import { createAdminSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import BioPageClient from '@/components/bio/BioPageClient';

// Public bio page: yourdomain.com/[slug]
// Rendered with all customizations; links filtered by schedule

export default async function BioPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, bio_slug, bio_title, bio_description, bio_theme, avatar_url, theme, bio_text, display_name, social_links, page_settings')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: blocks } = await supabase
    .from('bio_blocks')
    .select('*')
    .eq('user_id', profile.id)
    .order('position', { ascending: true });

  const { data: links } = await supabase
    .from('links')
    .select('id, title, short_code, destination_url, thumbnail_url, priority')
    .eq('user_id', profile.id)
    .eq('is_bio_link', true)
    .eq('is_active', true);

  const theme = profile.bio_theme || { bg: '#ffffff', text: '#000000', accent: '#3361FF', style: 'minimal' };
  const pageSettings = (profile.page_settings as Record<string, unknown>) || {};
  const linksMap = (links || []).reduce((acc, l) => { acc[l.id] = l; return acc; }, {} as Record<string, { id: string; title: string; short_code: string; destination_url: string; thumbnail_url?: string | null; priority?: boolean }>);

  return (
    <BioPageClient
      profile={{
        title: profile.bio_title || 'My Links',
        description: profile.bio_description || '',
        displayName: profile.display_name || profile.bio_title || '',
        bioText: profile.bio_text || profile.bio_description || '',
        avatarUrl: profile.avatar_url || '',
        theme,
        pageSettings: (pageSettings || {}) as Record<string, string>,
        socialLinks: (() => {
          const all = { ...((profile.social_links as Record<string, string>) || {}) };
          for (const id of (pageSettings.hidden_socials as string[]) || []) delete all[id];
          return all;
        })(),
      }}
      blocks={(blocks || []).map((b) => ({
        id: b.id,
        block_type: b.block_type,
        block_data: (b.block_data as Record<string, unknown>) || {},
      }))}
      linksMap={linksMap}
      slug={params.slug}
    />
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('bio_title, bio_description, bio_text, display_name')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) return {};

  return {
    title: profile.display_name || profile.bio_title || 'Links',
    description: profile.bio_text || profile.bio_description || '',
  };
}
