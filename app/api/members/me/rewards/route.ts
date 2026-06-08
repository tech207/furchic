import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type LevelRow = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: unknown
  sort_order: number
}
type TxRow = {
  id: string
  type: string
  points: number
  note: string | null
  order_id: string | null
  created_at: string
}

export const GET = withAuth(async (_req, _ctx, user) => {
  const admin = createAdminClient()

  const [userRes, levelsRes, txRes] = await Promise.all([
    admin
      .from('users')
      .select('reward_points, total_spent, member_level_id')
      .eq('id', user.id)
      .single(),
    admin
      .from('member_levels')
      .select('*')
      .order('sort_order', { ascending: true }),
    admin
      .from('reward_transactions')
      .select('id, type, points, note, order_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (userRes.error || !userRes.data)
    return apiError('找不到使用者', 404, 'NOT_FOUND')

  const u = userRes.data as unknown as {
    reward_points: number
    total_spent: number
    member_level_id: string | null
  }
  const levels = (levelsRes.data as unknown as LevelRow[]) ?? []
  const txs = (txRes.data as unknown as TxRow[]) ?? []

  const currentLevel = levels.find((l) => l.id === u.member_level_id) ?? null
  const nextLevel = levels.find((l) => l.min_spent > u.total_spent) ?? null
  const points_to_next = nextLevel ? nextLevel.min_spent - u.total_spent : null

  return apiSuccess({
    level: currentLevel,
    reward_points: u.reward_points,
    next_level: nextLevel ?? null,
    points_to_next,
    transactions: txs,
  })
})
