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

const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: '📱' },
  { id: 'instagram', name: 'Instagram', icon: '📸' },
  { id: 'youtube', name: 'YouTube', icon: '▶️' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'facebook', name: 'Facebook', icon: '👍' },
  { id: 'x', name: 'X/Twitter', icon: '𝕏' },
  { id: 'bluesky', name: 'Bluesky', icon: '🦋' },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_CHARS = 280;

  useEffect(() => {
    loadData();
  }, []);

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
          {/* Connected Accounts */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5" /> Posting Accounts
            </h2>
            <p className="text-xs text-gray-500 -mt-2 mb-4">
              These connections let CreatorPixel publish on your behalf. They're separate
              from the analytics connection on the Attention page.
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              {PLATFORMS.map((platform) => {
                const account = accounts.find((a) => a.platform === platform.id);
                const connected = !!account;
                return (
                  <div
                    key={platform.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                      connected
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{platform.icon}</span>
                    <span className="text-sm font-medium">{platform.name}</span>
                    {connected ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Connect Account
            </button>
            <p className="text-xs text-gray-500 mt-2">
              You&apos;ll be redirected to Upload-Post to connect your accounts via OAuth.
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
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => (
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
                      <span>{platform.icon}</span>
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
                            <span>
                              {PLATFORMS.find((x) => x.id === p)?.icon} {p}
                            </span>
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
            <h3 className="font-semibold text-gray-900 mb-4">Quick Tips</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Connect your accounts via Upload-Post OAuth to post</li>
              <li>• Text-only posts work on X, LinkedIn, Facebook, Bluesky</li>
              <li>• Images supported on TikTok, Instagram, LinkedIn, Facebook, X, Bluesky</li>
              <li>• Video supported on TikTok, Instagram, YouTube, LinkedIn, Facebook, X</li>
              <li>• Schedule posts for optimal engagement</li>
            </ul>
            <a
              href="https://docs.upload-post.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
            >
              Upload-Post Docs <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
