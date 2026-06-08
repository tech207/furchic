'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentSetting = {
  id: string
  payment_type: string
  display_name: string
  description: string | null
  is_enabled: boolean
  icon_emoji: string | null
  ecpay_payment_type: string | null
  settings: Record<string, unknown>
  sort_order: number
}

type TxStatus = 'paid' | 'pending' | 'refunded' | 'failed'

type Transaction = {
  id: string
  order_id: string
  ecpay_trade_no: string | null
  payment_type: string | null
  amount: number
  status: TxStatus
  paid_at: string | null
  created_at: string
  ecpay_response: Record<string, unknown> | null
  orders: {
    id: string
    ecpay_order_id: string | null
    recipient_name: string | null
  } | null
}

type Stats = {
  todayCount: number
  todayAmount: number
  pendingCount: number
  monthlyAmount: number
}

// ── ECPay Settings Card ───────────────────────────────────────────────────────

function EcpaySettingsCard() {
  const [merchantId, setMerchantId] = useState('')
  const [environment, setEnvironment] = useState<'staging' | 'production'>(
    'staging',
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [masked, setMasked] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/settings')
        const json = await res.json()
        const s = json.data?.settings ?? {}
        setMerchantId(s.ecpay_merchant_id ?? '')
        setEnvironment(
          s.ecpay_environment === 'production' ? 'production' : 'staging',
        )
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/admin/settings/ecpay_merchant_id', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: merchantId.trim() }),
        }),
        fetch('/api/admin/settings/ecpay_environment', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: environment }),
        }),
      ])
      toast({ title: '綠界帳號設定已儲存' })
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  const displayId =
    masked && merchantId
      ? merchantId.slice(0, 3) + '*'.repeat(Math.max(0, merchantId.length - 3))
      : merchantId

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔑</span>
        <h3 className="font-semibold">綠界帳號設定</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-56" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Merchant ID</Label>
            <div className="flex items-center gap-2">
              <Input
                value={masked ? displayId : merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                onFocus={() => setMasked(false)}
                onBlur={() => setMasked(true)}
                placeholder="請輸入綠界商店代號"
                className="w-72 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMasked((m) => !m)}
                className="text-xs text-muted-foreground"
              >
                {masked ? '顯示' : '隱藏'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>API 環境</Label>
            <div className="flex gap-3">
              {(['staging', 'production'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={cn(
                    'flex-none rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    environment === env
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {env === 'staging' ? '🧪 測試環境' : '🚀 正式環境'}
                </button>
              ))}
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
              ⚠️ 切換環境需重新部署，請確認設定正確後再儲存。
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            儲存帳號設定
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Extra Settings per payment type ──────────────────────────────────────────

const INSTALLMENT_OPTIONS = [3, 6, 12, 24] as const

function CreditSettings({
  settings,
  onChange,
}: {
  settings: Record<string, unknown>
  onChange: (s: Record<string, unknown>) => void
}) {
  const installmentEnabled = Boolean(settings.installment_enabled)
  const periods: number[] = Array.isArray(settings.installment_periods)
    ? (settings.installment_periods as number[])
    : []

  function togglePeriod(p: number, checked: boolean) {
    const next = checked
      ? [...periods, p].sort((a, b) => a - b)
      : periods.filter((x) => x !== p)
    onChange({ ...settings, installment_periods: next })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch
          checked={installmentEnabled}
          onCheckedChange={(v) =>
            onChange({ ...settings, installment_enabled: v })
          }
          id="credit-installment"
        />
        <Label htmlFor="credit-installment" className="cursor-pointer">
          開啟分期付款
        </Label>
      </div>
      {installmentEnabled && (
        <div className="space-y-2 pl-1">
          <Label className="text-xs text-muted-foreground">可選分期期數</Label>
          <div className="flex flex-wrap gap-4">
            {INSTALLMENT_OPTIONS.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <Checkbox
                  id={`period-${p}`}
                  checked={periods.includes(p)}
                  onCheckedChange={(v) => togglePeriod(p, !!v)}
                />
                <label
                  htmlFor={`period-${p}`}
                  className="cursor-pointer select-none text-sm"
                >
                  {p} 期
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AtmSettings({
  settings,
  onChange,
}: {
  settings: Record<string, unknown>
  onChange: (s: Record<string, unknown>) => void
}) {
  const expireDays = String(settings.expire_days ?? '3')
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>付款期限</Label>
        <Select
          value={expireDays}
          onValueChange={(v) =>
            onChange({ ...settings, expire_days: Number(v) })
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} 天
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        支援各大銀行虛擬帳號：台灣銀行、合作金庫、第一銀行、華南銀行、彰化銀行、
        土地銀行、台北富邦、國泰世華、玉山銀行、中國信託、台新銀行等。
      </p>
    </div>
  )
}

function CvsSettings({
  settings,
  onChange,
}: {
  settings: Record<string, unknown>
  onChange: (s: Record<string, unknown>) => void
}) {
  const expireDays = String(settings.expire_days ?? '3')
  const note = String(settings.note ?? '')
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>付款期限</Label>
        <Select
          value={expireDays}
          onValueChange={(v) =>
            onChange({ ...settings, expire_days: Number(v) })
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d} 天
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>備注說明（顯示於結帳頁）</Label>
        <Input
          value={note}
          onChange={(e) => onChange({ ...settings, note: e.target.value })}
          placeholder="例：代碼繳費限額 NT$20,000"
          className="max-w-sm"
        />
      </div>
    </div>
  )
}

// ── PaymentCard ───────────────────────────────────────────────────────────────

function PaymentCard({
  setting,
  onSaved,
}: {
  setting: PaymentSetting
  onSaved: (updated: PaymentSetting) => void
}) {
  const [enabled, setEnabled] = useState(setting.is_enabled)
  const [settings, setSettings] = useState<Record<string, unknown>>(
    setting.settings,
  )
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleToggle(next: boolean) {
    setEnabled(next)
    setToggling(true)
    try {
      const res = await fetch(`/api/admin/payment-settings/${setting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: next }),
      })
      if (!res.ok) throw new Error()
      onSaved({ ...setting, is_enabled: next, settings })
      toast({
        title: next
          ? `已開通 ${setting.display_name}`
          : `已停用 ${setting.display_name}`,
      })
    } catch {
      setEnabled(!next)
      toast({ variant: 'destructive', title: '更新失敗，請稍後再試' })
    } finally {
      setToggling(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/payment-settings/${setting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error()
      onSaved({ ...setting, is_enabled: enabled, settings })
      toast({ title: '已儲存設定' })
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-200',
        enabled
          ? 'border-orange-400 shadow-sm shadow-orange-100'
          : 'border-border',
      )}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">
            {setting.icon_emoji ?? '💳'}
          </span>
          <div className="space-y-0.5">
            <p className="font-semibold leading-none">{setting.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {setting.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && (
            <Badge className="border-orange-200 bg-orange-100 px-1.5 py-0 text-[10px] text-orange-700">
              已開通
            </Badge>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label={`切換 ${setting.display_name}`}
          />
        </div>
      </div>

      {enabled && (
        <div className="space-y-5 border-t px-5 pb-5 pt-4">
          {setting.payment_type === 'CREDIT' && (
            <CreditSettings settings={settings} onChange={setSettings} />
          )}
          {setting.payment_type === 'ATM' && (
            <AtmSettings settings={settings} onChange={setSettings} />
          )}
          {setting.payment_type === 'CVS' && (
            <CvsSettings settings={settings} onChange={setSettings} />
          )}
          {setting.payment_type === 'BARCODE' && (
            <p className="text-sm text-muted-foreground">
              超商條碼繳費無額外設定。
            </p>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            儲存設定
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Tab 2 helpers ─────────────────────────────────────────────────────────────

const TX_STATUS: Record<TxStatus, { label: string; cls: string }> = {
  paid: {
    label: '已付款',
    cls: 'bg-green-100 text-green-700 border-green-200',
  },
  pending: {
    label: '待付款',
    cls: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  refunded: {
    label: '已退款',
    cls: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  failed: { label: '失敗', cls: 'bg-red-100 text-red-700 border-red-200' },
}

function formatPaymentType(type: string | null): string {
  if (!type) return '—'
  if (type.startsWith('Credit')) return '信用卡'
  if (type.startsWith('ATM')) return 'ATM 轉帳'
  if (type === 'CVS_CVS') return '超商代碼'
  if (type === 'CVS_BARCODE') return '超商條碼'
  if (type.startsWith('BNPL')) return '先享後付'
  return type
}

function TxBadge({ status }: { status: TxStatus }) {
  const c = TX_STATUS[status] ?? { label: status, cls: '' }
  return (
    <Badge className={cn('border text-xs font-medium', c.cls)}>{c.label}</Badge>
  )
}

const TX_PAGE_SIZE = 20

// ── TransactionsTab ───────────────────────────────────────────────────────────

function TransactionsTab() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    todayCount: 0,
    todayAmount: 0,
    pendingCount: 0,
    monthlyAmount: 0,
  })

  // Filters
  const [ptFilter, setPtFilter] = useState('all')
  const [stFilter, setStFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE))

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/transactions/stats')
      const json = await res.json()
      if (res.ok) setStats(json.data)
    } catch {
      /* non-fatal */
    }
  }, [])

  const fetchTxs = useCallback(
    async (p: number, pt: string, st: string, sd: string, ed: string) => {
      setLoading(true)
      try {
        const q = new URLSearchParams({ page: String(p) })
        if (pt && pt !== 'all') q.set('payment_type_prefix', pt)
        if (st && st !== 'all') q.set('status', st)
        if (sd) q.set('start_date', sd)
        if (ed) q.set('end_date', ed)
        const res = await fetch(`/api/admin/transactions?${q}`)
        const json = await res.json()
        if (!res.ok) throw new Error()
        setTxs(json.data?.transactions ?? [])
        setTotal(json.data?.total ?? 0)
      } catch {
        toast({ variant: 'destructive', title: '載入交易記錄失敗' })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchTxs(page, ptFilter, stFilter, startDate, endDate)
  }, [fetchTxs, page, ptFilter, stFilter, startDate, endDate])

  // Legacy: copy trade no (kept from original)
  async function handleCopyNo(no: string) {
    await navigator.clipboard.writeText(no)
    toast({ title: '已複製綠界交易號' })
  }

  // Export
  function handleExport() {
    const q = new URLSearchParams()
    if (ptFilter !== 'all') q.set('payment_type_prefix', ptFilter)
    if (stFilter !== 'all') q.set('status', stFilter)
    if (startDate) q.set('start_date', startDate)
    if (endDate) q.set('end_date', endDate)
    window.open(`/api/admin/transactions/export?${q}`, '_blank')
  }

  const hasDateFilter = !!(startDate || endDate)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            {
              label: '今日成功交易',
              value: `${stats.todayCount} 筆`,
              color: 'text-green-600',
            },
            {
              label: '今日收款金額',
              value: `NT$${stats.todayAmount.toLocaleString()}`,
              color: 'text-blue-600',
            },
            {
              label: '待入帳（ATM/CVS）',
              value: `${stats.pendingCount} 筆`,
              color: 'text-orange-600',
            },
            {
              label: '本月總收款',
              value: `NT$${stats.monthlyAmount.toLocaleString()}`,
              color: 'text-purple-600',
            },
          ] as const
        ).map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <p className="mb-1 text-xs text-muted-foreground">{k.label}</p>
            <p className={cn('text-xl font-bold tabular-nums', k.color)}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 付款方式 */}
        <Select
          value={ptFilter}
          onValueChange={(v) => {
            setPtFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="付款方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部付款方式</SelectItem>
            <SelectItem value="Credit">信用卡</SelectItem>
            <SelectItem value="ATM">ATM 轉帳</SelectItem>
            <SelectItem value="CVS">超商</SelectItem>
          </SelectContent>
        </Select>

        {/* 狀態 */}
        <Select
          value={stFilter}
          onValueChange={(v) => {
            setStFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="paid">已付款</SelectItem>
            <SelectItem value="pending">待付款</SelectItem>
            <SelectItem value="refunded">退款</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
          </SelectContent>
        </Select>

        {/* 日期範圍 */}
        <Input
          type="date"
          className="w-36"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value)
            setPage(1)
          }}
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          className="w-36"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value)
            setPage(1)
          }}
        />
        {hasDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setPage(1)
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            清除日期
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            匯出對帳 CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              fetchTxs(page, ptFilter, stFilter, startDate, endDate)
            }
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">共 {total} 筆</p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {[
                '交易號碼（ECPay TradeNo）',
                '訂單號',
                '買家',
                '付款方式',
                '金額',
                '狀態',
                '付款時間',
                '',
              ].map((h) => (
                <th
                  key={h}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-medium text-gray-600',
                    h === '金額' ? 'text-right' : 'text-left',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : txs.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-16 text-center text-muted-foreground"
                >
                  <CreditCard className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  無交易記錄
                </td>
              </tr>
            ) : (
              txs.map((tx) => (
                <Fragment key={tx.id}>
                  {/* Main row */}
                  <tr
                    className={cn(
                      'cursor-pointer select-none border-b transition-colors',
                      expanded === tx.id ? 'bg-orange-50' : 'hover:bg-gray-50',
                    )}
                    onClick={() =>
                      setExpanded((prev) => (prev === tx.id ? null : tx.id))
                    }
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {tx.ecpay_trade_no ? (
                        <span className="flex items-center gap-1.5">
                          {tx.ecpay_trade_no}
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyNo(tx.ecpay_trade_no!)
                            }}
                            title="複製"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${tx.order_id}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-orange-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tx.order_id.slice(0, 8)}…
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {tx.orders?.recipient_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatPaymentType(tx.payment_type)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      NT${tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {tx.paid_at
                        ? new Date(tx.paid_at).toLocaleString('zh-TW')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === tx.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expanded === tx.id && (
                    <tr className="border-b bg-orange-50/40">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-medium text-gray-500">
                              對應訂單
                            </span>
                            <Link
                              href={`/admin/orders/${tx.order_id}`}
                              className="inline-flex items-center gap-1 text-orange-600 hover:underline"
                            >
                              {tx.orders?.ecpay_order_id ?? tx.order_id}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-gray-500">
                              ECPay 回應原始資料
                            </p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-xs leading-relaxed text-green-400">
                              {tx.ecpay_response
                                ? JSON.stringify(tx.ecpay_response, null, 2)
                                : '（無資料）'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          第 {page} / {totalPages} 頁
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/payment-settings')
        const json = await res.json()
        setPaymentSettings((json.data?.settings ?? []) as PaymentSetting[])
      } catch {
        toast({ variant: 'destructive', title: '載入失敗，請重新整理' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleSettingUpdated(updated: PaymentSetting) {
    setPaymentSettings((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    )
  }

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <CreditCard className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">金流管理</h1>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">付款方式設定</TabsTrigger>
          <TabsTrigger value="transactions">交易記錄</TabsTrigger>
        </TabsList>

        {/* ── Tab 1：付款方式設定 ──────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <EcpaySettingsCard />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : paymentSettings.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">尚未載入付款方式</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentSettings.map((s) => (
                <PaymentCard
                  key={s.id}
                  setting={s}
                  onSaved={handleSettingUpdated}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2：交易記錄 ──────────────────────────────────────────── */}
        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
