-- ============================================================
-- Furchic WebApp — 002_about_faq_partners.sql
-- ============================================================

BEGIN;

-- ── FAQ 問題清單 ──────────────────────────────────────────────────────────────

CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question VARCHAR(200) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  -- general | membership | nfc | shipping | payment
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 合作夥伴 ─────────────────────────────────────────────────────────────────

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  category VARCHAR(50) DEFAULT 'brand',
  -- brand | store | enterprise
  is_marquee BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 洽談聯絡設定（單筆） ─────────────────────────────────────────────────────

CREATE TABLE contact_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email VARCHAR(100),
  line_url TEXT,
  form_title VARCHAR(100) DEFAULT '合作洽談',
  form_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_settings ENABLE ROW LEVEL SECURITY;

-- faqs：公開可讀（is_active=true），admin 可全操作
CREATE POLICY "faqs_public_read" ON faqs
  FOR SELECT USING (is_active = true);

CREATE POLICY "faqs_admin_all" ON faqs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- partners：同上
CREATE POLICY "partners_public_read" ON partners
  FOR SELECT USING (is_active = true);

CREATE POLICY "partners_admin_all" ON partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- contact_settings：公開可讀，admin 可寫
CREATE POLICY "contact_settings_public_read" ON contact_settings
  FOR SELECT USING (true);

CREATE POLICY "contact_settings_admin_write" ON contact_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_faqs_category_sort ON faqs(category, sort_order, is_active);
CREATE INDEX idx_partners_sort ON partners(sort_order, is_active);

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_contact_settings_updated_at
  BEFORE UPDATE ON contact_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed Data ────────────────────────────────────────────────────────────────

INSERT INTO faqs (question, answer, category, sort_order) VALUES
('如何申請 NFC 卡？', '購買活動商品後，使用包裝上的兌換碼，完成會員註冊與寵物建檔，即可申請印製專屬 NFC 卡。', 'nfc', 1),
('NFC 卡遺失怎麼辦？', '請立即登入會員中心，進入寵物管理頁面，點選「停用卡片」即可防止個資外洩。', 'nfc', 2),
('會員等級如何升等？', '依照累積消費金額自動升等，購物滿 NT$5,000 升銀卡，滿 NT$20,000 升金卡。', 'membership', 1),
('回饋金如何使用？', '結帳時可選擇使用回饋金折抵，1 點等於 NT$1，每筆最多折抵訂單金額 50%。', 'membership', 2),
('運費如何計算？', '單筆訂單滿 NT$1,500 享免運費，未滿則運費 NT$60。', 'shipping', 1),
('可以退換貨嗎？', '商品到貨 7 天內，如有瑕疵或錯誤出貨，可申請退換貨。詳情請參閱退換貨政策。', 'shipping', 2);

INSERT INTO contact_settings (email, form_title, form_description) VALUES
('partnership@petchic.tw', '合作洽談', '歡迎品牌、店家、企業與我們洽談合作，請填寫以下資料，我們將盡快與您聯繫。');

