'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Globe, Loader2, RefreshCw, Truck, X } from 'lucide-react'
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

type LogisticsSetting = {
  id: string
  logistics_type: string
  display_name: string
  is_enabled: boolean
  shipping_fee: number
  free_shipping_threshold: number | null
  ecpay_logistics_id: string | null
  settings: Record<string, unknown>
  sort_order: number
}

type LogisticsRecord = {
  id: string
  recipient_name: string | null
  logistics_company: string | null
  tracking_number: string | null
  logistics_status: string | null
  logistics_status_at: string | null
  created_at: string
}

// ── Logo / badge config ───────────────────────────────────────────────────────

type LogisticsDisplay = {
  badge: string
  color: string
  emoji?: string
}

const LOGISTICS_DISPLAY: Record<string, LogisticsDisplay> = {
  HOME: {
    badge: '宅配',
    color: 'bg-gray-100 text-gray-700 border border-gray-300',
    emoji: '🏠',
  },
  UNIMART: { badge: '7-11', color: 'bg-orange-500 text-white' },
  FAMI: { badge: '全家', color: 'bg-blue-600 text-white' },
  HILIFE: { badge: '萊爾富', color: 'bg-red-600 text-white' },
  OKMARTB2C: { badge: 'OK', color: 'bg-blue-900 text-white' },
}

const LOGISTICS_STATUS_STYLES = {
  shipping: { label: '配送中', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: '已送達', cls: 'bg-green-100 text-green-700' },
  failed: { label: '異常', cls: 'bg-red-100 text-red-700' },
  pending_pickup: { label: '等待取件', cls: 'bg-orange-100 text-orange-700' },
} as const

type LogisticsStatus = keyof typeof LOGISTICS_STATUS_STYLES

// ── GlobalThresholdCard ───────────────────────────────────────────────────────

function GlobalThresholdCard({
  value,
  onSaved,
}: {
  value: number
  onSaved: (v: number) => void
}) {
  const [threshold, setThreshold] = useState(String(value))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setThreshold(String(value))
  }, [value])

  async function handleSave() {
    const parsed = parseInt(threshold)
    if (isNaN(parsed) || parsed < 0) {
      toast({ variant: 'destructive', title: '請輸入有效金額' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/free_shipping_threshold', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsed }),
      })
      if (!res.ok) throw new Error()
      onSaved(parsed)
      toast({ title: '已更新全域免運門檻' })
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">全域免運門檻</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        各物流方式若未設定自訂免運門檻，訂單達此金額即享免運費。
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">NT$</span>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            min={0}
            className="w-36"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          儲存
        </Button>
      </div>
    </div>
  )
}

// ── LogisticsCard ─────────────────────────────────────────────────────────────

