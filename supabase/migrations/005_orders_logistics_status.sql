-- ── 物流狀態欄位 ─────────────────────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_status    VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_status_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.logistics_status    IS 'shipping | delivered | failed | pending_pickup';
COMMENT ON COLUMN orders.logistics_status_at IS '最後一次呼叫綠界 API 更新狀態的時間';
