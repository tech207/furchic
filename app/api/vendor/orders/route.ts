import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const DEFAULT_LIMIT = 20

const VALID_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'done',
  'cancelled',
  'refunded',
] as const

// ── GET /api/vendor/orders ────────────────────────────────────────────────────

export const GET = withVendorPermission(
  'orders',
  async (req: NextRequest, _ctx, account) => {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')?.trim() ?? ''
    // statuses: comma-separated list, e.g. "paid,processing"
    const statusesRaw = url.searchParams.get('statuses')?.trim() ?? ''
    const statusList = statusesRaw
      ? statusesRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const start_date = url.searchParams.get('start_date')?.trim() ?? ''
    const end_date = url.searchParams.get('end_date')?.trim() ?? ''
    const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
    const limitRaw = parseInt(
      url.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
      10,
    )
    const limit =
      isNaN(limitRaw) || limitRaw < 1 || limitRaw > 100
        ? DEFAULT_LIMIT
        : limitRaw

    if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
      return apiError('無效的狀態過濾條件', 400, 'INVALID_STATUS')
    }
    if (
      statusList.some((s) => !(VALID_STATUSES as readonly string[]).includes(s))
    ) {
      return apiError('無效的狀態過濾條件', 400, 'INVALID_STATUS')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const vendorId = account.vendor_id

    // Step 1: This vendor's product IDs
    const { data: products, error: productsErr } = await admin
      .from('products')
      .select('id')
      .eq('vendor_id', vendorId)

    if (productsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const productIds = ((products ?? []) as { id: string }[]).map((p) => p.id)
    if (productIds.length === 0) {
      return apiSuccess({ orders: [], total: 0, page, totalPages: 0 })
    }

    // Step 2: All variant IDs for those products
    const { data: variants, error: variantsErr } = await admin
      .from('product_variants')
      .select('id')
      .in('product_id', productIds)

    if (variantsErr) return apiError('載入失敗', 500, 'FETCH_FAILED')

    const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id)
    if (variantIds.length === 0) {
      return apiSuccess({ orders: [], total: 0, page, totalPages: 0 })
    }

    // Step 3: Distinct order IDs containing those variants
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
      return apiSuccess({ orders: [], total: 0, page, totalPages: 0 })
    }

    // Step 4: Paginated orders — only shipping-necessary fields, no phone
    let query = admin
      .from('orders')
      .select(
        'id, status, total_amount, subtotal, shipping_fee, shipping_method, recipient_name, recipient_address, cvs_store_id, cvs_store_name, tracking_number, created_at, updated_at',
        { count: 'exact' },
      )
      .in('id', orderIds)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status) query = query.eq('status', status)
    if (start_date)
      query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
    if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

    const { data, error, count } = await query
    if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

    return apiSuccess({
      orders: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  },
)
