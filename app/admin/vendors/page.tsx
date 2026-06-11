'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  CheckCircle,
  Ban,
  Eye,
  Loader2,
  Store,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { VENDOR_CATEGORIES } from '@/lib/validations/vendor'

// ── Types ─────────────────────────────────────────────────────────────────────

type VendorStatus = 'pending' | 'approved' | 'suspended' | 'rejected'

type Vendor = {
  id: string
  company_name: string
  brand_name: string
  vendor_type: 'permanent' | 'flash'
  category: string | null
  status: VendorStatus
  contact_email: string
  contact_name: string
  logo_url: string | null
  default_commission_rate: number
  created_at: string
  product_count: number
  monthly_revenue: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待審核' },
  { key: 'approved', label: '已上線' },
  { key: 'suspended', label: '已停權' },
] as const

const STATUS_STYLES: Record<
  VendorStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '待審核',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  approved: {
    label: '已上線',
    className: 'border-green-200 bg-green-50 text-green-700',
  },
  suspended: {
    label: '已停權',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  rejected: {
    label: '已駁回',
    className: 'border-muted bg-muted/50 text-muted-foreground',
  },
}

const VENDOR_TYPE_LABEL: Record<string, string> = {
  permanent: '長期',
  flash: '短期',
}

function categoryLabel(value: string | null) {
  return VENDOR_CATEGORIES.find((c) => c.value === value)?.label ?? value ?? '—'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminVendorsPage() {
  const { toast } = useToast()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Approve state
  const [approving, setApproving] = useState<string | null>(null)

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<Vendor | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspending, setSuspending] = useState(false)

  const load = useCallback(async (q: string, status: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q.trim()) params.set('search', q.trim())
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/vendors?${params}`)
      const json = await res.json()
      if (res.ok) {
        setVendors(json.data.vendors)
        setTotal(json.data.total)
        setTotalPages(json.data.totalPages)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(search, tab, page), 300)
    return () => clearTimeout(t)
  }, [search, tab, page, load])

  async function handleApprove(vendor: Vendor) {
    setApproving(vendor.id)
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/approve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '審核失敗' })
        return
      }
      toast({ title: json.data?.message ?? '廠商已審核通過' })
      void load(search, tab, page)
    } finally {
      setApproving(null)
    }
  }

  async function handleSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return
    setSuspending(true)
    try {
      const res = await fetch(
        `/api/admin/vendors/${suspendTarget.id}/suspend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: suspendReason.trim() }),
        },
      )
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '停權失敗' })
        return
      }
      toast({ title: json.data?.message ?? '廠商已停權' })
      setSuspendTarget(null)
      setSuspendReason('')
      void load(search, tab, page)
    } finally {
      setSuspending(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">廠商管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 間廠商</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋品牌名稱、公司、Email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                setPage(1)
              }}
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

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Store className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {search || tab ? '找不到符合條件的廠商' : '目前沒有廠商資料'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-4 py-3 font-medium">廠商</th>
                <th className="px-4 py-3 font-medium">類型</th>
                <th className="px-4 py-3 font-medium">類別</th>
                <th className="px-4 py-3 text-right font-medium">商品數</th>
                <th className="px-4 py-3 text-right font-medium">本月銷售</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 font-medium">加入時間</th>
                <th className="w-36 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map((vendor) => (
                <VendorRow
                  key={vendor.id}
                  vendor={vendor}
                  approving={approving === vendor.id}
                  onApprove={() => handleApprove(vendor)}
                  onSuspend={() => {
                    setSuspendTarget(vendor)
                    setSuspendReason('')
                  }}
                />
              ))}
            </tbody>
          </table>
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

      {/* Suspend dialog */}
      <Dialog
        open={!!suspendTarget}
        onOpenChange={(open: boolean) => !open && setSuspendTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>停權廠商</DialogTitle>
            <DialogDescription>
              停權後廠商所有商品將自動下架，廠商帳號無法登入。
            </DialogDescription>
          </DialogHeader>
          {suspendTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">{suspendTarget.brand_name}</p>
                <p className="text-muted-foreground">
                  {suspendTarget.company_name}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>停權原因 *</Label>
                <Textarea
                  rows={3}
                  placeholder="請說明停權原因…"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  maxLength={500}
                  autoFocus
                />
                <p className="text-right text-xs text-muted-foreground">
                  {suspendReason.length}/500
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendTarget(null)}
              disabled={suspending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={suspending || !suspendReason.trim()}
            >
              {suspending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              確定停權
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── VendorRow ─────────────────────────────────────────────────────────────────

function VendorRow({
  vendor,
  approving,
  onApprove,
  onSuspend,
}: {
  vendor: Vendor
  approving: boolean
  onApprove: () => void
  onSuspend: () => void
}) {
  const statusInfo = STATUS_STYLES[vendor.status]

  return (
    <tr className="hover:bg-muted/20">
      {/* Brand */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {vendor.logo_url ? (
            <img
              src={vendor.logo_url}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-600">
              {vendor.brand_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium">{vendor.brand_name}</p>
            <p className="max-w-[140px] truncate text-xs text-muted-foreground">
              {vendor.company_name}
            </p>
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3 text-muted-foreground">
        {VENDOR_TYPE_LABEL[vendor.vendor_type] ?? vendor.vendor_type}
      </td>

      {/* Category */}
      <td className="px-4 py-3 text-muted-foreground">
        {categoryLabel(vendor.category)}
      </td>

      {/* Product count */}
      <td className="px-4 py-3 text-right font-medium">
        {vendor.product_count}
      </td>

      {/* Monthly revenue */}
      <td className="px-4 py-3 text-right font-medium">
        {vendor.monthly_revenue > 0
          ? `NT$ ${vendor.monthly_revenue.toLocaleString()}`
          : '—'}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant="outline" className={statusInfo.className}>
          {statusInfo.label}
        </Badge>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(vendor.created_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {vendor.status === 'pending' && (
            <Button
              size="sm"
              className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
              onClick={onApprove}
              disabled={approving}
            >
              {approving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              <span className="ml-1">審核</span>
            </Button>
          )}
          {vendor.status === 'approved' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onSuspend}
            >
              <Ban className="mr-1 h-3 w-3" />
              停權
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
            <Link href={`/admin/vendors/${vendor.id}`}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
            <Link href={`/admin/vendors/${vendor.id}?tab=commissions`}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  )
}
