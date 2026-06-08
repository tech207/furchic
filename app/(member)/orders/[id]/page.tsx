import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, Package, MapPin, Truck, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: '訂單詳情 | Furchic' }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  pending: { label: '待付款', class: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已付款', class: 'bg-blue-100 text-blue-700' },
  processing: { label: '處理中', class: 'bg-indigo-100 text-indigo-700' },
  shipped: { label: '已出貨', class: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: '已送達', class: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', class: 'bg-gray-100 text-gray-500' },
  refunded: { label: '已退款', class: 'bg-rose-100 text-rose-600' },
} as const

type OrderStatus = keyof typeof STATUS

const SHIPPING_LABEL: Record<string, string> = {
  home_delivery: '宅配到府',
  seven_eleven: '7-ELEVEN 取貨',
  family_mart: '全家 取貨',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string
  quantity: number
  unit_price: number
  product_variants: {
    name: string
    products: { name: string; images: string[] | null } | null
  } | null
}

type OrderDetail = {
  id: string
  status: string
  subtotal: number
  promotions_discount: number
  coupon_discount: number
  reward_points_discount: number
  shipping_fee: number
  total_amount: number
  shipping_method: string
  recipient_name: string
  recipient_phone: string
  recipient_address: string | null
  cvs_store_name: string | null
  note: string | null
  created_at: string
  order_items: OrderItem[]
}

// ── Section card ─────────────────────────────────────────────────────────────

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Icon className="h-4 w-4 text-orange-500" />
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: React.ReactNode
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>
        {value}
      </span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: raw } = await supabase
    .from('orders')
    .select(
      `
      id, status, subtotal, promotions_discount, coupon_discount,
      reward_points_discount, shipping_fee, total_amount,
      shipping_method, recipient_name, recipient_phone,
      recipient_address, cvs_store_name, note, created_at,
      order_items (
        id, quantity, unit_price,
        product_variants (
          name,
          products ( name, images )
        )
      )
    `,
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!raw) notFound()

  const order = raw as unknown as OrderDetail
  const st = STATUS[order.status as OrderStatus] ?? STATUS.pending
  const fmt = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <main className="container max-w-2xl py-8">
      {/* Back */}
      <Link
        href="/orders"
        className="mb-5 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
      >
        <ChevronLeft className="h-4 w-4" />
        我的訂單
      </Link>

      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">
            訂單 #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmt.format(new Date(order.created_at))}
          </p>
        </div>
        <span
          className={cn('rounded-full px-3 py-1 text-sm font-medium', st.class)}
        >
          {st.label}
        </span>
      </div>

      <div className="space-y-4">
        {/* Items */}
        <Card icon={Package} title="訂購商品">
          <div className="space-y-3">
            {order.order_items.map((item) => {
              const product = item.product_variants?.products
              const variant = item.product_variants
              const thumb = Array.isArray(product?.images)
                ? product.images[0]
                : null

              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={product?.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {product?.name ?? '商品'}
                    </p>
                    {variant?.name && (
                      <p className="text-xs text-muted-foreground">
                        {variant.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    NT$ {(item.unit_price * item.quantity).toLocaleString()}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Shipping */}
        <Card icon={Truck} title="配送資訊">
          <Row
            label="物流方式"
            value={
              SHIPPING_LABEL[order.shipping_method] ?? order.shipping_method
            }
          />
          <Row label="收件人" value={order.recipient_name} />
          <Row label="聯絡電話" value={order.recipient_phone} />
          {order.recipient_address && (
            <Row label="收件地址" value={order.recipient_address} />
          )}
          {order.cvs_store_name && (
            <Row label="取貨門市" value={order.cvs_store_name} />
          )}
          {order.note && <Row label="備註" value={order.note} />}
        </Card>

        {/* Pricing */}
        <Card icon={CreditCard} title="付款明細">
          <div className="divide-y">
            <div className="space-y-0.5 pb-3">
              <Row
                label="商品小計"
                value={`NT$ ${order.subtotal.toLocaleString()}`}
              />
              {order.promotions_discount > 0 && (
                <Row
                  label="優惠折扣"
                  value={`- NT$ ${order.promotions_discount.toLocaleString()}`}
                />
              )}
              {order.coupon_discount > 0 && (
                <Row
                  label="折扣碼"
                  value={`- NT$ ${order.coupon_discount.toLocaleString()}`}
                />
              )}
              {order.reward_points_discount > 0 && (
                <Row
                  label="點數折抵"
                  value={`- NT$ ${order.reward_points_discount.toLocaleString()}`}
                />
              )}
              <Row
                label="運費"
                value={
                  order.shipping_fee === 0
                    ? '免運'
                    : `NT$ ${order.shipping_fee.toLocaleString()}`
                }
              />
            </div>
            <div className="pt-3">
              <Row
                label="應付總額"
                value={`NT$ ${order.total_amount.toLocaleString()}`}
                bold
              />
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
