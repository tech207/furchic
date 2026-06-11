'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Send,
  Save,
  UploadCloud,
  X,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { VENDOR_CATEGORIES } from '@/lib/validations/vendor'

// ── Types ─────────────────────────────────────────────────────────────────────

type ImageEntry = { file: File; preview: string }

// ── Image picker ──────────────────────────────────────────────────────────────

function ImagePicker({
  images,
  onChange,
}: {
  images: ImageEntry[]
  onChange: (imgs: ImageEntry[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function handleFiles(files: FileList) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) {
        toast({ variant: 'destructive', title: '僅支援 JPG、PNG、WebP' })
        return
      }
      if (images.length >= 6) {
        toast({ variant: 'destructive', title: '最多上傳 6 張圖片' })
        return
      }
      const preview = URL.createObjectURL(file)
      onChange([...images, { file, preview }])
    }
  }

  function remove(idx: number) {
    const next = images.filter((_, i) => i !== idx)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="group relative h-24 w-24 overflow-hidden rounded-xl border bg-muted"
          >
            <img
              src={img.preview}
              alt=""
              className="h-full w-full object-cover"
            />
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

        {images.length < 6 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <UploadCloud className="h-5 w-5" />
            <span className="text-[11px]">新增圖片</span>
          </button>
        )}
      </div>

      {images.length === 0 && (
        <p className="text-xs text-muted-foreground">
          第一張圖片將作為商品封面，最多 6 張
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorNewProductPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [images, setImages] = useState<ImageEntry[]>([])
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null)

  async function uploadImages(productId: string): Promise<string[]> {
    const supabase = createClient()
    const urls: string[] = []

    for (const entry of images) {
      const ext = entry.file.name.split('.').pop() ?? 'jpg'
      const path = `products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, entry.file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      urls.push(data.publicUrl)
    }

    return urls
  }

  async function handleCreate(mode: 'draft' | 'submit') {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '請輸入商品名稱' })
      return
    }
    const price = parseInt(basePrice)
    if (isNaN(price) || price < 0) {
      toast({ variant: 'destructive', title: '請輸入有效售價（需大於等於 0）' })
      return
    }

    setSaving(mode)
    try {
      // Step 1: create product (without images first to get ID)
      const res = await fetch('/api/vendor/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          base_price: price,
          images: [],
          status: mode === 'draft' ? 'draft' : 'pending',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '建立失敗' })
        return
      }

      const productId = (json.data.product as { id: string }).id

      // Step 2: upload images and update product
      if (images.length > 0) {
        try {
          const imageUrls = await uploadImages(productId)
          await fetch(`/api/vendor/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: imageUrls, submit: false }),
          })
        } catch {
          toast({
            variant: 'destructive',
            title: '圖片上傳失敗',
            description: '商品已建立，請在編輯頁重新上傳圖片',
          })
        }
      }

      toast({
        title: mode === 'draft' ? '草稿已儲存' : '商品已送出審核',
        description: mode === 'submit' ? '審核通過後將自動上架' : undefined,
      })
      router.push(`/vendor/products/${productId}`)
    } finally {
      setSaving(null)
    }
  }

  const isBusy = saving !== null

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/vendor/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回商品列表
        </Link>
        <h1 className="text-xl font-bold">新增商品</h1>
        <p className="text-sm text-muted-foreground">
          送出後進入審核流程，審核通過即自動上架
        </p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
          <CardDescription>商品名稱與定價為必填欄位</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">商品名稱 *</Label>
            <Input
              id="name"
              placeholder="例：天然有機犬用零食禮盒"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category">商品類別</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price">基礎售價 (NT$) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                placeholder="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                規格無特價時顯示此售價
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品圖片</CardTitle>
          <CardDescription>最多 6 張，第一張為封面圖</CardDescription>
        </CardHeader>
        <CardContent>
          <ImagePicker images={images} onChange={setImages} />
        </CardContent>
      </Card>

      {/* SKU hint */}
      <div className="flex gap-2 rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          商品建立後可在編輯頁面新增規格（SKU），包含尺寸、顏色等變體與對應庫存。
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/vendor/products')}
          disabled={isBusy}
        >
          取消
        </Button>
        <Button
          variant="outline"
          onClick={() => handleCreate('draft')}
          disabled={isBusy}
        >
          {saving === 'draft' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          儲存草稿
        </Button>
        <Button onClick={() => handleCreate('submit')} disabled={isBusy}>
          {saving === 'submit' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          送出審核
        </Button>
      </div>
    </div>
  )
}
