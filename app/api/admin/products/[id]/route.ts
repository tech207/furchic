import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateProductSchema } from '@/lib/validations/product'

// Statuses considered "in-flight" (not yet fulfilled/cancelled)
const ACTIVE_ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
] as const

// ── GET /api/admin/products/[id] ──────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .select(
      `
      id, name, description, base_price, images, is_active, sort_order, created_at, updated_at,
      product_variants (
        id, name, sku, price, stock, low_stock_threshold, is_active, sort_order
      )
    `,
    )
    .eq('id', id)
    .single()

  if (error || !data) return apiError('找不到商品', 404, 'NOT_FOUND')

  return apiSuccess({ product: data as unknown as Record<string, unknown> })
})

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/products/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ product: data as unknown as Record<string, unknown> })
})

export const DELETE = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // Confirm product exists
  const { data: product } = await admin
    .from('products')
    .select('id, is_active')
    .eq('id', id)
    .single()

  if (!product) return apiError('找不到商品', 404, 'NOT_FOUND')

  // Check for active orders containing any variant of this product
  const { data: variantsRaw } = await admin
    .from('product_variants')
    .select('id')
    .eq('product_id', id)

  const variantIds =
    (variantsRaw as unknown as Array<{ id: string }> | null)?.map(
      (v) => v.id,
    ) ?? []

  if (variantIds.length > 0) {
    const { data: activeItemsRaw } = await admin
      .from('order_items')
      .select('order_id')
      .in('variant_id', variantIds)

    const orderIds = [
      ...new Set(
        (activeItemsRaw as unknown as Array<{ order_id: string }> | null)?.map(
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

  // Soft delete
  const { error } = await admin
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() } as never)
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/admin/products/[id]]', error.message)
    return apiError('刪除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
