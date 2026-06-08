-- ============================================================
-- 011_preorder.sql — 預購功能
-- ============================================================

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS is_preorder   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_note TEXT;

COMMENT ON COLUMN product_variants.is_preorder   IS '預購模式：開啟後庫存=0 仍可加入購物車';
COMMENT ON COLUMN product_variants.preorder_note IS '預購說明，例如「預計 2026/08/01 出貨」';
