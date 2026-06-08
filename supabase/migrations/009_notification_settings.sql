-- ── 通知設定 ──────────────────────────────────────────────────────────────────

INSERT INTO system_settings (key, value, description) VALUES
('notify_order_created',       'false', '訂單成立時通知管理員'),
('notify_order_paid',          'false', '訂單付款完成時通知管理員'),
('notify_low_stock',           'false', '低庫存通知'),
('notify_admin_email',         '""',    '通知收件人 Email'),
('notify_low_stock_threshold', '5',     '低庫存通知閾值（件數）'),
('max_pets_per_user',          '5',     '每位會員最多可建立的寵物數量')
ON CONFLICT (key) DO NOTHING;
