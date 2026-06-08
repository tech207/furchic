import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateContactSettingsSchema } from '@/lib/validations/about'

export const PUT = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updateContactSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0)
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contact_settings')
    .upsert(
      { id: 1, ...updates, updated_at: new Date().toISOString() } as never,
      { onConflict: 'id' },
    )
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/contact-settings]', error?.message)
    return apiError('儲存失敗', 500, 'SAVE_FAILED')
  }

  return apiSuccess({
    contact_settings: data as unknown as Record<string, unknown>,
  })
})
