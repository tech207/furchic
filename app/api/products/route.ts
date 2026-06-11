import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { listProductsSchema } from '@/lib/validations/product'

type VariantSummary = {
  id: string
  price: number | null
  stock: number
  is_active: boolean
  low_stock_threshold: number
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: unknown
  sort_order: number
  created_at: string
  updated_at: string
  product_variants: VariantSummary[]
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const parsed = listProductsSchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  })

  if (!parsed.success) {
    return apiError(
      '無效的查詢參數',
      400,
      'INVALID_PARAMS',
      parsed.error.errors,
    )
  }

  const { page, limit, sort, search } = parsed.data
  const supabase = createClient()

  let query = supabase
    .from('products')
    .select(
      `id, name, description, base_price, images, sort_order, created_at, updated_at,
      product_variants ( id, price, stock, is_active, low_stock_threshold )`,
    )
    .eq('is_active', true)
    // Vendor products must be approved; platform products (vendor_id IS NULL) always visible
    .or('vendor_id.is.null,is_approved.eq.true')

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  // Apply DB-level sort only for 'newest'; price sorts need computed fields
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('sort_order', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/products]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  const rows = (data as unknown as ProductRow[]) ?? []

  // Compute derived fields per product
  const enriched = rows.map((p) => {
    const activeVariants = p.product_variants.filter((v) => v.is_active)
    const prices = activeVariants.map((v) => v.price ?? p.base_price)
    const min_price = prices.length > 0 ? Math.min(...prices) : p.base_price
    const total_stock = activeVariants.reduce((s, v) => s + v.stock, 0)
    const variant_count = activeVariants.length
    const { product_variants: _, ...rest } = p
    return { ...rest, min_price, total_stock, variant_count }
  })

  // In-memory price sort (price_asc / price_desc)
  if (sort === 'price_asc') enriched.sort((a, b) => a.min_price - b.min_price)
  if (sort === 'price_desc') enriched.sort((a, b) => b.min_price - a.min_price)

  // Paginate
  const total = enriched.length
  const totalPages = Math.ceil(total / limit)
  const products = enriched.slice((page - 1) * limit, page * limit)

  return apiSuccess({ products, total, page, totalPages }, 200, {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  })
}
