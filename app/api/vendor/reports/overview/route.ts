import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const CHANNELS = ['online_daily', 'online_campaign', 'physical_event'] as const
type Channel = (typeof CHANNELS)[number]

type ChannelStat = {
  total_orders: number
  total_revenue: number
  vendor_revenue: number
  commission: number
}

type OrderRow = {
  sales_channel: string
  total_amount: number
  vendor_amount: number
  commission_amount: number
}

function empty(): ChannelStat {
  return { total_orders: 0, total_revenue: 0, vendor_revenue: 0, commission: 0 }
}

// ── GET /api/vendor/reports/overview ─────────────────────────────────────────

export const GET = withVendorPermission(
  'reports',
  async (req: NextRequest, _ctx, account) => {
    const url = new URL(req.url)
    const start_date = url.searchParams.get('start_date')?.trim() ?? ''
    const end_date = url.searchParams.get('end_date')?.trim() ?? ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    let query = admin
      .from('orders')
      .select('sales_channel, total_amount, vendor_amount, commission_amount')
      .eq('vendor_id', account.vendor_id)
      .neq('status', 'cancelled')
      .neq('status', 'refunded')

    if (start_date)
      query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
    if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

    const { data, error } = await query
    if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const rows = (data ?? []) as OrderRow[]

    const result: Record<Channel | 'total', ChannelStat> = {
      online_daily: empty(),
      online_campaign: empty(),
      physical_event: empty(),
      total: empty(),
    }

    for (const row of rows) {
      const ch = row.sales_channel as Channel
      if (ch in result) {
        result[ch].total_orders++
        result[ch].total_revenue += row.total_amount
        result[ch].vendor_revenue += row.vendor_amount
        result[ch].commission += row.commission_amount
      }
      result.total.total_orders++
      result.total.total_revenue += row.total_amount
      result.total.vendor_revenue += row.vendor_amount
      result.total.commission += row.commission_amount
    }

    return apiSuccess(result)
  },
)
