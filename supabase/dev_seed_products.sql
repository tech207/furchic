-- ============================================================
-- Furchic — dev_seed_products.sql
-- 開發用假資料，在 Supabase SQL Editor 執行
-- 圖片使用 picsum.photos placeholder，讓商品頁面可正常顯示
-- ============================================================

BEGIN;

-- ── Product 1: NFC 寵物名片卡 ──────────────────────────────────────────────────

INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000001',
  'Furchic NFC 寵物名片卡',
  '客製化 NFC 卡片，內含寵物 AI 去背照片合成，掃描即顯示緊急聯絡資訊。CR-80 標準尺寸，防水材質，全台宅配。',
  590,
  '["https://picsum.photos/seed/nfc-card-a/800/800","https://picsum.photos/seed/nfc-card-b/800/800","https://picsum.photos/seed/nfc-card-c/800/800"]',
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price  = EXCLUDED.base_price,
  images      = EXCLUDED.images,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

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
)
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

-- ── Product 2: 寵物識別吊牌（多規格）──────────────────────────────────────────

INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000002',
  '寵物識別吊牌',
  '不鏽鋼材質，雷射雕刻，耐用防水。可選擇不同形狀與顏色，搭配項圈使用。',
  250,
  '["https://picsum.photos/seed/pet-tag-a/800/800","https://picsum.photos/seed/pet-tag-b/800/800"]',
  true,
  2
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price  = EXCLUDED.base_price,
  images      = EXCLUDED.images,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES
  ('d0000000-0000-0000-0002-000000000001', 'c0000000-0000-0000-0001-000000000002', '骨頭形 / 橘色',   'TAG-BONE-ORG',    250,  50, 5, true, 1),
  ('d0000000-0000-0000-0002-000000000002', 'c0000000-0000-0000-0001-000000000002', '圓形 / 銀色',     'TAG-CIRCLE-SLV',  250,  50, 5, true, 2),
  ('d0000000-0000-0000-0002-000000000003', 'c0000000-0000-0000-0001-000000000002', '愛心形 / 玫瑰金', 'TAG-HEART-RGD',   280,  30, 5, true, 3),
  ('d0000000-0000-0000-0002-000000000004', 'c0000000-0000-0000-0001-000000000002', '星形 / 金色',     'TAG-STAR-GLD',    280,   3, 5, true, 4)  -- 即將售完示範
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

-- ── Product 3: 組合包 ──────────────────────────────────────────────────────────

INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000003',
  '寵物安全組合包',
  'NFC 名片卡 + 識別吊牌的超值組合，全方位保障寵物安全。享組合優惠價。',
  790,
  '["https://picsum.photos/seed/bundle-a/800/800","https://picsum.photos/seed/bundle-b/800/800"]',
  true,
  3
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price  = EXCLUDED.base_price,
  images      = EXCLUDED.images,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

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
)
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

-- ── Product 4: 已售完示範商品 ──────────────────────────────────────────────────

INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000004',
  '限定版寵物項圈',
  '季節限定款，採用環保材質，附有反光條設計，夜間散步更安全。（已售完示範用）',
  450,
  '["https://picsum.photos/seed/collar-a/800/800"]',
  true,
  4
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price  = EXCLUDED.base_price,
  images      = EXCLUDED.images,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES (
  'd0000000-0000-0000-0004-000000000001',
  'c0000000-0000-0000-0001-000000000004',
  'S / 黑色',
  'COLLAR-S-BLK',
  450,
  0,  -- 已售完
  5,
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

-- ── Product 5: 特惠商品示範 ────────────────────────────────────────────────────

INSERT INTO products (id, name, description, base_price, images, is_active, sort_order)
VALUES (
  'c0000000-0000-0000-0001-000000000005',
  '寵物外出背包',
  '透氣網格設計，可折疊收納，適合中小型犬貓使用。現正特惠中。',
  1290,
  '["https://picsum.photos/seed/bag-a/800/800","https://picsum.photos/seed/bag-b/800/800","https://picsum.photos/seed/bag-c/800/800"]',
  true,
  5
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price  = EXCLUDED.base_price,
  images      = EXCLUDED.images,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order;

INSERT INTO product_variants (id, product_id, name, sku, price, stock, low_stock_threshold, is_active, sort_order)
VALUES
  ('d0000000-0000-0000-0005-000000000001', 'c0000000-0000-0000-0001-000000000005', '粉色款', 'BAG-PINK',  980,  20, 5, true, 1),  -- 特惠（低於 base_price）
  ('d0000000-0000-0000-0005-000000000002', 'c0000000-0000-0000-0001-000000000005', '深藍款', 'BAG-NAVY', 1290,  15, 5, true, 2),
  ('d0000000-0000-0000-0005-000000000003', 'c0000000-0000-0000-0001-000000000005', '米色款', 'BAG-BEIGE', 980,   8, 5, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock;

COMMIT;
