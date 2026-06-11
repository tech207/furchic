import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

// ── GET /api/vendor/orders/[id] ───────────────────────────────────────────────

export const GET = withVendorPermission(
  'orders',
  async (_req, ctx, account) => {
    const id = ctx.params?.id as string | undefined
    if (!id) return apiError('缺少訂單 ID', 400, 'MISSING_ID')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const vendorId = account.vendor_id

    // Step 1: This vendor's product IDs → variant IDs
    const { data: products, error: productsErr } = await admin
      .from('products')
      .select('id')
      .eq('vendor_id', vendorId)

    if (productsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const productIds = ((products ?? []) as { id: string }[]).map((p) => p.id)
    if (productIds.length === 0) return apiError('找不到訂單', 404, 'NOT_FOUND')

    const { data: variants, error: variantsErr } = await admin
      .from('product_variants')
      .select('id')
      .in('product_id', productIds)

    if (variantsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id)
    if (variantIds.length === 0) return apiError('找不到訂單', 404, 'NOT_FOUND')

    // Step 2: Fetch the order — only shipping-necessary fields, no phone
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, status, total_amount, subtotal, shipping_fee, shipping_method, recipient_name, recipient_address, cvs_store_id, cvs_store_name, tracking_number, note, created_at, updated_at',
      )
      .eq('id', id)
      .single()

    if (orderErr || !order) return apiError('找不到訂單', 404, 'NOT_FOUND')

    // Step 3: Fetch only this vendor's items in the order
    const { data: vendorItems, error: itemsErr } = await admin
      .from('order_items')
      .select('id, variant_id, product_name, quantity, unit_price')
      .eq('order_id', id)
      .in('variant_id', variantIds)

    if (itemsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    // Security: if this order has none of our vendor's items, deny access
    if (!vendorItems || vendorItems.length === 0) {
      return apiError('找不到訂單', 404, 'NOT_FOUND')
    }

    return apiSuccess({ order, items: vendorItems })
  },
)
