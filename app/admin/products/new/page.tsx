'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

export default function NewProductPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: '請輸入商品名稱' })
      return
    }
    const price = parseInt(basePrice)
    if (isNaN(price) || price < 0) {
      toast({ variant: 'destructive', title: '請輸入有效售價' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          base_price: price,
          sort_order: parseInt(sortOrder) || 0,
          is_active: isActive,
          images: [],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '建立失敗' })
        return
      }
      const newId = (json.data.product as { id: string }).id
      toast({ title: '商品已建立，請繼續完善圖片與規格' })
      router.push(`/admin/products/${newId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回商品列表
        </Link>
        <h1 className="text-xl font-bold">新增商品</h1>
        <p className="text-sm text-muted-foreground">
          建立後可繼續新增圖片與規格（SKU）
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
          <CardDescription>建立後可在編輯頁繼續完善圖片與規格</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">商品名稱 *</Label>
            <Input
              id="name"
              placeholder="例：Furchic NFC 寵物名片卡"
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
              placeholder="商品說明、特色、使用方式…（建立後可再補充）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">基礎售價 (NT$) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                placeholder="590"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                規格無特價時使用此售價
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
              <p className="text-sm font-medium">立即上架</p>
              <p className="text-xs text-muted-foreground">
                可建立後再於編輯頁修改
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/admin/products')}
          disabled={saving}
        >
          取消
        </Button>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          建立商品
        </Button>
      </div>
    </div>
  )
}
