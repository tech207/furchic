-- ============================================================
-- Furchic WebApp — 001_initial_schema.sql
-- ============================================================

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Helper: updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Helper: is_admin() ────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on the users table so this can safely
-- be called from other tables' RLS policies without recursion.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM users WHERE id = auth.uid()),
    false
  );
$$;

-- ── Tables ────────────────────────────────────────────────────────────────────

-- 1. member_levels
CREATE TABLE member_levels (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR     NOT NULL,
  min_spent    INTEGER     NOT NULL DEFAULT 0,
  reward_rate  DECIMAL(4,2) NOT NULL DEFAULT 0.01,
  discount_rate DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  benefits     JSONB       NOT NULL DEFAULT '{}',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. users
CREATE TABLE users (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,
  phone           VARCHAR(20),
  email           VARCHAR(100),
  gender          VARCHAR(10) CHECK (gender IN ('male','female','other')),
  birthday        DATE,
  auth_provider   VARCHAR(20),
  avatar_url      TEXT,
  role            VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  member_level_id UUID        REFERENCES member_levels(id),
  reward_points   INTEGER     NOT NULL DEFAULT 0,
  total_spent     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. pets
CREATE TABLE pets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(50) NOT NULL,
  breed             VARCHAR(100),
  gender            VARCHAR(10),
  birthday          DATE,
  is_neutered       BOOLEAN     NOT NULL DEFAULT FALSE,
  chip_id           VARCHAR(50),
  photo_url         TEXT,
  ai_photo_url      TEXT,
  public_fields     JSONB       NOT NULL DEFAULT '["name","breed","emergency"]',
  card_status       VARCHAR     NOT NULL DEFAULT 'none'
    CHECK (card_status IN ('none','pending','active','disabled')),
  vet_hospital      VARCHAR     NOT NULL,
  special_care      BOOLEAN     NOT NULL DEFAULT FALSE,
  special_care_note TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. pet_caregivers
-- contact_methods: [{id, type:'phone'|'line'|'instagram'|'facebook'|'other',
--                    label, value, is_public}]
CREATE TABLE pet_caregivers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id          UUID        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR     NOT NULL CHECK (role IN ('owner','caregiver')),
  display_name    VARCHAR,
  contact_methods JSONB       NOT NULL DEFAULT '[]',
  is_visible      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  invited_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pet_id, user_id)
);

-- 5. pet_caregiver_invitations
CREATE TABLE pet_caregiver_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id      UUID        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  inviter_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR     NOT NULL UNIQUE,
  status      VARCHAR     NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired')),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. nfc_cards
CREATE TABLE nfc_cards (
  id          UUID        PRIMARY KEY, -- UUID burned into the NFC chip
  pet_id      UUID        UNIQUE REFERENCES pets(id) ON DELETE SET NULL,
  qr_url      TEXT,
  status      VARCHAR     NOT NULL DEFAULT 'unbound'
    CHECK (status IN ('unbound','active')),
  bound_at    TIMESTAMPTZ,
  bound_by    UUID        REFERENCES users(id),
  card_serial VARCHAR
);

-- 7. redemption_codes
CREATE TABLE redemption_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR     NOT NULL UNIQUE,
  batch_name  VARCHAR,
  max_uses    INTEGER     NOT NULL DEFAULT 1,
  used_count  INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  used_by     UUID        REFERENCES users(id),
  used_at     TIMESTAMPTZ,
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. products
CREATE TABLE products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR     NOT NULL,
  description TEXT,
  base_price  INTEGER     NOT NULL,
  images      JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. product_variants (SKU)
CREATE TABLE product_variants (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                VARCHAR     NOT NULL,
  sku                 VARCHAR     NOT NULL UNIQUE,
  price               INTEGER,    -- NULL = use product.base_price
  stock               INTEGER     NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER     NOT NULL DEFAULT 5,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order          INTEGER     NOT NULL DEFAULT 0
);

