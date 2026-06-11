'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  Clock,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type PendingProduct = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[]
  created_at: string
  vendor: {
    id: string
    company_name: string
    brand_name: string
    contact_email: string
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminProductsPendingPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [products, setProducts] = useState<PendingProduct[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Approve / reject state
  const [approving, setApproving] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PendingProduct | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q.trim()) params.set('search', q.trim())
      const res = await fetch(`/api/admin/products/pending?${params}`)
      const json = await res.json()
      if (res.ok) {
        setProducts(json.data.products)
        setTotal(json.data.total)
        setTotalPages(json.data.totalPages)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(search, page), 300)
    return () => clearTimeout(t)
  }, [search, page, load])

  async function handleApprove(productId: string) {
    setApproving(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}/approve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '審核失敗' })
        return
      }
      toast({ title: '商品已審核通過並上架' })
      void load(search, page)
    } finally {
      setApproving(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast({ variant: 'destructive', title: '請填寫駁回原因' })
      return
    }
    setRejecting(true)
    try {
      const res = await fetch(`/api/admin/products/${rejectTarget.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '駁回失敗' })
        return
      }
      toast({ title: '商品已駁回，廠商將收到通知' })
      setRejectTarget(null)
      setRejectReason('')
      void load(search, page)
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">商品審核</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 件待審核商品，依送審時間排序
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜尋商品名稱…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <CheckCircle className="mb-3 h-12 w-12 text-green-400/60" />
          <p className="font-medium text-muted-foreground">
            {search
              ? '找不到符合條件的商品'
              : '目前沒有待審核商品，全部都審完了！'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductReviewRow
              key={product.id}
              product={product}
              approving={approving === product.id}
              onApprove={() => handleApprove(product.id)}
              onReject={() => {
                setRejectTarget(product)
                setRejectReason('')
              }}
              onView={() => router.push(`/admin/products/${product.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一頁
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 頁
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一頁
          </Button>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(v) => !v && setRejectTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>駁回商品</DialogTitle>
            <DialogDescription>
              填寫駁回原因，廠商可查看並修改後重新送審。
            </DialogDescription>
          </DialogHeader>

          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">{rejectTarget.name}</p>
                <p className="text-muted-foreground">
                  {rejectTarget.vendor?.brand_name ??
                    rejectTarget.vendor?.company_name}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>駁回原因 *</Label>
                <Textarea
                  rows={3}
                  placeholder="例：商品圖片不清晰，請重新上傳高解析度圖片…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  maxLength={500}
                  autoFocus
                />
                <p className="text-right text-xs text-muted-foreground">
                  {rejectReason.length}/500
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejecting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            >
              {rejecting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              確定駁回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ProductReviewRow({
  product,
  approving,
  onApprove,
  onReject,
  onView,
}: {
  product: PendingProduct
  approving: boolean
  onApprove: () => void
  onReject: () => void
  onView: () => void
}) {
  const cover = product.images?.[0]

  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Cover image */}
      <div
        className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted"
        onClick={onView}
      >
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className="cursor-pointer font-medium hover:underline"
          onClick={onView}
        >
          {product.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {product.vendor?.brand_name ??
              product.vendor?.company_name ??
              '未知廠商'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(product.created_at)}
          </span>
          <span className="font-medium text-foreground">
            NT$ {product.base_price.toLocaleString()}
          </span>
        </div>
        {product.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {product.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700"
          onClick={onApprove}
          disabled={approving}
        >
          {approving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          )}
          審核通過
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={approving}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          駁回
        </Button>
      </div>
    </div>
  )
}
