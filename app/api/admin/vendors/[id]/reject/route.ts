import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminRejectVendorSchema } from '@/lib/validations/vendor'

export const POST = withAdmin(async (req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = adminRejectVendorSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { reason } = result.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor, error: fetchError } = await admin
    .from('vendors')
    .select('id, status, brand_name')
    .eq('id', id)
    .single()

  if (fetchError || !vendor) {
    return apiError('找不到廠商', 404, 'NOT_FOUND')
  }

  if (vendor.status === 'rejected') {
    return apiError('此廠商申請已被拒絕', 409, 'ALREADY_REJECTED')
  }

  const { error: updateError } = await admin
    .from('vendors')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('[admin/vendors/reject]', updateError.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({
    success: true,
    message: `已拒絕 ${vendor.brand_name as string} 的申請`,
  })
})
