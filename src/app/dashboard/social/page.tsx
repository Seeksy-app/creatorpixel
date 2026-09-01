'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Share2,
  Plus,
  Image,
  Video,
  Send,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  SiTiktok, SiInstagram, SiYoutube, SiFacebook, SiX, SiBluesky,
} from 'react-icons/si';
import { FaLinkedinIn } from 'react-icons/fa6';
import { createClient } from '@/lib/supabase/client';

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', Icon: SiTiktok, color: '#000000' },
  { id: 'instagram', name: 'Instagram', Icon: SiInstagram, color: '#E4405F' },
  { id: 'youtube', name: 'YouTube', Icon: SiYoutube, color: '#FF0000' },
  { id: 'linkedin', name: 'LinkedIn', Icon: FaLinkedinIn, color: '#0A66C2' },
  { id: 'facebook', name: 'Facebook', Icon: SiFacebook, color: '#1877F2' },
  { id: 'x', name: 'X/Twitter', Icon: SiX, color: '#000000' },
  { id: 'bluesky', name: 'Bluesky', Icon: SiBluesky, color: '#0285FF' },
] as const;

type PlatformId = (typeof PLATFORMS)[number]['id'];

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string | null;
  connected_at: string;
}

interface SocialPost {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  platforms: PlatformId[];
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
  upload_post_response?: {
    data?: {
      platforms?: Array< { name: string; url?: string; error?: string }>;
    };
  };
  created_at: string;
}

