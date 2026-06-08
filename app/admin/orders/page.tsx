'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Package,
  RefreshCw,
  Search,
  Ship,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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

type OrderItem = { product_name: string; quantity: number }

type AdminOrder = {
  id: string
  status: OrderStatus
  total_amount: number
  shipping_fee: number
  ecpay_order_id: string | null
  tracking_number: string | null
  logistics_company: string | null
  recipient_name: string | null
  recipient_phone: string | null
  created_at: string
  users: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
  order_items: OrderItem[]
}

type StatusCounts = Partial<Record<OrderStatus, number>>

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paid: 'bg-blue-100 text-blue-700 border-blue-200',
  processing: 'bg-purple-100 text-purple-700 border-purple-200',
  shipped: 'bg-orange-100 text-orange-700 border-orange-200',
  done: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  refunded: 'bg-red-100 text-red-500 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn('border text-xs font-medium', STATUS_COLORS[status] ?? '')}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

function itemSummary(items: OrderItem[]): string {
  if (!items.length) return '—'
  const first = items[0]
  return items.length > 1
    ? `${first.product_name} ×${first.quantity} 等 ${items.length} 項`
    : `${first.product_name} ×${first.quantity}`
}

const col = createColumnHelper<AdminOrder>()

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({})
  const [todayNew, setTodayNew] = useState(0)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [logistics, setLogistics] = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(
    async (p: number, s: string, st: string, sd: string, ed: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p) })
        if (st && st !== 'all') params.set('status', st)
        if (s) params.set('search', s)
        if (sd) params.set('start_date', sd)
        if (ed) params.set('end_date', ed)
        const res = await fetch(`/api/admin/orders?${params}`)
        const json = await res.json()
        setOrders(json.data?.orders ?? [])
        setTotal(json.data?.total ?? 0)
        setStatusCounts(json.data?.status_counts ?? {})
        setTodayNew(json.data?.today_new ?? 0)
        setRowSelection({})
      } catch {
        toast({ variant: 'destructive', title: '載入失敗' })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchOrders(page, search, statusFilter, startDate, endDate)
  }, [fetchOrders, page, search, statusFilter, startDate, endDate])

  // ── Search debounce ───────────────────────────────────────────────────────

  function handleSearch(v: string) {
    setDraftSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setSearch(v)
      setPage(1)
    }, 400)
  }

  function handleTabChange(v: string) {
    setStatusFilter(v)
    setPage(1)
    setRowSelection({})
  }

  // ── Bulk ship ─────────────────────────────────────────────────────────────

  const selectedIds = Object.entries(rowSelection)
    .filter(([, v]) => v)
    .map(([k]) => k)

  async function doBulkShip() {
    setBulkLoading(true)
    try {
      const res = await fetch('/api/admin/orders/bulk-ship', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: selectedIds,
          logistics_company: logistics || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '批次出貨失敗')
      toast({ title: `已標記 ${json.data?.updated_count} 筆為已出貨` })
      setBulkOpen(false)
      setLogistics('')
      setRowSelection({})
      fetchOrders(page, search, statusFilter, startDate, endDate)
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all')
      params.set('status', statusFilter)
    if (search) params.set('search', search)
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    window.open(`/api/admin/orders/export?${params}`, '_blank')
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      col.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v: boolean | 'indeterminate') =>
              table.toggleAllPageRowsSelected(!!v)
            }
            aria-label="全選"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v: boolean | 'indeterminate') =>
              row.toggleSelected(!!v)
            }
            aria-label="選取"
          />
        ),
      }),
      col.accessor('id', {
        header: '訂單號',
        cell: (info) => (
          <Link
            href={`/admin/orders/${info.getValue()}`}
            className="flex items-center gap-1 font-mono text-xs text-orange-600 hover:underline"
          >
            {info.getValue().slice(0, 8)}… <ExternalLink className="h-3 w-3" />
          </Link>
        ),
      }),
      col.accessor('created_at', {
        header: '時間',
        cell: (info) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(info.getValue()).toLocaleDateString('zh-TW')}
          </span>
        ),
      }),
      col.display({
        id: 'recipient',
        header: '收件人',
        cell: ({ row }) => {
          const o = row.original
          const name = o.recipient_name ?? o.users?.name ?? '—'
          const phone = o.recipient_phone ?? o.users?.phone ?? ''
          return (
            <div className="text-sm">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{phone}</div>
            </div>
          )
        },
      }),
      col.display({
        id: 'items',
        header: '商品',
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate text-sm text-muted-foreground">
            {itemSummary(row.original.order_items)}
          </span>
        ),
      }),
      col.accessor('total_amount', {
        header: '金額',
        cell: (info) => (
          <span className="font-semibold tabular-nums">
            NT${info.getValue().toLocaleString()}
          </span>
        ),
      }),
      col.accessor('status', {
        header: '狀態',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Link href={`/admin/orders/${row.original.id}`}>
            <Button variant="ghost" size="sm" className="text-xs">
              查看
            </Button>
          </Link>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    pageCount: totalPages,
  })

  // ── KPI ───────────────────────────────────────────────────────────────────

  const kpi = [
    {
      label: '待付款',
      value: statusCounts.pending ?? 0,
      icon: ShoppingBag,
      color: 'text-yellow-600',
    },
    {
      label: '已付款',
      value: statusCounts.paid ?? 0,
      icon: Package,
      color: 'text-blue-600',
    },
    {
      label: '待出貨',
      value: (statusCounts.processing ?? 0) + (statusCounts.shipped ?? 0),
      icon: Truck,
      color: 'text-purple-600',
    },
    { label: '今日新增', value: todayNew, icon: Ship, color: 'text-green-600' },
  ]

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">訂單管理</h1>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <Truck className="mr-1 h-4 w-4" />
              批次出貨（{selectedIds.length}）
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            匯出 CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              fetchOrders(page, search, statusFilter, startDate, endDate)
            }
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            重整
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi.map((k) => {
          const Icon = k.icon
          return (
            <div
              key={k.label}
              className="flex items-center gap-3 rounded-xl border bg-card p-4"
            >
              <Icon className={cn('h-8 w-8 shrink-0', k.color)} />
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {loading ? '…' : k.value}
                </p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Tabs value={statusFilter} onValueChange={handleTabChange}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="pending">待付款</TabsTrigger>
            <TabsTrigger value="paid">已付款</TabsTrigger>
            <TabsTrigger value="processing">處理中</TabsTrigger>
            <TabsTrigger value="shipped">已出貨</TabsTrigger>
            <TabsTrigger value="done">已完成</TabsTrigger>
            <TabsTrigger value="cancelled">已取消</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            placeholder="訂單號、姓名、電話…"
            value={draftSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {draftSearch && (
            <button
              className="absolute right-3 top-2.5 text-muted-foreground"
              onClick={() => {
                setDraftSearch('')
                setSearch('')
                setPage(1)
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Input
          type="date"
          className="w-36"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value)
            setPage(1)
          }}
          placeholder="開始日期"
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
          placeholder="結束日期"
        />
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setPage(1)
            }}
          >
            清除日期
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          共 {total} 筆
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-600"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-muted-foreground"
                >
                  無訂單資料
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors',
                    row.getIsSelected() ? 'bg-orange-50' : 'hover:bg-gray-50',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
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

      {/* Bulk Ship Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批次標記出貨</DialogTitle>
            <DialogDescription>
              將選取的 {selectedIds.length} 筆訂單標記為已出貨
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">物流商（選填）</label>
            <Input
              placeholder="例：黑貓、7-11 超商"
              value={logistics}
              onChange={(e) => setLogistics(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkOpen(false)}
              disabled={bulkLoading}
            >
              取消
            </Button>
            <Button onClick={doBulkShip} disabled={bulkLoading}>
              {bulkLoading ? '處理中…' : '確認出貨'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
