import type { NextRequest } from 'next/server'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { updateVariantSchema } from '@/lib/validations/product'

function ids(ctx: { params?: Record<string, string | string[]> }) {
  return {
    productId: ctx.params?.id as string | undefined,
    variantId: ctx.params?.variantId as string | undefined,
  }
}

// ── PUT /api/vendor/products/[id]/variants/[variantId] ────────────────────────

export const PUT = withVendorPermission(
  'products',
  async (req: NextRequest, ctx, account) => {
    const { productId, variantId } = ids(ctx)
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
    if (Object.keys(parsed.data).length === 0) {
      return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: variant } = await admin
      .from('product_variants')
      .select('id, product_id, products!inner(vendor_id)')
      .eq('id', variantId)
      .eq('product_id', productId)
      .maybeSingle()

    if (!variant) return apiError('找不到規格', 404, 'NOT_FOUND')
    if (variant.products?.vendor_id !== account.vendor_id) {
      return apiError('無權修改此規格', 403, 'FORBIDDEN')
    }

    // Check SKU uniqueness if sku is being updated
    if (parsed.data.sku) {
      const { data: conflict } = await admin
        .from('product_variants')
        .select('id')
        .eq('sku', parsed.data.sku)
        .neq('id', variantId)
        .maybeSingle()
      if (conflict)
        return apiError(
          `SKU「${parsed.data.sku}」已被使用`,
          409,
          'SKU_CONFLICT',
        )
    }

    const { data, error } = await admin
      .from('product_variants')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', variantId)
      .select()
      .single()

    if (error || !data) {
      console.error(
        '[PUT /api/vendor/products/[id]/variants/[variantId]]',
        error?.message,
      )
      return apiError('更新失敗', 500, 'UPDATE_FAILED')
    }

    return apiSuccess({ variant: data })
  },
)

// ── DELETE /api/vendor/products/[id]/variants/[variantId] ─────────────────────

export const DELETE = withVendorPermission(
  'products',
  async (_req: NextRequest, ctx, account) => {
    const { productId, variantId } = ids(ctx)
    if (!productId || !variantId) return apiError('缺少 ID', 400, 'MISSING_ID')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const { data: variant } = await admin
      .from('product_variants')
      .select('id, product_id, products!inner(vendor_id)')
      .eq('id', variantId)
      .eq('product_id', productId)
      .maybeSingle()

    if (!variant) return apiError('找不到規格', 404, 'NOT_FOUND')
    if (variant.products?.vendor_id !== account.vendor_id) {
      return apiError('無權刪除此規格', 403, 'FORBIDDEN')
    }

    const { error } = await admin
      .from('product_variants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', variantId)

    if (error) {
      console.error(
        '[DELETE /api/vendor/products/[id]/variants/[variantId]]',
        error?.message,
      )
      return apiError('刪除失敗', 500, 'DELETE_FAILED')
    }

    return apiSuccess({ success: true })
  },
)
