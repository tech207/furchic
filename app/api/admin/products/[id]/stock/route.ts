import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { stockAdjustSchema } from '@/lib/validations/product'

export const PUT = withAdmin(async (req: NextRequest, ctx, user) => {
  const productId = ctx.params?.id as string | undefined
  if (!productId) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = stockAdjustSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { variant_id, change, reason, note } = parsed.data
  const admin = createAdminClient()

  // Verify variant belongs to this product
  const { data: variantRaw } = await admin
    .from('product_variants')
    .select('id, stock')
    .eq('id', variant_id)
    .eq('product_id', productId)
    .single()

  if (!variantRaw) return apiError('找不到規格或不屬於此商品', 404, 'NOT_FOUND')

  const variant = variantRaw as unknown as { id: string; stock: number }
  const newStock = variant.stock + change

  if (newStock < 0) {
    return apiError(
      `庫存不足（目前 ${variant.stock}，變更量 ${change}）`,
      422,
      'INSUFFICIENT_STOCK',
    )
  }

  const now = new Date().toISOString()

  // Update variant stock
  const { error: updateErr } = await admin
    .from('product_variants')
    .update({ stock: newStock, updated_at: now } as never)
    .eq('id', variant_id)

  if (updateErr) {
    console.error(
      '[PUT /api/admin/products/[id]/stock] update',
      updateErr.message,
    )
    return apiError('庫存更新失敗', 500, 'UPDATE_FAILED')
  }

  // Insert stock log
  const { error: logErr } = await admin.from('stock_logs').insert({
    variant_id,
    change,
    stock_after: newStock,
    reason,
    note: note ?? null,
    created_by: user.id,
    created_at: now,
  } as never)

  if (logErr) {
    console.error('[PUT /api/admin/products/[id]/stock] log', logErr.message)
    // Non-fatal: stock updated, just log failed
  }

  return apiSuccess({ variant_id, stock: newStock, change, reason })
})
