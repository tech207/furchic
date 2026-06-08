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