COMMIT;
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
-- ── logistics_settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS logistics_settings (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_type          VARCHAR(50)  NOT NULL UNIQUE,
  display_name            VARCHAR(100) NOT NULL,
  is_enabled              BOOLEAN      NOT NULL DEFAULT FALSE,
  shipping_fee            INTEGER      NOT NULL DEFAULT 60,
  free_shipping_threshold INTEGER,                             -- NULL → use global system_settings
  ecpay_logistics_id      VARCHAR(50),
  settings                JSONB        NOT NULL DEFAULT '{}',
  sort_order              INTEGER      NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER logistics_settings_updated_at
  BEFORE UPDATE ON logistics_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed ──────────────────────────────────────────────────────────────────────

INSERT INTO logistics_settings (logistics_type, display_name, shipping_fee, sort_order) VALUES
  ('HOME',       '宅配到府',          100, 1),
  ('UNIMART',    '7-ELEVEN 超商取貨',  60, 2),
  ('FAMI',       '全家超商取貨',        60, 3),
  ('HILIFE',     '萊爾富超商取貨',      60, 4),
  ('OKMARTB2C',  'OK 超商取貨',        60, 5)
ON CONFLICT (logistics_type) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE logistics_settings ENABLE ROW LEVEL SECURITY;

-- Public SELECT: frontend checkout page needs to read enabled methods
CREATE POLICY "logistics_settings_select_public"
  ON logistics_settings FOR SELECT
  USING (TRUE);

-- Admin-only mutations
CREATE POLICY "logistics_settings_admin_all"
  ON logistics_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
-- ── 物流狀態欄位 ─────────────────────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_status    VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_status_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.logistics_status    IS 'shipping | delivered | failed | pending_pickup';
COMMENT ON COLUMN orders.logistics_status_at IS '最後一次呼叫綠界 API 更新狀態的時間';
-- ── 付款設定表 ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_settings (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type        VARCHAR(50)  NOT NULL UNIQUE,
  display_name        VARCHAR(100) NOT NULL,
  description         TEXT,
  is_enabled          BOOLEAN      NOT NULL DEFAULT FALSE,
  icon_emoji          VARCHAR(10),
  ecpay_payment_type  VARCHAR(50),
  settings            JSONB        NOT NULL DEFAULT '{}',
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN payment_settings.ecpay_payment_type IS '對應綠界 PaymentType 值（Credit / ATM / CVS / Barcode）';
COMMENT ON COLUMN payment_settings.settings           IS '額外設定，例如信用卡分期期數、CVS 到期天數等';

-- ── 交易記錄表 ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        REFERENCES orders(id),
  ecpay_trade_no  VARCHAR(50),
  payment_type    VARCHAR(50),
  amount          INTEGER     NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at         TIMESTAMPTZ,
  ecpay_response  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN payment_transactions.status         IS 'pending | paid | refunded | failed';
COMMENT ON COLUMN payment_transactions.ecpay_response IS '完整綠界回應，供對帳使用';

-- ── Index ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id     ON payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ecpay_no     ON payment_transactions (ecpay_trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_date  ON payment_transactions (status, created_at DESC);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON payment_settings;
CREATE TRIGGER trg_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE payment_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- payment_settings：SELECT 公開，ALL admin
CREATE POLICY "payment_settings_public_select" ON payment_settings
  FOR SELECT USING (true);

CREATE POLICY "payment_settings_admin_all" ON payment_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- payment_transactions：SELECT admin，INSERT 開放（webhook service role 用）
CREATE POLICY "payment_transactions_admin_select" ON payment_transactions
  FOR SELECT USING (is_admin());

CREATE POLICY "payment_transactions_insert" ON payment_transactions
  FOR INSERT WITH CHECK (true);

-- ── Seed ──────────────────────────────────────────────────────────────────────

INSERT INTO payment_settings
  (payment_type, display_name, description, icon_emoji, ecpay_payment_type, sort_order)
VALUES
  ('CREDIT',  '信用卡（一次付清）', 'Visa / Mastercard / JCB',             '💳', 'Credit',  1),
  ('ATM',     'ATM 轉帳',          '各大銀行虛擬帳號轉帳，3 天內完成付款', '🏧', 'ATM',     2),
  ('CVS',     '超商代碼繳費',      '7-11 / 全家 / 萊爾富 / OK 超商',       '🏪', 'CVS',     3),
  ('BARCODE', '超商條碼繳費',      '列印條碼至超商繳費',                    '📊', 'Barcode', 4)
ON CONFLICT (payment_type) DO NOTHING;
-- ── 政策內容表 ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policies (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              VARCHAR(50)  NOT NULL UNIQUE,
  title             VARCHAR(100) NOT NULL,
  content           TEXT,
  content_type      VARCHAR(20)  NOT NULL DEFAULT 'markdown',
  status            VARCHAR(20)  NOT NULL DEFAULT 'published',
  last_published_at TIMESTAMPTZ,
  draft_content     TEXT,
  meta_title        VARCHAR(200),
  meta_description  TEXT,
  updated_by        UUID         REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN policies.slug          IS 'service | refund（未來可擴展）';
COMMENT ON COLUMN policies.content_type  IS 'markdown | html';
COMMENT ON COLUMN policies.status        IS 'draft | published';
COMMENT ON COLUMN policies.draft_content IS '草稿暫存，發布後才覆蓋 content';

-- ── Auto-update updated_at ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_policies_updated_at ON policies;
CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_public_select" ON policies
  FOR SELECT USING (status = 'published');

CREATE POLICY "policies_admin_all" ON policies
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── Seed ──────────────────────────────────────────────────────────────────────

INSERT INTO policies (slug, title, content, status) VALUES
('service', '服務政策',
'## 服務政策

### 會員服務
- 會員享有回饋金累積與等級優惠
- 個人資料依隱私政策妥善保護

### NFC 卡服務
- NFC 卡一經綁定無法更換
- 卡片遺失可透過會員中心停用

### 訂單服務
- 訂單成立後 30 分鐘內可取消
- 超過時限請聯繫客服',
'published'),

('refund', '退換貨政策',
'## 退換貨政策

### 退貨條件
- 到貨 7 天內，商品未使用且包裝完整
- 商品瑕疵或錯誤出貨，10 天內申請

### 退貨流程
1. 聯繫客服告知退貨原因
2. 客服確認後提供退貨地址
3. 商品寄回確認後，5-7 個工作天退款',
'published')
ON CONFLICT (slug) DO NOTHING;
-- ── 管理員角色表 ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_roles (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50)  NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description  TEXT,
  permissions  JSONB        NOT NULL DEFAULT '[]',
  is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN admin_roles.name        IS 'super_admin | admin | editor | viewer';
COMMENT ON COLUMN admin_roles.permissions IS '可存取模組清單，例如 ["dashboard","orders","members"]';
COMMENT ON COLUMN admin_roles.is_system   IS '系統預設角色，is_system=true 不可刪除或改 permissions';

-- ── 擴充 users 表 ─────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role_id    UUID        REFERENCES admin_roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active_admin  BOOLEAN     NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at    TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by       UUID        REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at       TIMESTAMPTZ;

-- ── Index ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_admin_role_id ON users (admin_role_id) WHERE admin_role_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- 所有 admin 可查看角色列表
CREATE POLICY "admin_roles_admin_select" ON admin_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- 只有 super_admin 可新增/修改/刪除（排除系統角色的刪除）
CREATE POLICY "admin_roles_superadmin_mutate" ON admin_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN admin_roles r ON r.id = u.admin_role_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN admin_roles r ON r.id = u.admin_role_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND r.name = 'super_admin'
    )
  );

-- ── Seed ──────────────────────────────────────────────────────────────────────

INSERT INTO admin_roles (name, display_name, description, permissions, is_system) VALUES
('super_admin', '超級管理員',
  '擁有所有權限，包含人員管理和系統設定',
  '["dashboard","orders","members","products","banners","settings","logistics","payments","policies","faqs","partners","redemption","coupons","promotions","rewards","nfc","print","staff"]'::jsonb,
  true),

('admin', '一般管理員',
  '擁有大多數後台功能，不含人員管理和系統設定',
  '["dashboard","orders","members","products","banners","logistics","payments","policies","faqs","partners","redemption","coupons","promotions","rewards","nfc","print"]'::jsonb,
  true),

('editor', '內容管理員',
  '只能管理內容相關功能',
  '["dashboard","banners","faqs","partners","policies"]'::jsonb,
  true),

('viewer', '報表查看者',
  '只能查看儀表板和報表',
  '["dashboard"]'::jsonb,
  true)

ON CONFLICT (name) DO NOTHING;
-- ── 通知設定 ──────────────────────────────────────────────────────────────────

INSERT INTO system_settings (key, value, description) VALUES
('notify_order_created',       'false', '訂單成立時通知管理員'),
('notify_order_paid',          'false', '訂單付款完成時通知管理員'),
('notify_low_stock',           'false', '低庫存通知'),
('notify_admin_email',         '""',    '通知收件人 Email'),
('notify_low_stock_threshold', '5',     '低庫存通知閾值（件數）'),
('max_pets_per_user',          '5',     '每位會員最多可建立的寵物數量')
ON CONFLICT (key) DO NOTHING;
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
-- ============================================================
-- 011_preorder.sql — 預購功能
-- ============================================================

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS is_preorder   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_note TEXT;

COMMENT ON COLUMN product_variants.is_preorder   IS '預購模式：開啟後庫存=0 仍可加入購物車';
COMMENT ON COLUMN product_variants.preorder_note IS '預購說明，例如「預計 2026/08/01 出貨」';
