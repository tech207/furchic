import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  apiSuccess,
  apiError,
  type RouteHandlerContext,
} from '@/lib/auth/guards'

type OptionRow = {
  id: string
  option_name: string
  option_value: string
  sort_order: number
}

type VariantRow = {
  id: string
  name: string
  sku: string
  price: number | null
  stock: number
  low_stock_threshold: number
  is_active: boolean
  sort_order: number
  is_preorder: boolean
  preorder_note: string | null
}

type ProductRow = {
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
  product_variant_options: OptionRow[]
}

export async function GET(_req: NextRequest, ctx: RouteHandlerContext) {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, description, base_price, images, is_active, sort_order, created_at, updated_at,
      product_variants ( id, name, sku, price, stock, low_stock_threshold, is_active, sort_order ),
      product_variant_options ( id, option_name, option_value, sort_order )`,
    )
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error('[products/id] error:', error)
    return apiError('找不到商品', 404, 'NOT_FOUND')
  }

  const row = data as unknown as ProductRow
  const { product_variants, product_variant_options, ...product } = row

  const variants = product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  const options = product_variant_options.sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return apiSuccess({ product, variants, options })
}
