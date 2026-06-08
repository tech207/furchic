import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRow = { id: string }
type ItemRow = {
  product_id: string
  product_name: string
  quantity: number
  subtotal: number
}

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const days = Math.min(
    90,
    Math.max(1, Number(url.searchParams.get('days') ?? '30')),
  )
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get('limit') ?? '8')),
  )
  const admin = createAdminClient()
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: orders } = await admin
    .from('orders')
    .select('id')
    .gte('created_at', startDate)
    .neq('status', 'cancelled')

  const orderIds = ((orders as unknown as OrderRow[]) ?? []).map((o) => o.id)
  if (orderIds.length === 0) return apiSuccess({ data: [] })

  const { data: items } = await admin
    .from('order_items')
    .select('product_id, product_name, quantity, subtotal')
    .in('order_id', orderIds)

  const rows = (items as unknown as ItemRow[]) ?? []
  const map = new Map<
    string,
    { name: string; total_sold: number; revenue: number }
  >()

  rows.forEach((r) => {
    const e = map.get(r.product_id) ?? {
      name: r.product_name,
      total_sold: 0,
      revenue: 0,
    }
    e.total_sold += r.quantity
    e.revenue += r.subtotal
    map.set(r.product_id, e)
  })

  const result = Array.from(map.entries())
    .map(([product_id, v]) => ({ product_id, ...v }))
    .sort((a, b) => b.total_sold - a.total_sold)
    .slice(0, limit)

  return apiSuccess({ data: result })
})
