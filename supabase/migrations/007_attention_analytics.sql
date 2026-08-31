-- ============================================
-- Attention Dashboard (Phase 1): YouTube analytics
-- ============================================

-- One row per connected analytics account (YouTube first; platform column
-- keeps the door open for Spotify/TikTok/Meta connectors later)
CREATE TABLE IF NOT EXISTS public.analytics_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'spotify', 'tiktok', 'meta')),
  external_account_id TEXT NOT NULL,      -- YouTube channel id
  account_name TEXT,                      -- channel title
  refresh_token TEXT NOT NULL,            -- long-lived; service-role access only
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),

  UNIQUE(profile_id, platform, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_connections_profile
  ON public.analytics_connections(profile_id);

-- One row per video/episode
CREATE TABLE IF NOT EXISTS public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.analytics_connections(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,              -- YouTube video id
  title TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(connection_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_profile
  ON public.content_items(profile_id, published_at DESC);

-- One row per video per day of metrics
CREATE TABLE IF NOT EXISTS public.content_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  views BIGINT DEFAULT 0,                 -- public (inflated) views
  engaged_views BIGINT DEFAULT 0,         -- the post-Aug-24 "real" number
  minutes_watched BIGINT DEFAULT 0,       -- engaged watch time
  average_view_duration_seconds INTEGER,  -- AVD
  average_view_percentage NUMERIC(5,2),   -- APV
  subscribers_gained INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,

  UNIQUE(content_item_id, date)
);

CREATE INDEX IF NOT EXISTS idx_content_metrics_profile_date
  ON public.content_metrics_daily(profile_id, date DESC);

-- Audience retention curve: ~100 points per video (ratio of video elapsed
-- vs share of audience still watching)
CREATE TABLE IF NOT EXISTS public.retention_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  elapsed_ratio NUMERIC(5,4) NOT NULL,    -- 0.00 .. 1.00 through the video
  audience_ratio NUMERIC(6,4) NOT NULL,   -- share of viewers still watching
  captured_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(content_item_id, elapsed_ratio)
);

-- Public, shareable media kit
CREATE TABLE IF NOT EXISTS public.media_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  shown_metrics JSONB DEFAULT '["engaged_views","minutes_watched","avd","apv"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_kits_profile ON public.media_kits(profile_id);

-- ============================================
-- Row level security
-- ============================================
ALTER TABLE public.analytics_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_kits ENABLE ROW LEVEL SECURITY;

-- Owners can see their connections but tokens stay server-side: the client
-- reads via a view without token columns; the base table has no user SELECT.
CREATE OR REPLACE VIEW public.my_analytics_connections
  WITH (security_invoker = false) AS
  SELECT id, profile_id, platform, external_account_id, account_name,
         connected_at, last_synced_at, last_sync_error, status
  FROM public.analytics_connections
  WHERE profile_id = auth.uid();

GRANT SELECT ON public.my_analytics_connections TO authenticated;

CREATE POLICY "Users view own content items" ON public.content_items
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users view own metrics" ON public.content_metrics_daily
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users view own retention" ON public.retention_points
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = content_item_id AND ci.profile_id = auth.uid()
  ));

CREATE POLICY "Users manage own media kits" ON public.media_kits
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
