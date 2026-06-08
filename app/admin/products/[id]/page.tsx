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
  ImageIcon,
  GripVertical,
  Save,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
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
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Variant = {
  id: string
  name: string
  sku: string
  price: number | null
  stock: number
  low_stock_threshold: number
  is_active: boolean
  sort_order: number
  is_preorder: boolean
  preorder_note: string | null
}

type Product = {
  id: string
  name: string
  description: string | null
  base_price: number
  images: string[]
  is_active: boolean
  sort_order: number
  product_variants: Variant[]
}

const EMPTY_VARIANT_FORM = {
  name: '',
  sku: '',
  price: '',
  stock: '0',
  low_stock_threshold: '5',
  is_active: true,
  sort_order: '0',
  is_preorder: false,
  preorder_note: '',
}

// ── Image manager ─────────────────────────────────────────────────────────────

function ProductImageManager({
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
    if (images.length >= 10) {
      toast({ variant: 'destructive', title: '最多 10 張圖片' })
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
      onChange([...images, `${data.publicUrl}?t=${Date.now()}`])
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

  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
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
              onClick={() => remove(idx)}
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

        {images.length < 10 && (
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
        }}
      />
    </div>
  )
}

// ── Variant form dialog ────────────────────────────────────────────────────────

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
  const [form, setForm] = useState(EMPTY_VARIANT_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        sku: initial.sku,
        price: initial.price != null ? String(initial.price) : '',
        stock: String(initial.stock),
        low_stock_threshold: String(initial.low_stock_threshold),
        is_active: initial.is_active,
        sort_order: String(initial.sort_order),
        is_preorder: initial.is_preorder,
        preorder_note: initial.preorder_note ?? '',
      })
    } else {
      setForm(EMPTY_VARIANT_FORM)
    }
  }, [open, initial])

  function set(k: keyof typeof EMPTY_VARIANT_FORM, v: string | boolean) {
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
    const thresh = parseInt(form.low_stock_threshold)
    const price = form.price.trim() === '' ? null : parseInt(form.price)
    const sortOrd = parseInt(form.sort_order)
    if (isNaN(stock) || stock < 0) {
      toast({ variant: 'destructive', title: '庫存請輸入有效數字' })
      return
    }

    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        price,
        stock,
        low_stock_threshold: isNaN(thresh) ? 5 : thresh,
        is_active: form.is_active,
        sort_order: isNaN(sortOrd) ? 0 : sortOrd,
        is_preorder: form.is_preorder,
        preorder_note:
          form.is_preorder && form.preorder_note.trim()
            ? form.preorder_note.trim()
            : null,
      }
      const url = initial
        ? `/api/admin/products/${productId}/variants/${initial.id}`
        : `/api/admin/products/${productId}/variants`
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
      toast({ title: initial ? '規格已更新' : '規格已建立' })
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
          {/* name + sku */}
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
                placeholder="例：NFC-CARD-STD"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* price + stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                特價 (NT$)
                <span className="ml-1 text-xs text-muted-foreground">
                  留空則用基礎售價
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

          {/* low stock threshold + sort_order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>低庫存警示值</Label>
              <Input
                type="number"
                min={0}
                value={form.low_stock_threshold}
                onChange={(e) => set('low_stock_threshold', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>排序</Label>
              <Input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => set('sort_order', e.target.value)}
              />
            </div>
          </div>

          {/* is_active */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">上架販售</p>
              <p className="text-xs text-muted-foreground">
                關閉後此規格不顯示於前台
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => set('is_active', v)}
            />
          </div>

          {/* is_preorder */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">開放預購</p>
              <p className="text-xs text-muted-foreground">
                開啟後即使庫存為 0 也可加入購物車
              </p>
            </div>
            <Switch
              checked={form.is_preorder}
              onCheckedChange={(v) => set('is_preorder', v)}
            />
          </div>

          {/* preorder_note */}
          {form.is_preorder && (
            <div className="space-y-1.5">
              <Label>預購說明</Label>
              <Input
                placeholder="例：預計 2-3 週出貨，下單後不可取消"
                value={form.preorder_note}
                onChange={(e) => set('preorder_note', e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                顯示於商品頁，讓買家了解預計出貨時間
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {initial ? '儲存變更' : '建立規格'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete confirm dialog ──────────────────────────────────────────────────────

function DeleteDialog({
  open,
  title,
  description,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            確認刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  // Basic info form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingImgs, setSavingImgs] = useState(false)

  // Variant dialogs
  const [variantDialog, setVariantDialog] = useState<{
    open: boolean
    target: Variant | null
  }>({ open: false, target: null })
  const [deleteVariant, setDeleteVariant] = useState<Variant | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Delete product
  const [deleteProduct, setDeleteProduct] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/products/${params.id}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
        return
      }
      const p = json.data.product as Product
      setProduct(p)
      setName(p.name)
      setDescription(p.description ?? '')
      setBasePrice(String(p.base_price))
      setSortOrder(String(p.sort_order))
      setIsActive(p.is_active)
      setImages(Array.isArray(p.images) ? p.images : [])
    } finally {
      setLoading(false)
    }
  }, [params.id, toast])

  useEffect(() => {
    void load()
  }, [load])

  // ── Save basic info ────────────────────────────────────────────────────────

  async function handleSaveInfo() {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '請輸入商品名稱' })
      return
    }
    const price = parseInt(basePrice)
    if (isNaN(price) || price < 0) {
      toast({ variant: 'destructive', title: '請輸入有效售價' })
      return
    }
    setSavingInfo(true)
    try {
      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          base_price: price,
          sort_order: parseInt(sortOrder) || 0,
          is_active: isActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({ title: '基本資料已儲存' })
      void load()
    } finally {
      setSavingInfo(false)
    }
  }

  // ── Save images ────────────────────────────────────────────────────────────

  async function handleSaveImages() {
    setSavingImgs(true)
    try {
      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({ title: '圖片已儲存' })
    } finally {
      setSavingImgs(false)
    }
  }

  // ── Delete variant ─────────────────────────────────────────────────────────

  async function handleDeleteVariant() {
    if (!deleteVariant) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/admin/products/${params.id}/variants/${deleteVariant.id}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
        return
      }
      toast({ title: '規格已刪除' })
      setDeleteVariant(null)
      void load()
    } finally {
      setDeleting(false)
    }
  }

  // ── Delete product ─────────────────────────────────────────────────────────

  async function handleDeleteProduct() {
    setDeletingProduct(true)
    try {
      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
        return
      }
      toast({ title: '商品已下架刪除' })
      router.push('/admin/products')
    } finally {
      setDeletingProduct(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6 text-center text-muted-foreground">找不到此商品</div>
    )
  }

  const variants = product.product_variants ?? []
  const hasLowStock = variants.some(
    (v) => v.is_active && v.stock <= v.low_stock_threshold,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回商品列表
          </Link>
          <h1 className="text-xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={product.is_active ? 'default' : 'secondary'}>
              {product.is_active ? '上架中' : '已下架'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              ID: {product.id.slice(0, 8)}…
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={() => setDeleteProduct(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          刪除商品
        </Button>
      </div>

      {hasLowStock && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          有規格庫存偏低，請注意補貨
        </div>
      )}

      {/* ── 基本資料 ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
          <CardDescription>商品名稱、描述、售價與上下架狀態</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">商品名稱 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">商品描述</Label>
            <Textarea
              id="desc"
              rows={4}
              placeholder="商品說明、特色、使用方式…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length} / 5000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">基礎售價 (NT$) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                各規格無特價時使用此售價
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sort">排序值</Label>
              <Input
                id="sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">數字越小排越前面</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">上架販售</p>
              <p className="text-xs text-muted-foreground">
                關閉後商品不顯示於前台商城
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveInfo} disabled={savingInfo}>
              {savingInfo ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              儲存基本資料
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 商品圖片 ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品圖片</CardTitle>
          <CardDescription>
            最多 10 張，第一張為封面。圖片上傳後需點「儲存圖片」才會生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProductImageManager
            productId={product.id}
            images={images}
            onChange={setImages}
          />
          <div className="flex justify-end">
            <Button onClick={handleSaveImages} disabled={savingImgs}>
              {savingImgs ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
              )}
              儲存圖片
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 規格管理 ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">規格管理</CardTitle>
              <CardDescription className="mt-0.5">
                每個規格代表一個 SKU，可設定獨立特價與庫存
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setVariantDialog({ open: true, target: null })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新增規格
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              尚無規格，請點「新增規格」建立第一個 SKU
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">規格名稱</th>
                    <th className="pb-2 text-left font-medium">SKU</th>
                    <th className="pb-2 text-right font-medium">售價</th>
                    <th className="pb-2 text-right font-medium">庫存</th>
                    <th className="pb-2 text-center font-medium">狀態</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {variants
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((v) => {
                      const displayPrice = v.price ?? product.base_price
                      const onSale =
                        v.price !== null && v.price < product.base_price
                      const lowStock =
                        v.is_active && v.stock <= v.low_stock_threshold
                      return (
                        <tr key={v.id} className="group">
                          <td className="py-3 pr-4">
                            <p className="font-medium">{v.name}</p>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                            {v.sku}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <span
                              className={
                                onSale ? 'font-semibold text-rose-600' : ''
                              }
                            >
                              NT$ {displayPrice.toLocaleString()}
                            </span>
                            {onSale && (
                              <p className="text-xs text-muted-foreground line-through">
                                NT$ {product.base_price.toLocaleString()}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <span
                              className={
                                lowStock ? 'font-semibold text-orange-600' : ''
                              }
                            >
                              {v.stock}
                            </span>
                            {lowStock && (
                              <p className="text-xs text-orange-500">低庫存</p>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <Badge
                              variant={v.is_active ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {v.is_active ? '上架' : '停售'}
                            </Badge>
                          </td>
                          <td className="py-3 pl-4">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setVariantDialog({ open: true, target: v })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteVariant(v)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}

      <VariantDialog
        productId={product.id}
        basePriceFallback={product.base_price}
        initial={variantDialog.target}
        open={variantDialog.open}
        onClose={() => setVariantDialog({ open: false, target: null })}
        onSaved={() => void load()}
      />

      <DeleteDialog
        open={!!deleteVariant}
        title="刪除規格"
        description={`確定要刪除「${deleteVariant?.name}」（SKU: ${deleteVariant?.sku}）？此操作無法復原。`}
        onConfirm={handleDeleteVariant}
        onClose={() => setDeleteVariant(null)}
        loading={deleting}
      />

      <DeleteDialog
        open={deleteProduct}
        title="刪除商品"
        description={`確定要刪除「${product.name}」？商品將會下架並從系統移除，此操作無法復原。`}
        onConfirm={handleDeleteProduct}
        onClose={() => setDeleteProduct(false)}
        loading={deletingProduct}
      />
    </div>
  )
}
