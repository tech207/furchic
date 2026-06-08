import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const ABOUT_KEYS = [
  'company_name',
  'company_description',
  'company_logo_url',
  'company_email',
  'company_phone',
  'company_address',
  'company_website',
  'social_instagram',
  'social_facebook',
  'social_line',
] as const

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', ABOUT_KEYS as unknown as string[])

  const result: Record<string, string> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    result[row.key] = (row.value as string) ?? ''
  }
  return apiSuccess(result)
})

export const PUT = withAdmin(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const updates = body as Partial<Record<(typeof ABOUT_KEYS)[number], string>>
  const admin = createAdminClient()

  const rows = Object.entries(updates)
    .filter(([k]) => (ABOUT_KEYS as readonly string[]).includes(k))
    .map(([key, value]) => ({
      key,
      value: value as never,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }))

  if (!rows.length) return apiError('無有效欄位', 400, 'NO_VALID_FIELDS')

  const { error } = await admin
    .from('system_settings')
    .upsert(rows, { onConflict: 'key' })
  if (error) return apiError('儲存失敗', 500, 'SAVE_FAILED')

  return apiSuccess({ updated: rows.map((r) => r.key) })
})
