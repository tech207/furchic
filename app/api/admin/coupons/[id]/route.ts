import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateCouponSchema } from '@/lib/validations/coupon'

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updateCouponSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const updates = parsed.data
  if (Object.keys(updates).length === 0)
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coupons')
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/coupons/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ coupon: data as unknown as Record<string, unknown> })
})

export const DELETE = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // Check for any usages before deleting
  const { count } = await admin
    .from('coupon_usages')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)

  if ((count ?? 0) > 0) {
    return apiError(
      '此優惠碼已有使用紀錄，無法刪除（可改為停用）',
      409,
      'HAS_USAGES',
    )
  }

  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error) return apiError('刪除失敗', 500, 'DELETE_FAILED')

  return apiSuccess({ success: true })
})
