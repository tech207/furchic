import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export const GET = withAuth(async (_req, _ctx, user) => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select('*, member_levels(id, name, reward_rate, discount_rate, benefits)')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return apiError('用戶不存在', 404, 'NOT_FOUND')
  }

  return apiSuccess(data as unknown as Record<string, unknown>)
})
