'use client';

import { useEffect, useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  ExternalLink,
  Save,
  Upload,
  Trash2,
  GripVertical,
  Link,
  Youtube,
  Music,
  Type,
  Image,
  Mail,
  Smartphone,
  Tablet,
  Monitor,
  Plus,
  Palette,
  User,
  Layout,
  Share2,
  Settings,
  Eye,
  EyeOff,
  Plug,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { BIO_TEMPLATES, FONT_OPTIONS, BLOCK_TYPES } from '@/lib/bio-templates';
import { THEME_PRESETS, SOCIAL_PLATFORMS } from '@/lib/bio-themes';
import { getYouTubeVideoId, getSpotifyEmbedUrl } from '@/lib/embed-utils';

interface Profile {
  id: string;
  bio_slug: string | null;
  bio_title: string;
  bio_description: string | null;
  theme?: string;
  bio_text?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  social_links?: Record<string, string>;
  page_settings?: Record<string, unknown>;
}

interface BioBlock {
  id: string;
  block_type: 'link' | 'youtube' | 'spotify' | 'text' | 'image' | 'contact_form';
  position: number;
  block_data: Record<string, unknown>;
}

interface BioLink {
  id: string;
  title: string;
  destination_url: string;
  short_code: string;
  thumbnail_url?: string | null;
  priority?: boolean;
}

function SortableBlock({
  block,
  links,
  onUpdate,
  onDelete,
}: {
  block: BioBlock;
  links: BioLink[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [showContent, setShowContent] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const data = (block.block_data || {}) as Record<string, string>;

  return (
    <div ref={setNodeRef} style={style} className={`p-3 bg-gray-50 rounded-lg ${isDragging ? 'opacity-50 shadow-lg' : ''}`}>
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab touch-none">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-gray-500 uppercase">{block.block_type}</span>
          <p className="text-sm font-medium text-gray-900 truncate">
            {block.block_type === 'link' && links.find((l) => l.id === data.link_id)?.title}
            {block.block_type === 'youtube' && (data.url ? 'YouTube video' : 'YouTube (no URL)')}
            {block.block_type === 'spotify' && (data.url ? 'Spotify' : 'Spotify (no URL)')}
            {block.block_type === 'text' && (data.content?.slice(0, 30) || 'Text block')}
            {block.block_type === 'image' && (data.url ? 'Image' : 'Image (no URL)')}
            {block.block_type === 'contact_form' && 'Contact form'}
          </p>
        </div>
        <button onClick={() => setShowContent(!showContent)} className="p-1 text-gray-400 hover:text-gray-600">
          {showContent ? '−' : '+'}
        </button>
        <button onClick={() => onDelete(block.id)} className="p-1 text-red-500 hover:text-red-700">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {showContent && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3 pl-9">
          {block.block_type === 'link' && (
            <select
              value={data.link_id || ''}
              onChange={(e) => onUpdate(block.id, { ...data, link_id: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">Select link...</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          )}
          {(block.block_type === 'youtube' || block.block_type === 'spotify') && (
            <input
              type="url"
              value={data.url || ''}
              onChange={(e) => onUpdate(block.id, { ...data, url: e.target.value })}
              placeholder={block.block_type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://open.spotify.com/...'}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
          {block.block_type === 'text' && (
            <textarea
              value={data.content || ''}
              onChange={(e) => onUpdate(block.id, { ...data, content: e.target.value })}
              placeholder="Enter text (markdown supported)"
              rows={4}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
          {block.block_type === 'image' && (
            <div className="space-y-2">
              <input
                type="url"
                value={data.url || ''}
                onChange={(e) => onUpdate(block.id, { ...data, url: e.target.value })}
                placeholder="Image URL"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <input
                type="url"
                value={data.link_url || ''}
                onChange={(e) => onUpdate(block.id, { ...data, link_url: e.target.value })}
                placeholder="Link URL (optional)"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          )}
          {block.block_type === 'contact_form' && (
            <input
              type="text"
              value={data.title || ''}
              onChange={(e) => onUpdate(block.id, { ...data, title: e.target.value })}
              placeholder="Form title (optional)"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function BioEditorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [links, setLinks] = useState<BioLink[]>([]);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bioText, setBioText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [template, setTemplate] = useState('classic');
  const [pageSettings, setPageSettings] = useState<Record<string, unknown>>({});
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [connectedSocials, setConnectedSocials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewSize, setPreviewSize] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [activeTab, setActiveTab] = useState<'template' | 'profile' | 'content' | 'social' | 'settings'>('template');

  const TABS = [
    { id: 'template' as const, label: 'Template', icon: Palette },
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'content' as const, label: 'Content', icon: Layout },
    { id: 'social' as const, label: 'Social', icon: Share2 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileData) {
      setProfile(profileData);
      setSlug(profileData.bio_slug || '');
      setTitle(profileData.bio_title || '');
      setDisplayName(profileData.display_name || profileData.full_name || '');
      setBioText(profileData.bio_text || profileData.bio_description || '');
      setAvatarUrl(profileData.avatar_url || '');
      setTemplate(profileData.theme || 'classic');
      const templatePreset = BIO_TEMPLATES[profileData.theme as keyof typeof BIO_TEMPLATES] || BIO_TEMPLATES.classic;
      setPageSettings({ ...templatePreset.page_settings, ...(profileData.page_settings || {}) });
      setSocialLinks((profileData.social_links as Record<string, string>) || {});
    }

    // Connected posting accounts -> auto-suggest bio links for empty fields.
    // Upload-Post uses 'x'; the bio platform list calls it 'twitter'.
    const { data: accts } = await supabase
      .from('social_accounts')
      .select('platform, account_name')
      .eq('profile_id', user.id);
    if (accts?.length) {
      const bioIdFor = (p: string) => (p === 'x' ? 'twitter' : p);
      const connected: Record<string, string> = {};
      for (const a of accts) connected[bioIdFor(a.platform)] = a.account_name || '';
      setConnectedSocials(connected);

      const existing = (profileData?.social_links as Record<string, string>) || {};
      const suggestions: Record<string, string> = {};
      for (const a of accts) {
        const bioId = bioIdFor(a.platform);
        const handle = (a.account_name || '').replace(/^@/, '').trim();
        // Only prefill when the field is empty and the name looks like a handle
        if (existing[bioId] || !handle || /\s/.test(handle)) continue;
        const platform = SOCIAL_PLATFORMS.find((p) => p.id === bioId);
        if (platform) suggestions[bioId] = platform.urlPrefix + handle;
      }
      if (Object.keys(suggestions).length) {
        setSocialLinks((s) => ({ ...suggestions, ...s }));
      }
    }

    const { data: blocksData } = await supabase
      .from('bio_blocks')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });
    setBlocks(blocksData || []);

    const { data: linksData } = await supabase
      .from('links')
      .select('id, title, destination_url, short_code, thumbnail_url, priority')
      .eq('user_id', user.id)
      .eq('is_bio_link', true)
      .order('bio_order', { ascending: true });
    setLinks(linksData || []);

    setLoading(false);
  }

  async function saveProfile() {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        bio_title: title,
        bio_description: bioText,
        display_name: displayName,
        bio_text: bioText,
        avatar_url: avatarUrl || null,
        theme: template,
        social_links: socialLinks,
        page_settings: pageSettings,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || 'Failed to save');
    } else {
      toast.success('Bio page saved!');
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setAvatarUploading(true);
    setAvatarProgress(0);
    const timer = setInterval(() => setAvatarProgress((p) => Math.min(p + 20, 90)), 100);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      clearInterval(timer);
      setAvatarProgress(100);
      if (res.ok) {
        setAvatarUrl(data.url);
        toast.success('Avatar uploaded!');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      clearInterval(timer);
      toast.error('Upload failed');
    }
    setAvatarUploading(false);
    e.target.value = '';
  }

  async function addBlock(type: BioBlock['block_type']) {
    const res = await fetch('/api/bio-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_type: type, position: blocks.length, block_data: {} }),
    });
    if (res.ok) {
      const block = await res.json();
      setBlocks((b) => [...b, block]);
      setShowAddBlock(false);
    } else {
      toast.error('Failed to add block');
    }
  }

  async function updateBlock(id: string, blockData: Record<string, unknown>) {
    const res = await fetch(`/api/bio-blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_data: blockData }),
    });
    if (res.ok) {
      setBlocks((b) => b.map((x) => (x.id === id ? { ...x, block_data: blockData } : x)));
    }
  }

  async function deleteBlock(id: string) {
    const res = await fetch(`/api/bio-blocks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBlocks((b) => b.filter((x) => x.id !== id));
    }
  }

  async function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(newOrder);
    const res = await fetch('/api/bio-blocks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: newOrder.map((b) => b.id) }),
    });
    if (!res.ok) toast.error('Failed to reorder');
  }

  function applyTemplate(id: keyof typeof BIO_TEMPLATES) {
    const t = BIO_TEMPLATES[id];
    if (!t) return;
    setTemplate(id);
    setPageSettings(t.page_settings as Record<string, unknown>);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const settings = pageSettings as Record<string, string>;
  const previewBg =
    settings?.background_type === 'gradient'
      ? `linear-gradient(180deg, ${settings.background_value || '#fff'}, ${settings.background_value_2 || '#fff'})`
      : settings?.background_value || '#ffffff';

  const previewWidths = { mobile: 280, tablet: 400, desktop: 480 };

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bio Page</h1>
          <p className="text-gray-500 mt-1">Templates, blocks, and custom styling.</p>
        </div>
        <div className="flex items-center gap-3">
          {slug && (
            <>
              <button onClick={() => { navigator.clipboard.writeText(`${appUrl}/${slug}`); toast.success('Copied!'); }} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
                <Copy className="w-4 h-4" /> Copy URL
              </button>
              <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
                <ExternalLink className="w-4 h-4" /> Preview
              </a>
            </>
          )}
          <button onClick={saveProfile} disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          {activeTab === 'template' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Template</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {Object.entries(BIO_TEMPLATES).map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => applyTemplate(id as keyof typeof BIO_TEMPLATES)}
                    className={`p-3 rounded-xl border-2 text-left transition ${template === id ? 'border-brand-600 ring-2 ring-brand-200' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div
                      className="h-16 rounded-lg mb-2"
                      style={{
                        background: t.page_settings.background_type === 'gradient'
                          ? `linear-gradient(180deg, ${t.page_settings.background_value}, ${t.page_settings.background_value_2})`
                          : t.page_settings.background_value,
                      }}
                    />
                    <p className="text-xs font-medium text-gray-700">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.description}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font</label>
                <select
                  value={settings?.font_family || 'Inter'}
                  onChange={(e) => setPageSettings((s) => ({ ...s, font_family: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file?.type.startsWith('image/')) {
                        const input = fileInputRef.current;
                        if (input) {
                          const dt = new DataTransfer();
                          dt.items.add(file);
                          input.files = dt.files;
                          input.dispatchEvent(new Event('change'));
                        }
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-500 hover:bg-brand-50/50 transition"
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">Drop image or click to upload</p>
                      <p className="text-xs text-gray-500 mt-1">Supabase Storage • JPG, PNG</p>
                      {avatarUploading && (
                        <div className="mt-2 h-1.5 bg-gray-200 rounded overflow-hidden">
                          <div className="h-full bg-brand-600 rounded transition-all" style={{ width: `${avatarProgress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Or paste image URL"
                    className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio Text</label>
                  <textarea value={bioText} onChange={(e) => setBioText(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Creator, educator ✨" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Content Blocks</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {blocks.map((block) => (
                      <SortableBlock
                        key={block.id}
                        block={block}
                        links={links}
                        onUpdate={updateBlock}
                        onDelete={deleteBlock}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="relative mt-4">
                <button onClick={() => setShowAddBlock(!showAddBlock)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add block
                </button>
                {showAddBlock && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-lg z-10 grid grid-cols-2 gap-2">
                    {BLOCK_TYPES.map((bt) => (
                      <button
                        key={bt.id}
                        onClick={() => addBlock(bt.id as BioBlock['block_type'])}
                        className="px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100 flex items-center gap-2"
                      >
                        {bt.id === 'link' && <Link className="w-4 h-4" />}
                        {bt.id === 'youtube' && <Youtube className="w-4 h-4" />}
                        {bt.id === 'spotify' && <Music className="w-4 h-4" />}
                        {bt.id === 'text' && <Type className="w-4 h-4" />}
                        {bt.id === 'image' && <Image className="w-4 h-4" />}
                        {bt.id === 'contact_form' && <Mail className="w-4 h-4" />}
                        {bt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Social Links</h3>
              <p className="text-xs text-gray-500 mb-4">
                Connected accounts fill in automatically. Use the eye to show or hide a link
                on your public page.
              </p>
              <div className="space-y-2">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const hidden = ((pageSettings.hidden_socials as string[]) || []).includes(platform.id);
                  const isConnectable = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'twitter'].includes(platform.id);
                  const isConnected = platform.id in connectedSocials;
                  return (
                    <div key={platform.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-24 shrink-0">{platform.name}</span>
                      <input
                        type="url"
                        value={socialLinks[platform.id] || ''}
                        onChange={(e) => setSocialLinks((s) => ({ ...s, [platform.id]: e.target.value }))}
                        placeholder={platform.urlPrefix}
                        className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm ${hidden ? 'opacity-50' : ''}`}
                      />
                      <button
                        type="button"
                        title={hidden ? 'Hidden on your page — click to show' : 'Shown on your page — click to hide'}
                        onClick={() => setPageSettings((ps) => {
                          const cur = (ps.hidden_socials as string[]) || [];
                          return {
                            ...ps,
                            hidden_socials: hidden ? cur.filter((id) => id !== platform.id) : [...cur, platform.id],
                          };
                        })}
                        className={`p-2 rounded-lg hover:bg-gray-100 ${hidden ? 'text-gray-300' : 'text-gray-600'}`}
                      >
                        {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {isConnectable && !isConnected && (
                        <a
                          href="/dashboard/social"
                          title="Not connected — connect this account in Social Hub"
                          className="p-2 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-gray-100"
                        >
                          <Plug className="w-4 h-4" />
                        </a>
                      )}
                      {isConnectable && isConnected && (
                        <span title="Connected in Social Hub" className="p-2 text-green-500">
                          <Plug className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Page Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-400 mr-1">{appUrl}/</span>
                    <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="yourname" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="My Links" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                  <select
                    value={settings?.background_type || 'solid'}
                    onChange={(e) => setPageSettings((s) => ({ ...s, background_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="solid">Solid color</option>
                    <option value="gradient">Gradient</option>
                    <option value="image">Image URL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page Animation</label>
                  <select
                    value={(settings?.page_animation as string) || 'none'}
                    onChange={(e) => setPageSettings((s) => ({ ...s, page_animation: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade in</option>
                    <option value="reveal_down">Reveal top to bottom</option>
                    <option value="rise">Rise up</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    How your page appears when a visitor opens it. Skipped automatically for
                    visitors who prefer reduced motion.
                  </p>
                </div>
                {(settings?.background_type || 'solid') === 'solid' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="color"
                      value={settings?.background_value || '#ffffff'}
                      onChange={(e) => setPageSettings((s) => ({ ...s, background_value: e.target.value }))}
                      className="w-full h-10 rounded cursor-pointer"
                    />
                  </div>
                )}
                {(settings?.background_type || 'solid') === 'gradient' && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color 1</label>
                      <input
                        type="color"
                        value={settings?.background_value || '#3b82f6'}
                        onChange={(e) => setPageSettings((s) => ({ ...s, background_value: e.target.value }))}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color 2</label>
                      <input
                        type="color"
                        value={settings?.background_value_2 || '#1d4ed8'}
                        onChange={(e) => setPageSettings((s) => ({ ...s, background_value_2: e.target.value }))}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}
                {(settings?.background_type || 'solid') === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={(settings?.background_image as string) || ''}
                      onChange={(e) => setPageSettings((s) => ({ ...s, background_image: e.target.value }))}
                      placeholder="https://..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Shape</label>
                  <select
                    value={settings?.button_style || 'rounded'}
                    onChange={(e) => setPageSettings((s) => ({ ...s, button_style: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="rounded">Rounded</option>
                    <option value="pill">Pill</option>
                    <option value="square">Square</option>
                    <option value="outline">Outline</option>
                    <option value="square_outline">Square outline</option>
                    <option value="filled">Filled</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings?.email_capture as unknown) === true}
                    onChange={(e) => setPageSettings((s) => ({ ...s, email_capture: e.target.checked }))}
                    className="rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm text-gray-700">Show email signup form on bio page</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-1">
          <div className="sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-2">Live Preview</h3>
            <div className="flex gap-2 mb-3">
              {(['mobile', 'tablet', 'desktop'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPreviewSize(size)}
                  className={`p-2 rounded-lg border ${previewSize === size ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  {size === 'mobile' && <Smartphone className="w-4 h-4" />}
                  {size === 'tablet' && <Tablet className="w-4 h-4" />}
                  {size === 'desktop' && <Monitor className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <div className="mx-auto rounded-[2rem] border-[10px] border-gray-800 bg-gray-900 p-2 shadow-2xl" style={{ width: previewWidths[previewSize] + 20 }}>
              <div
                className="overflow-y-auto rounded-xl animate-fade-in"
                style={{
                  height: 520,
                  background: previewBg,
                  fontFamily: settings?.font_family || 'Inter',
                }}
              >
                <div className="p-6 text-center">
                  {(settings?.show_avatar as unknown) !== false && (
                    <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden flex items-center justify-center bg-white/20" style={{ borderColor: settings?.accent_color }}>
                      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold" style={{ color: settings?.accent_color }}>{(displayName || '?')[0]}</span>}
                    </div>
                  )}
                  <h2 className="text-lg font-bold" style={{ color: settings?.text_color }}>{displayName || title || 'My Links'}</h2>
                  {bioText && <p className="text-xs mt-1 opacity-90" style={{ color: settings?.text_color }}>{bioText}</p>}
                </div>
                <div className="px-4 pb-6 space-y-2">
                  {blocks.map((block, i) => (
                    <div key={block.id} className="animate-link-in" style={{ animationDelay: `${i * 50}ms` }}>
                      {block.block_type === 'link' && (() => {
                        const link = links.find((l) => l.id === (block.block_data as { link_id?: string })?.link_id);
                        if (!link) return <div className="p-3 rounded-lg bg-gray-200/50 text-gray-500 text-sm">Select link</div>;
                        return (
                          <div className="p-3 rounded-xl text-sm font-medium" style={{ backgroundColor: settings?.accent_color, color: '#fff' }}>
                            {link.thumbnail_url && <img src={link.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover inline-block mr-2 align-middle" />}
                            {link.title}
                          </div>
                        );
                      })()}
                      {block.block_type === 'youtube' && (() => {
                        const vid = getYouTubeVideoId((block.block_data as { url?: string })?.url || '');
                        if (!vid) return <div className="p-3 rounded-lg bg-gray-200/50 text-gray-500 text-xs">YouTube URL</div>;
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
                        const embedUrl = getSpotifyEmbedUrl((block.block_data as { url?: string })?.url || '');
                        if (!embedUrl) return <div className="p-3 rounded-lg bg-gray-200/50 text-gray-500 text-xs">Spotify URL</div>;
                        return (
                          <iframe src={embedUrl} title="Spotify" className="w-full h-80 rounded-xl" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
                        );
                      })()}
                      {block.block_type === 'text' && (
                        <div className="p-3 rounded-lg text-xs whitespace-pre-wrap" style={{ color: settings?.text_color, backgroundColor: 'rgba(0,0,0,0.05)' }}>
                          {(block.block_data as { content?: string })?.content || 'Text...'}
                        </div>
                      )}
                      {block.block_type === 'image' && (() => {
                        const url = (block.block_data as { url?: string })?.url;
                        if (!url) return <div className="p-3 rounded-lg bg-gray-200/50 text-gray-500 text-xs">Image URL</div>;
                        return <img src={url} alt="" className="w-full rounded-xl object-cover" />;
                      })()}
                      {block.block_type === 'contact_form' && (
                        <div className="p-3 rounded-xl border-2" style={{ borderColor: settings?.accent_color }}>
                          <p className="text-xs font-medium mb-2" style={{ color: settings?.text_color }}>{(block.block_data as { title?: string })?.title || 'Contact'}</p>
                          <input placeholder="Name" className="w-full mb-2 px-2 py-1.5 rounded text-xs bg-white/10" readOnly />
                          <input placeholder="Email" className="w-full mb-2 px-2 py-1.5 rounded text-xs bg-white/10" readOnly />
                          <input placeholder="Message" className="w-full mb-2 px-2 py-1.5 rounded text-xs bg-white/10" readOnly />
                          <button className="w-full py-2 rounded text-xs font-medium text-white" style={{ backgroundColor: settings?.accent_color }}>Send</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
