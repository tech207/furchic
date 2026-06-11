-- ============================================================
-- Furchic WebApp — V-A01_vendor_foundation.sql
-- Vendor Platform Foundation
-- 注意：此 migration 必須在 Line A 和 Line B 所有 prompt 前執行
-- ============================================================
--
-- 執行順序說明（與 Prompt Step 編號不同）：
--   products/orders 的 ALTER 引用 vendors(id)，
--   所以 vendors 表必須先建立，順序調整如下：
--   Step 3（vendors）→ Step 4（vendor_accounts）→ Step 5（commission_rules）
--   → Step 1（ALTER products）→ Step 2（ALTER orders）
--   → RLS helper → Step 6 RLS → Step 7 Indexes → Step 8 Trigger
-- ============================================================

BEGIN;

-- ── Step 3：建立 vendors 表 ──────────────────────────────────────────────────
-- 必須先於 products/orders 的 ALTER，因為它們有 FK 指向此表

CREATE TABLE IF NOT EXISTS vendors (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name           VARCHAR(100) NOT NULL,
  brand_name             VARCHAR(100) NOT NULL,
  vendor_type            VARCHAR(20)  NOT NULL DEFAULT 'permanent',
  -- permanent（長期進駐）| flash（短期快閃，無帳號）
  contact_name           VARCHAR(50)  NOT NULL,
  contact_email          VARCHAR(100) NOT NULL UNIQUE,
  contact_phone          VARCHAR(20)  NOT NULL,
  company_phone          VARCHAR(20),
  tax_id                 VARCHAR(20),
  -- 統一編號
  bank_account           JSONB        NOT NULL DEFAULT '{}',
  -- { bank_name, branch, account_no, account_name }
  logo_url               TEXT,
  description            TEXT,
  website_url            TEXT,
  category               VARCHAR(50),
  -- pet_food | pet_supplies | grooming | medical | lifestyle | other
  default_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  -- 預設抽成比例（%），Admin 可調整
  status                 VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- pending | approved | suspended | rejected
  approved_at            TIMESTAMPTZ,
  approved_by            UUID         REFERENCES users(id),
  rejection_reason       TEXT,
  notes                  TEXT,
  -- Admin 內部備注
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Step 4：建立 vendor_accounts 表（廠商員工帳號）──────────────────────────

CREATE TABLE IF NOT EXISTS vendor_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES users(id),
  -- 對應 auth.users；邀請成立但尚未註冊時可為 NULL
  email        VARCHAR(100) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  role         VARCHAR(20)  NOT NULL DEFAULT 'staff',
  -- owner（主帳號，對應 contact_email）| staff（員工）
  permissions  JSONB        NOT NULL DEFAULT '[]',
  -- ['products', 'orders', 'reports', 'staff']
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  invited_by   UUID         REFERENCES vendor_accounts(id),
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Step 5：建立 commission_rules 表（抽成規則）─────────────────────────────

CREATE TABLE IF NOT EXISTS commission_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  rule_type       VARCHAR(20) NOT NULL,
  -- vendor_default（廠商預設）
  -- product（單一商品，target_id = product_id）
  -- event（特定活動，target_id = event_id）
  -- channel（銷售管道，sales_channel 欄位生效）
  target_id       UUID,
  -- rule_type = product | event 時填入對應 ID；其餘為 NULL
  sales_channel   VARCHAR(20),
  -- rule_type = channel 時填入：online_daily | online_campaign | physical_event
  commission_rate DECIMAL(5,2) NOT NULL,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      UUID         REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Step 1：修改現有 products 表 ─────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS vendor_id     UUID         REFERENCES vendors(id),
  -- NULL = 平台自有商品
  ADD COLUMN IF NOT EXISTS sales_channel VARCHAR(20)  NOT NULL DEFAULT 'platform',
  -- platform（平台自有）| vendor（廠商上架）| flash（快閃）
  ADD COLUMN IF NOT EXISTS is_approved   BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by   UUID         REFERENCES users(id);

-- ── Step 2：修改現有 orders 表 ───────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vendor_id        UUID         REFERENCES vendors(id),
  -- NULL = 平台自有訂單
  ADD COLUMN IF NOT EXISTS sales_channel    VARCHAR(20)  NOT NULL DEFAULT 'online_daily',
  -- online_daily（網路日常）
  -- online_campaign（網路行銷活動）
  -- physical_event（實體活動）
  ADD COLUMN IF NOT EXISTS event_id         UUID,
  -- FK 到 events 表，V-B01 才建立，先允許 NULL
  ADD COLUMN IF NOT EXISTS commission_rate  DECIMAL(5,2),
  -- 此訂單成立時的抽成比例快照（避免日後抽成調整影響歷史數據）
  ADD COLUMN IF NOT EXISTS commission_amount INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_amount     INTEGER     NOT NULL DEFAULT 0;
  -- vendor_amount = total_amount - commission_amount

-- ── RLS Helper：避免 vendor_accounts 循環遞迴 ────────────────────────────────
-- 與 is_admin() 相同模式，SECURITY DEFINER 繞過 vendor_accounts 的 RLS，
-- 防止 vendors_self_read 和 vendor_accounts_self 兩層 policy 互相觸發形成死循環。

CREATE OR REPLACE FUNCTION get_my_vendor_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT vendor_id
  FROM vendor_accounts
  WHERE user_id = auth.uid()
    AND is_active = TRUE;
$$;

-- ── Step 6：RLS 設定 ──────────────────────────────────────────────────────────

-- vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_admin_all" ON vendors
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "vendors_self_read" ON vendors
  FOR SELECT
  USING (id IN (SELECT get_my_vendor_ids()));

-- vendor_accounts
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_accounts_admin_all" ON vendor_accounts
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "vendor_accounts_self" ON vendor_accounts
  FOR SELECT
  USING (vendor_id IN (SELECT get_my_vendor_ids()));

-- commission_rules（admin only）
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_admin_all" ON commission_rules
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Step 7：Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_vendor_id       ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_sales_channel   ON products(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id         ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_channel     ON orders(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_event_id          ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_vendor_id ON vendor_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_user_id  ON vendor_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_vendor_id ON commission_rules(vendor_id);

-- ── Step 8：Trigger — 訂單自動計算抽成金額 ───────────────────────────────────
-- 優先順序：商品專屬 > 活動專屬 > 銷售管道 > 廠商預設
-- commission_rate 快照寫入訂單，確保歷史數據不受日後規則調整影響

CREATE OR REPLACE FUNCTION calculate_order_commission()
RETURNS TRIGGER AS $$
DECLARE
  rate DECIMAL(5,2);
BEGIN
  SELECT commission_rate INTO rate
  FROM commission_rules
  WHERE vendor_id = NEW.vendor_id
    AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
    AND (
      rule_type = 'vendor_default'
      OR (rule_type = 'event'   AND target_id = NEW.event_id)
      OR (rule_type = 'channel' AND sales_channel = NEW.sales_channel)
    )
  ORDER BY
    CASE rule_type
      WHEN 'product'        THEN 1
      WHEN 'event'          THEN 2
      WHEN 'channel'        THEN 3
      WHEN 'vendor_default' THEN 4
    END
  LIMIT 1;

  -- 若 commission_rules 找不到，fallback 到廠商預設抽成比例
  IF rate IS NULL THEN
    SELECT default_commission_rate INTO rate
    FROM vendors
    WHERE id = NEW.vendor_id;
  END IF;

  NEW.commission_rate   := COALESCE(rate, 0);
  NEW.commission_amount := FLOOR(NEW.total_amount * NEW.commission_rate / 100);
  NEW.vendor_amount     := NEW.total_amount - NEW.commission_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.vendor_id IS NOT NULL)
  EXECUTE FUNCTION calculate_order_commission();

COMMIT;
