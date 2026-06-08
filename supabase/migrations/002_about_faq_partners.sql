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