function LogisticsCard({
  setting,
  onSaved,
}: {
  setting: LogisticsSetting
  onSaved: (updated: LogisticsSetting) => void
}) {
  const [enabled, setEnabled] = useState(setting.is_enabled)
  const [shippingFee, setShippingFee] = useState(String(setting.shipping_fee))
  const [useGlobal, setUseGlobal] = useState(
    setting.free_shipping_threshold === null,
  )
  const [customThreshold, setCustomThreshold] = useState(
    String(setting.free_shipping_threshold ?? 500),
  )
  const [ecpayId, setEcpayId] = useState(setting.ecpay_logistics_id ?? '')
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleToggle(next: boolean) {
    setEnabled(next)
    setToggling(true)
    try {
      const res = await fetch(`/api/admin/logistics-settings/${setting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: next }),
      })
      if (!res.ok) throw new Error()
      onSaved({ ...setting, is_enabled: next })
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
    const fee = parseInt(shippingFee)
    if (isNaN(fee) || fee < 0) {
      toast({ variant: 'destructive', title: '請輸入有效運費' })
      return
    }
    const threshold = useGlobal ? null : parseInt(customThreshold) || null
    setSaving(true)
    try {
      const body = {
        shipping_fee: fee,
        free_shipping_threshold: threshold,
        ecpay_logistics_id: ecpayId.trim() || null,
      }
      const res = await fetch(`/api/admin/logistics-settings/${setting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onSaved({ ...setting, ...body, is_enabled: enabled })
      toast({ title: '已儲存設定' })
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  const display = LOGISTICS_DISPLAY[setting.logistics_type] ?? {
    badge: setting.logistics_type,
    color: 'bg-gray-100 text-gray-700',
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-200',
        enabled
          ? 'border-green-400 shadow-sm shadow-green-100'
          : 'border-border',
      )}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex min-w-[56px] items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold tracking-tight',
              display.color,
            )}
          >
            {display.emoji ? `${display.emoji} ` : ''}
            {display.badge}
          </span>
          <div className="space-y-0.5">
            <p className="font-semibold leading-none">{setting.display_name}</p>
            <div className="flex items-center gap-2">
              {!enabled ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  已停用
                </Badge>
              ) : (
                <span className="text-xs font-medium text-green-600">
                  NT${setting.shipping_fee} 運費 · 已啟用
                </span>
              )}
            </div>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={toggling}
          aria-label={`切換 ${setting.display_name}`}
        />
      </div>

      {enabled && (
        <div className="space-y-5 border-t px-5 pb-5 pt-4">
          <div className="space-y-1.5">
            <Label>運費（NT$）</Label>
            <Input
              type="number"
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              min={0}
              className="w-40"
              placeholder="60"
            />
          </div>
          <div className="space-y-2.5">
            <Label>免運門檻</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`global-${setting.id}`}
                checked={useGlobal}
                onCheckedChange={(v) => setUseGlobal(!!v)}
              />
              <label
                htmlFor={`global-${setting.id}`}
                className="cursor-pointer select-none text-sm"
              >
                使用全域設定
              </label>
            </div>
            {!useGlobal && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-sm text-muted-foreground">NT$</span>
                <Input
                  type="number"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(e.target.value)}
                  min={0}
                  className="w-36"
                  placeholder="500"
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>綠界物流商代碼（選填）</Label>
            <Input
              value={ecpayId}
              onChange={(e) => setEcpayId(e.target.value)}
              placeholder="由綠界提供的物流商 ID"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              若尚未申請綠界物流，可先留空。
            </p>
          </div>
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

// ── LogisticsRecordsTab ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const info = LOGISTICS_STATUS_STYLES[status as LogisticsStatus]
  if (!info)
    return <span className="text-xs text-muted-foreground">未查詢</span>
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        info.cls,
      )}
    >
      {info.label}
    </span>
  )
}

