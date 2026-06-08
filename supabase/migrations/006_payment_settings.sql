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
