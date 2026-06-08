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
