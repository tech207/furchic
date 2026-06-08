import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updatePartnerSchema } from '@/lib/validations/about'

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updatePartnerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0)
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('partners')
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/partners/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ partner: data as unknown as Record<string, unknown> })
})

export const DELETE = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('partners')
    .update({ is_active: false, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select('id')
    .single()

  if (error || !data) {
    console.error('[DELETE /api/admin/partners/[id]]', error?.message)
    return apiError('刪除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
