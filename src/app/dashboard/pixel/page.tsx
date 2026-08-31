'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Code2, Copy, Check, RefreshCw, Globe, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface PixelDomain {
  domain: string;
  last_seen_at: string;
  total_events: number;
  status: string;
}

export default function PixelSettingsPage() {
  const [pixelId, setPixelId] = useState('');
  const [domains, setDomains] = useState<PixelDomain[]>([]);
  const [installed, setInstalled] = useState(false);
  const [recentActivity, setRecentActivity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'snippet' | 'platforms'>('snippet');
  const supabase = createClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creatorpixel.app';

  useEffect(() => {
    loadPixelStatus();
  }, []);

  async function loadPixelStatus() {
    setLoading(true);
    try {
      // Get pixel_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('pixel_id')
        .eq('id', user.id)
        .single();

      if (profile?.pixel_id) {
        setPixelId(profile.pixel_id);
      }

      // Check pixel status
      const res = await fetch('/api/pixel-status');
      if (res.ok) {
        const data = await res.json();
        setInstalled(data.installed);
        setRecentActivity(data.recentActivity);
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error('Failed to load pixel status:', err);
    }
    setLoading(false);
  }

  async function testInstallation() {
    setTesting(true);
    // Wait 3 seconds then re-check
    await new Promise(r => setTimeout(r, 3000));
    await loadPixelStatus();
    setTesting(false);
    if (recentActivity) {
      toast.success('Pixel detected! Events are coming in.');
    } else {
      toast.error('No events detected in the last 5 minutes. Make sure the pixel is installed and visit your site.');
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  }

  const installSnippet = `<!-- CreatorPixel Tracking -->
<script>
  (function(c,r,e,a,t,o,p){
    c[t]=c[t]||function(){(c[t].q=c[t].q||[]).push(arguments)};
    o=r.createElement(e);o.async=1;
    o.src='${appUrl}/pixel.js';
    p=r.getElementsByTagName(e)[0];p.parentNode.insertBefore(o,p);
  })(window,document,'script','','cpx');
  cpx('init', '${pixelId}', { rb2b: 'GOYPYH44EYOX' });
  cpx('track', 'pageview');
</script>`;

  const identifySnippet = `// Call this when you know who the visitor is (e.g. after form submit)
cpx('identify', 'visitor@email.com');`;

  const platformInstructions = [
    {
      name: 'WordPress',
      icon: '🔧',
      steps: [
        'Go to Appearance → Theme Editor (or use a plugin like "Insert Headers and Footers")',
        'Open header.php or use the plugin\'s "Header Scripts" section',
        'Paste the tracking snippet just before the closing </head> tag',
        'Save changes',
      ],
    },
    {
      name: 'Squarespace',
      icon: '◾',
      steps: [
        'Go to Settings → Advanced → Code Injection',
        'Paste the tracking snippet in the "Header" section',
        'Click Save',
      ],
    },
    {
      name: 'Webflow',
      icon: '🌐',
      steps: [
        'Go to Project Settings → Custom Code',
        'Paste the tracking snippet in the "Head Code" section',
        'Publish your site for changes to take effect',
      ],
    },
    {
      name: 'Shopify',
      icon: '🛒',
      steps: [
        'Go to Online Store → Themes → Edit Code',
        'Open theme.liquid',
        'Paste the tracking snippet just before </head>',
        'Save',
      ],
    },
    {
      name: 'Custom HTML',
      icon: '📄',
      steps: [
        'Open your HTML file(s)',
        'Paste the tracking snippet in the <head> section of every page',
        'Or add it to your shared layout/template file',
      ],
    },
    {
      name: 'Next.js / React',
      icon: '⚛️',
      steps: [
        'Add the snippet to your _document.tsx (Pages Router) or layout.tsx (App Router)',
        'Place it inside the <Head> component or use next/script with strategy="afterInteractive"',
        'Alternatively, use dangerouslySetInnerHTML in the head',
      ],
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Site Pixel</h1>
        <p className="text-gray-500 mt-1">Install CreatorPixel on your website — 3-layer identity resolution identifies up to 70% of visitors.</p>
      </div>

      {/* Status Card */}
      <div className={`rounded-xl border-2 p-6 mb-8 ${
        installed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {installed ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <p className={`font-semibold ${installed ? 'text-green-900' : 'text-amber-900'}`}>
                {loading ? 'Checking...' : installed ? 'Pixel Active' : 'Not Installed Yet'}
              </p>
              <p className={`text-sm ${installed ? 'text-green-700' : 'text-amber-700'}`}>
                {loading
                  ? 'Checking pixel status...'
                  : installed
                    ? `Tracking on ${domains.length} domain${domains.length !== 1 ? 's' : ''}`
                    : 'Paste the snippet below into your website\'s <head> tag'}
              </p>
            </div>
          </div>
          <button
            onClick={testInstallation}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Checking...' : 'Test Installation'}
          </button>
        </div>
      </div>

      {/* Pixel ID */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Your Pixel ID</h3>
          <button
            onClick={() => copyToClipboard(pixelId, 'pixelId')}
            className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            {copied === 'pixelId' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'pixelId' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <code className="block bg-gray-50 rounded-lg px-4 py-3 text-sm font-mono text-gray-700 select-all">
          {loading ? '...' : pixelId}
        </code>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('snippet')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'snippet' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Code2 className="w-4 h-4 inline mr-2" />
          Installation Code
        </button>
        <button
          onClick={() => setActiveTab('platforms')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'platforms' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          Platform Guides
        </button>
      </div>

      {activeTab === 'snippet' && (
        <div className="space-y-6">
          {/* Main Snippet */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Tracking Snippet</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Add this to your website's {'<head>'} tag on every page you want to track.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(installSnippet, 'snippet')}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                {copied === 'snippet' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'snippet' ? 'Copied!' : 'Copy Snippet'}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
              {installSnippet}
            </pre>
          </div>

          {/* Identify Snippet */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Identify Visitors (Optional)</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Call this when a visitor provides their email (form submission, login, etc.)
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(identifySnippet, 'identify')}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied === 'identify' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'identify' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
              {identifySnippet}
            </pre>
          </div>

          {/* 3-Layer Overview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">3-Layer Identity Resolution</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700">1</span>
                <div>
                  <p className="font-medium text-blue-900 text-sm">RB2B — LinkedIn Identification</p>
                  <p className="text-xs text-blue-700">Matches ~30% of US B2B visitors to LinkedIn profiles. Free tier available.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-700">2</span>
                <div>
                  <p className="font-medium text-purple-900 text-sm">People Data Labs — IP Enrichment</p>
                  <p className="text-xs text-purple-700">Resolves visitor IP to company + person data. Runs automatically on every visit.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <span className="flex-shrink-0 w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-700">3</span>
                <div>
                  <p className="font-medium text-green-900 text-sm">Email Capture — Full Person Enrichment</p>
                  <p className="text-xs text-green-700">When visitors submit forms, PDL enriches with full profile. Highest confidence.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'platforms' && (
        <div className="space-y-4">
          {platformInstructions.map((platform) => (
            <div key={platform.name} className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                <span className="mr-2">{platform.icon}</span>
                {platform.name}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                {platform.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Detected Domains */}
      {domains.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mt-6">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Detected Domains</h3>
            <p className="text-sm text-gray-500 mt-1">Sites where your pixel has been detected.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {domains.map((d) => (
              <div key={d.domain} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900">{d.domain}</span>
                    <span className="text-sm text-gray-400 ml-3">{d.total_events.toLocaleString()} events</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    d.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {d.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Last seen {new Date(d.last_seen_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
