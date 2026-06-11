import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Schema ────────────────────────────────────────────────────────────────────

const updateVendorSchema = z.object({
  brand_name: z.string().min(1).max(100).optional(),
  company_name: z.string().min(1).max(100).optional(),
  contact_name: z.string().min(1).max(50).optional(),
  contact_phone: z.string().max(20).optional(),
  company_phone: z.string().max(20).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  vendor_type: z.enum(['permanent', 'flash']).optional(),
  default_commission_rate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).nullable().optional(),
  website_url: z.string().url().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
})

function vid(ctx: { params?: Record<string, string | string[]> }) {
  return ctx.params?.id as string | undefined
}

// ── GET /api/admin/vendors/[id] ───────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const id = vid(ctx)
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor, error } = await admin
    .from('vendors')
    .select(
      `*, vendor_accounts(
        id, email, role, permissions, is_active, last_login_at, created_at
      )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[GET /api/admin/vendors/[id]]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }
  if (!vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')

  // Monthly stats via orders.vendor_id
  const now = new Date()
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString()

  const { data: monthlyOrders, count: orderCount } = await admin
    .from('orders')
    .select('id, total_amount', { count: 'exact' })
    .eq('vendor_id', id)
    .in('status', ['paid', 'processing', 'shipped', 'delivered'])
    .gte('created_at', monthStart)

  const monthlyRevenue = (
    (monthlyOrders ?? []) as Array<{ total_amount: number | null }>
  ).reduce((sum, o) => sum + (o.total_amount ?? 0), 0)

  // All-time order count
  const { count: totalOrderCount } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', id)
    .in('status', ['paid', 'processing', 'shipped', 'delivered'])

  // Product count
  const { count: productCount } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', id)

  // Commission rules
  const { data: commissionRules } = await admin
    .from('vendor_commission_rules')
    .select('*')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })

  return apiSuccess({
    vendor: {
      ...vendor,
      product_count: productCount ?? 0,
      order_count: totalOrderCount ?? 0,
      monthly_revenue: monthlyRevenue,
      monthly_order_count: orderCount ?? 0,
      commission_rules: commissionRules ?? [],
    },
  })
})

// ── PUT /api/admin/vendors/[id] ───────────────────────────────────────────────

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = vid(ctx)
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updateVendorSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }
  if (Object.keys(parsed.data).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: existing } = await admin
    .from('vendors')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return apiError('找不到廠商', 404, 'NOT_FOUND')

  const { data, error } = await admin
    .from('vendors')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/vendors/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ vendor: data })
})
