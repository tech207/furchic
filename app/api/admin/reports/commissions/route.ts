import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// month format: YYYY-MM
const MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

type OrderRow = {
  id: string
  vendor_id: string | null
  total_amount: number
  vendor_amount: number
  commission_amount: number
  commission_rate: number | null
  status: string
  created_at: string
  vendors: {
    brand_name: string
    company_name: string
    contact_email: string
  } | null
}

type VendorCommission = {
  vendor_id: string
  brand_name: string
  company_name: string
  contact_email: string
  month: string
  total_orders: number
  gross_revenue: number
  commission_amount: number
  vendor_payable: number
  avg_commission_rate: number
}

// ── GET /api/admin/reports/commissions ────────────────────────────────────────

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const vendor_id = url.searchParams.get('vendor_id')?.trim() ?? ''
  const month = url.searchParams.get('month')?.trim() ?? ''

  if (!month)
    return apiError('請提供月份（格式 YYYY-MM）', 400, 'MISSING_MONTH')
  if (!MONTH_RE.test(month)) {
    return apiError('月份格式錯誤，請使用 YYYY-MM', 400, 'INVALID_MONTH')
  }

  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0, 23, 59, 59, 999) // last day of month

  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select(
      'id, vendor_id, total_amount, vendor_amount, commission_amount, commission_rate, status, created_at, vendors(brand_name, company_name, contact_email)',
    )
    .not('vendor_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'refunded')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (vendor_id) query = (query as any).eq('vendor_id', vendor_id)

  const { data, error } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  const rows = (data ?? []) as unknown as OrderRow[]

  // Group per vendor
  const vendorMap = new Map<
    string,
    Omit<VendorCommission, 'avg_commission_rate'> & { rate_sum: number }
  >()

  for (const row of rows) {
    if (!row.vendor_id) continue
    const vid = row.vendor_id

    if (!vendorMap.has(vid)) {
      vendorMap.set(vid, {
        vendor_id: vid,
        brand_name: row.vendors?.brand_name ?? '',
        company_name: row.vendors?.company_name ?? '',
        contact_email: row.vendors?.contact_email ?? '',
        month,
        total_orders: 0,
        gross_revenue: 0,
        commission_amount: 0,
        vendor_payable: 0,
        rate_sum: 0,
      })
    }

    const stat = vendorMap.get(vid)!
    stat.total_orders++
    stat.gross_revenue += row.total_amount
    stat.commission_amount += row.commission_amount
    stat.vendor_payable += row.vendor_amount
    stat.rate_sum += row.commission_rate ?? 0
  }

  const commissions: VendorCommission[] = Array.from(vendorMap.values()).map(
    ({ rate_sum, ...stat }) => ({
      ...stat,
      avg_commission_rate:
        stat.total_orders > 0
          ? Math.round((rate_sum / stat.total_orders) * 100) / 100
          : 0,
    }),
  )

  commissions.sort((a, b) => b.vendor_payable - a.vendor_payable)

  // Grand total
  const grand = commissions.reduce(
    (acc, v) => ({
      total_orders: acc.total_orders + v.total_orders,
      gross_revenue: acc.gross_revenue + v.gross_revenue,
      commission_amount: acc.commission_amount + v.commission_amount,
      vendor_payable: acc.vendor_payable + v.vendor_payable,
    }),
    {
      total_orders: 0,
      gross_revenue: 0,
      commission_amount: 0,
      vendor_payable: 0,
    },
  )

  return apiSuccess({
    month,
    commissions,
    grand,
    total_vendors: commissions.length,
  })
})
