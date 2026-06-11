'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  UploadCloud,
  Save,
  Send,
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { createClient } from '@/lib/supabase/client'
import { VENDOR_CATEGORIES } from '@/lib/validations/vendor'

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductStatus = 'draft' | 'pending' | 'approved' | 'rejected'

type Variant = {
  id: string
  name: string
  sku: string
  price: number | null
  stock: number
  is_active: boolean
  sort_order: number
}

type Product = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[]
  status: ProductStatus
  category: string | null
  created_at: string
  updated_at: string
  product_variants: Variant[]
  meta?: { rejection?: { reason?: string } } | null
}

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

const EMPTY_VARIANT = {
  name: '',
  sku: '',
  price: '',
  stock: '0',
  is_active: true,
  sort_order: '0',
}

// ── Image manager ─────────────────────────────────────────────────────────────

function ImageManager({
  productId,
  images,
  onChange,
}: {
  productId: string
  images: string[]
  onChange: (imgs: string[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ variant: 'destructive', title: '僅支援 JPG、PNG、WebP' })
      return
    }
    if (images.length >= 6) {
      toast({ variant: 'destructive', title: '最多 6 張圖片' })
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `products/${productId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      onChange([...images, data.publicUrl])
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '上傳失敗',
        description: e instanceof Error ? e.message : '請稍後再試',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((url, idx) => (
          <div
            key={idx}
            className="group relative h-24 w-24 overflow-hidden rounded-xl border bg-muted"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== idx))}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">
                封面
              </span>
            )}
          </div>
        ))}

        {images.length < 6 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
            <span className="text-[11px]">
              {uploading ? '上傳中' : '新增圖片'}
            </span>
          </button>
        )}
      </div>
      {images.length === 0 && (
        <p className="text-xs text-muted-foreground">
          尚未上傳圖片，第一張將作為封面
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Variant dialog ─────────────────────────────────────────────────────────────

function VariantDialog({
  productId,
  basePriceFallback,
  initial,
  open,
  onClose,
  onSaved,
}: {
  productId: string
  basePriceFallback: number
  initial: Variant | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState(EMPTY_VARIANT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        sku: initial.sku,
        price: initial.price != null ? String(initial.price) : '',
        stock: String(initial.stock),
        is_active: initial.is_active,
        sort_order: String(initial.sort_order),
      })
    } else {
      setForm(EMPTY_VARIANT)
    }
  }, [open, initial])

  function set<K extends keyof typeof EMPTY_VARIANT>(
    k: K,
    v: (typeof EMPTY_VARIANT)[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: '請輸入規格名稱' })
      return
    }
    if (!form.sku.trim()) {
      toast({ variant: 'destructive', title: '請輸入 SKU' })
      return
    }
    const stock = parseInt(form.stock)
    if (isNaN(stock) || stock < 0) {
      toast({ variant: 'destructive', title: '庫存請輸入有效數字' })
      return
    }
    const price = form.price.trim() === '' ? null : parseInt(form.price)
    const sort = parseInt(form.sort_order) || 0

    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        price,
        stock,
        is_active: form.is_active,
        sort_order: sort,
      }
      const url = initial
        ? `/api/vendor/products/${productId}/variants/${initial.id}`
        : `/api/vendor/products/${productId}/variants`
      const method = initial ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({ title: initial ? '規格已更新' : '規格已新增' })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isOnSale =
    form.price.trim() !== '' &&
    !isNaN(parseInt(form.price)) &&
    parseInt(form.price) < basePriceFallback

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '編輯規格' : '新增規格'}</DialogTitle>
          <DialogDescription>
            商品基礎售價 NT$ {basePriceFallback.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>規格名稱 *</Label>
              <Input
                placeholder="例：標準版、L / 黑色"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input
                placeholder="例：PROD-L-BLK"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                特價 (NT$)
                <span className="ml-1 text-xs text-muted-foreground">
                  留空用基礎售價
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="留空"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
              {isOnSale && (
                <p className="text-xs text-rose-600">
                  特惠價 NT$ {parseInt(form.price).toLocaleString()}（省 NT${' '}
                  {(basePriceFallback - parseInt(form.price)).toLocaleString()}
                  ）
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>庫存數量 *</Label>
              <Input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">啟用販售</p>
              <p className="text-xs text-muted-foreground">
                關閉後此規格不顯示於前台
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => set('is_active', v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {initial ? '儲存變更' : '新增規格'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorProductDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const productId = params.id

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  // Basic info form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)
  const [dirty, setDirty] = useState(false)

  // Variant state
  const [variantDialog, setVariantDialog] = useState<{
    open: boolean
    initial: Variant | null
  }>({ open: false, initial: null })
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [deletingVariant, setDeletingVariant] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor/products/${productId}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
        router.push('/vendor/products')
        return
      }
      const p: Product = json.data.product
      setProduct(p)
      setName(p.name)
      setDescription(p.description ?? '')
      setCategory(p.category ?? '')
      setBasePrice(String(p.base_price))
      setImages(p.images ?? [])
      setDirty(false)
    } finally {
      setLoading(false)
    }
  }, [productId, router, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(mode: 'draft' | 'submit') {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '請輸入商品名稱' })
      return
    }
    const price = parseInt(basePrice)
    if (isNaN(price) || price < 0) {
      toast({ variant: 'destructive', title: '請輸入有效售價' })
      return
    }

    setSaving(mode)
    try {
      const res = await fetch(`/api/vendor/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          base_price: price,
          images,
          submit: mode === 'submit',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({
        title: mode === 'submit' ? '已送出審核' : '草稿已儲存',
        description: mode === 'submit' ? '審核通過後將自動上架' : undefined,
      })
      void load()
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteVariant() {
    if (!deleteVariantId) return
    setDeletingVariant(true)
    try {
      const res = await fetch(
        `/api/vendor/products/${productId}/variants/${deleteVariantId}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
        return
      }
      toast({ title: '規格已刪除' })
      setDeleteVariantId(null)
      void load()
    } finally {
      setDeletingVariant(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) return null

  const isEditable = product.status === 'draft' || product.status === 'rejected'
  const isReadonly = !isEditable
  const statusInfo = STATUS_STYLES[product.status]
  const rejectionReason = product.meta?.rejection?.reason
  const isBusy = saving !== null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/vendor/products"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回商品列表
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{product.name}</h1>
            <Badge variant="outline" className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Rejection notice */}
      {product.status === 'rejected' && rejectionReason && (
        <div className="flex gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <div>
            <p className="font-medium">審核未通過</p>
            <p className="mt-0.5 text-orange-700">{rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">基本資料</TabsTrigger>
          <TabsTrigger value="variants">
            規格 SKU
            {product.product_variants.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {product.product_variants.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales">銷售數據</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Basic info ── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          {isReadonly && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {product.status === 'pending'
                ? '商品審核中，暫不可修改。'
                : '商品已上架，如需修改請聯繫平台客服。'}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">商品資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">商品名稱 *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setDirty(true)
                  }}
                  disabled={isReadonly}
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc">商品描述</Label>
                <Textarea
                  id="desc"
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    setDirty(true)
                  }}
                  disabled={isReadonly}
                  maxLength={5000}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>商品類別</Label>
                  {isReadonly ? (
                    <Input
                      value={
                        VENDOR_CATEGORIES.find((c) => c.value === category)
                          ?.label ??
                        category ??
                        '未設定'
                      }
                      disabled
                    />
                  ) : (
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v)
                        setDirty(true)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇類別" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price">基礎售價 (NT$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={basePrice}
                    onChange={(e) => {
                      setBasePrice(e.target.value)
                      setDirty(true)
                    }}
                    disabled={isReadonly}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">商品圖片</CardTitle>
              <CardDescription>最多 6 張，第一張為封面圖</CardDescription>
            </CardHeader>
            <CardContent>
              {isReadonly ? (
                images.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {images.map((url, i) => (
                      <div
                        key={i}
                        className="relative h-24 w-24 overflow-hidden rounded-xl border bg-muted"
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] text-white">
                            封面
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">尚無圖片</p>
                )
              ) : (
                <ImageManager
                  productId={productId}
                  images={images}
                  onChange={(imgs) => {
                    setImages(imgs)
                    setDirty(true)
                  }}
                />
              )}
            </CardContent>
          </Card>

          {isEditable && (
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave('draft')}
                disabled={isBusy || !dirty}
              >
                {saving === 'draft' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                儲存草稿
              </Button>
              <Button onClick={() => handleSave('submit')} disabled={isBusy}>
                {saving === 'submit' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                送出審核
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Variants ── */}
        <TabsContent value="variants" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">規格（SKU）管理</h2>
              <p className="text-sm text-muted-foreground">
                為同一商品設定不同規格（尺寸、顏色等）
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setVariantDialog({ open: true, initial: null })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新增規格
            </Button>
          </div>

          {product.product_variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">尚未新增任何規格</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setVariantDialog({ open: true, initial: null })}
              >
                新增第一個規格
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-4 py-3 font-medium">規格名稱</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 text-right font-medium">售價</th>
                    <th className="px-4 py-3 text-right font-medium">庫存</th>
                    <th className="px-4 py-3 font-medium">狀態</th>
                    <th className="w-24 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.product_variants.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {v.sku}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.price != null
                          ? `NT$ ${v.price.toLocaleString()}`
                          : `NT$ ${product.base_price.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            v.stock === 0
                              ? 'font-medium text-red-600'
                              : v.stock <= 5
                                ? 'font-medium text-orange-600'
                                : ''
                          }
                        >
                          {v.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={v.is_active ? 'outline' : 'secondary'}
                          className={
                            v.is_active
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : ''
                          }
                        >
                          {v.is_active ? '啟用' : '停用'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() =>
                              setVariantDialog({ open: true, initial: v })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteVariantId(v.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: Sales ── */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">近 30 日銷售概覽</h2>
              <p className="text-sm text-muted-foreground">
                {product.status !== 'approved'
                  ? '商品上架後才會開始累積銷售數據'
                  : '以下為近 30 天的銷售摘要'}
              </p>
            </div>
          </div>

          {product.status !== 'approved' ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
              <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                商品上架後即可查看銷售數據
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <ShoppingBag className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-sm text-muted-foreground">
                      近 30 日銷售量
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">—</p>
                    <p className="text-sm text-muted-foreground">
                      近 30 日收入
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendor/reports">
                查看完整報表
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Variant dialog */}
      <VariantDialog
        productId={productId}
        basePriceFallback={product.base_price}
        initial={variantDialog.initial}
        open={variantDialog.open}
        onClose={() => setVariantDialog({ open: false, initial: null })}
        onSaved={() => void load()}
      />

      {/* Delete variant confirm */}
      <Dialog
        open={!!deleteVariantId}
        onOpenChange={(open: boolean) => !open && setDeleteVariantId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確定要刪除此規格？</DialogTitle>
            <DialogDescription>
              規格刪除後將停止販售，此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteVariantId(null)}
              disabled={deletingVariant}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVariant}
              disabled={deletingVariant}
            >
              {deletingVariant && (
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
