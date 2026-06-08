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
