'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Youtube, CheckCircle2, AlertCircle, Loader2, Unplug } from 'lucide-react';

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

export default function AttentionPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
      <AttentionContent />
    </Suspense>
  );
}

function AttentionContent() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('my_analytics_connections').select('*');
    setConnections(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Attention</h1>
      <p className="text-gray-500 mt-1">
        Sponsor-grade engagement metrics, pulled straight from the platforms.
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
          YouTube connected. First sync will backfill the last 90 days.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">Connected platforms</h2>

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
                      {c.last_sync_error ? ` · last sync failed` : ''}
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

      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
        Metrics dashboard and media kit land here after the first sync — engaged views,
        watch hours, average view duration, average percentage viewed, and per-video
        retention curves.
      </div>
    </div>
  );
}
