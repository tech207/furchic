'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  ReceiptText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

type CommissionRow = {
  vendor_id: string
  brand_name: string
  company_name: string
  contact_email: string
  month: string
  total_orders: number
  gross_revenue: number
  commission_amount: number
  vendor_payable: number
  avg_commission_rate: number
}

type ChannelStat = {
  vendor_id: string
  brand_name: string
  company_name: string
  total_orders: number
  total_revenue: number
  vendor_amount: number
  commission_amount: number
  channels: Record<string, number>
}

type ApiResult<T> = {
  data?: T
  error?: string
  message?: string
}

type GrandSummary = {
  total_orders: number
  gross_revenue: number
  commission_amount: number
  vendor_payable: number
}

const CHANNEL_LABELS: Record<string, string> = {
  online_daily: '網路日常銷售',
  online_campaign: '網路行銷活動',
  physical_event: '實體活動銷售',
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function monthRange(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const end = new Date(year, mon, 0)
  return {
    start: `${month}-01`,
    end: end.toISOString().slice(0, 10),
  }
}

function csvEscape(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = `\uFEFF${rows
    .map((row) => row.map(csvEscape).join(','))
    .join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default function AdminVendorReportsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [channelStats, setChannelStats] = useState<Record<string, ChannelStat>>(
    {},
  )
  const [grand, setGrand] = useState<GrandSummary>({
    total_orders: 0,
    gross_revenue: 0,
    commission_amount: 0,
    vendor_payable: 0,
  })
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const range = useMemo(() => monthRange(month), [month])

  useEffect(() => {
    const controller = new AbortController()

    async function loadReports() {
      setLoading(true)
      setError('')
      try {
        const [commissionRes, vendorRes] = await Promise.all([
          fetch(`/api/admin/reports/commissions?month=${month}`, {
            signal: controller.signal,
          }),
          fetch(
            `/api/admin/reports/vendors?start_date=${range.start}&end_date=${range.end}`,
            { signal: controller.signal },
          ),
        ])

        if (!commissionRes.ok || !vendorRes.ok) {
          throw new Error('載入廠商報表失敗')
        }

        const [commissionJson, vendorJson] = (await Promise.all([
          commissionRes.json(),
          vendorRes.json(),
        ])) as [
          ApiResult<{
            commissions: CommissionRow[]
            grand: GrandSummary
          }>,
          ApiResult<{ vendors: ChannelStat[] }>,
        ]

        setCommissions(commissionJson.data?.commissions ?? [])
        setGrand(
          commissionJson.data?.grand ?? {
            total_orders: 0,
            gross_revenue: 0,
            commission_amount: 0,
            vendor_payable: 0,
          },
        )
        setChannelStats(
          Object.fromEntries(
            (vendorJson.data?.vendors ?? []).map((vendor) => [
              vendor.vendor_id,
              vendor,
            ]),
          ),
        )
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || '載入廠商報表失敗')
          setCommissions([])
          setChannelStats({})
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadReports()
    return () => controller.abort()
  }, [month, range.end, range.start])

  function exportSettlementCsv(vendor: CommissionRow) {
    const channels = channelStats[vendor.vendor_id]?.channels ?? {}
    const rows: Array<Array<string | number>> = [
      ['月結對帳單'],
      ['月份', vendor.month],
      ['品牌名稱', vendor.brand_name],
      ['公司名稱', vendor.company_name],
      ['聯絡 Email', vendor.contact_email],
      [''],
      ['項目', '數值'],
      ['有效訂單數', vendor.total_orders],
      ['銷售總額', vendor.gross_revenue],
      ['平台抽成', vendor.commission_amount],
      ['應付廠商金額', vendor.vendor_payable],
      ['平均抽成比例', `${vendor.avg_commission_rate}%`],
      [''],
      ['銷售維度', '訂單數'],
      ['網路日常銷售', channels.online_daily ?? 0],
      ['網路行銷活動', channels.online_campaign ?? 0],
      ['實體活動銷售', channels.physical_event ?? 0],
    ]

    downloadCsv(
      `vendor-settlement-${vendor.brand_name || vendor.vendor_id}-${vendor.month}.csv`,
      rows,
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ReceiptText className="h-4 w-4" />
            Admin 後台
          </div>
          <h1 className="mt-1 text-2xl font-bold">廠商報表管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            廠商列表與本月銷售摘要，可展開查看維度明細並匯出月結 CSV。
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-muted-foreground">
            月份
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setExpandedVendorId(null)
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {error ? (
        <Card className="rounded-lg border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="本月廠商數"
          value={loading ? '—' : commissions.length.toLocaleString()}
        />
        <SummaryCard
          label="本月訂單數"
          value={loading ? '—' : grand.total_orders.toLocaleString()}
        />
        <SummaryCard
          label="本月銷售總額"
          value={loading ? '—' : formatCurrency(grand.gross_revenue)}
        />
        <SummaryCard
          label="應付廠商總額"
          value={loading ? '—' : formatCurrency(grand.vendor_payable)}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">廠商列表與銷售摘要</CardTitle>
          </div>
          <CardDescription>
            點擊廠商列可展開詳細報表，月結 CSV
            可寄送給短期廠商或無後台帳號的廠商。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              載入廠商月結摘要
            </div>
          ) : commissions.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              此月份尚無廠商銷售資料
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">廠商</TableHead>
                  <TableHead className="min-w-48">聯絡 Email</TableHead>
                  <TableHead className="text-right">訂單數</TableHead>
                  <TableHead className="text-right">銷售總額</TableHead>
                  <TableHead className="text-right">平台抽成</TableHead>
                  <TableHead className="text-right">應付廠商</TableHead>
                  <TableHead className="text-right">平均抽成</TableHead>
                  <TableHead className="w-44 text-right">月結對帳單</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((vendor) => {
                  const isOpen = expandedVendorId === vendor.vendor_id
                  const channels =
                    channelStats[vendor.vendor_id]?.channels ?? {}

                  return (
                    <Fragment key={vendor.vendor_id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedVendorId((prev) =>
                            prev === vendor.vendor_id ? null : vendor.vendor_id,
                          )
                        }
                      >
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <ChevronDown
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                !isOpen && '-rotate-90',
                              )}
                            />
                            <div>
                              <p className="font-medium">
                                {vendor.brand_name || vendor.company_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {vendor.company_name}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {vendor.contact_email || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.total_orders.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(vendor.gross_revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(vendor.commission_amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(vendor.vendor_payable)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {vendor.avg_commission_rate}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              exportSettlementCsv(vendor)
                            }}
                          >
                            <Download className="h-4 w-4" />
                            CSV
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isOpen ? (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <div className="space-y-4 p-4">
                              <div className="grid gap-3 md:grid-cols-3">
                                {Object.entries(CHANNEL_LABELS).map(
                                  ([key, label]) => (
                                    <div
                                      key={key}
                                      className="rounded-lg border bg-background p-4"
                                    >
                                      <p className="text-xs font-medium text-muted-foreground">
                                        {label}
                                      </p>
                                      <p className="mt-2 text-2xl font-bold tabular-nums">
                                        {(channels[key] ?? 0).toLocaleString()}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        訂單數
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                                <div className="overflow-x-auto rounded-lg border bg-background">
                                  <table className="w-full min-w-[720px] text-sm">
                                    <thead className="border-b text-xs text-muted-foreground">
                                      <tr>
                                        <th className="px-4 py-3 text-left">
                                          對帳項目
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                          數值
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                          備註
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <DetailRow
                                        label="有效訂單數"
                                        value={`${vendor.total_orders.toLocaleString()} 筆`}
                                        note="已排除取消與退款訂單"
                                      />
                                      <DetailRow
                                        label="銷售總額"
                                        value={formatCurrency(
                                          vendor.gross_revenue,
                                        )}
                                        note="依訂單總金額彙總"
                                      />
                                      <DetailRow
                                        label="平台抽成"
                                        value={formatCurrency(
                                          vendor.commission_amount,
                                        )}
                                        note="依訂單快照抽成比例計算"
                                      />
                                      <DetailRow
                                        label="應付廠商金額"
                                        value={formatCurrency(
                                          vendor.vendor_payable,
                                        )}
                                        note="銷售總額扣除平台抽成"
                                      />
                                    </tbody>
                                  </table>
                                </div>

                                <div className="rounded-lg border bg-background p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <FileText className="h-4 w-4 text-orange-500" />
                                    月結對帳單
                                  </div>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    產生 CSV
                                    後可直接寄送給短期合作或無後台帳號的廠商。
                                  </p>
                                  <Button
                                    className="mt-4 w-full gap-2"
                                    onClick={() => exportSettlementCsv(vendor)}
                                  >
                                    <Download className="h-4 w-4" />
                                    匯出月結對帳單
                                  </Button>
                                </div>
                              </div>
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

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Badge variant="outline" className="mr-2">
          CSV
        </Badge>
        月結對帳單以目前選定月份產生，內容包含廠商摘要、抽成、應付金額與三個銷售維度訂單數。
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{label}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        {value}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{note}</td>
    </tr>
  )
}
