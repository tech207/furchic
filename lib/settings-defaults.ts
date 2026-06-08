// Correct DB key names (as seeded in 001_initial_schema.sql)
// Previously some keys used wrong names (free_shipping_threshold etc.) — both
// sets are kept here so the admin settings page works while we migrate.

export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  // ── Public / checkout keys (actual DB names) ────────────────────────────
  free_shipping_amount: 1500,
  gift_nfc_amount: 2500,
  gift_nfc_enabled: false,
  gift_nfc_start_at: null,
  gift_nfc_end_at: null,
  reward_max_usage_rate: 0.5,
  card_request_enabled: true,
  max_pets_per_user: 5,
  max_caregivers_per_pet: 5,

  // ── Legacy admin-page keys (not in DB seed — kept for backward compat) ──
  free_shipping_threshold: 1000,
  nfc_gift_threshold: 500,
  gift_event_enabled: false,
  gift_event_start: null,
  gift_event_end: null,
  reward_max_rate: 30,
  card_application_open: true,
  card_application_note:
    '製卡申請需 3-5 個工作天，完成後將寄送到您的收件地址。',
  card_request_description:
    '製卡申請需 3-5 個工作天，完成後將寄送到您的收件地址。',

  // ── Notification keys (009_notification_settings.sql) ──────────────────
  notify_order_created: false,
  notify_order_paid: false,
  notify_low_stock: false,
  notify_admin_email: '',
  notify_low_stock_threshold: 5,

  // ── ECPay keys (stored in system_settings, saved via admin settings) ────
  ecpay_merchant_id: '',
  ecpay_environment: 'staging',
}

export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS)
