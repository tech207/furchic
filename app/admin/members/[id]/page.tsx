'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  CircleDot,
  Crown,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberLevel = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
}

type User = {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  auth_provider: string | null
  reward_points: number
  total_spent: number
  created_at: string
  member_level_id: string | null
  member_levels: MemberLevel | null
}

type NfcCard = { id: string; status: string }
type Pet = {
  id: string
  name: string
  photo_url: string | null
  breed: string | null
  card_status: string
  nfc_cards: NfcCard[] | null
}

type Order = {
  id: string
  status: string
  total_amount: number
  created_at: string
}

type Transaction = {
  id: string
  type: string
  points: number
  note: string | null
  created_at: string
}

type MemberData = {
  user: User
  pets: Pet[]
  orders: Order[]
  transactions: Transaction[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  processing: '備貨中',
  shipped: '已出貨',
  done: '完成',
  cancelled: '已取消',
  refunded: '已退款',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-red-100 text-red-700',
}
const TX_LABEL: Record<string, { label: string; color: string }> = {
  earned: { label: '消費獲得', color: 'text-green-600' },
  spent: { label: '兌換使用', color: 'text-red-600' },
  adjusted: { label: '手動調整', color: 'text-blue-600' },
  expired: { label: '過期失效', color: 'text-gray-500' },
}

function Avatar({
  user,
  size = 'md',
}: {
  user: User
  size?: 'sm' | 'md' | 'lg'
}) {
  const dim = size === 'lg' ? 64 : size === 'sm' ? 32 : 40
  const cls =
    size === 'lg'
      ? 'w-16 h-16 text-xl'
      : size === 'sm'
        ? 'w-8 h-8 text-xs'
        : 'w-10 h-10 text-sm'
  const initials = user.name.slice(0, 2)
  return user.avatar_url ? (
    <Image
      src={user.avatar_url}
      alt={user.name}
      width={dim}
      height={dim}
      className={cn(cls, 'rounded-full object-cover')}
    />
  ) : (
    <div
      className={cn(
        cls,
        'flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700',
      )}
    >
      {initials}
    </div>
  )
}

// ── Adjust dialog ─────────────────────────────────────────────────────────────

const adjustSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, '不可為 0'),
  note: z.string().max(200).optional(),
})
type AdjustForm = z.infer<typeof adjustSchema>