-- 10. product_variant_options
CREATE TABLE product_variant_options (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_name  VARCHAR NOT NULL, -- e.g. '顏色', '尺寸'
  option_value VARCHAR NOT NULL, -- e.g. '橘色', 'L'
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- 11. orders
CREATE TABLE orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  items                JSONB       NOT NULL,
  subtotal             INTEGER     NOT NULL DEFAULT 0,
  shipping_fee         INTEGER     NOT NULL DEFAULT 60,
  discount_amount      INTEGER     NOT NULL DEFAULT 0,
  total_amount         INTEGER     NOT NULL DEFAULT 0,
  coupon_code          VARCHAR,
  promotion_ids        JSONB       NOT NULL DEFAULT '[]',
  reward_points_used   INTEGER     NOT NULL DEFAULT 0,
  reward_points_earned INTEGER     NOT NULL DEFAULT 0,
  status               VARCHAR     NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','processing','shipped','done','cancelled')),
  shipping_method      VARCHAR,
  shipping_info        JSONB,
  tracking_number      VARCHAR,
  logistics_id         VARCHAR,
  payment_method       VARCHAR,
  ecpay_trade_no       VARCHAR,
  note                 TEXT,
  admin_note           TEXT,
  shipped_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. card_print_requests
CREATE TABLE card_print_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pet_id              UUID        NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
  redemption_code_id  UUID        REFERENCES redemption_codes(id),
  order_id            UUID        REFERENCES orders(id),
  source              VARCHAR     NOT NULL CHECK (source IN ('onsite','online')),
  card_front_url      TEXT,
  card_back_url       TEXT,
  status              VARCHAR     NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','printing','done')),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. coupons
CREATE TABLE coupons (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR     NOT NULL UNIQUE,
  name               VARCHAR     NOT NULL,
  description        TEXT,
  type               VARCHAR     NOT NULL CHECK (type IN ('percentage','fixed')),
  value              INTEGER     NOT NULL,
  min_order_amount   INTEGER     NOT NULL DEFAULT 0,
  max_discount_amount INTEGER,
  max_uses           INTEGER,
  used_count         INTEGER     NOT NULL DEFAULT 0,
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  starts_at          TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. promotions
CREATE TABLE promotions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR     NOT NULL,
  type             VARCHAR     NOT NULL CHECK (type IN ('percentage','fixed','free_shipping','gift')),
  value            INTEGER,
  condition_type   VARCHAR     NOT NULL CHECK (condition_type IN ('amount','quantity','member_level')),
  condition_value  INTEGER     NOT NULL DEFAULT 0,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  is_stackable     BOOLEAN     NOT NULL DEFAULT TRUE,
  starts_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. reward_transactions
CREATE TABLE reward_transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR     NOT NULL CHECK (type IN ('earned','used','expired','adjusted')),
  points     INTEGER     NOT NULL,
  order_id   UUID        REFERENCES orders(id),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. banners
CREATE TABLE banners (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR     NOT NULL,
  image_url  TEXT        NOT NULL,
  link_url   TEXT,
  type       VARCHAR     NOT NULL DEFAULT 'hero' CHECK (type IN ('hero','sponsor','shop')),
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. company_info  (enforced single-row)
CREATE TABLE company_info (
  id             INTEGER     PRIMARY KEY DEFAULT 1,
  name           VARCHAR,
  description    TEXT,
  logo_url       TEXT,
  contact_email  VARCHAR,
  phone          VARCHAR,
  address        TEXT,
  social_links   JSONB       NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 18. system_settings
CREATE TABLE system_settings (
  key         VARCHAR     PRIMARY KEY,
  value       JSONB       NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES users(id)
);

-- 19. analytics_events
CREATE TABLE analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR     NOT NULL,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_id  VARCHAR,
  page_url    TEXT,
  properties  JSONB       NOT NULL DEFAULT '{}',
  ip_hash     VARCHAR,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. stock_logs
CREATE TABLE stock_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  change      INTEGER     NOT NULL,
  reason      VARCHAR     NOT NULL CHECK (reason IN ('order','manual','import','return')),
  order_id    UUID        REFERENCES orders(id),
  note        TEXT,
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. rate_limits  (Edge Middleware — no user-level access)
CREATE TABLE rate_limits (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_pets_user_id                  ON pets(user_id);
CREATE INDEX idx_orders_user_id_status         ON orders(user_id, status);
CREATE INDEX idx_orders_created_at             ON orders(created_at DESC);
CREATE INDEX idx_nfc_cards_pet_id              ON nfc_cards(pet_id);
CREATE INDEX idx_product_variants_product_active ON product_variants(product_id, is_active);
CREATE INDEX idx_analytics_type_created        ON analytics_events(event_type, created_at DESC);
CREATE INDEX idx_analytics_user_id             ON analytics_events(user_id);
CREATE INDEX idx_coupons_code                  ON coupons(code);
CREATE INDEX idx_redemption_codes_code         ON redemption_codes(code);
CREATE INDEX idx_rate_limits_expires_at        ON rate_limits(expires_at);

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- updated_at auto-update
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- handle_new_user: auth.users INSERT → public.users INSERT
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO users (id, email, name, auth_provider, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.app_metadata->>'provider', 'email'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- update_user_total_spent: order → 'done' → accumulate + level-up check
CREATE OR REPLACE FUNCTION update_user_total_spent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_spent        INTEGER;
  v_new_level_id UUID;
BEGIN
  IF NEW.status = 'done' AND (OLD IS NULL OR OLD.status <> 'done') THEN
    UPDATE users
    SET total_spent = total_spent + NEW.total_amount,
        updated_at  = NOW()
    WHERE id = NEW.user_id
    RETURNING total_spent INTO v_spent;

    -- Level upgrade (never downgrade)
    SELECT id INTO v_new_level_id
    FROM member_levels
    WHERE min_spent <= v_spent
    ORDER BY min_spent DESC
    LIMIT 1;

    IF v_new_level_id IS NOT NULL THEN
      UPDATE users
      SET member_level_id = v_new_level_id,
          updated_at      = NOW()
      WHERE id = NEW.user_id
        AND (
          member_level_id IS NULL
          OR (SELECT min_spent FROM member_levels WHERE id = v_new_level_id)
           > (SELECT min_spent FROM member_levels WHERE id = member_level_id)
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_orders_total_spent
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION update_user_total_spent();

-- handle_reward_points: order → 'done' → earn reward points
CREATE OR REPLACE FUNCTION handle_reward_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_rate   DECIMAL(4,2);
  v_earned INTEGER;
BEGIN
  IF NEW.status = 'done' AND (OLD IS NULL OR OLD.status <> 'done') THEN
    SELECT COALESCE(ml.reward_rate, 0.01) INTO v_rate
    FROM users u
    LEFT JOIN member_levels ml ON ml.id = u.member_level_id
    WHERE u.id = NEW.user_id;

    v_earned := FLOOR(NEW.total_amount * v_rate);

    IF v_earned > 0 THEN
      INSERT INTO reward_transactions (id, user_id, type, points, order_id, created_at)
      VALUES (gen_random_uuid(), NEW.user_id, 'earned', v_earned, NEW.id, NOW());

      UPDATE users
      SET reward_points = reward_points + v_earned,
          updated_at    = NOW()
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_orders_reward_points
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_reward_points();

-- increment_rate_limit: atomic upsert used by Edge Middleware
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key TEXT, p_window_seconds INTEGER, p_limit INTEGER
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_now        TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
  v_count      INTEGER;
BEGIN
  INSERT INTO rate_limits (key, count, window_start, expires_at)
  VALUES (p_key, 1, v_now, v_expires_at)
  ON CONFLICT (key) DO UPDATE SET
    count        = CASE WHEN rate_limits.expires_at < v_now THEN 1
                        ELSE rate_limits.count + 1 END,
    window_start = CASE WHEN rate_limits.expires_at < v_now THEN v_now
                        ELSE rate_limits.window_start END,
    expires_at   = CASE WHEN rate_limits.expires_at < v_now THEN v_expires_at
                        ELSE rate_limits.expires_at END
  RETURNING count, expires_at INTO v_count, v_expires_at;

  RETURN json_build_object(
    'is_allowed',  v_count <= p_limit,
    'retry_after', CASE WHEN v_count > p_limit
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_expires_at - v_now))::INTEGER)
                   ELSE 0 END
  );
END;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_caregivers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_caregiver_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_cards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_print_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_levels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info             ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits              ENABLE ROW LEVEL SECURITY;

-- ── RLS: users ────────────────────────────────────────────────────────────────

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (is_admin());

-- Users can update their own profile; role escalation is blocked at the API layer
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (is_admin());

-- ── RLS: pets ─────────────────────────────────────────────────────────────────

CREATE POLICY "pets_select_owner" ON pets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pets_select_caregiver" ON pets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pet_caregivers
      WHERE pet_id = pets.id
        AND user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );

-- Public read for active NFC cards (for the /pet/{uuid} page via anon key)
CREATE POLICY "pets_select_nfc_public" ON pets
  FOR SELECT USING (card_status = 'active');

CREATE POLICY "pets_insert_owner" ON pets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "pets_update_owner" ON pets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "pets_delete_owner" ON pets
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "pets_admin_all" ON pets
  FOR ALL USING (is_admin());

-- ── RLS: pet_caregivers ───────────────────────────────────────────────────────

-- Pet owner can manage all caregivers for their pets
CREATE POLICY "pet_caregivers_owner_all" ON pet_caregivers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pets WHERE id = pet_id AND user_id = auth.uid())
  );

-- Caregiver can read their own entry
CREATE POLICY "pet_caregivers_self_select" ON pet_caregivers
  FOR SELECT USING (user_id = auth.uid());

-- Public can see visible caregivers of active-NFC pets (for NFC card page)
CREATE POLICY "pet_caregivers_nfc_public" ON pet_caregivers
  FOR SELECT USING (
    is_visible = true
    AND accepted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pets WHERE id = pet_id AND card_status = 'active'
    )
  );

