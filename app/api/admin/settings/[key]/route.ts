import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { SETTINGS_KEYS } from '@/lib/settings-defaults'

export const PUT = withAdmin(async (req: NextRequest, ctx, user) => {
  const key = ctx.params?.key as string | undefined
  if (!key) return apiError('缺少 key', 400, 'MISSING_KEY')

  // Allowlist check: rejects unknown keys to prevent DB pollution
  if (!SETTINGS_KEYS.includes(key)) {
    return apiError(`無效的設定 key: ${key}`, 400, 'INVALID_KEY')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const { value } = body as { value: unknown }
  if (value === undefined) return apiError('缺少 value', 400, 'MISSING_VALUE')

  const admin = createAdminClient()
  const { error } = await admin
    .from('system_settings')
    .upsert(
      {
        key,
        value: value as never,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )

  if (error) return apiError('儲存失敗', 500, 'SAVE_FAILED')
  return apiSuccess({ key, value })
})