function AdjustDialog({
  userId,
  open,
  onClose,
  onDone,
}: {
  userId: string
  open: boolean
  onClose: () => void
  onDone: (newBalance: number) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { delta: 0, note: '' },
  })

  async function onSubmit(values: AdjustForm) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/rewards/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          points: values.delta,
          note: values.note || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast({
        title: '調整成功',
        description: `新餘額：${json.data.new_balance} 點`,
      })
      form.reset()
      onDone(json.data.new_balance)
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '調整失敗',
        description: (e as Error).message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const delta = form.watch('delta')

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手動調整回饋金</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'mt-0 gap-1',
                  delta > 0 && 'border-green-500 text-green-700',
                )}
                onClick={() => form.setValue('delta', Math.abs(delta) || 100)}
              >
                <PlusCircle className="h-4 w-4" />
                加點
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'gap-1',
                  delta < 0 && 'border-red-500 text-red-700',
                )}
                onClick={() =>
                  form.setValue('delta', -(Math.abs(delta) || 100))
                }
              >
                <MinusCircle className="h-4 w-4" />
                扣點
              </Button>
              <FormField
                control={form.control}
                name="delta"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="正數=加點，負數=扣點"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註（選填）</FormLabel>
                  <FormControl>
                    <Textarea placeholder="調整原因…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '處理中…' : '確認調整'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminMemberDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const memberId = params.id

  const [data, setData] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setData(json.data)
    } catch {
      toast({ variant: 'destructive', title: '載入失敗' })
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  async function toggleRole() {
    if (!data) return
    const newRole = data.user.role === 'admin' ? 'user' : 'admin'
    const confirmed = confirm(
      newRole === 'admin'
        ? `確定要將 ${data.user.name} 升為 Admin？`
        : `確定要移除 ${data.user.name} 的 Admin 權限？`,
    )
    if (!confirmed) return
    setRoleLoading(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setData((d) => (d ? { ...d, user: { ...d.user, role: newRole } } : d))
      toast({ title: '角色更新成功' })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '更新失敗',
        description: (e as Error).message,
      })
    } finally {
      setRoleLoading(false)
    }
  }

  function handleAdjustDone(newBalance: number) {
    setData((d) =>
      d ? { ...d, user: { ...d.user, reward_points: newBalance } } : d,
    )
    setAdjustOpen(false)
    load()
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    )

  if (!data)
    return (
      <div className="p-6 py-32 text-center text-muted-foreground">
        找不到此會員
      </div>
    )

  const { user, pets, orders, transactions } = data
  const PROVIDER_MAP: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
    email: 'Email',
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      {/* ── Profile Card ── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar user={user} size="lg" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{user.name}</h1>
              {user.role === 'admin' && (
                <Badge className="flex items-center gap-1 border-red-200 bg-red-100 text-red-700">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Badge>
              )}
              {user.member_levels && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Crown className="h-3 w-3 text-orange-400" />
                  {user.member_levels.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.email ?? '—'}</p>
            <p className="text-sm text-muted-foreground">{user.phone ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              登入方式：
              {PROVIDER_MAP[user.auth_provider ?? 'email'] ??
                user.auth_provider}
              　·　加入日期：
              {new Date(user.created_at).toLocaleDateString('zh-TW')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleRole}
            disabled={roleLoading}
            className={cn(
              'shrink-0 gap-1.5',
              user.role === 'admin'
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-700 hover:bg-green-50',
            )}
          >
            {user.role === 'admin' ? (
              <>
                <ShieldOff className="h-4 w-4" />
                移除 Admin
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                設為 Admin
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Level & Rewards ── */}
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4 text-orange-400" />
            等級 & 回饋金
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustOpen(true)}
            className="text-xs"
          >
            手動調整點數
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '目前等級', value: user.member_levels?.name ?? '無' },
            {
              label: '回饋金餘額',
              value: `${user.reward_points.toLocaleString()} 點`,
            },
            {
              label: '累計消費',
              value: `NT$${user.total_spent.toLocaleString()}`,
            },
            {
              label: '折扣優惠',
              value: user.member_levels
                ? `${((1 - user.member_levels.discount_rate) * 100).toFixed(0)}% OFF`
                : '—',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border bg-muted/30 p-3 text-center"
            >
              <p className="text-sm font-semibold">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {transactions.length > 0 && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">
              最近點數異動
            </p>
            <div className="space-y-2">
              {transactions.map((tx) => {
                const info = TX_LABEL[tx.type] ?? {
                  label: tx.type,
                  color: 'text-gray-600',
                }
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium',
                          info.color,
                        )}
                      >
                        {info.label}
                      </span>
                      {tx.note && (
                        <span className="truncate text-xs text-muted-foreground">
                          {tx.note}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          tx.points >= 0 ? 'text-green-600' : 'text-red-600',
                        )}
                      >
                        {tx.points >= 0 ? '+' : ''}
                        {tx.points}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Pets ── */}
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">寵物列表（{pets.length} 隻）</h2>
        {pets.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            尚無寵物
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pets.map((pet) => {
              const nfc = pet.nfc_cards?.[0]
              const hasNfc = !!nfc
              const nfcActive = nfc?.status === 'active'
              return (
                <div
                  key={pet.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {pet.photo_url ? (
                    <Image
                      src={pet.photo_url}
                      alt={pet.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xl">
                      🐾
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pet.name}</p>
                    {pet.breed && (
                      <p className="truncate text-xs text-muted-foreground">
                        {pet.breed}
                      </p>
                    )}
                    <div
                      className={cn(
                        'mt-0.5 flex items-center gap-1 text-xs',
                        hasNfc
                          ? nfcActive
                            ? 'text-green-600'
                            : 'text-yellow-600'
                          : 'text-gray-400',
                      )}
                    >
                      {hasNfc ? (
                        nfcActive ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <CircleDot className="h-3 w-3" />
                        )
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {hasNfc ? (nfcActive ? '已啟用' : nfc.status) : '未綁定'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Orders ── */}
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">訂單紀錄（最近 10 筆）</h2>
        {orders.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            尚無訂單
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b">
                  {['訂單編號', '狀態', '金額', '日期'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-2 py-2 text-xs font-medium text-muted-foreground',
                        h === '金額' || h === '日期'
                          ? 'text-right'
                          : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/20"
                    onClick={() => router.push(`/admin/orders/${o.id}`)}
                  >
                    <td className="px-2 py-2.5 font-mono text-xs">
                      {o.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_COLORS[o.status] ??
                            'bg-gray-100 text-gray-600',
                        )}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                      NT${o.total_amount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust dialog */}
      <AdjustDialog
        userId={memberId}
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onDone={handleAdjustDone}
      />
    </div>
  )
}