CREATE POLICY "pet_caregivers_admin_all" ON pet_caregivers
  FOR ALL USING (is_admin());

-- ── RLS: pet_caregiver_invitations ────────────────────────────────────────────

-- Inviter manages their outgoing invitations
CREATE POLICY "invitations_inviter_all" ON pet_caregiver_invitations
  FOR ALL USING (inviter_id = auth.uid());

-- Token-based lookup handled by service role (API layer); no anon policy needed

CREATE POLICY "invitations_admin_all" ON pet_caregiver_invitations
  FOR ALL USING (is_admin());

-- ── RLS: nfc_cards ────────────────────────────────────────────────────────────

-- Public can read active cards (for NFC scan → /api/nfc/{uuid})
CREATE POLICY "nfc_cards_select_active" ON nfc_cards
  FOR SELECT USING (status = 'active');

-- Admins can see all and manage
CREATE POLICY "nfc_cards_admin_all" ON nfc_cards
  FOR ALL USING (is_admin());

-- ── RLS: card_print_requests ──────────────────────────────────────────────────

CREATE POLICY "card_requests_select_own" ON card_print_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "card_requests_insert_own" ON card_print_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "card_requests_admin_all" ON card_print_requests
  FOR ALL USING (is_admin());

-- ── RLS: redemption_codes ─────────────────────────────────────────────────────

