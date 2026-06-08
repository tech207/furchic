'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingBag,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  Shield,
  Truck,
  RefreshCw,
  Coins,
  ChevronRight,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Option = { id: string; option_name: string; option_value: string }
type Variant = {
  id: string
  name: string
  price: number | null
  stock: number
  is_preorder: boolean
  preorder_note: string | null
}
type Product = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[] | null
}
type RelatedProduct = {
  id: string
  name: string
  min_price: number
  base_price: number
  total_stock: number
  images: string[] | null
}

// ── Image gallery ─────────────────────────────────────────────────────────────

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0)
  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
        <img
          src={images[idx]}
          alt={`${name} ${idx + 1}`}
          className="h-full w-full object-cover transition-opacity duration-200"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                i === idx
                  ? 'border-orange-500'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab section ───────────────────────────────────────────────────────────────

type TabKey = 'intro' | 'spec' | 'shipping'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'intro', label: '商品介紹' },
  { key: 'spec', label: '規格說明' },
  { key: 'shipping', label: '退換貨政策' },
]

function TabSection({
  product,
  variants,
  options,
}: {
  product: Product
  variants: Variant[]
  options: Option[]
}) {
  const [tab, setTab] = useState<TabKey>('intro')

  const optionGroups = options.reduce<Record<string, string[]>>((acc, o) => {
    if (!acc[o.option_name]) acc[o.option_name] = []
    if (!acc[o.option_name].includes(o.option_value)) {
      acc[o.option_name].push(o.option_value)
    }
    return acc
  }, {})

  return (
    <div className="mt-12 border-t pt-8">
      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-orange-500 text-orange-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-8">
        {/* 商品介紹 */}
        {tab === 'intro' && (
          <div className="max-w-2xl space-y-6">
            {product.description ? (
              <p className="whitespace-pre-line leading-relaxed text-gray-600">
                {product.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400">尚無商品介紹</p>
            )}
          </div>
        )}

        {/* 規格說明 */}
        {tab === 'spec' && (
          <div className="max-w-xl space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                商品規格
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr className="py-2">
                    <td className="w-28 py-2.5 pr-4 font-medium text-gray-500">
                      商品名稱
                    </td>
                    <td className="py-2.5 text-gray-800">{product.name}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-gray-500">
                      定價
                    </td>
                    <td className="py-2.5 text-gray-800">
                      NT$ {product.base_price.toLocaleString()}
                    </td>
                  </tr>
                  {variants.length > 0 && (
                    <tr>
                      <td className="py-2.5 pr-4 font-medium text-gray-500">
                        可選規格
                      </td>
                      <td className="py-2.5 text-gray-800">
                        {variants.map((v) => v.name).join('、')}
                      </td>
                    </tr>
                  )}
                  {Object.entries(optionGroups).map(([name, values]) => (
                    <tr key={name}>
                      <td className="py-2.5 pr-4 font-medium text-gray-500">
                        {name}
                      </td>
                      <td className="py-2.5 text-gray-800">
                        {values.join('、')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl bg-orange-50 px-5 py-4 text-sm text-orange-700">
              實際商品顏色可能因螢幕顯示略有差異，以實物為準。
            </div>
          </div>
        )}

        {/* 退換貨政策 */}
        {tab === 'shipping' && (
          <div className="max-w-xl space-y-6 text-sm text-gray-600">
            <div>
              <h3 className="mb-2 font-semibold text-gray-800">配送方式</h3>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  宅配到府（黑貓、新竹）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  超商取貨（7-11、全家）
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  消費滿 NT$1,500 享免運費
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-gray-800">退換貨條件</h3>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  到貨起 <strong>7 天鑑賞期</strong>，商品未拆封且包裝完整
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  商品瑕疵或出貨錯誤，10 天內可申請
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  客製化 NFC 卡一經製作完成不接受退換
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-gray-800">退款流程</h3>
              <ol className="list-inside list-decimal space-y-1.5 pl-1">
                <li>聯繫客服告知退貨原因</li>
                <li>客服確認後提供退貨地址</li>
                <li>商品寄回並確認後，5–7 個工作天退款</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Related products ──────────────────────────────────────────────────────────

function RelatedProducts({ currentId }: { currentId: string }) {
  const [items, setItems] = useState<RelatedProduct[]>([])

  useEffect(() => {
    fetch('/api/products?limit=8')
      .then((r) => r.json())
      .then((json) => {
        const all = (json.data?.products as RelatedProduct[]) ?? []
        setItems(all.filter((p) => p.id !== currentId).slice(0, 4))
      })
      .catch(() => {})
  }, [currentId])

  if (items.length === 0) return null

  return (
    <div className="mt-12 border-t pt-8">
      <div className="mb-5 flex items-center gap-2">
        <Tag className="h-4 w-4 text-orange-500" />
        <h2 className="text-base font-bold text-gray-900">你可能也喜歡</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((p) => {
          const thumb = Array.isArray(p.images) ? p.images[0] : null
          const onSale = p.min_price < p.base_price
          const soldOut = p.total_stock === 0
          return (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-gray-300" />
                  </div>
                )}
                {soldOut && (
                  <span className="absolute left-2 top-2 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-white">
                    售完
                  </span>
                )}
                {!soldOut && onSale && (
                  <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                    特惠
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-semibold text-gray-800">
                  {p.name}
                </p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span
                    className={`text-sm font-bold ${soldOut ? 'text-gray-400' : 'text-orange-600'}`}
                  >
                    NT$ {p.min_price.toLocaleString()}
                  </span>
                  {onSale && (
                    <span className="text-xs text-gray-400 line-through">
                      NT$ {p.base_price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShopProductPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setProduct(json.data.product as Product)
          const vs = (json.data.variants as Variant[]) ?? []
          setVariants(vs)
          setOptions((json.data.options as Option[]) ?? [])
          if (vs.length === 1) setSelId(vs[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  const selected = variants.find((v) => v.id === selId)
  const price = selected?.price ?? product?.base_price ?? 0
  const onSale =
    !!selected &&
    selected.price !== null &&
    selected.price < (product?.base_price ?? 0)
  const stock = selected?.stock ?? 0
  const soldOut = !!selected && stock === 0
  const lowStock = !!selected && !soldOut && stock <= 5
  const images = Array.isArray(product?.images) ? product.images : []
  const earnPts = Math.floor(price * 0.01)

  // Any variant has lower price than base?
  const hasAnyOnSale = variants.some(
    (v) => v.price !== null && v.price < (product?.base_price ?? 0),
  )

  async function handleAddToCart() {
    if (!selId) return
    setAdding(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth?next=/shop/${params.id}`)
        return
      }
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: selId, quantity: qty }),
      })
      if (res.ok) {
        toast({
          title: '已加入購物車',
          description: `${product?.name} × ${qty}`,
        })
      } else {
        const j = (await res.json()) as { message?: string }
        toast({
          title: '加入失敗',
          description: j.message ?? '請稍後再試',
          variant: 'destructive',
        })
      }
    } finally {
      setAdding(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </main>
    )
  }

  if (!product) {
    return (
      <main className="container mx-auto px-4 py-24 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p className="text-lg font-semibold text-gray-500">找不到此商品</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push('/shop')}
        >
          回到商城
        </Button>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      {/* ── 麵包屑 ──────────────────────────────────────────────────────────── */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-orange-500">
          首頁
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-orange-500">
          商城
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="line-clamp-1 text-gray-600">{product.name}</span>
      </nav>

      {/* ── 主內容 (圖片 + 資訊) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {/* 左：圖片 */}
        <div className="md:sticky md:top-24 md:self-start">
          {images.length > 0 ? (
            <Gallery images={images} name={product.name} />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-gray-100">
              <ShoppingBag className="h-20 w-20 text-gray-300" />
            </div>
          )}
        </div>

        {/* 右：商品資訊 */}
        <div className="space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {soldOut && (
              <span className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-medium text-gray-600">
                已售完
              </span>
            )}
            {!soldOut && hasAnyOnSale && (
              <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-semibold text-rose-600">
                限時特惠
              </span>
            )}
            {!soldOut && lowStock && (
              <span className="rounded-full bg-orange-100 px-3 py-0.5 text-xs font-semibold text-orange-600">
                庫存剩 {stock} 件
              </span>
            )}
          </div>

          {/* 商品名稱 */}
          <h1 className="text-2xl font-bold leading-snug text-gray-900">
            {product.name}
          </h1>

          {/* 簡短描述 */}
          {product.description && (
            <p className="line-clamp-3 text-sm leading-relaxed text-gray-500">
              {product.description}
            </p>
          )}

          {/* 價格 */}
          <div className="rounded-xl bg-gray-50 px-4 py-3.5">
            <div className="flex items-baseline gap-3">
              <span
                className={`text-3xl font-bold ${soldOut ? 'text-gray-400' : 'text-orange-600'}`}
              >
                NT$ {price.toLocaleString()}
              </span>
              {onSale && (
                <span className="text-base text-gray-400 line-through">
                  NT$ {product.base_price.toLocaleString()}
                </span>
              )}
              {onSale && (
                <span className="rounded bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  省 NT$ {(product.base_price - price).toLocaleString()}
                </span>
              )}
            </div>
            {earnPts > 0 && !soldOut && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                <Coins className="h-3.5 w-3.5 text-yellow-500" />
                購買可獲得{' '}
                <span className="font-semibold text-yellow-600">
                  {earnPts}
                </span>{' '}
                點回饋金
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* 規格選擇 */}
          {variants.length > 1 && (
            <div>
              <p className="mb-2.5 text-sm font-semibold text-gray-700">
                選擇規格
                {selId && (
                  <span className="ml-2 font-normal text-orange-600">
                    {variants.find((v) => v.id === selId)?.name}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelId(v.id)
                      setQty(1)
                    }}
                    disabled={v.stock === 0}
                    className={`rounded-xl border px-4 py-2 text-sm transition-all ${
                      selId === v.id
                        ? 'border-orange-500 bg-orange-50 font-semibold text-orange-600 shadow-sm'
                        : v.stock === 0
                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 line-through'
                          : 'border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {v.name}
                    {v.stock > 0 && v.stock <= 5 && selId !== v.id && (
                      <span className="ml-1 text-xs text-orange-500">
                        ({v.stock})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 數量 */}
          {selId && !soldOut && (
            <div>
              <p className="mb-2.5 text-sm font-semibold text-gray-700">數量</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="flex h-10 w-10 items-center justify-center text-gray-500 hover:text-orange-600 disabled:opacity-30"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                    disabled={qty >= stock}
                    className="flex h-10 w-10 items-center justify-center text-gray-500 hover:text-orange-600 disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-xs text-gray-400">庫存 {stock} 件</span>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-2.5 pt-1">
            {soldOut ? (
              <Button disabled size="lg" className="w-full">
                已售完
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleAddToCart}
                  disabled={!selId || adding}
                  size="lg"
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !selId ? (
                    '請先選擇規格'
                  ) : (
                    '加入購物車'
                  )}
                </Button>
                {!selId && (
                  <p className="text-center text-xs text-gray-400">
                    請選擇規格後再加入購物車
                  </p>
                )}
              </>
            )}
          </div>

          {/* 服務保障 */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-gray-50 px-3 py-3.5 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <Truck className="h-5 w-5 text-orange-400" />
              <span className="text-xs leading-tight text-gray-500">
                滿千五
                <br />
                免運費
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <RefreshCw className="h-5 w-5 text-orange-400" />
              <span className="text-xs leading-tight text-gray-500">
                七天
                <br />
                鑑賞期
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Shield className="h-5 w-5 text-orange-400" />
              <span className="text-xs leading-tight text-gray-500">
                安全
                <br />
                加密支付
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab 區 ──────────────────────────────────────────────────────────── */}
      <TabSection product={product} variants={variants} options={options} />

      {/* ── 相關商品 ─────────────────────────────────────────────────────────── */}
      <RelatedProducts currentId={product.id} />
    </main>
  )
}
