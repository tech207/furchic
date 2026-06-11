import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const VALID_CHANNELS = ['online_daily', 'online_campaign', 'physical_event']
const VALID_SORTS = ['revenue', 'orders'] as const

type OrderSummary = {
  id: string
  commission_rate: number | null
}

type ItemRow = {
  order_id: string
  variant_id: string
  product_name: string | null
  quantity: number
  unit_price: number
  product_variants: {
    sku: string
    name: string
    product_id: string
  } | null
}

type SkuEntry = {
  variant_id: string
  variant_name: string
  sku: string
  quantity: number
  revenue: number
  vendor_revenue: number
}

type ProductEntry = {
  product_id: string
  product_name: string
  order_ids: Set<string>
  total_orders: number
  total_revenue: number
  vendor_revenue: number
  skus: Map<string, SkuEntry>
}

// ── GET /api/vendor/reports/products ─────────────────────────────────────────

export const GET = withVendorPermission(
  'reports',
  async (req: NextRequest, _ctx, account) => {
    const url = new URL(req.url)
    const channel = url.searchParams.get('channel')?.trim() ?? ''
    const start_date = url.searchParams.get('start_date')?.trim() ?? ''
    const end_date = url.searchParams.get('end_date')?.trim() ?? ''
    const sort = (url.searchParams.get('sort')?.trim() ??
      'revenue') as (typeof VALID_SORTS)[number]

    if (channel && !VALID_CHANNELS.includes(channel)) {
      return apiError('無效的銷售管道', 400, 'INVALID_CHANNEL')
    }
    if (!VALID_SORTS.includes(sort as never)) {
      return apiError('無效的排序方式', 400, 'INVALID_SORT')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const vendorId = account.vendor_id

    // Step 1: Get qualifying orders for this vendor
    let ordersQuery = admin
      .from('orders')
      .select('id, commission_rate')
      .eq('vendor_id', vendorId)
      .neq('status', 'cancelled')
      .neq('status', 'refunded')

    if (channel) ordersQuery = ordersQuery.eq('sales_channel', channel)
    if (start_date)
      ordersQuery = ordersQuery.gte('created_at', `${start_date}T00:00:00.000Z`)
    if (end_date)
      ordersQuery = ordersQuery.lte('created_at', `${end_date}T23:59:59.999Z`)

    const { data: orders, error: ordersErr } = await ordersQuery
    if (ordersErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const orderList = (orders ?? []) as OrderSummary[]
    if (orderList.length === 0) return apiSuccess({ products: [] })

    // commission_rate lookup: orderId → rate
    const rateMap = new Map<string, number>(
      orderList.map((o) => [o.id, o.commission_rate ?? 0]),
    )
    const orderIds = orderList.map((o) => o.id)

    // Step 2: Get order items with variant info (only this vendor's variants)
    const { data: items, error: itemsErr } = await admin
      .from('order_items')
      .select(
        'order_id, variant_id, product_name, quantity, unit_price, product_variants(sku, name, product_id)',
      )
      .in('order_id', orderIds)

    if (itemsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const itemRows = (items ?? []) as ItemRow[]

    // Step 3: Verify items belong to this vendor (security: cross-check product_id)
    // Collect distinct product_ids from items
    const productIds = [
      ...new Set(
        itemRows
          .map((i) => i.product_variants?.product_id)
          .filter((id): id is string => !!id),
      ),
    ]

    let vendorProductIds = new Set<string>()
    if (productIds.length > 0) {
      const { data: vendorProducts } = await admin
        .from('products')
        .select('id, name')
        .eq('vendor_id', vendorId)
        .in('id', productIds)

      const vp = (vendorProducts ?? []) as { id: string; name: string }[]
      vendorProductIds = new Set(vp.map((p) => p.id))
    }

    // Step 4: Aggregate by product
    const productMap = new Map<string, ProductEntry>()

    for (const item of itemRows) {
      const pv = item.product_variants
      if (!pv) continue
      const productId = pv.product_id
      if (!vendorProductIds.has(productId)) continue // skip non-vendor items

      const commissionRate = rateMap.get(item.order_id) ?? 0
      const grossRevenue = item.unit_price * item.quantity
      const vendorRevenue = Math.round(
        grossRevenue * (1 - commissionRate / 100),
      )

      // Product-level entry
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          product_id: productId,
          product_name: item.product_name ?? pv.name,
          order_ids: new Set(),
          total_orders: 0,
          total_revenue: 0,
          vendor_revenue: 0,
          skus: new Map(),
        })
      }
      const prod = productMap.get(productId)!
      prod.order_ids.add(item.order_id)
      prod.total_revenue += grossRevenue
      prod.vendor_revenue += vendorRevenue

      // SKU-level entry
      if (!prod.skus.has(item.variant_id)) {
        prod.skus.set(item.variant_id, {
          variant_id: item.variant_id,
          variant_name: pv.name,
          sku: pv.sku,
          quantity: 0,
          revenue: 0,
          vendor_revenue: 0,
        })
      }
      const sku = prod.skus.get(item.variant_id)!
      sku.quantity += item.quantity
      sku.revenue += grossRevenue
      sku.vendor_revenue += vendorRevenue
    }

    // Finalize total_orders (distinct orders per product)
    for (const prod of productMap.values()) {
      prod.total_orders = prod.order_ids.size
    }

    // Build output
    let products = Array.from(productMap.values()).map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      total_orders: p.total_orders,
      total_revenue: p.total_revenue,
      vendor_revenue: p.vendor_revenue,
      sku_breakdown: Array.from(p.skus.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
    }))

    if (sort === 'revenue') {
      products = products.sort((a, b) => b.total_revenue - a.total_revenue)
    } else {
      products = products.sort((a, b) => b.total_orders - a.total_orders)
    }

    return apiSuccess({ products })
  },
)
