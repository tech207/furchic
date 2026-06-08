import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type LevelRow = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  sort_order: number
}

export const GET = withAuth(async (_req, _ctx, user) => {
  const admin = createAdminClient()

  const [userRes, levelsRes] = await Promise.all([
    admin
      .from('users')
      .select('total_spent, member_level_id')
      .eq('id', user.id)
      .single(),
    admin
      .from('member_levels')
      .select('id, name, min_spent, reward_rate, discount_rate, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  if (userRes.error || !userRes.data)
    return apiError('找不到使用者', 404, 'NOT_FOUND')

  const u = userRes.data as unknown as {
    total_spent: number
    member_level_id: string | null
  }
  const levels = (levelsRes.data as unknown as LevelRow[]) ?? []

  const currentLevel = levels.find((l) => l.id === u.member_level_id) ?? null
  const nextLevel = levels.find((l) => l.min_spent > u.total_spent) ?? null

  let progress = 100
  let current_spent = u.total_spent
  let next_threshold: number | null = null

  if (nextLevel) {
    const prevMin = currentLevel?.min_spent ?? 0
    const range = nextLevel.min_spent - prevMin
    const progress_in_range = u.total_spent - prevMin
    progress =
      range > 0
        ? Math.min(100, Math.floor((progress_in_range / range) * 100))
        : 0
    next_threshold = nextLevel.min_spent
  }

  return apiSuccess({
    progress,
    current_spent,
    next_threshold,
    current_level: currentLevel,
    next_level: nextLevel ?? null,
  })
})
