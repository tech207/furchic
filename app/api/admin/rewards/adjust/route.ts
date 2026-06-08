import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const adjustSchema = z.object({
  user_id: z.string().uuid(),
  points: z
    .number()
    .int()
    .refine((n) => n !== 0, '點數不可為 0'),
  note: z.string().max(200).optional(),
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const parsed = adjustSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const { user_id, points, note } = parsed.data
  const admin = createAdminClient()

  // Verify user exists
  const { data: userRow } = await admin
    .from('users')
    .select('id, reward_points')
    .eq('id', user_id)
    .single()
  if (!userRow) return apiError('找不到此會員', 404, 'NOT_FOUND')

  const u = userRow as unknown as { id: string; reward_points: number }
  const newBalance = Math.max(0, u.reward_points + points)

  const [txRes, userRes] = await Promise.all([
    admin
      .from('reward_transactions')
      .insert({
        user_id,
        type: 'adjusted',
        points,
        note: note ?? null,
      } as never)
      .select()
      .single(),
    admin
      .from('users')
      .update({ reward_points: newBalance } as never)
      .eq('id', user_id),
  ])

  if (txRes.error || userRes.error)
    return apiError('調整失敗', 500, 'ADJUST_FAILED')

  return apiSuccess({ transaction: txRes.data, new_balance: newBalance }, 201)
})