export default function SocialHubPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [topVideos, setTopVideos] = useState<Array<{ id: string; title: string; thumbnail_url: string | null; engaged: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_CHARS = 280;

  useEffect(() => {
    loadData();
    loadTopVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTopVideos() {
    const supabase = createClient();
    const { data: items } = await supabase
      .from('content_items')
      .select('id, title, thumbnail_url')
      .limit(50);
    if (!items?.length) return;

    const { data: rows } = await supabase
      .from('content_metrics_daily')
      .select('content_item_id, engaged_views, views')
      .in('content_item_id', items.map((i) => i.id));

    const totals = new Map<string, number>();
    for (const r of rows || []) {
      totals.set(r.content_item_id, (totals.get(r.content_item_id) || 0) + (r.engaged_views || r.views || 0));
    }
    const top = items
      .map((i) => ({ id: i.id, title: i.title || '', thumbnail_url: i.thumbnail_url, engaged: totals.get(i.id) || 0 }))
      .filter((v) => v.engaged > 0)
      .sort((a, b) => b.engaged - a.engaged)
      .slice(0, 3);
    setTopVideos(top);
  }

  async function loadData() {
    setLoading(true);
    try {
      await fetch('/api/social/sync', { method: 'POST' });
      const [accountsRes, postsRes] = await Promise.all([
        fetch('/api/social/accounts'),
        fetch('/api/social/posts'),
      ]);
      const accountsData = await accountsRes.json();
      const postsData = await postsRes.json();
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setPosts(Array.isArray(postsData) ? postsData : []);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: PLATFORMS.map((p) => p.id) }),
      });
      const data = await res.json();
      if (data.connectionUrl) {
        window.location.href = data.connectionUrl;
      } else {
        toast.error(data.error || 'Failed to get connection URL');
      }
    } catch {
      toast.error('Failed to connect');
    }
    setConnecting(false);
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please select an image or video');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/social', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setMediaUrl(data.url);
        setMediaType(data.type);
        toast.success('Media uploaded');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    }
    setPosting(false);
    e.target.value = '';
  }

  function togglePlatform(id: PlatformId) {
    setSelectedPlatforms((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );
  }

  async function handlePostNow() {
    if (!content.trim()) {
      toast.error('Enter some content');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/social/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
          platforms: selectedPlatforms,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Post sent!');
        setContent('');
        setMediaUrl(null);
        setMediaType(null);
        setSelectedPlatforms([]);
        loadData();
      } else {
        toast.error(data.error || 'Post failed');
      }
    } catch {
      toast.error('Post failed');
    }
    setPosting(false);
  }

  async function handleSchedule() {
    if (!content.trim()) {
      toast.error('Enter some content');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    if (!scheduledAt) {
      toast.error('Select date and time');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
          platforms: selectedPlatforms,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Post scheduled!');
        setContent('');
        setMediaUrl(null);
        setMediaType(null);
        setSelectedPlatforms([]);
        setScheduledAt('');
        loadData();
      } else {
        toast.error(data.error || 'Schedule failed');
      }
    } catch {
      toast.error('Schedule failed');
    }
    setPosting(false);
  }

  function getPlatformUrl(post: SocialPost, platformName: string): string | null {
    const platforms = post.upload_post_response?.data?.platforms || [];
    const p = platforms.find((x) => x.name.toLowerCase() === platformName.toLowerCase());
    return p?.url || null;
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Social Hub</h1>
        <p className="text-gray-500 mt-1">
          Publish and schedule posts to your social accounts. Looking for your engagement
          stats? Those live in <a href="/dashboard/attention" className="text-blue-600 hover:underline">Attention</a>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Connected Accounts — icon row; click any icon to connect/manage */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Share2 className="w-5 h-5" /> Posting Accounts
              </h2>
              {connecting && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {PLATFORMS.map((platform) => {
                const account = accounts.find((a) => a.platform === platform.id);
                const connected = !!account;
                return (
                  <button
                    key={platform.id}
                    onClick={handleConnect}
                    disabled={connecting}
                    title={connected
                      ? `${platform.name} connected${account?.account_name ? ` as ${account.account_name}` : ''} — click to manage`
                      : `Connect ${platform.name}`}
                    className={`relative p-2.5 rounded-lg border transition disabled:opacity-50 ${
                      connected
                        ? 'border-gray-200 bg-white hover:border-gray-300'
                        : 'border-transparent bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <platform.Icon
                      className="w-5 h-5"
                      style={{ color: connected ? platform.color : '#C6CDD5' }}
                    />
                    {connected && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Click any icon to connect or manage accounts. Posting is separate from the
              stats connection on <a href="/dashboard/attention" className="text-blue-500 hover:underline">Attention</a>.
            </p>
          </div>

          {/* Post Composer */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Compose Post</h2>
            <div className="space-y-4">
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                  placeholder="What's on your mind?"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {content.length} / 2000
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleMediaUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={posting}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
                  Image
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={posting}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Video className="w-4 h-4" /> Video
                </button>
                {mediaUrl && (
                  <div className="flex items-center gap-2 ml-2">
                    {mediaType === 'image' ? (
                      <img src={mediaUrl} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-xs text-gray-500">Video attached</span>
                    )}
                    <button
                      onClick={() => { setMediaUrl(null); setMediaType(null); }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                {accounts.length === 0 && (
                  <p className="text-sm text-gray-500 mb-2">
                    No accounts connected yet — use “Connect Account” above to link the
                    platforms you post to.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.filter((p) => accounts.some((a) => a.platform === p.id)).map((platform) => (
                    <label
                      key={platform.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                        selectedPlatforms.includes(platform.id)
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform.id)}
                        onChange={() => togglePlatform(platform.id)}
                        className="rounded border-gray-300 text-brand-600 sr-only"
                      />
                      <platform.Icon className="w-4 h-4" style={{ color: platform.color }} />
                      <span className="text-sm font-medium">{platform.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Schedule (optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handlePostNow}
                  disabled={posting || !content.trim() || selectedPlatforms.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Post Now
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={posting || !content.trim() || selectedPlatforms.length === 0 || !scheduledAt}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Post History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Post History</h2>
            {posts.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No posts yet. Create your first post above!</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                  >
                    <p className="text-sm text-gray-900 line-clamp-2">{post.content}</p>
                    {post.media_url && (
                      <div className="mt-2">
                        {post.media_type === 'image' ? (
                          <img src={post.media_url} alt="" className="h-16 w-16 rounded object-cover" />
                        ) : (
                          <span className="text-xs text-gray-500">📹 Video attached</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          post.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : post.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-700'
                              : post.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {post.status === 'published' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {post.status === 'scheduled' && <Clock className="w-3 h-3 inline mr-1" />}
                        {post.status === 'failed' && <XCircle className="w-3 h-3 inline mr-1" />}
                        {post.status}
                      </span>
                      {post.platforms?.map((p) => {
                        const url = getPlatformUrl(post, p);
                        return (
                          <span key={p} className="text-xs flex items-center gap-1">
                            {(() => {
                              const pl = PLATFORMS.find((x) => x.id === p);
                              return pl ? <pl.Icon className="w-3 h-3" style={{ color: pl.color }} /> : null;
                            })()}
                            <span>{p}</span>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 hover:text-brand-700"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleString()
                        : post.scheduled_at
                          ? `Scheduled: ${new Date(post.scheduled_at).toLocaleString()}`
                          : new Date(post.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Tips</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Text posts publish to X, LinkedIn, Facebook, and Bluesky; video reaches TikTok, Instagram, and YouTube too.</li>
              <li>• Schedule around your audience&apos;s peak hours — your Attention retention curves show when they watch.</li>
            </ul>

            {topVideos.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Your top videos · 90d
                </h4>
                <div className="space-y-3">
                  {topVideos.map((v) => (
                    <a
                      key={v.id}
                      href="/dashboard/attention"
                      className="flex items-center gap-3 group"
                    >
                      {v.thumbnail_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="w-20 h-12 rounded-md object-cover shrink-0 group-hover:opacity-90"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 line-clamp-2 group-hover:text-brand-600">
                          {v.title}
                        </p>
                        <p className="text-xs text-gray-400">{v.engaged.toLocaleString()} engaged views</p>
                      </div>
                    </a>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Repost your winners — proven content earns twice.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
