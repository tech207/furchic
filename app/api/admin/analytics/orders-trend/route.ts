import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRow = { total_amount: number; created_at: string }

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const days = Math.min(
    90,
    Math.max(7, Number(url.searchParams.get('days') ?? '30')),
  )
  const admin = createAdminClient()

  const startDate = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data } = await admin
    .from('orders')
    .select('total_amount, created_at')
    .gte('created_at', startDate)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  const rows = (data as unknown as OrderRow[]) ?? []

  // Pre-fill all dates with 0
  const grouped = new Map<string, { count: number; revenue: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    grouped.set(d, { count: 0, revenue: 0 })
  }

  rows.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    const e = grouped.get(d)
    if (e) {
      e.count++
      e.revenue += r.total_amount
    }
  })

  const result = Array.from(grouped.entries()).map(([date, v]) => ({
    date,
    count: v.count,
    revenue: v.revenue,
  }))

  return apiSuccess({ data: result })
})
