import type { Metadata } from 'next'
import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Coins,
  Edit3,
  Nfc,
  Package,
  PawPrint,
  SlidersHorizontal,
  Star,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: '會員中心',
  description: '查看個人資料、點數、訂單與寵物資訊',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelRow = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  sort_order: number
}

type TxRow = {
  id: string
  type: 'earned' | 'spent' | 'adjusted' | 'expired'
  points: number
  note: string | null
  order_id: string | null
  created_at: string
}

type OrderItemRow = {
  product_name: string
  quantity: number
  products: { images: unknown } | null
}

type OrderRow = {
  id: string
  status: string
  total_amount: number
  created_at: string
  order_items: OrderItemRow[]
}

type PetRow = {
  id: string
  name: string
  breed: string | null
  photo_url: string | null
  ai_photo_url: string | null
  card_status: string
  nfc_cards: { id: string; status: string }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '待付款', cls: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已付款', cls: 'bg-blue-100 text-blue-700' },
  processing: { label: '處理中', cls: 'bg-purple-100 text-purple-700' },
  shipped: { label: '配送中', cls: 'bg-indigo-100 text-indigo-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', cls: 'bg-gray-100 text-gray-600' },
  refunded: { label: '已退款', cls: 'bg-red-100 text-red-700' },
}

const PROVIDER_LABEL: Record<string, string> = {
  line: 'LINE',
  google: 'Google',
  email: 'Email',
}

