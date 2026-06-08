'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  Download,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type CodeRow = {
  id: string
  code: string
  batch_name: string | null
  expires_at: string | null
  used_by: string | null
  used_at: string | null
  used_count: number
  max_uses: number
  created_at: string
}

type StatusFilter = 'all' | 'unused' | 'used' | 'expired'

function getStatus(row: CodeRow): StatusFilter {
  if (row.used_by) return 'used'
  if (row.expires_at && new Date(row.expires_at) < new Date()) return 'expired'
  return 'unused'
}

// ─── Generate form schema ──────────────────────────────────────────────────────

const generateSchema = z.object({
  batch_name: z.string().min(1, '請輸入批次名稱').max(100),
  count: z.number().int().min(1).max(200),
  prefix: z.string().max(10).default(''),
  format: z.enum(['alpha', 'numeric', 'alphanumeric']).default('alphanumeric'),
  expires_at: z.string().optional(),
})
type GenerateForm = z.infer<typeof generateSchema>

// ─── Column helper ─────────────────────────────────────────────────────────────

const col = createColumnHelper<CodeRow>()

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ row }: { row: CodeRow }) {
  const s = getStatus(row)
  if (s === 'used')
    return (
      <Badge className="border-green-200 bg-green-100 text-green-700">
        已使用
      </Badge>
    )
  if (s === 'expired') return <Badge variant="destructive">已過期</Badge>
  return (
    <Badge variant="outline" className="border-orange-300 text-orange-600">
      未使用
    </Badge>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RedemptionCodesPage() {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [generated, setGenerated] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CodeRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PAGE_SIZE = 50
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchCodes = useCallback(
    async (p: number, s: string, st: StatusFilter) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p), status: st })
        if (s) params.set('search', s)
        const res = await fetch(`/api/admin/redemption-codes?${params}`)
        if (!res.ok) throw new Error('載入失敗')
        const json = await res.json()
        setCodes(json.data?.codes ?? [])
        setTotal(json.data?.total ?? 0)
      } catch {
        toast({ variant: 'destructive', title: '載入失敗' })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchCodes(page, search, status)
  }, [fetchCodes, page, search, status])

  // ── Search debounce ──────────────────────────────────────────────────────────

  function handleSearchInput(v: string) {
    setDraftSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setSearch(v)
      setPage(1)
    }, 400)
  }

  function clearSearch() {
    setDraftSearch('')
    setSearch('')
    setPage(1)
  }

  // ── Tab change ───────────────────────────────────────────────────────────────

  function handleTab(v: string) {
    setStatus(v as StatusFilter)
    setPage(1)
  }

  // ── Generate form ────────────────────────────────────────────────────────────

  const form = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      batch_name: '',
      count: 10,
      prefix: '',
      format: 'alphanumeric',
      expires_at: '',
    },
  })

  async function onGenerate(values: GenerateForm) {
    setGenerating(true)
    setGenerated([])
    try {
      const body = {
        ...values,
        expires_at: values.expires_at?.trim() ? values.expires_at : null,
      }
      const res = await fetch('/api/admin/redemption-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '產生失敗')
      const newCodes: string[] = (json.data?.codes ?? []).map(
        (c: { code: string }) => c.code,
      )
      setGenerated(newCodes)
      toast({ title: `成功產生 ${newCodes.length} 組兌換碼` })
      fetchCodes(1, search, status)
      setPage(1)
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setGenerating(false)
    }
  }

  // ── Export filtered list ─────────────────────────────────────────────────────

  function handleExport() {
    const params = new URLSearchParams({ status })
    if (search) params.set('search', search)
    window.open(`/api/admin/redemption-codes/export?${params}`, '_blank')
  }

  // ── Download generated CSV ───────────────────────────────────────────────────

  function downloadGeneratedCsv() {
    const bom = '﻿'
    const csv = bom + '代碼\n' + generated.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `generated-${form.getValues('batch_name') || 'codes'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/admin/redemption-codes/${deleteTarget.id}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '刪除失敗')
      toast({ title: '已刪除兌換碼' })
      setDeleteTarget(null)
      fetchCodes(page, search, status)
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setDeleting(false)
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      col.accessor('code', {
        header: '代碼',
        cell: (info) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm tracking-wider">
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('batch_name', {
        header: '批次',
        cell: (info) =>
          info.getValue() ?? <span className="text-xs text-gray-400">—</span>,
      }),
      col.accessor('expires_at', {
        header: '到期日',
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            new Date(v).toLocaleDateString('zh-TW')
          ) : (
            <span className="text-xs text-gray-400">永不過期</span>
          )
        },
      }),
      col.display({
        id: 'status',
        header: '狀態',
        cell: ({ row }) => <StatusBadge row={row.original} />,
      }),
      col.accessor('used_by', {
        header: '使用者 ID',
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            <span className="font-mono text-xs text-gray-600">
              {v.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )
        },
      }),
      col.accessor('used_at', {
        header: '使用時間',
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            new Date(v).toLocaleString('zh-TW')
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )
        },
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          if (getStatus(r) !== 'unused') return null
          return (
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )
        },
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: codes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">兌換碼管理</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            匯出 CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCodes(page, search, status)}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            重整
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setGenerated([])
              setDrawerOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            批次產生
          </Button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={status} onValueChange={handleTab}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="unused">未使用</TabsTrigger>
            <TabsTrigger value="used">已使用</TabsTrigger>
            <TabsTrigger value="expired">已過期</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 pr-8"
            placeholder="搜尋代碼或批次名稱…"
            value={draftSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          {draftSearch && (
            <button
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <span className="whitespace-nowrap text-sm text-gray-500">
          共 {total} 筆
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left font-medium text-gray-600"
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
            ) : codes.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-gray-400"
                >
                  無資料
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-colors hover:bg-gray-50"
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
      <div className="flex items-center justify-between text-sm text-gray-600">
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

      {/* ── Batch Generate Drawer ───────────────────────────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-[420px] overflow-y-auto sm:w-[480px]"
        >
          <SheetHeader className="mb-4">
            <SheetTitle>批次產生兌換碼</SheetTitle>
            <SheetDescription>
              設定參數後按「產生」，代碼將立即存入資料庫。
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onGenerate)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="batch_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>批次名稱</FormLabel>
                    <FormControl>
                      <Input placeholder="例：2026夏日活動" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>數量：{field.value} 組</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min={1}
                        max={200}
                        step={1}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1</span>
                      <span>200</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>前綴（選填，最多 10 字）</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例：SUMMER"
                        maxLength={10}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代碼格式</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="alphanumeric">
                          英數混合（預設）
                        </SelectItem>
                        <SelectItem value="alpha">純英文字母</SelectItem>
                        <SelectItem value="numeric">純數字</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>到期日（選填）</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={generating}>
                {generating ? '產生中…' : '產生兌換碼'}
              </Button>
            </form>
          </Form>

          {/* Generated result */}
          {generated.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    已產生 {generated.length} 組
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadGeneratedCsv}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    下載 CSV
                  </Button>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-gray-50 p-2">
                  {generated.map((c, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm tracking-wider text-gray-700"
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除兌換碼</DialogTitle>
            <DialogDescription>
              確定要刪除代碼{' '}
              <span className="font-mono font-semibold">
                {deleteTarget?.code}
              </span>
              ？ 此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? '刪除中…' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
