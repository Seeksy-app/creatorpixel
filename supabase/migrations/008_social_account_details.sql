-- Avatar and follower count for connected posting accounts,
-- synced from Upload-Post
ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS followers INTEGER;
