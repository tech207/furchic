'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Handshake,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Globe,
  Star,
  StarOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUploader } from '@/components/common/ImageUploader'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { Partner, PartnerCategory } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PartnerCategory, string> = {
  brand: '品牌聯名',
  store: '通路合作',
  enterprise: '動物醫院・寵物店',
}

const CATEGORY_COLORS: Record<PartnerCategory, string> = {
  brand: 'bg-purple-100 text-purple-700',
  store: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-green-100 text-green-700',
}

// ── Form Dialog ───────────────────────────────────────────────────────────────

type FormState = {
  name: string
  description: string
  logo_url: string
  website_url: string
  category: PartnerCategory
  is_marquee: boolean
  is_active: boolean
}

const INIT: FormState = {
  name: '',
  description: '',
  logo_url: '',
  website_url: '',
  category: 'brand',
  is_marquee: true,
  is_active: true,
}

function PartnerDialog({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(partner)
  const logoPath = partner?.id ? `partners/${partner.id}` : `partners/new`
  const [form, setForm] = useState<FormState>(
    partner
      ? {
          name: partner.name,
          description: partner.description ?? '',
          logo_url: partner.logo_url ?? '',
          website_url: partner.website_url ?? '',
          category: partner.category,
          is_marquee: partner.is_marquee,
          is_active: partner.is_active,
        }
      : INIT,
  )
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: '請填寫合作夥伴名稱', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        logo_url: form.logo_url || null,
        website_url: form.website_url || null,
        category: form.category,
        is_marquee: form.is_marquee,
        is_active: form.is_active,
      }
      const url = isEdit
        ? `/api/admin/partners/${partner!.id}`
        : '/api/admin/partners'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = (await res.json()) as { message?: string }
        throw new Error(j.message ?? '操作失敗')
      }
      toast({ title: isEdit ? '已更新' : '已新增' })
      onSaved()
      onClose()
    } catch (e) {
      toast({ title: String((e as Error).message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯合作夥伴' : '新增合作夥伴'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>
              名稱 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="合作夥伴名稱"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>分類</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set('category', v as PartnerCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as PartnerCategory[]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>描述（選填）</Label>
            <Input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="簡短介紹"
            />
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <Label>Logo 圖片</Label>
            <ImageUploader
              bucketName="partners"
              filePath={logoPath}
              onUpload={(url) => set('logo_url', url)}
              currentImageUrl={form.logo_url || undefined}
            />
            <p className="text-xs text-muted-foreground">
              建議 PNG 透明背景，200×80 px
            </p>
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <Label>官網連結（選填）</Label>
            <Input
              value={form.website_url}
              onChange={(e) => set('website_url', e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">首頁跑馬燈</p>
                <p className="text-xs text-muted-foreground">
                  在首頁合作品牌區輪播顯示
                </p>
              </div>
              <Switch
                checked={form.is_marquee}
                onCheckedChange={(v) => set('is_marquee', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">啟用</p>
                <p className="text-xs text-muted-foreground">
                  關閉後不顯示在前台
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => set('is_active', v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? '儲存' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<Partner | null | 'new'>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/partners')
      const json = (await res.json()) as { data?: { partners: Partner[] } }
      setPartners(json.data?.partners ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleMarquee(p: Partner) {
    const res = await fetch(`/api/admin/partners/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_marquee: !p.is_marquee }),
    })
    if (res.ok) {
      setPartners((ps) =>
        ps.map((x) =>
          x.id === p.id ? { ...x, is_marquee: !p.is_marquee } : x,
        ),
      )
    }
  }

  async function toggleActive(p: Partner) {
    const res = await fetch(`/api/admin/partners/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
    if (res.ok) {
      setPartners((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)),
      )
    }
  }

  async function handleDelete(p: Partner) {
    if (!confirm(`確定要刪除「${p.name}」？`)) return
    setDeleting(p.id)
    try {
      await fetch(`/api/admin/partners/${p.id}`, { method: 'DELETE' })
      toast({ title: '已刪除' })
      void load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Handshake className="h-5 w-5 text-orange-500" />
          <h1 className="text-xl font-bold">合作夥伴管理</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              ({partners.length})
            </span>
          )}
        </div>
        <Button onClick={() => setDialog('new')} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && partners.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed py-20 text-center text-muted-foreground">
          <Handshake className="mx-auto mb-3 h-10 w-10 opacity-20" />
          <p>尚無合作夥伴，點選右上角新增</p>
        </div>
      )}

      {/* List */}
      {!loading && partners.length > 0 && (
        <div className="space-y-3">
          {partners.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm',
                !p.is_active && 'opacity-50',
              )}
            >
              {/* Logo */}
              <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-50">
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt={p.name}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-300">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      CATEGORY_COLORS[p.category],
                    )}
                  >
                    {CATEGORY_LABELS[p.category]}
                  </span>
                  {p.is_marquee && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-orange-300 text-xs text-orange-600"
                    >
                      <Star className="h-3 w-3" />
                      首頁跑馬燈
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}
                {p.website_url && (
                  <a
                    href={p.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    {p.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Marquee toggle */}
                <button
                  title={p.is_marquee ? '移除跑馬燈' : '加入跑馬燈'}
                  onClick={() => toggleMarquee(p)}
                  className={cn(
                    'rounded-lg p-2 transition-colors',
                    p.is_marquee
                      ? 'text-orange-500 hover:bg-orange-50'
                      : 'text-gray-300 hover:bg-orange-50 hover:text-orange-400',
                  )}
                >
                  {p.is_marquee ? (
                    <Star className="h-4 w-4 fill-current" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </button>

                {/* Active toggle */}
                <Switch
                  checked={p.is_active}
                  onCheckedChange={() => toggleActive(p)}
                  className="scale-75"
                />

                {/* Edit */}
                <button
                  onClick={() => setDialog(p)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deleting === p.id}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  {deleting === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialog && (
        <PartnerDialog
          partner={dialog === 'new' ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
