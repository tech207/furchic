import { type NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateUserSchema } from '@/lib/validations/user'

export const PUT = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = updateUserSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const updates = result.data
  // Strip empty strings — don't overwrite existing values with blanks
  const clean: Record<string, unknown> = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== '' && v !== undefined),
  )
  clean.updated_at = new Date().toISOString()

  // Use admin client to bypass the placeholder Database type restriction on .update()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .update(clean as unknown as never)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[PUT /api/users/me]', error.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess(data as unknown as Record<string, unknown>)
})
