'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle,
  Ban,
  Plus,
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  Percent,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { VENDOR_CATEGORIES } from '@/lib/validations/vendor'

// ── Types ─────────────────────────────────────────────────────────────────────

type VendorStatus = 'pending' | 'approved' | 'suspended' | 'rejected'

type CommissionRule = {
  id: string
  rule_type: 'base' | 'product' | 'category' | 'channel'
  target_id: string | null
  sales_channel: string | null
  commission_rate: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  note: string | null
  created_at: string
}

type VendorAccount = {
  id: string
  email: string
  role: 'owner' | 'staff'
  permissions: string[]
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

type VendorDetail = {
  id: string
  company_name: string
  brand_name: string
  vendor_type: 'permanent' | 'flash'
  contact_name: string
  contact_email: string
  contact_phone: string
  company_phone: string | null
  tax_id: string | null
  logo_url: string | null
  description: string | null
  website_url: string | null
  category: string | null
  default_commission_rate: number
  status: VendorStatus
  notes: string | null
  created_at: string
  approved_at: string | null
  rejection_reason: string | null
  product_count: number
  order_count: number
  monthly_revenue: number
  monthly_order_count: number
  commission_rules: CommissionRule[]
  vendor_accounts: VendorAccount[]
}

type AdminProduct = {
  id: string
  name: string
  base_price: number
  images: string[]
  is_active: boolean
  status: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const PRODUCT_STATUS_STYLES: Record<
  string,
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

const RULE_TYPE_LABELS: Record<string, string> = {
  base: '預設',
  product: '商品',
  category: '類別',
  channel: '管道',
  vendor_default: '廠商預設',
  event: '活動',
}

const CHANNEL_LABELS: Record<string, string> = {
  online_daily: '網路日常',
  online_campaign: '網路活動',
  physical_event: '實體活動',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function categoryLabel(value: string | null) {
  return VENDOR_CATEGORIES.find((c) => c.value === value)?.label ?? value ?? '—'
}

// ── Commission dialog ─────────────────────────────────────────────────────────

type CommissionForm = {
  rule_type: CommissionRule['rule_type']
  target_id: string
  sales_channel: string
  commission_rate: string
  starts_at: string
  ends_at: string
  note: string
}

const EMPTY_COMMISSION: CommissionForm = {
  rule_type: 'product',
  target_id: '',
  sales_channel: '',
  commission_rate: '',
  starts_at: '',
  ends_at: '',
  note: '',
}

function CommissionDialog({
  vendorId,
  open,
  onClose,
  onSaved,
}: {
  vendorId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState(EMPTY_COMMISSION)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(EMPTY_COMMISSION)
  }, [open])

  function set<K extends keyof typeof EMPTY_COMMISSION>(
    k: K,
    v: (typeof EMPTY_COMMISSION)[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    const rate = parseFloat(form.commission_rate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast({ variant: 'destructive', title: '請輸入有效的抽成比例（0–100）' })
      return
    }
    if (form.rule_type === 'product' && !form.target_id.trim()) {
      toast({ variant: 'destructive', title: '商品規則需填寫商品 ID' })
      return
    }
    if (form.rule_type === 'channel' && !form.sales_channel.trim()) {
      toast({ variant: 'destructive', title: '管道規則需選擇銷售管道' })
      return
    }

    setSaving(true)
    try {
      const body = {
        rule_type: form.rule_type,
        target_id: form.target_id.trim() || null,
        sales_channel: form.sales_channel || null,
        commission_rate: rate / 100,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        note: form.note.trim() || null,
      }
      const res = await fetch(`/api/admin/vendors/${vendorId}/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '建立失敗' })
        return
      }
      toast({ title: '抽成規則已新增' })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增抽成規則</DialogTitle>
          <DialogDescription>
            特殊規則的優先級高於廠商預設抽成比例
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Rule type */}
          <div className="space-y-1.5">
            <Label>規則類型 *</Label>
            <Select
              value={form.rule_type}
              onValueChange={(v) =>
                set('rule_type', v as (typeof EMPTY_COMMISSION)['rule_type'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">預設（覆蓋廠商全局）</SelectItem>
                <SelectItem value="product">商品（指定單一商品）</SelectItem>
                <SelectItem value="category">類別</SelectItem>
                <SelectItem value="channel">管道</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target ID (for product rule) */}
          {form.rule_type === 'product' && (
            <div className="space-y-1.5">
              <Label>商品 ID *</Label>
              <Input
                placeholder="商品 UUID"
                value={form.target_id}
                onChange={(e) => set('target_id', e.target.value)}
              />
            </div>
          )}

          {/* Sales channel */}
          {form.rule_type === 'channel' && (
            <div className="space-y-1.5">
              <Label>銷售管道 *</Label>
              <Select
                value={form.sales_channel}
                onValueChange={(v) => set('sales_channel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇管道" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Commission rate */}
          <div className="space-y-1.5">
            <Label>抽成比例 (%) *</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="例：20"
                value={form.commission_rate}
                onChange={(e) => set('commission_rate', e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>生效開始</Label>
              <Input
                type="date"
                value={form.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>生效結束</Label>
              <Input
                type="date"
                value={form.ends_at}
                onChange={(e) => set('ends_at', e.target.value)}
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>備注</Label>
            <Input
              placeholder="說明此規則的用途（可選）"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            新增規則
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminVendorDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const vendorId = params.id

  const defaultTab = searchParams.get('tab') ?? 'info'

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Info tab form
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Products tab
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  // Commission dialog
  const [showCommission, setShowCommission] = useState(false)

  // Action states
  const [approving, setApproving] = useState(false)
  const [suspendDialog, setSuspendDialog] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspending, setSuspending] = useState(false)
  const [unsuspending, setUnsuspending] = useState(false)

  const loadVendor = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
        router.push('/admin/vendors')
        return
      }
      const v: VendorDetail = json.data.vendor
      setVendor(v)
      setNotes(v.notes ?? '')
    } finally {
      setLoading(false)
    }
  }, [vendorId, router, toast])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const res = await fetch(`/api/admin/products?vendor_id=${vendorId}`)
      const json = await res.json()
      if (res.ok) {
        setProducts(json.data?.products ?? json.data ?? [])
      }
    } finally {
      setProductsLoading(false)
    }
  }, [vendorId])

  useEffect(() => {
    void loadVendor()
  }, [loadVendor])

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({ title: '備注已儲存' })
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/approve`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '審核失敗' })
        return
      }
      toast({ title: json.data?.message ?? '廠商已審核通過' })
      void loadVendor()
    } finally {
      setApproving(false)
    }
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) return
    setSuspending(true)
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '停權失敗' })
        return
      }
      toast({ title: json.data?.message ?? '廠商已停權' })
      setSuspendDialog(false)
      setSuspendReason('')
      void loadVendor()
    } finally {
      setSuspending(false)
    }
  }

  async function handleUnsuspend() {
    setUnsuspending(true)
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/suspend`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '解除停權失敗' })
        return
      }
      toast({ title: json.data?.message ?? '廠商已恢復上線' })
      void loadVendor()
    } finally {
      setUnsuspending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!vendor) return null

  const statusInfo = STATUS_STYLES[vendor.status]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回廠商列表
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{vendor.brand_name}</h1>
            <Badge variant="outline" className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{vendor.company_name}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          {vendor.status === 'pending' && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-1.5 h-4 w-4" />
              )}
              審核通過
            </Button>
          )}
          {vendor.status === 'approved' && (
            <Button
              variant="destructive"
              onClick={() => {
                setSuspendDialog(true)
                setSuspendReason('')
              }}
            >
              <Ban className="mr-1.5 h-4 w-4" />
              停權
            </Button>
          )}
          {vendor.status === 'suspended' && (
            <Button
              variant="outline"
              onClick={handleUnsuspend}
              disabled={unsuspending}
            >
              {unsuspending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-4 w-4" />
              )}
              解除停權
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label="商品數"
          value={String(vendor.product_count)}
          color="blue"
        />
        <StatCard
          icon={ShoppingBag}
          label="累積訂單"
          value={String(vendor.order_count)}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          label="本月銷售"
          value={
            vendor.monthly_revenue > 0
              ? `NT$ ${vendor.monthly_revenue.toLocaleString()}`
              : '—'
          }
          color="green"
        />
        <StatCard
          icon={Users}
          label="本月訂單"
          value={String(vendor.monthly_order_count)}
          color="orange"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="info">廠商資料</TabsTrigger>
          <TabsTrigger
            value="products"
            onClick={() => {
              if (products.length === 0) void loadProducts()
            }}
          >
            商品列表
          </TabsTrigger>
          <TabsTrigger value="commissions">抽成設定</TabsTrigger>
          <TabsTrigger value="sales">銷售報表</TabsTrigger>
          <TabsTrigger value="accounts">帳號管理</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Info ── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Basic info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本資料</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="品牌名稱" value={vendor.brand_name} />
                <InfoRow label="公司名稱" value={vendor.company_name} />
                <InfoRow
                  label="廠商類型"
                  value={
                    vendor.vendor_type === 'permanent' ? '長期進駐' : '短期快閃'
                  }
                />
                <InfoRow label="類別" value={categoryLabel(vendor.category)} />
                <InfoRow label="統一編號" value={vendor.tax_id ?? '未填寫'} />
                {vendor.website_url && (
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0 text-muted-foreground">
                      官方網站
                    </span>
                    <a
                      href={vendor.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-blue-600 hover:underline"
                    >
                      {vendor.website_url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
                <InfoRow
                  label="加入時間"
                  value={formatDate(vendor.created_at)}
                />
                {vendor.approved_at && (
                  <InfoRow
                    label="審核時間"
                    value={formatDate(vendor.approved_at)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">聯絡資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="負責人" value={vendor.contact_name} />
                <InfoRow label="聯絡 Email" value={vendor.contact_email} />
                <InfoRow label="聯絡電話" value={vendor.contact_phone} />
                {vendor.company_phone && (
                  <InfoRow label="公司電話" value={vendor.company_phone} />
                )}
                <InfoRow
                  label="預設抽成"
                  value={`${vendor.default_commission_rate}%`}
                />
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {vendor.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">廠商簡介</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {vendor.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Admin notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin 備注</CardTitle>
              <CardDescription>此備注僅限後台管理人員可見</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={3}
                placeholder="記錄特殊協議、溝通紀錄、注意事項…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {notes.length}/1000
                </span>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  儲存備注
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Products ── */}
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                商品列表 ({vendor.product_count})
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadProducts()}
                disabled={productsLoading}
              >
                {productsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  '重新載入'
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {productsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="mb-2 h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">尚無商品</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left">
                      <th className="px-4 py-3 font-medium">商品名稱</th>
                      <th className="px-4 py-3 text-right font-medium">
                        基礎售價
                      </th>
                      <th className="px-4 py-3 font-medium">狀態</th>
                      <th className="px-4 py-3 font-medium">建立時間</th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p) => {
                      const ps =
                        PRODUCT_STATUS_STYLES[
                          p.status ?? (p.is_active ? 'approved' : 'draft')
                        ] ?? PRODUCT_STATUS_STYLES.draft
                      return (
                        <tr key={p.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {p.images?.[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt=""
                                  className="h-8 w-8 rounded object-cover"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-muted" />
                              )}
                              <span className="line-clamp-1 font-medium">
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            NT$ {p.base_price.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={ps.className}>
                              {ps.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(p.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/products/${p.id}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Commissions ── */}
        <TabsContent value="commissions" className="mt-4 space-y-4">
          {/* Default rate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">廠商預設抽成比例</CardTitle>
              <CardDescription>
                適用所有商品的基礎抽成，特殊規則會覆蓋此設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-muted-foreground" />
                  <span className="text-3xl font-bold">
                    {vendor.default_commission_rate}
                  </span>
                  <span className="text-lg text-muted-foreground">%</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const val = prompt(
                      '輸入新的預設抽成比例（%）',
                      String(vendor.default_commission_rate),
                    )
                    if (val === null) return
                    const rate = parseFloat(val)
                    if (isNaN(rate) || rate < 0 || rate > 100) {
                      toast({
                        variant: 'destructive',
                        title: '請輸入 0–100 之間的數值',
                      })
                      return
                    }
                    fetch(`/api/admin/vendors/${vendorId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ default_commission_rate: rate }),
                    })
                      .then((r) => r.json())
                      .then((j) => {
                        if (j.data) {
                          toast({ title: '預設抽成已更新' })
                          void loadVendor()
                        } else {
                          toast({
                            variant: 'destructive',
                            title: j.message ?? '更新失敗',
                          })
                        }
                      })
                      .catch(() =>
                        toast({ variant: 'destructive', title: '更新失敗' }),
                      )
                  }}
                >
                  修改
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Special rules */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">特殊抽成規則</CardTitle>
                <CardDescription className="mt-1">
                  針對特定商品、管道或活動設定差異化抽成
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowCommission(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                新增規則
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {vendor.commission_rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Percent className="mb-2 h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">尚無特殊規則</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left">
                      <th className="px-4 py-3 font-medium">類型</th>
                      <th className="px-4 py-3 font-medium">目標</th>
                      <th className="px-4 py-3 text-right font-medium">抽成</th>
                      <th className="px-4 py-3 font-medium">生效期間</th>
                      <th className="px-4 py-3 font-medium">狀態</th>
                      <th className="px-4 py-3 font-medium">備注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendor.commission_rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 font-medium">
                          {RULE_TYPE_LABELS[rule.rule_type] ?? rule.rule_type}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {rule.target_id
                            ? rule.target_id.slice(0, 8) + '…'
                            : rule.sales_channel
                              ? (CHANNEL_LABELS[rule.sales_channel] ??
                                rule.sales_channel)
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {(rule.commission_rate * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {rule.starts_at || rule.ends_at
                            ? `${formatDate(rule.starts_at)} – ${formatDate(rule.ends_at)}`
                            : '長期有效'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={rule.is_active ? 'outline' : 'secondary'}
                            className={
                              rule.is_active
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : ''
                            }
                          >
                            {rule.is_active ? '生效中' : '停用'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {rule.note ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Sales ── */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <ShoppingBag className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {vendor.monthly_order_count}
                  </p>
                  <p className="text-sm text-muted-foreground">本月訂單數</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {vendor.monthly_revenue > 0
                      ? `NT$ ${vendor.monthly_revenue.toLocaleString()}`
                      : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">本月銷售額</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                  <Percent className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {vendor.monthly_revenue > 0
                      ? `NT$ ${Math.round((vendor.monthly_revenue * vendor.default_commission_rate) / 100).toLocaleString()}`
                      : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">預估抽成收入</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settlement */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">月結記錄</CardTitle>
                <CardDescription className="mt-1">
                  歷史對帳單記錄
                </CardDescription>
              </div>
              <Button size="sm" variant="outline">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                產生本月對帳單
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-muted-foreground">尚無月結記錄</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 5: Accounts ── */}
        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">廠商帳號管理</CardTitle>
              <CardDescription>廠商員工帳號列表，可停用帳號</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {vendor.vendor_accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="mb-2 h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">尚無帳號</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">角色</th>
                      <th className="px-4 py-3 font-medium">權限</th>
                      <th className="px-4 py-3 font-medium">最後登入</th>
                      <th className="px-4 py-3 font-medium">狀態</th>
                      <th className="w-16 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vendor.vendor_accounts.map((acc) => (
                      <AccountRow
                        key={acc.id}
                        account={acc}
                        onToggle={async (active) => {
                          // Update via admin API — no dedicated endpoint, use a simple fetch
                          const res = await fetch(
                            `/api/admin/vendors/${vendorId}`,
                            {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                _account_toggle: {
                                  id: acc.id,
                                  is_active: active,
                                },
                              }),
                            },
                          )
                          if (res.ok) {
                            toast({
                              title: active ? '帳號已啟用' : '帳號已停用',
                            })
                            void loadVendor()
                          }
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Commission dialog */}
      <CommissionDialog
        vendorId={vendorId}
        open={showCommission}
        onClose={() => setShowCommission(false)}
        onSaved={() => void loadVendor()}
      />

      {/* Suspend dialog */}
      <Dialog
        open={suspendDialog}
        onOpenChange={(open: boolean) => !open && setSuspendDialog(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>停權廠商</DialogTitle>
            <DialogDescription>
              停權後廠商所有商品將自動下架，廠商帳號無法登入後台。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <span>
                停權將立即生效，所有 {vendor.product_count} 件商品會同步下架。
              </span>
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
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialog(false)}
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: 'blue' | 'purple' | 'green' | 'orange'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pb-4 pt-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountRow({
  account,
  onToggle,
}: {
  account: VendorAccount
  onToggle: (active: boolean) => Promise<void>
}) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle(v: boolean) {
    setToggling(true)
    try {
      await onToggle(v)
    } finally {
      setToggling(false)
    }
  }

  return (
    <tr className="hover:bg-muted/10">
      <td className="px-4 py-3">{account.email}</td>
      <td className="px-4 py-3">
        <Badge variant={account.role === 'owner' ? 'default' : 'secondary'}>
          {account.role === 'owner' ? '負責人' : '員工'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {(account.permissions as string[]).join('、') || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {account.last_login_at ? formatDate(account.last_login_at) : '從未登入'}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={account.is_active ? 'outline' : 'secondary'}
          className={
            account.is_active
              ? 'border-green-200 bg-green-50 text-green-700'
              : ''
          }
        >
          {account.is_active ? '啟用中' : '已停用'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {account.role !== 'owner' && (
          <Switch
            checked={account.is_active}
            disabled={toggling}
            onCheckedChange={(v) => void handleToggle(v)}
          />
        )}
      </td>
    </tr>
  )
}
