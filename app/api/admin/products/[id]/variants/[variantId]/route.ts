import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateVariantSchema } from '@/lib/validations/product'

export const PUT = withAdmin(async (req: NextRequest, ctx, user) => {
  const productId = ctx.params?.id as string | undefined
  const variantId = ctx.params?.variantId as string | undefined
  if (!productId || !variantId) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = updateVariantSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }

  const admin = createAdminClient()

  // Verify variant belongs to this product
  const { data: existing } = await admin
    .from('product_variants')
    .select('id, stock, sku')
    .eq('id', variantId)
    .eq('product_id', productId)
    .single()

  if (!existing) return apiError('找不到規格', 404, 'NOT_FOUND')

  type VariantRow = { id: string; stock: number; sku: string }
  const current = existing as unknown as VariantRow

  // SKU uniqueness check (only if changing SKU)
  if (updates.sku && updates.sku !== current.sku) {
    const { data: conflict } = await admin
      .from('product_variants')
      .select('id')
      .eq('sku', updates.sku)
      .neq('id', variantId)
      .single()

    if (conflict)
      return apiError(`SKU「${updates.sku}」已被使用`, 409, 'SKU_CONFLICT')
  }

  const now = new Date().toISOString()
  const stockChanged =
    updates.stock !== undefined && updates.stock !== current.stock

  const { data: variant, error } = await admin
    .from('product_variants')
    .update({ ...updates, updated_at: now } as never)
    .eq('id', variantId)
    .select()
    .single()

  if (error || !variant) {
    console.error(
      '[PUT /api/admin/products/[id]/variants/[variantId]]',
      error?.message,
    )
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  // Log stock change
  if (stockChanged) {
    const newStock = updates.stock!
    await admin.from('stock_logs').insert({
      variant_id: variantId,
      change: newStock - current.stock,
      stock_after: newStock,
      reason: 'manual',
      note: '管理員手動調整',
      created_by: user.id,
      created_at: now,
    } as never)
  }

  return apiSuccess({ variant: variant as unknown as Record<string, unknown> })
})

export const DELETE = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const productId = ctx.params?.id as string | undefined
  const variantId = ctx.params?.variantId as string | undefined
  if (!productId || !variantId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('product_variants')
    .select('id')
    .eq('id', variantId)
    .eq('product_id', productId)
    .single()

  if (!existing) return apiError('找不到規格', 404, 'NOT_FOUND')

  // Block deletion if variant has active orders
  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .contains('items', JSON.stringify([{ variant_id: variantId }]))
    .in('status', ['pending', 'paid', 'processing', 'shipped'])

  if ((count ?? 0) > 0) {
    return apiError('此規格有未完成訂單，無法刪除', 409, 'HAS_ACTIVE_ORDERS')
  }

  const { error } = await admin
    .from('product_variants')
    .delete()
    .eq('id', variantId)

  if (error) {
    console.error(
      '[DELETE /api/admin/products/[id]/variants/[variantId]]',
      error.message,
    )
    return apiError('刪除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
