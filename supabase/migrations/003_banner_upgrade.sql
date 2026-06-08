-- 003_banner_upgrade.sql
-- Adds scheduling, mobile image, accessibility, and draft/publish status to banners.
-- Also back-fills columns that existed in API code but were missing from the table.

-- ── Back-fill missing columns ─────────────────────────────────────────────────

-- Allow nullable title/image_url (API code has always treated these as nullable)
ALTER TABLE banners ALTER COLUMN title      DROP NOT NULL;
ALTER TABLE banners ALTER COLUMN image_url  DROP NOT NULL;

-- Columns used by the API layer but never in the DB schema
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS bg_class VARCHAR(200);

-- ── New feature columns ───────────────────────────────────────────────────────

ALTER TABLE banners ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS alt_text          VARCHAR(200);
ALTER TABLE banners ADD COLUMN IF NOT EXISTS starts_at         TIMESTAMPTZ;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS ends_at           TIMESTAMPTZ;

ALTER TABLE banners ADD COLUMN IF NOT EXISTS status VARCHAR(20)
  NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'archived'));

-- ── Update RLS select policy ──────────────────────────────────────────────────
-- Extend the existing public read policy to also honour status and scheduling.

DROP POLICY IF EXISTS "banners_select_active" ON banners;

CREATE POLICY "banners_select_active" ON banners
  FOR SELECT USING (
    is_active = true
    AND status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );
