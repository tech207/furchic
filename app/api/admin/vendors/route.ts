import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const LIMIT = 20
const VALID_STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const

// ── GET /api/admin/vendors ────────────────────────────────────────────────────

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const search = (url.searchParams.get('search') ?? '').trim()
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw

  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    return apiError('無效的狀態篩選', 400, 'INVALID_STATUS')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  let query = admin
    .from('vendors')
    .select(
      `id, company_name, brand_name, vendor_type, category, status,
       contact_email, contact_name, logo_url,
       default_commission_rate, created_at, approved_at, rejection_reason,
       products!vendor_id(count)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * LIMIT, page * LIMIT - 1)

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (search) {
    query = query.or(
      `brand_name.ilike.%${search}%,company_name.ilike.%${search}%,contact_email.ilike.%${search}%`,
    )
  }

  const { data: vendors, error, count } = await query

  if (error) {
    console.error('[GET /api/admin/vendors]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  const vendorList = (vendors ?? []) as Array<Record<string, unknown>>

  // Fetch this month's revenue for all vendors in one query
  let monthlyRevenueMap: Record<string, number> = {}
  if (vendorList.length > 0) {
    const vendorIds = vendorList.map((v) => v.id as string)
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString()

    const { data: orders } = await admin
      .from('orders')
      .select('vendor_id, total_amount')
      .in('vendor_id', vendorIds)
      .in('status', ['paid', 'processing', 'shipped', 'delivered'])
      .gte('created_at', monthStart)

    for (const o of (orders ?? []) as Array<{
      vendor_id: string
      total_amount: number | null
    }>) {
      if (o.vendor_id) {
        monthlyRevenueMap[o.vendor_id] =
          (monthlyRevenueMap[o.vendor_id] ?? 0) + (o.total_amount ?? 0)
      }
    }
  }

  const result = vendorList.map((v) => ({
    ...v,
    product_count:
      (v.products as Array<{ count: number }> | null)?.[0]?.count ?? 0,
    monthly_revenue: monthlyRevenueMap[v.id as string] ?? 0,
    products: undefined,
  }))

  return apiSuccess({
    vendors: result,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / LIMIT),
  })
})
