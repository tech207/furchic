import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

function changePct(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Math.round(((today - yesterday) / yesterday) * 100)
}

function dayBounds(offsetDays: number): [string, string] {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  const date = d.toISOString().slice(0, 10)
  return [`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`]
}

// ── Row types ─────────────────────────────────────────────────────────────────

type ORow = { total_amount: number }

type VariantRow = {
  id: string
  name: string
  sku: string
  stock: number
  low_stock_threshold: number
  products: { name: string; images: unknown } | null
}

export type LowStockItem = {
  id: string
  variant_name: string
  product_name: string | null
  sku: string
  stock: number
  threshold: number
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest, _ctx, _user) => {
  const admin = createAdminClient()

  const [todayStart, todayEnd] = dayBounds(0)
  const [yesterStart, yesterEnd] = dayBounds(1)

  const [
    mToday,
    mYest,
    mTotal,
    petsToday,
    petsTotal,
    oToday,
    oYest,
    oPending,
    pvToday,
    pvYest,
    nfcActive,
    nfcUnbound,
    lowStockRes,
  ] = await Promise.all([
    // ── members ──────────────────────────────────────────────────────────────
    admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
    admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterStart)
      .lte('created_at', yesterEnd),
    admin.from('users').select('id', { count: 'exact', head: true }),

    // ── pets ─────────────────────────────────────────────────────────────────
    admin
      .from('pets')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
    admin.from('pets').select('id', { count: 'exact', head: true }),

    // ── orders ───────────────────────────────────────────────────────────────
    admin
      .from('orders')
      .select('total_amount')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .neq('status', 'cancelled'),
    admin
      .from('orders')
      .select('total_amount')
      .gte('created_at', yesterStart)
      .lte('created_at', yesterEnd)
      .neq('status', 'cancelled'),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // ── page views ────────────────────────────────────────────────────────────
    admin
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd),
    admin
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')
      .gte('created_at', yesterStart)
      .lte('created_at', yesterEnd),

    // ── nfc_cards ─────────────────────────────────────────────────────────────
    admin
      .from('nfc_cards')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin
      .from('nfc_cards')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unbound'),

    // ── low stock — fetch active variants ordered by stock asc ────────────────
    // Column-to-column comparison (stock <= low_stock_threshold) is done in JS
    // since PostgREST JS client doesn't support cross-column filters.
    admin
      .from('product_variants')
      .select(
        'id, name, sku, stock, low_stock_threshold, products(name, images)',
      )
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .limit(200),
  ])

  // ── Compute derived values ────────────────────────────────────────────────

  const membersToday = mToday.count ?? 0
  const membersYest = mYest.count ?? 0
  const membersTotal = mTotal.count ?? 0

  const petsTodayCount = petsToday.count ?? 0
  const petsTotalCount = petsTotal.count ?? 0

  const oTodayRows = (oToday.data as unknown as ORow[]) ?? []
  const oYestRows = (oYest.data as unknown as ORow[]) ?? []
  const ordersToday = oTodayRows.length
  const ordersYest = oYestRows.length
  const ordersPending = oPending.count ?? 0
  const revenueToday = oTodayRows.reduce((s, r) => s + r.total_amount, 0)
  const revenueYest = oYestRows.reduce((s, r) => s + r.total_amount, 0)

  const pvTodayCount = pvToday.count ?? 0
  const pvYestCount = pvYest.count ?? 0

  const nfcActiveCount = nfcActive.count ?? 0
  const nfcUnboundCount = nfcUnbound.count ?? 0

  const allVariants = (lowStockRes.data as unknown as VariantRow[]) ?? []
  const lowStockAll = allVariants.filter(
    (v) => v.stock <= v.low_stock_threshold,
  )
  const lowStockItems: LowStockItem[] = lowStockAll.slice(0, 5).map((v) => ({
    id: v.id,
    variant_name: v.name,
    product_name: v.products?.name ?? null,
    sku: v.sku,
    stock: v.stock,
    threshold: v.low_stock_threshold,
  }))

  return apiSuccess({
    members: {
      today: membersToday,
      yesterday: membersYest,
      total: membersTotal,
      change_pct: changePct(membersToday, membersYest),
    },
    pets: {
      today: petsTodayCount,
      total: petsTotalCount,
    },
    orders: {
      today: ordersToday,
      yesterday: ordersYest,
      pending: ordersPending,
      change_pct: changePct(ordersToday, ordersYest),
    },
    revenue: {
      today: revenueToday,
      yesterday: revenueYest,
      change_pct: changePct(revenueToday, revenueYest),
    },
    page_views: {
      today: pvTodayCount,
      yesterday: pvYestCount,
      change_pct: changePct(pvTodayCount, pvYestCount),
    },
    low_stock: {
      count: lowStockAll.length,
      items: lowStockItems,
    },
    nfc_cards: {
      total_active: nfcActiveCount,
      total_unbound: nfcUnboundCount,
    },
  })
})
