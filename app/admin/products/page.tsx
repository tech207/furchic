'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GripVertical,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type Row,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  parseProductExcel,
  generateProductTemplate,
  type ParsedProduct,
  type ImportError,
} from '@/lib/utils/excel'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminProduct = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  min_price: number
  total_stock: number
  variant_count: number
  low_stock_count: number
}

type ImportPhase =
  | { phase: 'upload' }
  | { phase: 'parsing' }
  | {
      phase: 'preview'
      products: ParsedProduct[]
      errors: ImportError[]
      file: File
    }
  | { phase: 'importing' }
  | {
      phase: 'done'
      success: number
      variants: number
      errors: Array<{ row: number; message: string }>
    }

// ── Low-stock banner ──────────────────────────────────────────────────────────

function LowStockBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        有 <strong>{count}</strong> 個規格庫存偏低（≤
        低庫存警示值），請注意補貨。
      </span>
    </div>
  )
}

// ── Drag handle ───────────────────────────────────────────────────────────────

function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}

// ── Sortable table row ────────────────────────────────────────────────────────

function SortableRow({ row }: { row: Row<AdminProduct> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id })

  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : 'auto',
        position: isDragging ? 'relative' : 'static',
      }}
      className="border-b last:border-b-0 hover:bg-muted/40"
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          style={{ width: cell.column.getSize() }}
          className="px-3 py-2.5 align-middle text-sm"
        >
          {cell.column.id === 'drag' ? (
            <DragHandle {...listeners} />
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </td>
      ))}
    </tr>
  )
}

