import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('member_levels')
    .select(
      'id, name, min_spent, reward_rate, discount_rate, benefits, sort_order',
    )
    .order('sort_order', { ascending: true })
    .order('min_spent', { ascending: true })

  if (error) {
    console.error('[GET /api/member-levels]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ levels: data ?? [] })
}
