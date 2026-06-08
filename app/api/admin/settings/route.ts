import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS, SETTINGS_KEYS } from '@/lib/settings-defaults'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', SETTINGS_KEYS)

  if (error) return apiError('讀取失敗', 500, 'READ_FAILED')

  const result: Record<string, unknown> = { ...SETTINGS_DEFAULTS }
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    result[row.key] = row.value
  }

  return apiSuccess({ settings: result })
})
