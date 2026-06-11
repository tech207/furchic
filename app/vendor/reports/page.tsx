'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  PackageSearch,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

type ChannelKey = 'online_daily' | 'online_campaign' | 'physical_event'

type ChannelMeta = {
  key: ChannelKey
  label: string
  commissionRate: number
}

type OverviewStat = {
  total_orders: number
  total_revenue: number
  vendor_revenue: number
  commission: number
}

type DailyPoint = {
  date: string
  orders: number
  revenue: number
  vendor_revenue: number
}

type SkuBreakdown = {
  variant_id: string
  variant_name: string
  sku: string
  quantity: number
  revenue: number
  vendor_revenue: number
}

type ProductReport = {
  product_id: string
  product_name: string
  total_orders: number
  total_revenue: number
  vendor_revenue: number
  sku_breakdown: SkuBreakdown[]
}

type ApiResult<T> = {
  data?: T
  error?: string
  message?: string
}

const CHANNELS: ChannelMeta[] = [
  { key: 'online_daily', label: '網路日常銷售', commissionRate: 20 },
  { key: 'online_campaign', label: '網路行銷活動', commissionRate: 25 },
  { key: 'physical_event', label: '實體活動銷售', commissionRate: 15 },
]

const emptyOverview: OverviewStat = {
  total_orders: 0,
  total_revenue: 0,
  vendor_revenue: 0,
  commission: 0,
}

function getDefaultRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  }
}

function moneyShort(value: number) {
  if (value >= 1000000) return `${Math.round(value / 10000)}萬`
  if (value >= 10000) return `${Math.round(value / 1000) / 10}萬`
  return value.toLocaleString()
}

function parseFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) return decodeURIComponent(encoded)
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1]
  return quoted ?? fallback
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: DailyPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">訂單數：{point.orders}</p>
      <p className="text-muted-foreground">
        銷售金額：{formatCurrency(point.revenue)}
      </p>
    </div>
  )
}