function LogisticsRecordsTab() {
  const [records, setRecords] = useState<LogisticsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [trackingSet, setTrackingSet] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: 'shipped', page: '1' })
      if (dateFrom) params.set('start_date', dateFrom)
      if (dateTo) params.set('end_date', dateTo)
      const res = await fetch(`/api/admin/orders?${params}`)
      const json = await res.json()
      setRecords((json.data?.orders ?? []) as LogisticsRecord[])
    } catch {
      toast({ variant: 'destructive', title: '載入失敗' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (typeFilter && r.logistics_company !== typeFilter) return false
        if (statusFilter && r.logistics_status !== statusFilter) return false
        return true
      }),
    [records, typeFilter, statusFilter],
  )

  async function handleTrack(orderId: string) {
    setTrackingSet((prev) => new Set([...prev, orderId]))
    try {
      const res = await fetch(`/api/admin/logistics/${orderId}/status`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '查詢失敗')
      setRecords((prev) =>
        prev.map((r) =>
          r.id === orderId
            ? {
                ...r,
                logistics_status: json.data.status,
                logistics_status_at: json.data.updated_at,
              }
            : r,
        ),
      )
      toast({ title: `已更新：${json.data.status_label}` })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: err instanceof Error ? err.message : '查詢失敗',
      })
    } finally {
      setTrackingSet((prev) => {
        const n = new Set(prev)
        n.delete(orderId)
        return n
      })
    }
  }

  async function handleCopy(trackingNumber: string) {
    await navigator.clipboard.writeText(trackingNumber)
    toast({ title: '已複製追蹤單號' })
  }

  const hasFilters = !!(typeFilter || statusFilter || dateFrom || dateTo)

  return (
    <div className="mt-4 space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* 物流方式 */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">物流方式</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="7-ELEVEN">7-ELEVEN</SelectItem>
              <SelectItem value="全家">全家</SelectItem>
              <SelectItem value="萊爾富">萊爾富</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
              <SelectItem value="宅配">宅配</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 物流狀態 */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">物流狀態</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              <SelectItem value="shipping">配送中</SelectItem>
              <SelectItem value="delivered">已送達</SelectItem>
              <SelectItem value="failed">異常</SelectItem>
              <SelectItem value="pending_pickup">等待取件</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 日期範圍 */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">出貨日期</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36 text-sm"
            />
            <span className="text-sm text-muted-foreground">~</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36 text-sm"
            />
          </div>
        </div>

        {/* 查詢 / 清除 */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="h-9">
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            查詢
          </Button>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setTypeFilter('')
                setStatusFilter('')
                setDateFrom('')
                setDateTo('')
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              清除
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
          <Truck className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">沒有符合條件的物流記錄</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-24">訂單號</TableHead>
                <TableHead>收件人</TableHead>
                <TableHead>物流方式</TableHead>
                <TableHead>追蹤單號</TableHead>
                <TableHead>物流狀態</TableHead>
                <TableHead>出貨時間</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rec) => {
                const isTracking = trackingSet.has(rec.id)
                const shippedAt = rec.logistics_status_at ?? rec.created_at
                return (
                  <TableRow key={rec.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rec.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {rec.recipient_name ?? '—'}
                    </TableCell>
                    <TableCell>{rec.logistics_company ?? '—'}</TableCell>
                    <TableCell>
                      {rec.tracking_number ? (
                        <span className="font-mono text-xs">
                          {rec.tracking_number}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rec.logistics_status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(shippedAt).toLocaleDateString('zh-TW', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleTrack(rec.id)}
                          disabled={isTracking}
                        >
                          {isTracking ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          追蹤
                        </Button>
                        {rec.tracking_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => handleCopy(rec.tracking_number!)}
                          >
                            <Copy className="h-3 w-3" />
                            複製
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLogisticsPage() {
  const [settings, setSettings] = useState<LogisticsSetting[]>([])
  const [globalThreshold, setGlobalThreshold] = useState<number>(1000)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [logisticsR, settingsR] = await Promise.all([
        fetch('/api/admin/logistics-settings').then((r) => r.json()),
        fetch('/api/admin/settings').then((r) => r.json()),
      ])
      setSettings(logisticsR.data?.settings ?? [])
      setGlobalThreshold(
        settingsR.data?.settings?.free_shipping_threshold ?? 1000,
      )
    } catch {
      toast({ variant: 'destructive', title: '載入失敗，請重新整理' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSettingUpdated(updated: LogisticsSetting) {
    setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  return (
    <div className="max-w-3xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">物流管理</h1>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">開通設定</TabsTrigger>
          <TabsTrigger value="records">物流記錄</TabsTrigger>
        </TabsList>

        {/* ── Tab 1：開通設定 ─────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {loading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : (
            <GlobalThresholdCard
              value={globalThreshold}
              onSaved={setGlobalThreshold}
            />
          )}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : settings.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-12 text-center text-muted-foreground">
              <Truck className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">尚未載入物流方式</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.map((s) => (
                <LogisticsCard
                  key={s.id}
                  setting={s}
                  onSaved={handleSettingUpdated}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2：物流記錄 ─────────────────────────────────────────── */}
        <TabsContent value="records">
          <LogisticsRecordsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
