import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const VALID_CHANNELS = ['online_daily', 'online_campaign', 'physical_event']

type OrderRow = {
  created_at: string
  total_amount: number
  vendor_amount: number
}

// ── GET /api/vendor/reports/daily ─────────────────────────────────────────────

export const GET = withVendorPermission(
  'reports',
  async (req: NextRequest, _ctx, account) => {
    const url = new URL(req.url)
    const channel = url.searchParams.get('channel')?.trim() ?? ''
    const start_date = url.searchParams.get('start_date')?.trim() ?? ''
    const end_date = url.searchParams.get('end_date')?.trim() ?? ''

    if (channel && !VALID_CHANNELS.includes(channel)) {
      return apiError('無效的銷售管道', 400, 'INVALID_CHANNEL')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    let query = admin
      .from('orders')
      .select('created_at, total_amount, vendor_amount')
      .eq('vendor_id', account.vendor_id)
      .neq('status', 'cancelled')
      .neq('status', 'refunded')
      .order('created_at', { ascending: true })

    if (channel) query = query.eq('sales_channel', channel)
    if (start_date)
      query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
    if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

    const { data, error } = await query
    if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const rows = (data ?? []) as OrderRow[]

    // Aggregate by date (YYYY-MM-DD)
    const dayMap = new Map<
      string,
      { orders: number; revenue: number; vendor_revenue: number }
    >()

    for (const row of rows) {
      const date = row.created_at.slice(0, 10)
      const entry = dayMap.get(date) ?? {
        orders: 0,
        revenue: 0,
        vendor_revenue: 0,
      }
      entry.orders++
      entry.revenue += row.total_amount
      entry.vendor_revenue += row.vendor_amount
      dayMap.set(date, entry)
    }

    const daily = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    return apiSuccess({ daily })
  },
)
