import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShoppingBag, ChevronRight, PackageSearch } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: '我的訂單 | Pet.chic Weekend' }

// ── Status config ──────────────────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string
  status: string
  total_amount: number
  shipping_method: string
  created_at: string
  order_items: { quantity: number }[]
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function OrdersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: raw } = await supabase
    .from('orders')
    .select(
      'id, status, total_amount, shipping_method, created_at, order_items (quantity)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const orders = (raw as unknown as OrderRow[]) ?? []

  const fmt = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <main className="container py-8">
      <div className="mb-6 flex items-center gap-2">
        <ShoppingBag className="h-5 w-5 text-orange-500" />
        <h1 className="text-xl font-bold">我的訂單</h1>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed bg-muted/20 py-24 text-center">
          <PackageSearch className="h-14 w-14 text-muted-foreground/30" />
          <div>
            <p className="font-semibold">還沒有訂單</p>
            <p className="mt-1 text-sm text-muted-foreground">
              去逛逛商城，找到你喜歡的商品吧
            </p>
          </div>
          <Button asChild>
            <Link href="/shop">前往商城</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const st = STATUS[order.status as OrderStatus] ?? STATUS.pending
            const totalQty = order.order_items.reduce(
              (s, i) => s + i.quantity,
              0,
            )
            const date = fmt.format(new Date(order.created_at))

            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="space-y-1.5">
                  {/* Order number */}
                  <p className="text-xs text-muted-foreground">
                    訂單 #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  {/* Status + date */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        st.class,
                      )}
                    >
                      {st.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {date}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · 共 {totalQty} 件商品
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-orange-600">
                    NT$ {order.total_amount.toLocaleString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
