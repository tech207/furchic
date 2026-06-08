import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createVariantSchema } from '@/lib/validations/product'

export const POST = withAdmin(async (req: NextRequest, ctx, user) => {
  const productId = ctx.params?.id as string | undefined
  if (!productId) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = createVariantSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const admin = createAdminClient()

  // Confirm product exists
  const { data: product } = await admin
    .from('products')
    .select('id')
    .eq('id', productId)
    .single()

  if (!product) return apiError('找不到商品', 404, 'NOT_FOUND')

  // Ensure SKU is unique
  const { data: skuConflict } = await admin
    .from('product_variants')
    .select('id')
    .eq('sku', parsed.data.sku)
    .single()

  if (skuConflict)
    return apiError(`SKU「${parsed.data.sku}」已被使用`, 409, 'SKU_CONFLICT')

  const { options, ...variantFields } = parsed.data
  const now = new Date().toISOString()

  const { data: variant, error: variantErr } = await admin
    .from('product_variants')
    .insert({
      ...variantFields,
      product_id: productId,
      created_at: now,
      updated_at: now,
    } as never)
    .select()
    .single()

  if (variantErr || !variant) {
    console.error(
      '[POST /api/admin/products/[id]/variants]',
      variantErr?.message,
    )
    return apiError('建立規格失敗', 500, 'CREATE_FAILED')
  }

  const variantRow = variant as unknown as { id: string; stock: number }

  // Insert options if provided
  if (options && options.length > 0) {
    await admin
      .from('product_variant_options')
      .insert(
        options.map((o) => ({ variant_id: variantRow.id, ...o })) as never,
      )
  }

  // Initial stock log (only if stock > 0)
  if (variantRow.stock > 0) {
    await admin.from('stock_logs').insert({
      variant_id: variantRow.id,
      change: variantRow.stock,
      stock_after: variantRow.stock,
      reason: 'manual',
      note: '初始庫存',
      created_by: user.id,
      created_at: now,
    } as never)
  }

  return apiSuccess(
    { variant: variant as unknown as Record<string, unknown> },
    201,
  )
})
