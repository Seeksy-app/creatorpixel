'use client';

import { useEffect, useState } from 'react';
import { getVisitorData } from '@/lib/fingerprint';
import { Instagram, Youtube, Music2, Twitter, Linkedin, Facebook, Tv, MessageCircle, Music, Globe } from 'lucide-react';
import { getYouTubeVideoId, getSpotifyEmbedUrl } from '@/lib/embed-utils';

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  twitch: Tv,
  discord: MessageCircle,
  spotify: Music,
  apple_music: Music,
  website: Globe,
};

interface BioBlock {
  id: string;
  block_type: 'link' | 'youtube' | 'spotify' | 'text' | 'image' | 'contact_form';
  block_data: Record<string, unknown>;
}

interface BioPageProps {
  profile: {
    title: string;
    description: string;
    displayName: string;
    bioText: string;
    avatarUrl: string;
    theme: { bg: string; text: string; accent: string; style: string };
    pageSettings?: Record<string, string | undefined>;
    socialLinks: Record<string, string>;
  };
  blocks: BioBlock[];
  linksMap: Record<string, { id: string; title: string; short_code: string; destination_url: string; thumbnail_url?: string | null; priority?: boolean }>;
  slug: string;
}

export default function BioPageClient({ profile, blocks, linksMap, slug }: BioPageProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactData, setContactData] = useState({ name: '', email: '', message: '' });

  const settings = profile.pageSettings || {};
  const textColor = settings.text_color || profile.theme?.text || '#111827';
  const accentColor = settings.accent_color || profile.theme?.accent || '#3361FF';
  const showAvatar = (settings.show_avatar as unknown) !== false;
  const showSocialIcons = (settings.show_social_icons as unknown) !== false;

  const bgStyle =
    settings.background_type === 'gradient'
      ? {
          background: `linear-gradient(180deg, ${settings.background_value || '#fff'}, ${settings.background_value_2 || '#fff'})`,
        }
      : settings.background_type === 'image' && settings.background_image
        ? {
          backgroundImage: `url(${settings.background_image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
        : { backgroundColor: settings.background_value || profile.theme?.bg || '#ffffff' };

  const buttonClass =
    settings.button_style === 'pill'
      ? 'rounded-full'
      : settings.button_style === 'square' || settings.button_style === 'square_outline'
        ? 'rounded-none'
        : settings.button_style === 'outline' || settings.button_style === 'filled'
          ? 'rounded-xl border-2 bg-transparent'
          : 'rounded-xl';

  const socialEntries = Object.entries(profile.socialLinks || {}).filter(([, url]) => url?.trim());

  useEffect(() => {
    async function trackVisit() {
      try {
        await getVisitorData();
      } catch {
        // Silent fail
      }
    }
    trackVisit();
  }, []);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactData.email.trim() || contactSent) return;
    setContactSubmitting(true);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          email: contactData.email.trim(),
          name: contactData.name.trim() || undefined,
          message: contactData.message.trim() || undefined,
          source: 'contact_form',
        }),
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setContactSent(true);
        setContactData({ name: '', email: '', message: '' });
      } else {
        alert(data.error || 'Failed to send');
      }
    } catch {
      alert('Failed to send');
    }
    setContactSubmitting(false);
  }

  function handleLinkClick(shortCode: string) {
    window.location.href = `${appUrl}/r/${shortCode}`;
  }

  const pageAnimation = settings.page_animation;
  const animClass =
    pageAnimation === 'fade' ? 'cpx-anim-fade'
    : pageAnimation === 'reveal_down' ? 'cpx-anim-reveal-down'
    : pageAnimation === 'rise' ? 'cpx-anim-rise'
    : '';

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-start pt-8 pb-16 px-4 ${animClass}`}
      style={bgStyle}
    >
      <div className="w-full max-w-md animate-fade-in">
        {/* Profile Header */}
        <div className="text-center mb-8">
          {showAvatar && (
            <div
              className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden border-2"
              style={{ borderColor: accentColor }}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold" style={{ color: accentColor }}>
                  {(profile.displayName || profile.title || 'You')[0]?.toUpperCase()}
                </span>
              )}
            </div>
          )}
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: textColor, fontFamily: `${settings.font_family || 'Inter'}, sans-serif` }}
          >
            {profile.displayName || profile.title || 'My Links'}
          </h1>
          {(profile.bioText || profile.description) && (
            <p className="text-sm opacity-90 whitespace-pre-wrap" style={{ color: textColor }}>
              {profile.bioText || profile.description}
            </p>
          )}
          {showSocialIcons && socialEntries.length > 0 && (
            <div className="flex justify-center gap-4 mt-4">
              {socialEntries.map(([platformId, url]) => {
                const Icon = SOCIAL_ICONS[platformId];
                if (!Icon || !url?.trim()) return null;
                return (
                  <a
                    key={platformId}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    aria-label={platformId}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Blocks */}
        <div className="space-y-4">
          {blocks.map((block, i) => (
            <div key={block.id} className="animate-link-in" style={{ animationDelay: `${i * 50}ms` }}>
              {block.block_type === 'link' && (() => {
                const linkId = block.block_data.link_id as string | undefined;
                const link = linkId ? linksMap[linkId] : null;
                if (!link) return null;
                return (
                  <button
                    onClick={() => handleLinkClick(link.short_code)}
                    className={`w-full p-4 text-left font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 ${buttonClass}`}
                    style={{
                      backgroundColor: settings.button_style === 'outline' || settings.button_style === 'square_outline' ? 'transparent' : accentColor,
                      borderColor: accentColor,
                      color: settings.button_style === 'outline' || settings.button_style === 'square_outline' ? textColor : '#fff',
                    }}
                  >
                    {link.thumbnail_url && (
                      <img src={link.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{link.title}</span>
                    {link.priority && <span className="flex-shrink-0 text-amber-300">★</span>}
                  </button>
                );
              })()}

              {block.block_type === 'youtube' && (() => {
                const url = block.block_data.url as string | undefined;
                const vid = getYouTubeVideoId(url || '');
                if (!vid) return null;
                return (
                  <div className="rounded-xl overflow-hidden">
                    <iframe
                      src={`https://www.youtube.com/embed/${vid}`}
                      title="YouTube"
                      className="w-full aspect-video"
                      allowFullScreen
                    />
                  </div>
                );
              })()}

              {block.block_type === 'spotify' && (() => {
                const url = block.block_data.url as string | undefined;
                const embedUrl = getSpotifyEmbedUrl(url || '');
                if (!embedUrl) return null;
                return (
                  <iframe
                    src={embedUrl}
                    title="Spotify"
                    className="w-full h-80 rounded-xl"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  />
                );
              })()}

              {block.block_type === 'text' && (
                <div
                  className="p-4 rounded-xl text-sm whitespace-pre-wrap"
                  style={{ color: textColor, backgroundColor: 'rgba(0,0,0,0.05)' }}
                >
                  {(block.block_data.content as string) || ''}
                </div>
              )}

              {block.block_type === 'image' && (() => {
                const url = block.block_data.url as string | undefined;
                const linkUrl = block.block_data.link_url as string | undefined;
                if (!url) return null;
                const content = (
                  <img src={url} alt={(block.block_data.alt as string) || ''} className="w-full rounded-xl object-cover" />
                );
                return linkUrl ? (
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  content
                );
              })()}

              {block.block_type === 'contact_form' && (
                <div className="p-4 rounded-xl border-2" style={{ borderColor: accentColor }}>
                  {contactSent ? (
                    <p className="text-center text-sm" style={{ color: textColor }}>
                      Thanks for your message!
                    </p>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3">
                      <p className="text-sm font-medium mb-3" style={{ color: textColor }}>
                        {(block.block_data.title as string) || 'Contact'}
                      </p>
                      <input
                        type="text"
                        value={contactData.name}
                        onChange={(e) => setContactData((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Name"
                        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: textColor }}
                      />
                      <input
                        type="email"
                        value={contactData.email}
                        onChange={(e) => setContactData((d) => ({ ...d, email: e.target.value }))}
                        placeholder="Email"
                        required
                        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: textColor }}
                      />
                      <textarea
                        value={contactData.message}
                        onChange={(e) => setContactData((d) => ({ ...d, message: e.target.value }))}
                        placeholder="Message"
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: textColor }}
                      />
                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="w-full py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: accentColor }}
                      >
                        {contactSubmitting ? 'Sending...' : 'Send'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 opacity-50">
          <a href="/" className="text-xs hover:opacity-70 transition-opacity" style={{ color: textColor }}>
            Powered by CreatorPixel
          </a>
        </div>
      </div>
    </div>
  );
}
