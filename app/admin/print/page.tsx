'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Download,
  Eye,
  Loader2,
  PawPrint,
  Printer,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'pending' | 'printing' | 'done'

type PrintRequest = {
  id: string
  status: Status
  source: 'onsite' | 'online'
  card_front_url: string | null
  card_back_url: string | null
  note: string | null
  created_at: string
  pets: {
    id: string
    name: string
    breed: string | null
    ai_photo_url: string | null
    photo_url: string | null
  } | null
  users: { id: string; name: string } | null
  redemption_codes: { id: string; code: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: '待印製' },
  { key: 'printing', label: '印製中' },
  { key: 'done', label: '已完成' },
]

const STATUS_NEXT: Record<Status, Status | null> = {
  pending: 'printing',
  printing: 'done',
  done: null,
}

const STATUS_NEXT_LABEL: Record<Status, string> = {
  pending: '標記印製中',
  printing: '標記完成',
  done: '',
}

const SOURCE_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  onsite: { label: '現場兌換', variant: 'secondary' },
  online: { label: '線上訂單', variant: 'default' },
}

// ── Request card component ────────────────────────────────────────────────────

function RequestCard({
  req,
  onStatusChange,
}: {
  req: PrintRequest
  onStatusChange: (id: string, status: Status) => Promise<void>
}) {
  const { toast } = useToast()
  const [imageUrls, setImageUrls] = useState<{
    front: string
    back: string
  } | null>(
    req.card_front_url && req.card_back_url
      ? { front: req.card_front_url, back: req.card_back_url }
      : null,
  )
  const [loadingImages, setLoadingImages] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const photoSrc = req.pets?.ai_photo_url ?? req.pets?.photo_url
  const sourceCfg = SOURCE_BADGE[req.source] ?? SOURCE_BADGE.onsite
  const nextStatus = STATUS_NEXT[req.status]

  async function fetchImages() {
    setLoadingImages(true)
    try {
      const res = await fetch(`/api/admin/cards/${req.id}/images`)
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: json.message ?? '無法取得卡面圖片',
        })
        return
      }
      setImageUrls({ front: json.data.front_url, back: json.data.back_url })
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤' })
    } finally {
      setLoadingImages(false)
    }
  }

  function downloadImage(url: string, filename: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleStatusUpdate() {
    if (!nextStatus) return
    setUpdatingStatus(true)
    await onStatusChange(req.id, nextStatus)
    setUpdatingStatus(false)
  }

  const petName = req.pets?.name ?? '未知寵物'
  const ownerName = req.users?.name ?? '未知飼主'

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">
        {/* Pet photo */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {photoSrc ? (
            <Image
              src={photoSrc}
              alt={petName}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PawPrint className="h-7 w-7 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{petName}</span>
            {req.pets?.breed && (
              <span className="text-sm text-muted-foreground">
                {req.pets.breed}
              </span>
            )}
            <Badge variant={sourceCfg.variant} className="text-xs">
              {sourceCfg.label}
            </Badge>
            {req.redemption_codes?.code && (
              <span className="font-mono text-xs text-muted-foreground">
                {req.redemption_codes.code}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">👤 {ownerName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(req.created_at).toLocaleString('zh-TW')}
          </p>
        </div>

        {/* Status update button */}
        {nextStatus && (
          <Button
            size="sm"
            variant={nextStatus === 'done' ? 'default' : 'outline'}
            onClick={handleStatusUpdate}
            disabled={updatingStatus}
            className="shrink-0 gap-1.5"
          >
            {updatingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            {STATUS_NEXT_LABEL[req.status]}
          </Button>
        )}
      </div>

      {/* Preview dialog (inline expansion) */}
      {imageUrls && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Image
              src={imageUrls.front}
              alt="正面"
              width={540}
              height={340}
              className="w-full rounded-lg ring-1 ring-border"
              style={{ height: 'auto' }}
            />
            <Image
              src={imageUrls.back}
              alt="背面"
              width={540}
              height={340}
              className="w-full rounded-lg ring-1 ring-border"
              style={{ height: 'auto' }}
            />
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 border-t px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={imageUrls ? () => setImageUrls(null) : fetchImages}
          disabled={loadingImages}
          className="gap-1.5 text-xs"
        >
          {loadingImages ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {imageUrls ? '隱藏預覽' : '預覽卡面'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!imageUrls) await fetchImages()
            if (imageUrls)
              downloadImage(imageUrls.front, `${petName}_front.png`)
          }}
          disabled={loadingImages}
          className="gap-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          正面 PNG
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!imageUrls) await fetchImages()
            if (imageUrls) downloadImage(imageUrls.back, `${petName}_back.png`)
          }}
          disabled={loadingImages}
          className="gap-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          背面 PNG
        </Button>
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function RequestSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPrintPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Status>('pending')
  const [requests, setRequests] = useState<PrintRequest[]>([])
  const [tabCounts, setTabCounts] = useState<Record<Status, number>>({
    pending: 0,
    printing: 0,
    done: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
  }, [search])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: activeTab,
        search: debouncedSearch,
        page: String(page),
      })
      const res = await fetch(`/api/admin/cards?${params}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
        return
      }
      setRequests((json.data.requests as PrintRequest[]) ?? [])
      setTotal(json.data.total ?? 0)
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤' })
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch, page, toast])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  // Load tab counts on mount
  useEffect(() => {
    async function loadCounts() {
      const counts: Record<Status, number> = {
        pending: 0,
        printing: 0,
        done: 0,
      }
      await Promise.all(
        TABS.map(async (t) => {
          const res = await fetch(`/api/admin/cards?status=${t.key}&page=1`)
          const json = await res.json()
          if (res.ok) counts[t.key] = json.data.total ?? 0
        }),
      )
      setTabCounts(counts)
    }
    void loadCounts()
  }, [])

  async function handleStatusChange(id: string, newStatus: Status) {
    const res = await fetch(`/api/admin/cards/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'destructive', title: json.message ?? '更新失敗' })
      return
    }
    toast({
      title: `狀態已更新為「${newStatus === 'printing' ? '印製中' : '已完成'}」`,
    })
    setRequests((prev) => prev.filter((r) => r.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    setTabCounts((prev) => ({
      ...prev,
      [activeTab]: Math.max(0, prev[activeTab] - 1),
      [newStatus]: prev[newStatus] + 1,
    }))
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">卡片印製管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              管理 NFC 卡片製卡申請與印製流程
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
            />
            重新整理
          </Button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Tabs + search row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key)
                  setPage(1)
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === t.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                      activeTab === t.key
                        ? 'bg-primary text-white'
                        : 'bg-muted-foreground/20 text-muted-foreground',
                    )}
                  >
                    {tabCounts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="搜尋寵物或飼主名稱…"
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <RequestSkeleton key={i} />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? '沒有符合搜尋條件的申請' : '此狀態目前沒有申請記錄'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onStatusChange={handleStatusChange}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              上一頁
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 頁
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              下一頁
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
