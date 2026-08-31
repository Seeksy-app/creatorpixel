'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Youtube, CheckCircle2, AlertCircle, Loader2, Unplug, RefreshCw,
  Eye, Clock, Timer, Percent,
} from 'lucide-react';

interface Connection {
  id: string;
  platform: string;
  external_account_id: string;
  account_name: string | null;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  status: string;
}

interface ContentItem {
  id: string;
  external_id: string;
  title: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
}

interface MetricRow {
  content_item_id: string;
  views: number;
  engaged_views: number;
  minutes_watched: number;
  average_view_duration_seconds: number | null;
  average_view_percentage: number | null;
}

function fmtDuration(s: number | null | undefined): string {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function AttentionPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
      <AttentionContent />
    </Suspense>
  );
}

function AttentionContent() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [metrics, setMetrics] = useState<Map<string, MetricRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: conns } = await supabase.from('my_analytics_connections').select('*');
    setConnections(conns || []);

    const { data: content } = await supabase
      .from('content_items')
      .select('id, external_id, title, thumbnail_url, published_at, duration_seconds')
      .order('published_at', { ascending: false })
      .limit(50);
    setItems(content || []);

    if (content && content.length) {
      const { data: rows } = await supabase
        .from('content_metrics_daily')
        .select('content_item_id, views, engaged_views, minutes_watched, average_view_duration_seconds, average_view_percentage')
        .in('content_item_id', content.map((c) => c.id));

      // Aggregate the daily rows per video: sums for counts, weighted-by-views
      // averages for AVD/APV
      const agg = new Map<string, MetricRow>();
      for (const r of rows || []) {
        const cur = agg.get(r.content_item_id) || {
          content_item_id: r.content_item_id, views: 0, engaged_views: 0,
          minutes_watched: 0, average_view_duration_seconds: 0, average_view_percentage: 0,
        };
        const prevViews = cur.views;
        cur.views += r.views || 0;
        cur.engaged_views += r.engaged_views || 0;
        cur.minutes_watched += r.minutes_watched || 0;
        if (cur.views > 0) {
          cur.average_view_duration_seconds = Math.round(
            ((cur.average_view_duration_seconds || 0) * prevViews + (r.average_view_duration_seconds || 0) * (r.views || 0)) / cur.views
          );
          cur.average_view_percentage = Number(
            (((cur.average_view_percentage || 0) * prevViews + (Number(r.average_view_percentage) || 0) * (r.views || 0)) / cur.views).toFixed(1)
          );
        }
        agg.set(r.content_item_id, cur);
      }
      setMetrics(agg);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function syncNow() {
    setSyncing(true);
    await fetch('/api/analytics/sync', { method: 'POST' });
    await load();
    setSyncing(false);
  }

  async function disconnect(id: string) {
    setBusy(true);
    await fetch('/api/analytics/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_id: id }),
    });
    await load();
    setBusy(false);
  }

  const error = searchParams.get('error');
  const justConnected = searchParams.get('connected');

  // Channel-level totals across all videos
  const totals = Array.from(metrics.values()).reduce(
    (t, m) => ({
      views: t.views + m.views,
      engaged: t.engaged + m.engaged_views,
      minutes: t.minutes + m.minutes_watched,
    }),
    { views: 0, engaged: 0, minutes: 0 }
  );
  const withApv = Array.from(metrics.values()).filter((m) => m.average_view_percentage);
  const avgApv = withApv.length
    ? (withApv.reduce((s, m) => s + (Number(m.average_view_percentage) || 0), 0) / withApv.length).toFixed(1)
    : null;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Attention</h1>
      <p className="text-gray-500 mt-1">
        Sponsor-grade engagement metrics, pulled straight from the platforms. This is a
        read-only stats connection — to publish posts, use{' '}
        <a href="/dashboard/social" className="text-blue-600 hover:underline">Social Hub</a>.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Connection failed ({error}). Try again, and make sure you approve both permissions on the Google screen.
        </div>
      )}
      {justConnected && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          YouTube connected. Hit “Sync now” to pull your last 90 days.
        </div>
      )}

      {/* Summary cards */}
      {metrics.size > 0 && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
              <Eye className="h-3.5 w-3.5" /> Engaged views · 90d
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{fmtNum(totals.engaged || totals.views)}</p>
            {totals.engaged > 0 && totals.views > 0 && (
              <p className="text-xs text-gray-400">{fmtNum(totals.views)} public views</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5" /> Watch hours · 90d
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{fmtNum(Math.round(totals.minutes / 60))}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
              <Timer className="h-3.5 w-3.5" /> Videos tracked
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.size}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
              <Percent className="h-3.5 w-3.5" /> Avg % viewed
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{avgApv ? `${avgApv}%` : '—'}</p>
          </div>
        </div>
      )}

      {/* Connections */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Connected platforms</h2>
          {connections.length > 0 && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : connections.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Nothing connected yet. Connect your YouTube channel to pull engaged views,
            watch hours, and retention — the numbers sponsors ask for.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Youtube className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{c.account_name || c.external_account_id}</p>
                    <p className="text-xs text-gray-500">
                      {c.last_synced_at
                        ? `Last synced ${new Date(c.last_synced_at).toLocaleString()}`
                        : 'Not synced yet'}
                      {c.last_sync_error ? ' · last sync failed' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnect(c.id)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                >
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}

        <a
          href="/api/analytics/connect"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Youtube className="h-4 w-4" />
          Connect YouTube
        </a>
      </div>

      {/* Per-video table */}
      {items.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Video</th>
                  <th className="px-4 py-3 text-right">Engaged views</th>
                  <th className="px-4 py-3 text-right">Watch hours</th>
                  <th className="px-4 py-3 text-right">AVD</th>
                  <th className="px-4 py-3 text-right">% viewed</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => {
                  const m = metrics.get(v.id);
                  return (
                    <tr key={v.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {v.thumbnail_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={v.thumbnail_url} alt="" className="h-9 w-16 rounded object-cover" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 line-clamp-1">{v.title || v.external_id}</p>
                            <p className="text-xs text-gray-400">
                              {v.published_at ? new Date(v.published_at).toLocaleDateString() : ''} · {fmtDuration(v.duration_seconds)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{m ? fmtNum(m.engaged_views || m.views) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{m ? fmtNum(Math.round(m.minutes_watched / 60)) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtDuration(m?.average_view_duration_seconds)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{m?.average_view_percentage ? `${m.average_view_percentage}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length === 0 && !loading && connections.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
          No video data yet — hit “Sync now” above to pull your last 90 days from YouTube.
        </div>
      )}
    </div>
  );
}
