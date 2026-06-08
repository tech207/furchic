import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type EventRow = { event_type: string; session_id: string | null }

const STEPS = [
  'page_view',
  'add_to_cart',
  'checkout_start',
  'order_complete',
] as const
const LABELS: Record<string, string> = {
  page_view: '訪客',
  add_to_cart: '加入購物車',
  checkout_start: '開始結帳',
  order_complete: '完成訂單',
}

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const days = Math.min(
    90,
    Math.max(1, Number(url.searchParams.get('days') ?? '30')),
  )
  const admin = createAdminClient()
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data } = await admin
    .from('analytics_events')
    .select('event_type, session_id')
    .gte('created_at', startDate)
    .in('event_type', [...STEPS])

  const rows = (data as unknown as EventRow[]) ?? []

  const sets = new Map<string, Set<string>>()
  STEPS.forEach((s) => sets.set(s, new Set()))

  rows.forEach((r) => {
    if (r.session_id && sets.has(r.event_type)) {
      sets.get(r.event_type)!.add(r.session_id)
    }
  })

  const counts = STEPS.map((s) => sets.get(s)!.size)
  const top = counts[0] || 1

  const steps = STEPS.map((s, i) => ({
    name: LABELS[s],
    event: s,
    count: counts[i],
    rate: Math.round((counts[i] / top) * 100),
    conv:
      i === 0
        ? 100
        : counts[i - 1] > 0
          ? Math.round((counts[i] / counts[i - 1]) * 100)
          : 0,
  }))

  return apiSuccess({ steps })
})
