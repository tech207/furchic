import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    admin_note: z.string().max(2000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, '至少提供一個欄位')

export const GET = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const [userRes, petsRes, ordersRes, txRes] = await Promise.all([
    admin
      .from('users')
      .select(
        '*, member_levels(id, name, min_spent, reward_rate, discount_rate)',
      )
      .eq('id', id)
      .single() as unknown as Promise<{
      data: Record<string, unknown> | null
      error: Error | null
    }>,
    admin
      .from('pets')
      .select('id, name, photo_url, card_status, breed, nfc_cards(id, status)')
      .eq('user_id', id)
      .order('created_at') as unknown as Promise<{
      data: unknown[] | null
      error: Error | null
    }>,
    admin
      .from('orders')
      .select('id, status, total_amount, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10) as unknown as Promise<{
      data: unknown[] | null
      error: Error | null
    }>,
    admin
      .from('reward_transactions')
      .select('id, type, points, note, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5) as unknown as Promise<{
      data: unknown[] | null
      error: Error | null
    }>,
  ])

  if (userRes.error || !userRes.data)
    return apiError('找不到會員', 404, 'NOT_FOUND')

  return apiSuccess({
    user: userRes.data,
    pets: petsRes.data ?? [],
    orders: ordersRes.data ?? [],
    transactions: txRes.data ?? [],
  })
})

export const PUT = withAdmin(async (req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const admin = createAdminClient()

  // Cannot demote yourself
  if (parsed.data.role === 'user' && id === user.id) {
    return apiError('不能移除自己的 Admin 權限', 400, 'SELF_DEMOTION')
  }

  // If demoting to user, ensure at least 1 admin remains
  if (parsed.data.role === 'user') {
    const { count } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return apiError('系統至少需保留 1 位 Admin', 400, 'LAST_ADMIN')
    }
  }

  const { data, error } = await admin
    .from('users')
    .update(parsed.data as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')
  return apiSuccess({ user: data })
})
