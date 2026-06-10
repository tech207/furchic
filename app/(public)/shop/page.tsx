import type { Metadata } from 'next'
import Link from 'next/link'
import { Tag, ShoppingBag, AlertCircle } from 'lucide-react'
import HeroBanner, { type HeroBannerItem } from '@/components/home/HeroBanner'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '商城 | Furchic',
  description: '探索 Furchic 精選 NFC 寵物智能卡與配件',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Variant = {
  price: number | null
  stock: number
  is_active: boolean
  is_preorder: boolean
}

type Product = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[] | null
  sort_order: number
  product_variants: Variant[]
}

type EnrichedProduct = Omit<Product, 'product_variants'> & {
  min_price: number
  total_stock: number
  has_preorder: boolean
}

const SHOP_BANNER_HEIGHT = { desktop: '280px', mobile: '160px' }

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getShopBanners(): Promise<HeroBannerItem[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/banners?type=shop`, {
      next: { revalidate: 300 },
    })
    const json = await res.json()
    return (json.data as HeroBannerItem[]) ?? []
  } catch {
    return []
  }
}

async function getProducts(): Promise<EnrichedProduct[]> {
  try {
    const admin = createClient()
    const { data, error } = await admin
      .from('products')
      .select(
        `id, name, description, base_price, images, sort_order, product_variants (price, stock, is_active, is_preorder)`,
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[shop] getProducts error:', error)
      return []
    }

    return ((data as unknown as Product[]) ?? []).map((p) => {
      const active = p.product_variants.filter((v) => v.is_active)
      const prices = active.map((v) => v.price ?? p.base_price)
      const min_price = prices.length ? Math.min(...prices) : p.base_price
      const total_stock = active.reduce((s, v) => s + v.stock, 0)
      const has_preorder = active.some((v) => v.is_preorder)
      const { product_variants: _, ...rest } = p
      return { ...rest, min_price, total_stock, has_preorder }
    })
  } catch (e) {
    console.error('[shop] getProducts exception:', e)
    return []
  }
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({ p }: { p: EnrichedProduct }) {
  const thumb = Array.isArray(p.images) ? p.images[0] : null
  const onSale = p.min_price < p.base_price
  const soldOut = p.total_stock === 0 && !p.has_preorder
  const lowStock = !soldOut && !p.has_preorder && p.total_stock <= 5

  return (
    <Link
      href={`/shop/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {thumb ? (
          <img
            src={thumb}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {soldOut && (
            <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-white">
              已售完
            </span>
          )}
          {p.has_preorder && (
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
              預購中
            </span>
          )}
          {!soldOut && !p.has_preorder && onSale && (
            <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-medium text-white">
              特惠
            </span>
          )}
          {!soldOut && lowStock && (
            <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-medium text-white">
              即將售完
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
          {p.name}
        </p>
        {p.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-400">
            {p.description}
          </p>
        )}

        {/* Price */}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span
            className={`text-base font-bold ${soldOut ? 'text-gray-400' : 'text-orange-600'}`}
          >
            NT$ {p.min_price.toLocaleString()}
          </span>
          {onSale && (
            <span className="text-sm text-gray-400 line-through">
              NT$ {p.base_price.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ShopPage() {
  const [shopBanners, products] = await Promise.all([
    getShopBanners(),
    getProducts(),
  ])

  return (
    <main>
      {/* Shop banner */}
      {shopBanners.length > 0 && (
        <HeroBanner banners={shopBanners} height={SHOP_BANNER_HEIGHT} />
      )}

      <div className="container mx-auto px-4 py-10">
        {/* Title */}
        <div className="mb-8 flex items-center gap-2.5">
          <Tag className="h-5 w-5 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900">商城</h1>
          {products.length > 0 && (
            <span className="ml-auto text-sm text-gray-400">
              {products.length} 款商品
            </span>
          )}
        </div>

        {/* Empty */}
        {products.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300" />
            <p className="text-base font-medium text-gray-500">目前尚無商品</p>
            <p className="text-sm text-gray-400">請稍後再來看看</p>
          </div>
        )}

        {/* Grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