export default function VendorReportsPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelKey>('online_daily')
  const [range, setRange] = useState(getDefaultRange)
  const [overview, setOverview] = useState<
    Partial<Record<ChannelKey, OverviewStat>>
  >({})
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [products, setProducts] = useState<ProductReport[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const activeMeta =
    CHANNELS.find((c) => c.key === activeChannel) ?? CHANNELS[0]
  const activeOverview = overview[activeChannel] ?? emptyOverview

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => b.total_revenue - a.total_revenue),
    [products],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadReport() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({
          start_date: range.start,
          end_date: range.end,
        })
        const channelParams = new URLSearchParams(params)
        channelParams.set('channel', activeChannel)

        const [overviewRes, dailyRes, productsRes] = await Promise.all([
          fetch(`/api/vendor/reports/overview?${params.toString()}`, {
            signal: controller.signal,
          }),
          fetch(`/api/vendor/reports/daily?${channelParams.toString()}`, {
            signal: controller.signal,
          }),
          fetch(
            `/api/vendor/reports/products?${channelParams.toString()}&sort=revenue`,
            { signal: controller.signal },
          ),
        ])

        if (!overviewRes.ok || !dailyRes.ok || !productsRes.ok) {
          throw new Error('載入報表失敗')
        }

        const [overviewJson, dailyJson, productsJson] = (await Promise.all([
          overviewRes.json(),
          dailyRes.json(),
          productsRes.json(),
        ])) as [
          ApiResult<Record<ChannelKey, OverviewStat>>,
          ApiResult<{ daily: DailyPoint[] }>,
          ApiResult<{ products: ProductReport[] }>,
        ]

        setOverview(overviewJson.data ?? {})
        setDaily(dailyJson.data?.daily ?? [])
        setProducts(productsJson.data?.products ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || '載入報表失敗')
          setOverview({})
          setDaily([])
          setProducts([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadReport()
    return () => controller.abort()
  }, [activeChannel, range.end, range.start])

  async function exportReport(format: 'csv' | 'xlsx') {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        channel: activeChannel,
        start_date: range.start,
        end_date: range.end,
        format,
      })
      const res = await fetch(`/api/vendor/reports/export?${params.toString()}`)
      if (!res.ok) throw new Error('匯出失敗')

      const blob = await res.blob()
      const fallback = `vendor-report-${activeChannel}-${range.start}-${range.end}.${format}`
      const filename = parseFilename(
        res.headers.get('Content-Disposition'),
        fallback,
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      window.alert((err as Error).message || '匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PackageSearch className="h-4 w-4" />
            廠商後台
          </div>
          <h1 className="mt-1 text-2xl font-bold">銷售報表</h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              日期範圍
            </div>
            <input
              type="date"
              value={range.start}
              max={range.end}
              onChange={(e) =>
                setRange((prev) => ({ ...prev, start: e.target.value }))
              }
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <span className="hidden text-muted-foreground sm:inline">-</span>
            <input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(e) =>
                setRange((prev) => ({ ...prev, end: e.target.value }))
              }
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exporting} className="gap-2">
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                匯出報表
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => void exportReport('csv')}>
                <FileText className="mr-2 h-4 w-4" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportReport('xlsx')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs
        value={activeChannel}
        onValueChange={(value) => {
          setActiveChannel(value as ChannelKey)
          setExpanded({})
        }}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg p-1 lg:w-auto">
          {CHANNELS.map((channel) => (
            <TabsTrigger
              key={channel.key}
              value={channel.key}
              className="min-w-fit px-4 py-2"
            >
              {channel.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map((channel) => (
          <TabsContent key={channel.key} value={channel.key} className="mt-0">
            {error ? (
              <Card className="rounded-lg border-red-200 bg-red-50">
                <CardContent className="p-4 text-sm text-red-700">
                  {error}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="總訂單數"
                value={loading ? '—' : activeOverview.total_orders}
                suffix="筆"
              />
              <MetricCard
                label="總銷售金額"
                value={
                  loading ? '—' : formatCurrency(activeOverview.total_revenue)
                }
              />
              <MetricCard
                label="應收款"
                value={
                  loading ? '—' : formatCurrency(activeOverview.vendor_revenue)
                }
                note="已扣除平台抽成"
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
              <Card className="rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">銷售金額趨勢</CardTitle>
                  <CardDescription>
                    X 軸為日期，Tooltip 顯示當天訂單數與銷售金額
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {loading ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        載入趨勢資料
                      </div>
                    ) : daily.length === 0 ? (
                      <EmptyState label="此日期範圍尚無銷售趨勢資料" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={daily}
                          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => String(value).slice(5)}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => moneyShort(Number(value))}
                          />
                          <Tooltip content={<TrendTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#e76f51"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">抽成說明</CardTitle>
                  <CardDescription>{activeMeta.label}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="font-medium">
                      本維度適用抽成比例：{activeMeta.commissionRate}%
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      實際抽成依各商品規則計算，詳情請聯繫平台
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="平台抽成"
                      value={formatCurrency(activeOverview.commission)}
                    />
                    <MiniStat
                      label="應收占比"
                      value={
                        activeOverview.total_revenue > 0
                          ? `${Math.round(
                              (activeOverview.vendor_revenue /
                                activeOverview.total_revenue) *
                                100,
                            )}%`
                          : '—'
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4 rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">商品銷售</CardTitle>
                <CardDescription>
                  預設依銷售金額降序排列，點擊商品列可展開 SKU 明細
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    載入商品銷售資料
                  </div>
                ) : sortedProducts.length === 0 ? (
                  <EmptyState label="此維度尚無商品銷售資料" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-56">商品名稱</TableHead>
                        <TableHead className="min-w-36">SKU</TableHead>
                        <TableHead className="text-right">銷售數量</TableHead>
                        <TableHead className="text-right">銷售金額</TableHead>
                        <TableHead className="text-right">抽成金額</TableHead>
                        <TableHead className="text-right">應收款</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedProducts.map((product) => {
                        const quantity = product.sku_breakdown.reduce(
                          (sum, sku) => sum + sku.quantity,
                          0,
                        )
                        const commission =
                          product.total_revenue - product.vendor_revenue
                        const isOpen = expanded[product.product_id]
                        const primarySku =
                          product.sku_breakdown.length === 1
                            ? product.sku_breakdown[0].sku
                            : `${product.sku_breakdown[0]?.sku ?? '—'} 等 ${
                                product.sku_breakdown.length
                              } 個`

                        return (
                          <Fragment key={product.product_id}>
                            <TableRow
                              className="cursor-pointer"
                              onClick={() =>
                                setExpanded((prev) => ({
                                  ...prev,
                                  [product.product_id]:
                                    !prev[product.product_id],
                                }))
                              }
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <ChevronRight
                                    className={cn(
                                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                      isOpen && 'rotate-90',
                                    )}
                                  />
                                  <span>{product.product_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {primarySku}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {quantity.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(product.total_revenue)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(commission)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(product.vendor_revenue)}
                              </TableCell>
                            </TableRow>
                            {isOpen ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="bg-muted/30 p-0"
                                >
                                  <div className="overflow-x-auto p-4">
                                    <table className="w-full min-w-[720px] text-sm">
                                      <thead className="text-xs text-muted-foreground">
                                        <tr className="border-b">
                                          <th className="py-2 text-left">
                                            SKU 明細
                                          </th>
                                          <th className="py-2 text-left">
                                            規格
                                          </th>
                                          <th className="py-2 text-right">
                                            銷售數量
                                          </th>
                                          <th className="py-2 text-right">
                                            銷售金額
                                          </th>
                                          <th className="py-2 text-right">
                                            抽成金額
                                          </th>
                                          <th className="py-2 text-right">
                                            應收款
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {product.sku_breakdown.map((sku) => (
                                          <tr
                                            key={sku.variant_id}
                                            className="border-b last:border-0"
                                          >
                                            <td className="py-2 font-mono text-xs">
                                              {sku.sku}
                                            </td>
                                            <td className="py-2">
                                              {sku.variant_name}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                              {sku.quantity.toLocaleString()}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                              {formatCurrency(sku.revenue)}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                              {formatCurrency(
                                                sku.revenue -
                                                  sku.vendor_revenue,
                                              )}
                                            </td>
                                            <td className="py-2 text-right font-medium tabular-nums">
                                              {formatCurrency(
                                                sku.vendor_revenue,
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix,
  note,
}: {
  label: string
  value: number | string
  suffix?: string
  note?: string
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-end gap-1">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {suffix ? (
            <span className="pb-0.5 text-sm text-muted-foreground">
              {suffix}
            </span>
          ) : null}
        </div>
        {note ? (
          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  )
}
