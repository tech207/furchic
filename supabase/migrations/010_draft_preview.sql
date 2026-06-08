-- ============================================================
-- Furchic WebApp — 010_draft_preview.sql
-- Unified draft / preview / publish system
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE draft_previews (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type  VARCHAR(50)  NOT NULL
    CHECK (resource_type IN ('product_price','banner','faq','policy','promotion')),
  resource_id    UUID,
  draft_data     JSONB        NOT NULL,
  preview_token  VARCHAR(100) NOT NULL UNIQUE,
  created_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  draft_previews                IS '草稿預覽快照；preview_token 持有者可讀取草稿內容';
COMMENT ON COLUMN draft_previews.resource_type  IS 'product_price | banner | faq | policy | promotion';
COMMENT ON COLUMN draft_previews.resource_id    IS '對應資源的 UUID；faq 為 NULL（整份清單）';
COMMENT ON COLUMN draft_previews.draft_data     IS '草稿內容完整快照';
COMMENT ON COLUMN draft_previews.preview_token  IS '預覽連結 token，不需登入即可讀取';
COMMENT ON COLUMN draft_previews.published_at   IS '已發布時間；NULL = 尚未發布';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_draft_previews_token    ON draft_previews(preview_token);
CREATE INDEX idx_draft_previews_resource ON draft_previews(resource_type, resource_id);
CREATE INDEX idx_draft_previews_expires  ON draft_previews(expires_at) WHERE published_at IS NULL;

-- ── Cleanup function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_previews()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM draft_previews
  WHERE expires_at < NOW()
    AND published_at IS NULL;
$$;

COMMENT ON FUNCTION cleanup_expired_previews IS '清理過期且未發布的草稿，可由 pg_cron 排程呼叫';

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE draft_previews ENABLE ROW LEVEL SECURITY;

-- 任何人持有 token 皆可透過 API 讀取（API 層自行查詢，不需 JWT）
-- 此 policy 讓 service role 查詢無阻礙；一般用戶走 API route 不走 RLS
CREATE POLICY "draft_previews_admin_all" ON draft_previews
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- service role bypass RLS by default（Supabase admin client）
-- 公開預覽查詢由 API route 用 service role 執行，不需額外 policy
