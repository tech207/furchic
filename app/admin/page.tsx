'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart2,
  CreditCard,
  Eye,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/admin/charts/KpiCard'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// ── Lazy chart imports ────────────────────────────────────────────────────────

const OrderTrendChart = dynamic(
  () =>
    import('@/components/admin/charts/OrderTrendChart').then(
      (m) => m.OrderTrendChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
)
const StatusPieChart = dynamic(
  () =>
    import('@/components/admin/charts/StatusPieChart').then(
      (m) => m.StatusPieChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
)
const ConversionFunnel = dynamic(
  () =>
    import('@/components/admin/charts/ConversionFunnel').then(
      (m) => m.ConversionFunnel,
    ),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
)

// ── Types ─────────────────────────────────────────────────────────────────────

type KpiData = {
  members: {
    today: number
    yesterday: number
    total: number
    change_pct: number
  }
  pets: { today: number; total: number }
  orders: {
    today: number
    yesterday: number
    pending: number
    change_pct: number
  }
  revenue: { today: number; yesterday: number; change_pct: number }
  page_views: { today: number; yesterday: number; change_pct: number }
  low_stock: { count: number }
  nfc_cards: { total_active: number; total_unbound: number }
}

type TrendPoint = { date: string; count: number; revenue: number }
type StatusPoint = { status: string; label: string; count: number }
type FunnelStep = {
  name: string
  event: string
  count: number
  rate: number
  conv: number
}
type OrderTodo = {
  id: string
  status: string
  total_amount: number
  created_at: string
}
type StockTodo = {
  id: string
  name: string
  sku: string
  stock: number
  low_stock_threshold: number
  products: { name: string } | null
}
type MemberItem = {
  id: string
  name: string | null
  email: string
  created_at: string
}
type TodoData = { shipments: OrderTodo[]; low_stock: StockTodo[] }

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="h-full space-y-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

const STAT_STYLES = {
  default: 'bg-muted/40 border-border',
  blue: 'bg-blue-50  border-blue-100',
  green: 'bg-green-50 border-green-100',
  amber: 'bg-amber-50 border-amber-100',
} as const

function StatCard({
  label,
  value,
  icon,
  accent = 'default',
}: {
  label: string
  value: number | string
  icon?: React.ReactNode
  accent?: keyof typeof STAT_STYLES
}) {
  return (
    <div className={cn('space-y-1 rounded-xl border p-4', STAT_STYLES[accent])}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
    </div>
  )
}

// ── TodoColumn ────────────────────────────────────────────────────────────────

function TodoColumn({
  title,
  icon,
  href,
  loading,
  children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <Link href={href} className="text-xs text-orange-600 hover:underline">
          查看全部
        </Link>
      </div>
      <div className="divide-y">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="mb-1.5 h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))
          : children}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  paid: '已付款',
  processing: '處理中',
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()

  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [orderStatus, setOrderStatus] = useState<StatusPoint[]>([])
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [todo, setTodo] = useState<TodoData | null>(null)
  const [recentMembers, setRecentMembers] = useState<MemberItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [kpiR, trendR, statusR, funnelR, todoR, membersR] =
        await Promise.all([
          fetch('/api/admin/analytics/kpi').then((r) => r.json()),
          fetch('/api/admin/analytics/orders-trend?days=30').then((r) =>
            r.json(),
          ),
          fetch('/api/admin/analytics/order-status').then((r) => r.json()),
          fetch('/api/admin/analytics/funnel?days=30').then((r) => r.json()),
          fetch('/api/admin/analytics/todo').then((r) => r.json()),
          fetch('/api/admin/members?page=1').then((r) => r.json()),
        ])
      setKpi(kpiR.data ?? null)
      setTrend(trendR.data?.data ?? [])
      setOrderStatus(statusR.data?.data ?? [])
      setFunnel(funnelR.data?.steps ?? [])
      setTodo(todoR.data ?? null)
      setRecentMembers(
        ((membersR.data?.members ?? []) as MemberItem[]).slice(0, 5),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const kl = loading || !kpi // kpi loading shorthand

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">儀表板</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 h-4 w-4" />
          重整
        </Button>
      </div>

      {/* ── Row 1：6 KPI 卡（3+3）──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {/* 第一排 */}
        <KpiCard
          title="今日新增會員"
          value={kl ? '—' : kpi!.members.today}
          changePct={kl ? undefined : kpi!.members.change_pct}
          loading={kl}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <KpiCard
          title="今日新增寵物"
          value={kl ? '—' : kpi!.pets.today}
          loading={kl}
          icon={<Package className="h-5 w-5" />}
          subtitle={kl ? '' : `累計 ${kpi!.pets.total.toLocaleString()} 隻`}
        />
        <KpiCard
          title="今日訂單數"
          value={kl ? '—' : kpi!.orders.today}
          changePct={kl ? undefined : kpi!.orders.change_pct}
          loading={kl}
          icon={<ShoppingBag className="h-5 w-5" />}
          subtitle={kl ? '' : `待出貨 ${kpi!.orders.pending} 筆`}
        />

        {/* 第二排 */}
        <KpiCard
          title="今日營業額"
          value={kl ? '—' : `NT$${kpi!.revenue.today.toLocaleString()}`}
          changePct={kl ? undefined : kpi!.revenue.change_pct}
          loading={kl}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <KpiCard
          title="今日瀏覽量"
          value={kl ? '—' : kpi!.page_views.today.toLocaleString()}
          changePct={kl ? undefined : kpi!.page_views.change_pct}
          loading={kl}
          icon={<Eye className="h-5 w-5" />}
        />
        <KpiCard
          title="低庫存商品"
          value={kl ? '—' : kpi!.low_stock.count}
          loading={kl}
          icon={<AlertTriangle className="h-5 w-5" />}
          subtitle="點擊查看商品"
          onClick={() => router.push('/admin/products?filter=low-stock')}
        />
      </div>

      {/* ── Row 2：快速概覽（4 個靜態數字卡）────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kl ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="總會員數"
              value={kpi!.members.total.toLocaleString()}
              icon={<Users className="h-4 w-4" />}
              accent="default"
            />
            <StatCard
              label="總寵物數"
              value={kpi!.pets.total.toLocaleString()}
              icon={<Package className="h-4 w-4" />}
              accent="blue"
            />
            <StatCard
              label="已啟用 NFC 卡"
              value={kpi!.nfc_cards.total_active.toLocaleString()}
              icon={<CreditCard className="h-4 w-4" />}
              accent="green"
            />
            <StatCard
              label="未綁定 NFC 卡"
              value={kpi!.nfc_cards.total_unbound.toLocaleString()}
              icon={<WifiOff className="h-4 w-4" />}
              accent="amber"
            />
          </>
        )}
      </div>

      {/* ── Row 3：圖表（左 2/3 訂單趨勢 + 右 1/3 狀態圓餅）─────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="近 30 日訂單趨勢">
            <OrderTrendChart data={trend} loading={loading} />
          </ChartCard>
        </div>
        <div>
          <ChartCard title="訂單狀態分佈">
            <StatusPieChart data={orderStatus} loading={loading} />
          </ChartCard>
        </div>
      </div>

      {/* ── Row 4：轉換漏斗（全寬）──────────────────────────────────────────── */}
      <ChartCard title="轉換漏斗（近 30 日）">
        <ConversionFunnel steps={funnel} loading={loading} />
      </ChartCard>

      {/* ── Row 5：三欄快速待辦───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 待出貨訂單 */}
        <TodoColumn
          title="待出貨"
          icon={<Truck className="h-4 w-4 text-blue-500" />}
          href="/admin/orders"
          loading={loading}
        >
          {todo?.shipments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              沒有待出貨訂單
            </p>
          ) : (
            todo?.shipments.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30"
              >
                <div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {o.id.slice(0, 8)}
                  </span>
                  <p className="font-medium">
                    NT${o.total_amount.toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ORDER_STATUS_LABEL[o.status] ?? o.status}
                </Badge>
              </div>
            ))
          )}
        </TodoColumn>

        {/* 低庫存商品 */}
        <TodoColumn
          title="低庫存商品"
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
          href="/admin/products?filter=low-stock"
          loading={loading}
        >
          {todo?.low_stock.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              庫存充足
            </p>
          ) : (
            todo?.low_stock.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30"
              >
                <div>
                  <span className="font-medium">{v.products?.name ?? '—'}</span>
                  <p className="text-xs text-muted-foreground">
                    {v.name} · {v.sku}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-red-500">{v.stock}</span>
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    / {v.low_stock_threshold}
                  </span>
                </div>
              </div>
            ))
          )}
        </TodoColumn>

        {/* 最新會員 */}
        <TodoColumn
          title="最新會員"
          icon={<Users className="h-4 w-4 text-orange-500" />}
          href="/admin/members"
          loading={loading}
        >
          {recentMembers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              尚無新會員
            </p>
          ) : (
            recentMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <span className="font-medium">{m.name ?? '未命名'}</span>
                  <p className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtShort(m.created_at)}
                </span>
              </div>
            ))
          )}
        </TodoColumn>
      </div>
    </div>
  )
}
