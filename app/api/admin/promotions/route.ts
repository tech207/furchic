import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPromotionSchema } from '@/lib/validations/promotion'

export const GET = withAdmin(async (_req, _ctx, _user) => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ promotions: data ?? [] })
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = createPromotionSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('promotions')
    .insert({ ...parsed.data, created_at: now, updated_at: now } as never)
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/promotions]', error?.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  return apiSuccess(
    { promotion: data as unknown as Record<string, unknown> },
    201,
  )
})