// ── Import dialog ─────────────────────────────────────────────────────────────

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<ImportPhase>({ phase: 'upload' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPhase({ phase: 'upload' })
    setDragging(false)
  }

  async function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast({ variant: 'destructive', title: '請上傳 .xlsx 或 .xls 檔案' })
      return
    }
    setPhase({ phase: 'parsing' })
    try {
      const result = await parseProductExcel(file)
      setPhase({ phase: 'preview', ...result, file })
    } catch (e) {
      toast({ variant: 'destructive', title: `解析失敗：${String(e)}` })
      setPhase({ phase: 'upload' })
    }
  }

  async function handleConfirmImport() {
    if (phase.phase !== 'preview') return
    const { file } = phase
    setPhase({ phase: 'importing' })

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()

      if (!res.ok) {
        const errs =
          (json.errors as
            | Array<{ row: number; message: string }>
            | undefined) ?? []
        setPhase({
          phase: 'preview',
          products: phase.products,
          errors: [
            ...phase.errors,
            ...errs.map((e) => ({ row: e.row, message: e.message })),
          ],
          file,
        })
        toast({ variant: 'destructive', title: json.message ?? '匯入失敗' })
        return
      }

      setPhase({
        phase: 'done',
        success: json.data.success,
        variants: json.data.variants,
        errors: json.data.errors ?? [],
      })
      onImported()
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤，請稍後再試' })
      reset()
    }
  }

  function handleDownloadTemplate() {
    const blob = generateProductTemplate()
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'product_import_template.xlsx',
    })
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批次匯入商品</DialogTitle>
          <DialogDescription>
            透過 Excel 一次匯入多個商品與規格
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {phase.phase === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-xl border-2 border-dashed py-14 text-center transition-colors',
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
              <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">拖曳 Excel 至此，或點擊選擇</p>
              <p className="mt-1 text-xs text-muted-foreground">
                .xlsx / .xls，最大 5 MB
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>不確定格式？</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="h-3 w-3" />
                下載範本
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Parsing ── */}
        {phase.phase === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">解析 Excel 中…</p>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {phase.phase === 'preview' && (
          <div className="space-y-4">
            {/* Errors */}
            {phase.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-destructive">
                  發現 {phase.errors.length} 個錯誤，需修正後重新上傳
                </p>
                <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  {phase.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {e.row > 0 ? `第 ${e.row} 列：` : ''}
                      {e.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Products preview */}
            {phase.products.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">
                  預覽 {phase.products.length} 件商品（共{' '}
                  {phase.products.reduce((s, p) => s + p.variants.length, 0)}{' '}
                  個規格）
                </p>
                <div className="max-h-52 overflow-y-auto rounded-lg border">
                  {phase.products.map((p, i) => (
                    <div key={i} className="border-b px-3 py-2 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          NT$ {p.base_price}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.variants.map((v) => (
                          <span
                            key={v.sku}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                          >
                            {v.sku}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>
                重新上傳
              </Button>
              <Button
                onClick={() => void handleConfirmImport()}
                disabled={
                  phase.errors.length > 0 || phase.products.length === 0
                }
              >
                確認匯入 {phase.products.length} 件商品
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 4: Importing ── */}
        {phase.phase === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">匯入中，請稍候…</p>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {phase.phase === 'done' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">匯入完成</p>
                <p className="text-sm text-muted-foreground">
                  成功匯入 {phase.success} 件商品、{phase.variants} 個規格
                </p>
              </div>
            </div>

            {phase.errors.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-800 dark:bg-orange-950/20">
                <p className="mb-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                  {phase.errors.length} 個錯誤未能匯入
                </p>
                {phase.errors.map((e, i) => (
                  <p
                    key={i}
                    className="text-xs text-orange-600 dark:text-orange-500"
                  >
                    {e.row > 0 ? `第 ${e.row} 列：` : ''}
                    {e.message}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                關閉
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockTotal, setLowStockTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [importOpen, setImportOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ search, filter })
      const res = await fetch(`/api/admin/products?${p}`)
      const json = await res.json()
      if (res.ok) {
        setProducts((json.data.products as AdminProduct[]) ?? [])
        setLowStockTotal(json.data.low_stock_total ?? 0)
      } else {
        toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
      }
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤' })
    } finally {
      setLoading(false)
    }
  }, [search, filter, toast])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => void loadProducts(),
      search ? 300 : 0,
    )
  }, [loadProducts, search])

  // ── Inline toggle ──────────────────────────────────────────────────────────
  async function handleToggleActive(id: string, is_active: boolean) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active } : p)),
    )
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !is_active } : p)),
      )
      toast({ variant: 'destructive', title: '狀態更新失敗' })
    }
  }

  // ── Soft delete ────────────────────────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定要下架並刪除「${name}」嗎？`)) return
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast({ title: `「${name}」已刪除` })
    }
  }

  // ── TanStack Table columns ─────────────────────────────────────────────────
  const columnHelper = useMemo(() => createColumnHelper<AdminProduct>(), [])

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'drag',
        size: 40,
        header: '',
        cell: () => null, // actual content handled in SortableRow
      }),
      columnHelper.display({
        id: 'thumbnail',
        size: 52,
        header: '',
        cell: ({ row }) => {
          const src = row.original.images?.[0]
          return src ? (
            <div className="relative h-11 w-11 overflow-hidden rounded-lg">
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
              <Package className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )
        },
      }),
      columnHelper.accessor('name', {
        header: '商品名稱',
        cell: ({ getValue, row }) => (
          <div className="min-w-0">
            <p className="max-w-[200px] truncate font-medium">{getValue()}</p>
            {row.original.description && (
              <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('variant_count', {
        header: '規格數',
        size: 80,
        cell: ({ getValue }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('min_price', {
        header: '售價起',
        size: 100,
        cell: ({ getValue }) => `NT$ ${getValue().toLocaleString()}`,
      }),
      columnHelper.accessor('total_stock', {
        header: '總庫存',
        size: 90,
        cell: ({ getValue, row }) => {
          const low = row.original.low_stock_count > 0
          return (
            <span
              className={cn(
                'flex items-center gap-1',
                low && 'font-medium text-orange-600',
              )}
            >
              {getValue()}
              {low && <AlertTriangle className="h-3.5 w-3.5" />}
            </span>
          )
        },
      }),
      columnHelper.accessor('is_active', {
        header: '狀態',
        size: 80,
        cell: ({ getValue, row }) => (
          <Switch
            checked={getValue()}
            onCheckedChange={(v) => void handleToggleActive(row.original.id, v)}
          />
        ),
      }),
      columnHelper.accessor('sort_order', {
        header: '排序',
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/admin/products/${row.original.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() =>
                void handleDelete(row.original.id, row.original.name)
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnHelper, products],
  )

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  const productIds = useMemo(() => products.map((p) => p.id), [products])

  // ── dnd-kit drag-end ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = products.findIndex((p) => p.id === active.id)
    const newIdx = products.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(products, oldIdx, newIdx).map((p, i) => ({
      ...p,
      sort_order: i,
    }))
    setProducts(reordered)

    void fetch('/api/admin/products/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: reordered.map((p) => ({ id: p.id, sort_order: p.sort_order })),
      }),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">商品管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              共 {products.length} 件商品
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadProducts()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              />
              重新整理
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = generateProductTemplate()
                const url = URL.createObjectURL(blob)
                const a = Object.assign(document.createElement('a'), {
                  href: url,
                  download: 'product_import_template.xlsx',
                })
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              下載範本
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              批次匯入
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link href="/admin/products/new">
                <Plus className="h-3.5 w-3.5" />
                新增商品
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-6">
        {/* Low-stock banner */}
        <LowStockBanner count={lowStockTotal} />

        {/* Toolbar: search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋商品名稱…"
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {{ all: '全部', active: '上架', inactive: '下架' }[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b bg-muted/30">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        style={{ width: h.getSize() }}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              {loading ? (
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={columns.length} className="px-3 py-2.5">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : products.length === 0 ? (
                <tbody>
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      {search || filter !== 'all'
                        ? '沒有符合條件的商品'
                        : '尚未有商品，點擊「新增商品」開始'}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={productIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <SortableRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void loadProducts()}
      />
    </div>
  )
}
