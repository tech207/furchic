import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (_req, ctx, _user) => {
  const productId = ctx.params?.id as string | undefined
  if (!productId) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // Confirm product exists
  const { data: product } = await admin
    .from('products')
    .select('id')
    .eq('id', productId)
    .single()

  if (!product) return apiError('找不到商品', 404, 'NOT_FOUND')

  // Fetch stock logs for all variants of this product
  const { data, error } = await admin
    .from('stock_logs')
    .select(
      `id, change, stock_after, reason, note, created_at, created_by,
      product_variants!inner ( id, name, sku, product_id )`,
    )
    .eq('product_variants.product_id', productId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[GET /api/admin/products/[id]/stock-logs]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ logs: (data as unknown as unknown[]) ?? [] })
})
