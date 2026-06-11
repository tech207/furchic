import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withVendorAuth, withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EDITABLE_STATUSES = ['draft', 'rejected'] as const
const ACTIVE_ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
] as const

const vendorUpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  base_price: z.number().int().min(0).optional(),
  images: z.array(z.string().url()).max(6).optional(),
  category: z.string().max(100).nullable().optional(),
  submit: z.boolean().default(true),
})

function productId(ctx: { params?: Record<string, string | string[]> }) {
  return ctx.params?.id as string | undefined
}

// ── GET /api/vendor/products/[id] ─────────────────────────────────────────────

export const GET = withVendorAuth(async (_req: NextRequest, ctx, account) => {
  const id = productId(ctx)
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: product, error } = await admin
    .from('products')
    .select(
      `id, name, description, base_price, images, status, is_approved, is_active,
       category, sort_order, created_at, updated_at, vendor_id,
       product_variants ( id, name, sku, price, stock, is_active, sort_order )`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[GET /api/vendor/products/[id]]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }
  if (!product) return apiError('找不到商品', 404, 'NOT_FOUND')
  if (product.vendor_id !== account.vendor_id) {
    return apiError('無權存取此商品', 403, 'FORBIDDEN')
  }

  return apiSuccess({ product })
})

// ── PUT /api/vendor/products/[id] ─────────────────────────────────────────────
// Only draft / rejected products can be edited; re-submits as pending.

export const PUT = withVendorPermission(
  'products',
  async (req: NextRequest, ctx, account) => {
    const id = productId(ctx)
    if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: existing } = await admin
      .from('products')
      .select('id, vendor_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return apiError('找不到商品', 404, 'NOT_FOUND')
    if (existing.vendor_id !== account.vendor_id) {
      return apiError('無權修改此商品', 403, 'FORBIDDEN')
    }
    if (!(EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
      return apiError(
        `目前狀態「${existing.status}」不允許修改，只有 draft 或 rejected 狀態可修改`,
        409,
        'STATUS_NOT_EDITABLE',
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid request body', 400, 'INVALID_JSON')
    }

    const parsed = vendorUpdateProductSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
    }
    if (Object.keys(parsed.data).length === 0) {
      return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
    }

    const { submit, ...fields } = parsed.data
    const { data, error } = await admin
      .from('products')
      .update({
        ...fields,
        ...(submit ? { status: 'pending', is_approved: false } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      console.error('[PUT /api/vendor/products/[id]]', error?.message)
      return apiError('更新失敗', 500, 'UPDATE_FAILED')
    }

    return apiSuccess({ product: data })
  },
)

// ── DELETE /api/vendor/products/[id] ─────────────────────────────────────────
// Only draft / rejected, and only when there are no active orders.

export const DELETE = withVendorPermission(
  'products',
  async (_req: NextRequest, ctx, account) => {
    const id = productId(ctx)
    if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: existing } = await admin
      .from('products')
      .select('id, vendor_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return apiError('找不到商品', 404, 'NOT_FOUND')
    if (existing.vendor_id !== account.vendor_id) {
      return apiError('無權刪除此商品', 403, 'FORBIDDEN')
    }
    if (!(EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
      return apiError(
        '只有 draft 或 rejected 狀態的商品可刪除',
        409,
        'STATUS_NOT_DELETABLE',
      )
    }

    // Check for active orders containing any variant of this product
    const { data: variantsRaw } = await admin
      .from('product_variants')
      .select('id')
      .eq('product_id', id)

    const variantIds: string[] =
      (variantsRaw as Array<{ id: string }> | null)?.map((v) => v.id) ?? []

    if (variantIds.length > 0) {
      const { data: orderItemsRaw } = await admin
        .from('order_items')
        .select('order_id')
        .in('variant_id', variantIds)

      const orderIds = [
        ...new Set(
          (orderItemsRaw as Array<{ order_id: string }> | null)?.map(
            (i) => i.order_id,
          ) ?? [],
        ),
      ]

      if (orderIds.length > 0) {
        const { count } = await admin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('id', orderIds)
          .in('status', [...ACTIVE_ORDER_STATUSES])

        if ((count ?? 0) > 0) {
          return apiError(
            '此商品有未完成訂單，無法刪除',
            409,
            'HAS_ACTIVE_ORDERS',
          )
        }
      }
    }

    const { error } = await admin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/vendor/products/[id]]', error.message)
      return apiError('刪除失敗', 500, 'DELETE_FAILED')
    }

    return apiSuccess({ success: true })
  },
)
