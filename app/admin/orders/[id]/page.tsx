'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Package,
  Save,
  Ship,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'done'
  | 'cancelled'
  | 'refunded'

type OrderDetail = {
  id: string
  status: OrderStatus
  total_amount: number
  subtotal: number
  shipping_fee: number
  promotions_discount: number
  coupon_discount: number
  reward_points_discount: number
  coupon_code: string | null
  ecpay_order_id: string | null
  tracking_number: string | null
  logistics_company: string | null
  admin_note: string | null
  recipient_name: string | null
  recipient_phone: string | null
  recipient_address: string | null
  created_at: string
  updated_at: string
  users: {
    id: string
    name: string
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null
}

type OrderItem = {
  id: string
  product_name: string
  variant_name: string
  sku: string
  quantity: number
  unit_price: number
  subtotal: number
}

type AuditLog = {
  id: string
  action: string
  old_status: string | null
  new_status: string | null
  note: string | null
  created_at: string
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  processing: '處理中',
  shipped: '已出貨',
  done: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-red-100 text-red-500',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['done'],
  done: ['refunded'],
  cancelled: [],
  refunded: [],
}

// ── Status stepper ────────────────────────────────────────────────────────────

const STEPS: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'done',
]

function StatusStepper({ current }: { current: OrderStatus }) {
  const isTerminal = current === 'cancelled' || current === 'refunded'
  const currentIdx = STEPS.indexOf(current)

  if (isTerminal) {
    return (
      <div className="flex items-center gap-2 py-4">
        <XCircle className="h-6 w-6 text-red-400" />
        <span className="font-semibold text-red-500">
          {STATUS_LABELS[current]}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {STEPS.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const pending = i > currentIdx
        return (
          <div key={s} className="flex shrink-0 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : active
                      ? 'border-orange-500 text-orange-500'
                      : 'border-gray-200 text-gray-400',
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-xs',
                  active
                    ? 'font-semibold text-orange-600'
                    : done
                      ? 'text-gray-600'
                      : 'text-gray-400',
                )}
              >
                {STATUS_LABELS[s]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-1 mb-4 h-0.5 w-12 transition-colors',
                  done ? 'bg-orange-500' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Audit timeline ────────────────────────────────────────────────────────────

function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  if (!logs.length)
    return <p className="py-4 text-sm text-muted-foreground">尚無紀錄</p>
  return (
    <div className="space-y-3">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                i === logs.length - 1 ? 'bg-orange-500' : 'bg-gray-300',
              )}
            />
            {i < logs.length - 1 && (
              <div className="mt-1 w-px flex-1 bg-gray-200" />
            )}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {log.action
                  .split(',')
                  .map((a) =>
                    a === 'status_changed'
                      ? `狀態：${STATUS_LABELS[log.old_status ?? ''] ?? log.old_status} → ${STATUS_LABELS[log.new_status ?? ''] ?? log.new_status}`
                      : a === 'shipment_updated'
                        ? '出貨資訊已更新'
                        : a === 'note_updated'
                          ? '備注已更新'
                          : a,
                  )
                  .join('；')}
              </span>
            </div>
            {log.note && (
              <p className="mt-0.5 text-xs text-muted-foreground">{log.note}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Shipment edit state
  const [tracking, setTracking] = useState('')
  const [logistics, setLogistics] = useState('')
  const [ecpay, setEcpay] = useState('')
  const [nextStatus, setNextStatus] = useState<string>('')
  const [adminNote, setAdminNote] = useState('')
  const noteRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error()
      const { order: o, items: it, audit_logs: lg } = json.data
      setOrder(o)
      setItems(it)
      setLogs(lg)
      setTracking(o.tracking_number ?? '')
      setLogistics(o.logistics_company ?? '')
      setEcpay(o.ecpay_order_id ?? '')
      setAdminNote(o.admin_note ?? '')
      setNextStatus('')
    } catch {
      toast({ variant: 'destructive', title: '載入失敗' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Auto-save admin note
  function handleNoteChange(v: string) {
    setAdminNote(v)
    if (noteRef.current) clearTimeout(noteRef.current)
    noteRef.current = setTimeout(() => saveField({ admin_note: v }), 1500)
  }

  async function saveField(fields: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '儲存失敗')
      if (fields.status) {
        setOrder((o) =>
          o ? { ...o, status: fields.status as OrderStatus } : o,
        )
        load()
      }
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function updateShipment() {
    const payload: Record<string, unknown> = {}
    if (tracking !== (order?.tracking_number ?? ''))
      payload.tracking_number = tracking
    if (logistics !== (order?.logistics_company ?? ''))
      payload.logistics_company = logistics
    if (ecpay !== (order?.ecpay_order_id ?? '')) payload.ecpay_order_id = ecpay
    if (nextStatus) payload.status = nextStatus

    if (Object.keys(payload).length === 0) {
      toast({ title: '沒有變更' })
      return
    }
    await saveField(payload)
    if (nextStatus) setNextStatus('')
    toast({ title: '已更新' })
    load()
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>找不到此訂單</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          返回
        </Button>
      </div>
    )
  }

  const allowedNext = VALID_TRANSITIONS[order.status] ?? []
  const isPaid = ['paid', 'processing', 'shipped', 'done'].includes(
    order.status,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              訂單{' '}
              <span className="font-mono text-orange-600">
                {id.slice(0, 8)}…
              </span>
            </h1>
            <Badge className={cn('text-xs', STATUS_COLORS[order.status])}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString('zh-TW')}
          </p>
        </div>
        {saving && (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Status stepper */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          訂單進度
        </h2>
        <StatusStepper current={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: items + amounts */}
        <div className="space-y-5 lg:col-span-2">
          {/* Items table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
              <Package className="h-4 w-4 text-orange-500" />
              商品明細
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {['商品', '規格', 'SKU', '數量', '單價', '小計'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left font-medium text-gray-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {item.variant_name}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {item.sku}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-2 tabular-nums">
                      NT${item.unit_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-semibold tabular-nums">
                      NT${item.subtotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Amount summary */}
          <div className="space-y-2 rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-3 font-semibold">金額摘要</h2>
            <AmountRow
              label="商品小計"
              value={order.subtotal ?? order.total_amount}
            />
            {(order.promotions_discount ?? 0) > 0 && (
              <AmountRow
                label="促銷折扣"
                value={-order.promotions_discount}
                className="text-green-600"
              />
            )}
            {(order.coupon_discount ?? 0) > 0 && (
              <AmountRow
                label={`折扣碼 ${order.coupon_code ? `(${order.coupon_code})` : ''}`}
                value={-order.coupon_discount}
                className="text-green-600"
              />
            )}
            {(order.reward_points_discount ?? 0) > 0 && (
              <AmountRow
                label="回饋金折抵"
                value={-order.reward_points_discount}
                className="text-green-600"
              />
            )}
            <AmountRow label="運費" value={order.shipping_fee ?? 0} />
            <Separator />
            <AmountRow
              label="訂單總計"
              value={order.total_amount}
              className="text-base font-bold"
            />
          </div>
        </div>

        {/* Right: recipient + shipping + note */}
        <div className="space-y-5">
          {/* Recipient */}
          <div className="space-y-2 rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-1 font-semibold">收件資訊</h2>
            <InfoRow
              label="姓名"
              value={order.recipient_name ?? order.users?.name ?? '—'}
            />
            <InfoRow
              label="電話"
              value={order.recipient_phone ?? order.users?.phone ?? '—'}
            />
            <InfoRow label="地址" value={order.recipient_address ?? '—'} />
            <Separator />
            <InfoRow label="會員" value={order.users?.name ?? '—'} />
            <InfoRow label="Email" value={order.users?.email ?? '—'} />
          </div>

          {/* Shipping block (only if paid or beyond) */}
          {isPaid && (
            <div className="space-y-3 rounded-xl border bg-card p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Truck className="h-4 w-4 text-orange-500" /> 出貨資訊
              </h2>

              {/* Status change */}
              {allowedNext.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    變更狀態
                  </label>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="選擇新狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNext.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">物流商</label>
                <Input
                  className="mt-1"
                  placeholder="例：黑貓宅急便"
                  value={logistics}
                  onChange={(e) => setLogistics(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  追蹤單號
                </label>
                <Input
                  className="mt-1"
                  placeholder="輸入物流追蹤號"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  ECPay 單號
                </label>
                <Input
                  className="mt-1"
                  placeholder="ECPay 訂單編號"
                  value={ecpay}
                  onChange={(e) => setEcpay(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={updateShipment}
                disabled={saving}
              >
                <Save className="mr-1 h-4 w-4" />
                {saving ? '儲存中…' : '更新出貨'}
              </Button>
            </div>
          )}

          {/* Admin note */}
          <div className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Admin 備注</h2>
            <textarea
              className="h-24 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="僅 Admin 可見的備注…"
              value={adminNote}
              onChange={(e) => handleNoteChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">自動儲存中</p>
          </div>
        </div>
      </div>

      {/* Audit timeline */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-orange-500" />
          操作記錄
        </h2>
        <AuditTimeline logs={logs} />
      </div>
    </div>
  )
}

function AmountRow({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className={cn('flex justify-between', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {value < 0
          ? `-NT$${Math.abs(value).toLocaleString()}`
          : `NT$${value.toLocaleString()}`}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all font-medium">{value}</span>
    </div>
  )
}
