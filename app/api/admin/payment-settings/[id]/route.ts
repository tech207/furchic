import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('is_enabled' in body) patch.is_enabled = Boolean(body.is_enabled)
  if ('settings' in body) patch.settings = body.settings

  if (Object.keys(patch).length === 1) {
    return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('payment_settings')
    .update(patch as never)
    .eq('id', id)
    .select('id, payment_type, display_name, is_enabled, settings, updated_at')
    .single()

  if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')

  return apiSuccess({ setting: data })
})
