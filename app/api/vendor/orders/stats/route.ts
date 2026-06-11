import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

// ── GET /api/vendor/orders/stats ──────────────────────────────────────────────

export const GET = withVendorPermission(
  'orders',
  async (_req, _ctx, account) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const vendorId = account.vendor_id

    // Step 1: This vendor's product IDs → variant IDs
    const [productsRes, now] = await Promise.all([
      admin.from('products').select('id').eq('vendor_id', vendorId),
      Promise.resolve(new Date()),
    ])

    if (productsRes.error) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const productIds = ((productsRes.data ?? []) as { id: string }[]).map(
      (p) => p.id,
    )
    if (productIds.length === 0) {
      return apiSuccess({ today: 0, this_month: 0, pending_shipping: 0 })
    }

    const { data: variants, error: variantsErr } = await admin
      .from('product_variants')
      .select('id')
      .in('product_id', productIds)

    if (variantsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id)
    if (variantIds.length === 0) {
      return apiSuccess({ today: 0, this_month: 0, pending_shipping: 0 })
    }

    // Step 2: Distinct order IDs for this vendor
    const { data: orderItems, error: itemsErr } = await admin
      .from('order_items')
      .select('order_id')
      .in('variant_id', variantIds)

    if (itemsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const orderIds = [
      ...new Set(
        ((orderItems ?? []) as { order_id: string }[]).map((i) => i.order_id),
      ),
    ]

    if (orderIds.length === 0) {
      return apiSuccess({ today: 0, this_month: 0, pending_shipping: 0 })
    }

    // Step 3: Parallel counts
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [todayRes, monthRes, pendingRes] = await Promise.all([
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('id', orderIds)
        .gte('created_at', todayStart.toISOString())
        .neq('status', 'cancelled'),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('id', orderIds)
        .gte('created_at', monthStart.toISOString())
        .neq('status', 'cancelled'),
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('id', orderIds)
        .in('status', ['paid', 'processing']),
    ])

    return apiSuccess({
      today: todayRes.count ?? 0,
      this_month: monthRes.count ?? 0,
      pending_shipping: pendingRes.count ?? 0,
    })
  },
)
