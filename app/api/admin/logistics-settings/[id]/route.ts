import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type UpdateBody = {
  is_enabled?: boolean
  shipping_fee?: number
  free_shipping_threshold?: number | null
  settings?: Record<string, unknown>
}

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: UpdateBody
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const patch: Record<string, unknown> = {}
  if ('is_enabled' in body) patch.is_enabled = body.is_enabled
  if ('shipping_fee' in body) patch.shipping_fee = body.shipping_fee
  if ('free_shipping_threshold' in body)
    patch.free_shipping_threshold = body.free_shipping_threshold
  if ('settings' in body) patch.settings = body.settings

  if (Object.keys(patch).length === 0)
    return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('logistics_settings')
    .update(patch as never)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')
  return apiSuccess({ setting: data })
})
