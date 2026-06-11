import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const commissionSchema = z.object({
  rule_type: z.enum(['base', 'product', 'category', 'channel'], {
    errorMap: () => ({
      message: '規則類型須為 base / product / category / channel',
    }),
  }),
  target_id: z.string().uuid('target_id 必須為有效 UUID').nullable().optional(),
  sales_channel: z.string().max(50).nullable().optional(),
  commission_rate: z
    .number()
    .min(0, '抽成比例不可為負')
    .max(1, '抽成比例最大為 1（100%）'),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

function vid(ctx: { params?: Record<string, string | string[]> }) {
  return ctx.params?.id as string | undefined
}

// ── GET /api/admin/vendors/[id]/commissions ───────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const vendorId = vid(ctx)
  if (!vendorId) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor } = await admin
    .from('vendors')
    .select('id, company_name, brand_name')
    .eq('id', vendorId)
    .maybeSingle()

  if (!vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')

  const { data, error } = await admin
    .from('vendor_commission_rules')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/admin/vendors/[id]/commissions]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ vendor, rules: data ?? [] })
})

// ── POST /api/admin/vendors/[id]/commissions ──────────────────────────────────

export const POST = withAdmin(async (req: NextRequest, ctx, user) => {
  const vendorId = vid(ctx)
  if (!vendorId) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = commissionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor } = await admin
    .from('vendors')
    .select('id')
    .eq('id', vendorId)
    .maybeSingle()

  if (!vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')

  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('vendor_commission_rules')
    .insert({
      ...parsed.data,
      vendor_id: vendorId,
      created_by: user.id,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/vendors/[id]/commissions]', error?.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  return apiSuccess({ rule: data }, 201)
})
