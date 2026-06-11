-- ============================================================
-- Pet.chic Weekend WebApp — seed.sql
-- 執行順序：migration 完成後執行
--
-- 管理員設定方式：
--   1. 先透過 App 或 Supabase Dashboard 用 admin@furchic.com 完成註冊
--   2. handle_new_user trigger 會自動建立 public.users 記錄
--   3. 再執行下方的 admin 升級 SQL：
--      UPDATE public.users SET role = 'admin' WHERE email = 'admin@furchic.com';
-- ============================================================

BEGIN;

-- ── Member Levels ─────────────────────────────────────────────────────────────

INSERT INTO member_levels (id, name, min_spent, reward_rate, discount_rate, benefits, sort_order)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '一般會員',
    0,
    0.01,
    1.00,
    '{"description": "基本回饋 1%"}',
    1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '銀卡會員',
    5000,
    0.02,
    0.98,
    '{"description": "累計消費滿 NT$5,000 升等，回饋 2%，九八折優惠"}',
    2
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '金卡會員',
    20000,
    0.03,
    0.95,
    '{"description": "累計消費滿 NT$20,000 升等，回饋 3%，九五折優惠"}',
    3
  )
ON CONFLICT (id) DO NOTHING;

-- ── Banners ───────────────────────────────────────────────────────────────────

INSERT INTO banners (id, title, image_url, link_url, type, sort_order, is_active)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    'Pet.chic Weekend NFC 寵物名片 — 讓愛不迷路',
    '/images/banner-hero-01.jpg',
    '/shop',
    'hero',
    1,
    true
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '首次購買 NFC 卡享 9 折優惠',
    '/images/banner-hero-02.jpg',
    '/shop',
    'hero',
    2,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ── Products ──────────────────────────────────────────────────────────────────

-- Product 1: NFC 寵物名片卡
INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000001',
  'Pet.chic Weekend NFC 寵物名片卡',
  '客製化 NFC 卡片，內含寵物 AI 去背照片合成，掃描即顯示緊急聯絡資訊。CR-80 標準尺寸，防水材質。',
  590,
  '["/images/products/nfc-card-01.jpg", "/images/products/nfc-card-02.jpg"]',
  true,
  1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES (
  'd0000000-0000-0000-0001-000000000001',
  'c0000000-0000-0000-0001-000000000001',
  '標準版',
  'NFC-CARD-STD',
  590,
  100,
  10,
  true,
  1
) ON CONFLICT (id) DO NOTHING;

-- Product 2: 寵物吊牌（多規格）
INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000002',
  '寵物識別吊牌',
  '不鏽鋼材質，雷射雕刻，耐用防水。可選擇不同形狀與顏色，搭配項圈使用。',
  250,
  '["/images/products/pet-tag-01.jpg", "/images/products/pet-tag-02.jpg"]',
  true,
  2
) ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES
  (
    'd0000000-0000-0000-0002-000000000001',
    'c0000000-0000-0000-0001-000000000002',
    '骨頭形 / 橘色',
    'TAG-BONE-ORG',
    250,
    50,
    5,
    true,
    1
  ),
  (
    'd0000000-0000-0000-0002-000000000002',
    'c0000000-0000-0000-0001-000000000002',
    '圓形 / 銀色',
    'TAG-CIRCLE-SLV',
    250,
    50,
    5,
    true,
    2
  ),
  (
    'd0000000-0000-0000-0002-000000000003',
    'c0000000-0000-0000-0001-000000000002',
    '愛心形 / 玫瑰金',
    'TAG-HEART-RGD',
    280,
    30,
    5,
    true,
    3
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variant_options (product_id, option_name, option_value, sort_order)
VALUES
  ('c0000000-0000-0000-0001-000000000002', '形狀', '骨頭形', 1),
  ('c0000000-0000-0000-0001-000000000002', '形狀', '圓形',   2),
  ('c0000000-0000-0000-0001-000000000002', '形狀', '愛心形', 3),
  ('c0000000-0000-0000-0001-000000000002', '顏色', '橘色',   1),
  ('c0000000-0000-0000-0001-000000000002', '顏色', '銀色',   2),
  ('c0000000-0000-0000-0001-000000000002', '顏色', '玫瑰金', 3);

-- Product 3: 寵物名片卡 + 吊牌組合包
INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000003',
  '寵物安全組合包',
  'NFC 名片卡 + 識別吊牌的超值組合，全方位保障寵物安全。享組合優惠價。',
  790,
  '["/images/products/bundle-01.jpg"]',
  true,
  3
) ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES (
  'd0000000-0000-0000-0003-000000000001',
  'c0000000-0000-0000-0001-000000000003',
  '組合包（NFC 卡 + 吊牌）',
  'BUNDLE-NFC-TAG',
  790,
  30,
  5,
  true,
  1
) ON CONFLICT (id) DO NOTHING;

-- ── System Settings (already inserted in migration, listed here for reference) ─
-- Run this block only if seed.sql is executed without running the migration:

INSERT INTO system_settings (key, value, description) VALUES
  ('free_shipping_amount',  '1500',  '免運門檻（元）'),
  ('gift_nfc_amount',       '2500',  'NFC 卡贈品門檻（元）'),
  ('gift_nfc_enabled',      'false', '贈品活動是否開啟'),
  ('gift_nfc_start_at',     'null',  '贈品活動開始時間'),
  ('gift_nfc_end_at',       'null',  '贈品活動結束時間'),
  ('reward_max_usage_rate', '0.5',   '回饋金最大折抵比率'),
  ('card_request_enabled',  'true',  '是否開放申請製卡'),
  ('max_pets_per_user',     '10',    '每用戶最多寵物數'),
  ('max_caregivers_per_pet','5',     '每隻寵物最多照護者數（含飼主）')
ON CONFLICT (key) DO NOTHING;

-- ── Admin Role Grant ──────────────────────────────────────────────────────────
-- 執行完成後，請先讓 admin@furchic.com 完成 Auth 註冊，再執行以下指令：
--
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@furchic.com';

COMMIT;

