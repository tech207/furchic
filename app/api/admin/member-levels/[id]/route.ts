import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  min_spent: z.number().int().min(0).optional(),
  reward_rate: z.number().min(0).max(1).optional(),
  discount_rate: z.number().min(0).max(1).optional(),
  benefits: z.array(z.string()).optional(),
  sort_order: z.number().int().min(0).optional(),
})

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
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
  const { data, error } = await admin
    .from('member_levels')
    .update(parsed.data as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')
  return apiSuccess({ level: data })
})

export const DELETE = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // Block if users currently hold this level
  const { count } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('member_level_id', id)

  if (count && count > 0) {
    return apiError(`此等級有 ${count} 位會員，無法刪除`, 409, 'LEVEL_IN_USE')
  }

  const { error } = await admin.from('member_levels').delete().eq('id', id)
  if (error) return apiError('刪除失敗', 500, 'DELETE_FAILED')
  return apiSuccess({ success: true })
})