const TX_LABEL: Record<string, string> = {
  earned: '消費回饋',
  spent: '點數折抵',
  adjusted: '手動調整',
  expired: '點數過期',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function fmtMoney(n: number) {
  return `NT$${n.toLocaleString('zh-TW')}`
}

function firstImage(items: OrderItemRow[]): string | null {
  for (const item of items) {
    const imgs = item.products?.images
    if (Array.isArray(imgs) && typeof imgs[0] === 'string') return imgs[0]
  }
  return null
}

function computeProgress(
  totalSpent: number,
  current: LevelRow | null,
  next: LevelRow | null,
): number {
  if (!next) return 100
  const base = current?.min_spent ?? 0
  const span = next.min_spent - base
  if (span <= 0) return 100
  return Math.min(
    100,
    Math.max(0, Math.round(((totalSpent - base) / span) * 100)),
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

// ── Data + render ─────────────────────────────────────────────────────────────

async function DashboardContent() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth')

  const admin = createAdminClient()
  const userId = user.id

  const [levelsRes, txRes, ordersRes, petsRes, totalOrdersRes] =
    await Promise.all([
      admin
        .from('member_levels')
        .select('id, name, min_spent, reward_rate, discount_rate, sort_order')
        .order('sort_order', { ascending: true }),

      admin
        .from('reward_transactions')
        .select('id, type, points, note, order_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      admin
        .from('orders')
        .select(
          'id, status, total_amount, created_at, order_items(product_name, quantity, products(images))',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      admin
        .from('pets')
        .select(
          'id, name, breed, photo_url, ai_photo_url, card_status, nfc_cards(id, status)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '(cancelled,refunded)'),
    ])

  const levels = (levelsRes.data as unknown as LevelRow[]) ?? []
  const txs = (txRes.data as unknown as TxRow[]) ?? []
  const orders = (ordersRes.data as unknown as OrderRow[]) ?? []
  const pets = (petsRes.data as unknown as PetRow[]) ?? []
  const totalOrders = totalOrdersRes.count ?? 0

  const currentLevel = levels.find((l) => l.id === user.member_level_id) ?? null
  const nextLevel = levels.find((l) => l.min_spent > user.total_spent) ?? null
  const progress = computeProgress(user.total_spent, currentLevel, nextLevel)
  const activeNfc = pets.reduce(
    (n, p) =>
      n + (p.nfc_cards ?? []).filter((c) => c.status === 'active').length,
    0,
  )

  const providerLabel = PROVIDER_LABEL[user.auth_provider ?? 'email'] ?? 'Email'
  const initials = user.name.slice(0, 2)

  // ── Hero ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-6 text-white shadow-lg shadow-orange-200">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-4 right-16 h-24 w-24 rounded-full bg-white/10" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: profile info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/20 text-2xl font-bold">
                  {initials}
                </div>
              )}
            </div>

            {/* Name / email / edit */}
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{user.name}</p>
              {user.email && (
                <p className="mt-0.5 truncate text-sm text-white/75">
                  {user.email}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                  {providerLabel}
                </span>
                <Link
                  href="/profile/edit"
                  className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium transition hover:bg-white/25"
                >
                  <Edit3 className="h-3 w-3" />
                  編輯資料
                </Link>
              </div>
            </div>
          </div>

          {/* Right: level + points + progress */}
          <div className="shrink-0 space-y-3 sm:text-right">
            {/* Level badge */}
            <div className="flex items-center gap-2 sm:justify-end">
              <Star className="h-4 w-4 fill-white" />
              <span className="font-semibold">
                {currentLevel?.name ?? '一般會員'}
              </span>
            </div>

            {/* Points */}
            <div className="flex items-end gap-1.5 sm:justify-end">
              <Coins className="mb-1 h-6 w-6 text-white/80" />
              <span className="text-4xl font-black tabular-nums leading-none">
                {user.reward_points.toLocaleString('zh-TW')}
              </span>
              <span className="mb-1 text-lg text-white/80">點</span>
            </div>

            {/* Progress bar */}
            {nextLevel ? (
              <div className="space-y-1 sm:text-left">
                <div className="flex justify-between text-xs text-white/70">
                  <span>{fmtMoney(user.total_spent)} 已消費</span>
                  <span>
                    距 {nextLevel.name} 差{' '}
                    {fmtMoney(nextLevel.min_spent - user.total_spent)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-right text-xs text-white/60">{progress}%</p>
              </div>
            ) : (
              <p className="text-sm text-white/70">已達最高等級 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: '訂單',
            value: totalOrders,
            icon: Package,
            href: '/orders',
            cta: '查看全部',
          },
          {
            label: '寵物',
            value: pets.length,
            icon: PawPrint,
            href: '/pets',
            cta: '管理寵物',
          },
          {
            label: '啟用 NFC',
            value: activeNfc,
            icon: Nfc,
            href: '/pets',
            cta: '查看',
          },
        ].map(({ label, value, icon: Icon, href, cta }) => (
          <Link
            key={label}
            href={href}
            className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card p-4 text-center shadow-sm transition hover:border-orange-200 hover:shadow-md"
          >
            <Icon className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-black tabular-nums">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="mt-0.5 flex items-center gap-0.5 text-xs font-medium text-orange-600 opacity-0 transition-opacity group-hover:opacity-100">
              {cta} <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>

      {/* ── Recent orders ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">最近訂單</h2>
          <Link
            href="/orders"
            className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            查看全部 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              還沒有訂單，去逛逛商城！
            </p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-4 rounded-full"
            >
              <Link href="/shop">前往商城</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) => {
              const st = ORDER_STATUS[order.status] ?? {
                label: order.status,
                cls: 'bg-gray-100 text-gray-600',
              }
              const thumbnail = firstImage(order.order_items)

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                >
                  {/* Thumbnail grid (max 3) */}
                  <div className="flex shrink-0 -space-x-2">
                    {order.order_items.slice(0, 3).map((item, i) => {
                      const imgs = item.products?.images
                      const src =
                        Array.isArray(imgs) && typeof imgs[0] === 'string'
                          ? imgs[0]
                          : null
                      return (
                        <div
                          key={i}
                          className="relative h-10 w-10 overflow-hidden rounded-lg border-2 border-card bg-muted"
                        >
                          {src ? (
                            <Image
                              src={src}
                              alt={item.product_name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {order.order_items[0]?.product_name ?? '訂單'}
                      {order.order_items.length > 1 && (
                        <span className="text-muted-foreground">
                          {' '}
                          +{order.order_items.length - 1}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Right meta */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">
                      {fmtMoney(order.total_amount)}
                    </p>
                    <span
                      className={cn(
                        'mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {st.label}
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDate(order.created_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── My pets ────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">我的寵物</h2>
          <Link
            href="/pets"
            className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            管理寵物 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {pets.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center">
            <PawPrint className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">還沒有添加寵物</p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-4 rounded-full"
            >
              <Link href="/pets/new">新增寵物</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {pets.slice(0, 3).map((pet) => {
                const photo = pet.ai_photo_url ?? pet.photo_url
                const isActive = pet.nfc_cards.some(
                  (c) => c.status === 'active',
                )

                return (
                  <Link
                    key={pet.id}
                    href={`/pets/${pet.id}`}
                    className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                  >
                    {/* Pet photo */}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                      {photo ? (
                        <Image
                          src={photo}
                          alt={pet.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <PawPrint className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{pet.name}</p>
                      {pet.breed && (
                        <p className="truncate text-xs text-muted-foreground">
                          {pet.breed}
                        </p>
                      )}
                    </div>

                    {/* NFC badge */}
                    <Badge
                      className={cn(
                        'shrink-0 text-xs',
                        isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500',
                      )}
                      variant="secondary"
                    >
                      <Nfc className="mr-1 h-3 w-3" />
                      {isActive ? '已啟用' : '未啟用'}
                    </Badge>
                  </Link>
                )
              })}
            </div>

            {pets.length > 3 && (
              <Link
                href="/pets"
                className="flex items-center justify-center gap-1 py-1 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                查看全部 {pets.length} 隻
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
      </section>

      {/* ── Reward transactions ────────────────────────────────────────────── */}
      <section>
        <details className="group rounded-2xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between px-5 py-4 hover:bg-muted/30">
            <h2 className="font-semibold">回饋金紀錄</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden group-open:inline">收起</span>
              <span className="inline group-open:hidden">查看完整紀錄</span>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
            </div>
          </summary>

          <div className="border-t">
            {txs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                尚無回饋金紀錄
              </div>
            ) : (
              <div className="divide-y">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    {/* Icon */}
                    <div className="shrink-0">
                      {tx.type === 'earned' && (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      )}
                      {tx.type === 'spent' && (
                        <ArrowDownLeft className="h-4 w-4 text-red-400" />
                      )}
                      {tx.type === 'adjusted' && (
                        <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                      )}
                      {tx.type === 'expired' && (
                        <Star className="h-4 w-4 text-gray-400" />
                      )}
                    </div>

                    {/* Label + date */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tx.note ?? TX_LABEL[tx.type] ?? tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(tx.created_at)}
                      </p>
                    </div>

                    {/* Points */}
                    <span
                      className={cn(
                        'shrink-0 font-semibold tabular-nums',
                        tx.points > 0 ? 'text-green-600' : 'text-red-500',
                      )}
                    >
                      {tx.points > 0 ? '+' : ''}
                      {tx.points} 點
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  )
}
