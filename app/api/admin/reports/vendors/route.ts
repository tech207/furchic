import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_CHANNELS = ['online_daily', 'online_campaign', 'physical_event']

type OrderRow = {
  vendor_id: string | null
  sales_channel: string
  total_amount: number
  vendor_amount: number
  commission_amount: number
  vendors: { brand_name: string; company_name: string } | null
}

type VendorStat = {
  vendor_id: string
  brand_name: string
  company_name: string
  total_orders: number
  total_revenue: number
  vendor_amount: number
  commission_amount: number
  channels: Record<string, number>
}

// ── GET /api/admin/reports/vendors ────────────────────────────────────────────

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const vendor_id = url.searchParams.get('vendor_id')?.trim() ?? ''
  const channel = url.searchParams.get('channel')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''

  if (channel && !VALID_CHANNELS.includes(channel)) {
    return apiError('無效的銷售管道', 400, 'INVALID_CHANNEL')
  }

  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select(
      'vendor_id, sales_channel, total_amount, vendor_amount, commission_amount, vendors(brand_name, company_name)',
    )
    .not('vendor_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'refunded')

  if (vendor_id) query = (query as any).eq('vendor_id', vendor_id)
  if (channel) query = (query as any).eq('sales_channel', channel)
  if (start_date)
    query = (query as any).gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date)
    query = (query as any).lte('created_at', `${end_date}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  const rows = (data ?? []) as unknown as OrderRow[]

  // Aggregate per vendor
  const vendorMap = new Map<string, VendorStat>()

  for (const row of rows) {
    if (!row.vendor_id) continue
    const vid = row.vendor_id

    if (!vendorMap.has(vid)) {
      vendorMap.set(vid, {
        vendor_id: vid,
        brand_name: row.vendors?.brand_name ?? '',
        company_name: row.vendors?.company_name ?? '',
        total_orders: 0,
        total_revenue: 0,
        vendor_amount: 0,
        commission_amount: 0,
        channels: { online_daily: 0, online_campaign: 0, physical_event: 0 },
      })
    }

    const stat = vendorMap.get(vid)!
    stat.total_orders++
    stat.total_revenue += row.total_amount
    stat.vendor_amount += row.vendor_amount
    stat.commission_amount += row.commission_amount
    if (row.sales_channel in stat.channels) {
      stat.channels[row.sales_channel]++
    }
  }

  const vendors = Array.from(vendorMap.values()).sort(
    (a, b) => b.total_revenue - a.total_revenue,
  )

  return apiSuccess({ vendors, total: vendors.length })
})
