import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCouponSchema } from '@/lib/validations/coupon'

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const admin = createAdminClient()

  let query = admin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (search.trim()) query = query.ilike('code', `%${search.trim()}%`)

  const { data, error } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ coupons: data ?? [] })
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = createCouponSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Check code uniqueness
  const { data: existing } = await admin
    .from('coupons')
    .select('id')
    .eq('code', parsed.data.code)
    .single()
  if (existing)
    return apiError(
      `優惠碼「${parsed.data.code}」已存在`,
      409,
      'CODE_DUPLICATE',
    )

  const { data, error } = await admin
    .from('coupons')
    .insert({
      ...parsed.data,
      used_count: 0,
      created_at: now,
      updated_at: now,
    } as never)
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/coupons]', error?.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  return apiSuccess({ coupon: data as unknown as Record<string, unknown> }, 201)
})
