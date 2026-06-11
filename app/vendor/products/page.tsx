'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected'

type Product = {
  id: string
  name: string
  base_price: number
  images: string[]
  status: ProductStatus
  product_variants: Array<{ id: string }>
  meta?: { rejection?: { reason?: string } } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待審核' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '已駁回' },
  { key: 'draft', label: '草稿' },
] as const

const STATUS_STYLES: Record<
  ProductStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '審核中',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  approved: {
    label: '已上架',
    className: 'border-green-200 bg-green-50 text-green-700',
  },
  rejected: {
    label: '已駁回',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  draft: { label: '草稿', className: '' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorProductsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('')
  const [total, setTotal] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (q: string, status: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q.trim()) p.set('search', q.trim())
      if (status) p.set('status', status)
      const res = await fetch(`/api/vendor/products?${p}`)
      const json = await res.json()
      if (res.ok) {
        setProducts(json.data.products)
        setTotal(json.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(search, tab), 300)
    return () => clearTimeout(t)
  }, [search, tab, load])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/vendor/products/${deleteId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
        return
      }
      toast({ title: '商品已刪除' })
      setDeleteId(null)
      void load(search, tab)
    } finally {
      setDeleting(false)
    }
  }

  const hasFilter = !!(search || tab)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">商品管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 項商品</p>
        </div>
        <Button asChild>
          <Link href="/vendor/products/new">
            <Plus className="mr-1.5 h-4 w-4" />
            新增商品
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋商品名稱…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {hasFilter
              ? '找不到符合條件的商品'
              : '還沒有商品，開始上架您的第一個商品'}
          </p>
          {!hasFilter && (
            <Button asChild size="sm" className="mt-4">
              <Link href="/vendor/products/new">新增第一個商品</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => router.push(`/vendor/products/${p.id}`)}
              onDelete={() => setDeleteId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open: boolean) => !open && setDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確定要刪除此商品？</DialogTitle>
            <DialogDescription>
              此操作無法復原，商品資料將永久移除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              確定刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  const cover = product.images?.[0]
  const skuCount = product.product_variants?.length ?? 0
  const info = STATUS_STYLES[product.status]
  const canEdit = product.status !== 'approved'
  const canDelete = product.status === 'draft' || product.status === 'rejected'
  const rejectionReason = product.meta?.rejection?.reason

  return (
    <div className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      {/* Cover image */}
      <div className="relative aspect-[4/3] bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/25" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="line-clamp-2 font-medium leading-snug">
            {product.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {skuCount > 0 ? `${skuCount} 個規格` : '尚無規格'}{' '}
            <span className="font-semibold text-foreground">
              · NT$ {product.base_price.toLocaleString()}
            </span>
          </p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={info.className}>
            {info.label}
          </Badge>
          {product.status === 'rejected' && rejectionReason && (
            <span
              title={`駁回原因：${rejectionReason}`}
              className="cursor-help"
            >
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onEdit}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {canEdit ? '編輯' : '查看'}
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
