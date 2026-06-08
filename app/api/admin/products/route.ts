import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createProductSchema } from '@/lib/validations/product'

type VariantRow = {
  id: string
  price: number | null
  stock: number
  is_active: boolean
  low_stock_threshold: number
}

type ProductWithVariants = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: unknown
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  product_variants: VariantRow[]
}

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const filter = url.searchParams.get('filter') ?? 'all'

  const admin = createAdminClient()

  let query = admin
    .from('products')
    .select(
      `id, name, description, base_price, images, is_active, sort_order, created_at, updated_at,
      product_variants ( id, price, stock, is_active, low_stock_threshold )`,
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
  if (filter === 'active') query = query.eq('is_active', true)
  if (filter === 'inactive') query = query.eq('is_active', false)

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/admin/products]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  const rows = (data as unknown as ProductWithVariants[]) ?? []

  const products = rows.map((p) => {
    const variants = p.product_variants ?? []
    const prices = variants.map((v) => v.price ?? p.base_price)
    const min_price = prices.length > 0 ? Math.min(...prices) : p.base_price
    const total_stock = variants.reduce((s, v) => s + v.stock, 0)
    const variant_count = variants.length
    const low_stock_count = variants.filter(
      (v) => v.is_active && v.stock <= v.low_stock_threshold,
    ).length
    const { product_variants: _, ...rest } = p
    return { ...rest, min_price, total_stock, variant_count, low_stock_count }
  })

  const low_stock_total = products.reduce((s, p) => s + p.low_stock_count, 0)

  return apiSuccess({ products, low_stock_total })
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('products')
    .insert({ ...parsed.data, created_at: now, updated_at: now } as never)
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/products]', error?.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  return apiSuccess(
    { product: data as unknown as Record<string, unknown> },
    201,
  )
})
