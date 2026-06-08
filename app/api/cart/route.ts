import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CartItem } from '@/store/cartStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type CartRow = {
  variant_id: string
  quantity: number
  product_variants: {
    id: string
    name: string
    sku: string
    price: number | null
    stock: number
    is_active: boolean
    products: {
      id: string
      name: string
      images: string[] | null
      base_price: number
      is_active: boolean
    } | null
  } | null
}

// ── GET /api/cart ─────────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, _ctx, user) => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('carts')
    .select(
      `
      variant_id,
      quantity,
      product_variants (
        id, name, sku, price, stock, is_active,
        products (
          id, name, images, base_price, is_active
        )
      )
    `,
    )
    .eq('user_id', user.id)

  if (error) {
    console.error('[GET /api/cart]', error.message)
    return apiError('購物車載入失敗', 500, 'FETCH_FAILED')
  }

  const rows = (data as unknown as CartRow[]) ?? []
  const warnings: string[] = []
  const items: CartItem[] = []

  for (const row of rows) {
    const variant = row.product_variants
    const product = variant?.products

    if (!variant || !product) continue

    if (!product.is_active) {
      warnings.push(`「${product.name}」已下架，已從購物車移除`)
      continue
    }
    if (!variant.is_active) {
      warnings.push(
        `「${product.name} / ${variant.name}」規格已停售，已從購物車移除`,
      )
      continue
    }

    let quantity = row.quantity

    if (variant.stock === 0) {
      warnings.push(`「${product.name}」已售完，已從購物車移除`)
      continue
    }
    if (quantity > variant.stock) {
      warnings.push(
        `「${product.name}」庫存不足，數量已調整為 ${variant.stock}`,
      )
      quantity = variant.stock
    }

    items.push({
      product_id: product.id,
      variant_id: variant.id,
      name: product.name,
      variant_name: variant.name,
      sku: variant.sku,
      unit_price: variant.price ?? product.base_price,
      quantity,
      image_url: product.images?.[0] ?? '',
      stock: variant.stock,
    })
  }

  return apiSuccess({ items, warnings })
})

// ── PUT /api/cart ─────────────────────────────────────────────────────────────
// Replaces the entire cart for the user (full sync).

export const PUT = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const items = (body as { items?: CartItem[] }).items
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Clear existing cart first
  await admin.from('carts').delete().eq('user_id', user.id)

  if (!items?.length) {
    return apiSuccess({ synced: 0 })
  }

  // Validate stock for all variants
  const variantIds = [...new Set(items.map((i) => i.variant_id))]

  const { data: variantsRaw } = await admin
    .from('product_variants')
    .select('id, stock, is_active')
    .in('id', variantIds)

  const stockMap = new Map(
    (
      variantsRaw as unknown as Array<{
        id: string
        stock: number
        is_active: boolean
      }> | null
    )?.map((v) => [v.id, v]) ?? [],
  )

  const rows = items
    .filter((item) => {
      const v = stockMap.get(item.variant_id)
      return v?.is_active && item.quantity > 0
    })
    .map((item) => {
      const v = stockMap.get(item.variant_id)
      return {
        user_id: user.id,
        variant_id: item.variant_id,
        quantity: Math.min(item.quantity, v?.stock ?? item.quantity),
        created_at: now,
        updated_at: now,
      }
    })

  if (rows.length > 0) {
    const { error } = await admin.from('carts').insert(rows as never)
    if (error) {
      console.error('[PUT /api/cart]', error.message)
      return apiError('購物車同步失敗', 500, 'SYNC_FAILED')
    }
  }

  return apiSuccess({ synced: rows.length })
})
