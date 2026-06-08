import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (_req, _ctx, _user) => {
  const admin = createAdminClient()

  // Fetch all active variants where stock <= low_stock_threshold
  // Supabase doesn't support column-to-column comparisons via the JS client,
  // so fetch all active variants and filter in JS.
  const { data, error } = await admin
    .from('product_variants')
    .select(
      `id, name, sku, price, stock, low_stock_threshold, is_active, updated_at,
      products!inner ( id, name, is_active )`,
    )
    .eq('is_active', true)
    .eq('products.is_active', true)
    .order('stock', { ascending: true })

  if (error) {
    console.error('[GET /api/admin/products/low-stock]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  type VariantRow = {
    id: string
    name: string
    sku: string
    price: number | null
    stock: number
    low_stock_threshold: number
    is_active: boolean
    updated_at: string
    products: { id: string; name: string; is_active: boolean } | null
  }

  const rows = (data as unknown as VariantRow[]) ?? []
  const variants = rows.filter((v) => v.stock <= v.low_stock_threshold)

  return apiSuccess({ variants, count: variants.length })
})