-- Validation is done via service role; users only see codes they've used
CREATE POLICY "redemption_codes_select_used_own" ON redemption_codes
  FOR SELECT USING (used_by = auth.uid());

CREATE POLICY "redemption_codes_admin_all" ON redemption_codes
  FOR ALL USING (is_admin());

-- ── RLS: products ─────────────────────────────────────────────────────────────

CREATE POLICY "products_select_active" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "products_admin_all" ON products
  FOR ALL USING (is_admin());

-- ── RLS: product_variants ─────────────────────────────────────────────────────

CREATE POLICY "variants_select_active" ON product_variants
  FOR SELECT USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM products WHERE id = product_id AND is_active = true)
  );

CREATE POLICY "variants_admin_all" ON product_variants
  FOR ALL USING (is_admin());

-- ── RLS: product_variant_options ──────────────────────────────────────────────

CREATE POLICY "variant_options_select_public" ON product_variant_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products WHERE id = product_id AND is_active = true)
  );

CREATE POLICY "variant_options_admin_all" ON product_variant_options
  FOR ALL USING (is_admin());

-- ── RLS: orders ───────────────────────────────────────────────────────────────

CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_admin" ON orders
  FOR UPDATE USING (is_admin());

CREATE POLICY "orders_select_admin" ON orders
  FOR SELECT USING (is_admin());

-- ── RLS: coupons ──────────────────────────────────────────────────────────────

-- Coupon validation done via service role in API; no direct user access
CREATE POLICY "coupons_admin_all" ON coupons
  FOR ALL USING (is_admin());

-- ── RLS: promotions ───────────────────────────────────────────────────────────

CREATE POLICY "promotions_select_active" ON promotions
  FOR SELECT USING (is_active = true);

CREATE POLICY "promotions_admin_all" ON promotions
  FOR ALL USING (is_admin());

-- ── RLS: member_levels ────────────────────────────────────────────────────────

CREATE POLICY "member_levels_select_public" ON member_levels
  FOR SELECT USING (true);

