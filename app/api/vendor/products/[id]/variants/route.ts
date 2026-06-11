import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createVariantSchema } from '@/lib/validations/product'

// ── POST /api/vendor/products/[id]/variants ───────────────────────────────────

export const POST = withVendorPermission(
  'products',
  async (req: NextRequest, ctx, account) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // Confirm product exists and belongs to this vendor
    const { data: product } = await admin
      .from('products')
      .select('id, vendor_id, status')
      .eq('id', productId)
      .maybeSingle()

    if (!product) return apiError('找不到商品', 404, 'NOT_FOUND')
    if (product.vendor_id !== account.vendor_id) {
      return apiError('無權存取此商品', 403, 'FORBIDDEN')
    }
    // Variants can be added to draft/pending/rejected products (for preparation)
    if (product.status === 'approved') {
      // Approved products: allow adding variants (they'll still be visible)
    }

    // Ensure SKU is unique
    const { data: skuConflict } = await admin
      .from('product_variants')
      .select('id')
      .eq('sku', parsed.data.sku)
      .maybeSingle()

    if (skuConflict) {
      return apiError(`SKU「${parsed.data.sku}」已被使用`, 409, 'SKU_CONFLICT')
    }

    const { options, ...variantFields } = parsed.data
    const now = new Date().toISOString()

    const { data: variant, error: variantErr } = await admin
      .from('product_variants')
      .insert({
        ...variantFields,
        product_id: productId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (variantErr || !variant) {
      console.error(
        '[POST /api/vendor/products/[id]/variants]',
        variantErr?.message,
      )
      return apiError('建立規格失敗', 500, 'CREATE_FAILED')
    }

    const variantRow = variant as { id: string; stock: number }

    // Insert options if provided
    if (options && options.length > 0) {
      await admin
        .from('product_variant_options')
        .insert(options.map((o) => ({ variant_id: variantRow.id, ...o })))
    }

    // Initial stock log (only if stock > 0)
    if (variantRow.stock > 0) {
      await admin.from('stock_logs').insert({
        variant_id: variantRow.id,
        change: variantRow.stock,
        stock_after: variantRow.stock,
        reason: 'manual',
        note: '初始庫存',
        created_by: account.user_id,
        created_at: now,
      })
    }

    return apiSuccess({ variant }, 201)
  },
)
