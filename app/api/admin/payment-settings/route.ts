import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const SELECT_COLS =
  'id, payment_type, display_name, description, is_enabled, icon_emoji, ecpay_payment_type, settings, sort_order, created_at, updated_at'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('payment_settings')
    .select(SELECT_COLS)
    .order('sort_order', { ascending: true })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ settings: data ?? [] })
})