CREATE POLICY "member_levels_admin_all" ON member_levels
  FOR ALL USING (is_admin());

-- ── RLS: reward_transactions ──────────────────────────────────────────────────

CREATE POLICY "reward_tx_select_own" ON reward_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "reward_tx_admin_all" ON reward_transactions
  FOR ALL USING (is_admin());

-- ── RLS: banners ──────────────────────────────────────────────────────────────

CREATE POLICY "banners_select_active" ON banners
  FOR SELECT USING (is_active = true);

CREATE POLICY "banners_admin_all" ON banners
  FOR ALL USING (is_admin());

-- ── RLS: company_info ─────────────────────────────────────────────────────────

CREATE POLICY "company_info_select_public" ON company_info
  FOR SELECT USING (true);

CREATE POLICY "company_info_admin_all" ON company_info
  FOR ALL USING (is_admin());

-- ── RLS: system_settings ──────────────────────────────────────────────────────

-- These keys are safe to expose to the frontend via /api/settings/public
CREATE POLICY "settings_select_public" ON system_settings
  FOR SELECT USING (
    key IN (
      'free_shipping_amount',
      'gift_nfc_amount',
      'gift_nfc_enabled',
      'gift_nfc_start_at',
      'gift_nfc_end_at',
      'reward_max_usage_rate',
      'card_request_enabled',
      'max_pets_per_user',
      'max_caregivers_per_pet'
    )
  );

CREATE POLICY "settings_admin_all" ON system_settings
  FOR ALL USING (is_admin());

-- ── RLS: analytics_events ─────────────────────────────────────────────────────

-- Anyone (including anon) can INSERT events for page/funnel tracking
CREATE POLICY "analytics_insert_public" ON analytics_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "analytics_select_admin" ON analytics_events
  FOR SELECT USING (is_admin());

-- ── RLS: stock_logs ───────────────────────────────────────────────────────────

CREATE POLICY "stock_logs_admin_all" ON stock_logs
  FOR ALL USING (is_admin());

-- ── RLS: rate_limits ──────────────────────────────────────────────────────────
-- No user-level policies: only SECURITY DEFINER functions can access this table.

-- ── Storage Buckets ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pet-photos',     'pet-photos',     true,  5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('card-images',    'card-images',    false, NULL,    NULL),
  ('product-images', 'product-images', true,  NULL,    ARRAY['image/jpeg','image/png','image/webp']),
  ('company-assets', 'company-assets', true,  NULL,    ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- pet-photos: public read
CREATE POLICY "pet_photos_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'pet-photos');

-- pet-photos: authenticated user uploads to own folder (path: {user_id}/*)
CREATE POLICY "pet_photos_insert_owner" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pet-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pet_photos_update_owner" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "pet_photos_delete_owner" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- card-images: admin only
CREATE POLICY "card_images_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'card-images' AND is_admin());

-- product-images: public read, admin write
CREATE POLICY "product_images_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND is_admin());

CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND is_admin());

CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND is_admin());

-- company-assets: public read, admin write
CREATE POLICY "company_assets_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "company_assets_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-assets' AND is_admin());

CREATE POLICY "company_assets_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'company-assets' AND is_admin());

CREATE POLICY "company_assets_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-assets' AND is_admin());

-- ── System Settings Defaults ──────────────────────────────────────────────────

INSERT INTO system_settings (key, value, description) VALUES
  ('free_shipping_amount', '1500',  '免運門檻（元）'),
  ('gift_nfc_amount',      '2500',  'NFC 卡贈品門檻（元）'),
  ('gift_nfc_enabled',     'false', '贈品活動是否開啟'),
  ('gift_nfc_start_at',    'null',  '贈品活動開始時間'),
  ('gift_nfc_end_at',      'null',  '贈品活動結束時間'),
  ('reward_max_usage_rate','0.5',   '回饋金最大折抵比率'),
  ('card_request_enabled', 'true',  '是否開放申請製卡'),
  ('max_pets_per_user',    '10',    '每用戶最多寵物數'),
  ('max_caregivers_per_pet','5',    '每隻寵物最多照護者數（含飼主）')
ON CONFLICT (key) DO NOTHING;

-- ── company_info placeholder ──────────────────────────────────────────────────

INSERT INTO company_info (id, name, description, social_links, updated_at)
VALUES (1, 'Furchic', '讓每隻寵物都有自己的身份', '{}', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;
