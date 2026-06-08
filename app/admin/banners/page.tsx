'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { PreviewLinkDialog } from '@/components/admin/PreviewLinkDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ImageUploader } from '@/components/common/ImageUploader'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type BannerType = 'hero' | 'sponsor' | 'shop'

type Banner = {
  id: string
  type: BannerType
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  title: string | null
  subtitle: string | null
  link: string | null
  bg_class: string | null
  is_active: boolean
  status: 'draft' | 'published' | 'archived'
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
}

type FormPayload = {
  type?: BannerType
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  title: string | null
  subtitle: string | null
  link: string | null
  bg_class: string | null
  starts_at: string | null
  ends_at: string | null
  status: 'draft' | 'published'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BannerType, string> = {
  hero: '首頁 Banner',
  sponsor: '贊助商',
  shop: '商城',
}

const SIZE_HINTS: Record<BannerType, { desktop: string; mobile: string }> = {
  hero: { desktop: '1920 × 600 px', mobile: '768 × 400 px' },
  shop: { desktop: '1440 × 280 px', mobile: '768 × 200 px' },
  sponsor: { desktop: '200 × 100 px', mobile: '同桌面版（不需另行上傳）' },
}

const PREVIEW_H: Record<BannerType, string> = {
  hero: 'h-36',
  shop: 'h-20',
  sponsor: 'h-24',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function validateLink(val: string): string {
  if (!val) return ''
  if (!val.startsWith('https://')) return '連結必須以 https:// 開頭'
  return ''
}

// ── Add/Edit Dialog ───────────────────────────────────────────────────────────

type DialogState =
  | { mode: 'add'; type: BannerType }
  | { mode: 'edit'; banner: Banner }
  | null

type BannerDraftState = {
  draftId: string
  previewUrl: string
  expiresAt: string
}

function BannerDialog({
  state,
  onClose,
  onSave,
  onPublished,
}: {
  state: DialogState
  onClose: () => void
  onSave: (data: FormPayload) => Promise<void>
  onPublished?: () => void
}) {
  const isEdit = state?.mode === 'edit'
  const tsRef = useRef(Date.now())

  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftState, setDraftState] = useState<BannerDraftState | null>(null)
  const [selectedType, setSelectedType] = useState<BannerType>('hero')
  const [imageUrl, setImageUrl] = useState('')
  const [mobileImageUrl, setMobileImageUrl] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')
  const [altText, setAltText] = useState('')
  const [bgClass, setBgClass] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Reset form when dialog opens/changes
  useEffect(() => {
    if (!state) return
    tsRef.current = Date.now()
    setShowPreview(false)
    setLinkError('')

    if (state.mode === 'edit') {
      const b = state.banner
      setSelectedType(b.type)
      setImageUrl(b.image_url ?? '')
      setMobileImageUrl(b.mobile_image_url ?? '')
      setTitle(b.title ?? '')
      setSubtitle(b.subtitle ?? '')
      setLink(b.link ?? '')
      setAltText(b.alt_text ?? '')
      setBgClass(b.bg_class ?? '')
      setStartsAt(b.starts_at ? toLocalDatetime(b.starts_at) : '')
      setEndsAt(b.ends_at ? toLocalDatetime(b.ends_at) : '')
      setShowSchedule(!!(b.starts_at || b.ends_at))
    } else {
      setSelectedType(state.type)
      setImageUrl('')
      setMobileImageUrl('')
      setTitle('')
      setSubtitle('')
      setLink('')
      setAltText('')
      setBgClass('')
      setStartsAt('')
      setEndsAt('')
      setShowSchedule(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const ts = tsRef.current
  const desktopPath = `banners/${selectedType}/${ts}_desktop.jpg`
  const mobilePath = `banners/${selectedType}/${ts}_mobile.jpg`

  function buildPayload(overrideStatus?: 'published' | 'draft'): FormPayload {
    return {
      type: isEdit ? undefined : selectedType,
      image_url: imageUrl || null,
      mobile_image_url: mobileImageUrl || null,
      alt_text: altText || null,
      title: title || null,
      subtitle: subtitle || null,
      link: link || null,
      bg_class: bgClass || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      status: overrideStatus ?? 'published',
    }
  }

  async function handleSubmit() {
    const err = validateLink(link)
    if (err) {
      setLinkError(err)
      return
    }

    setSaving(true)
    try {
      await onSave(buildPayload('published'))
      onClose()
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDraftAndPreview() {
    const err = validateLink(link)
    if (err) {
      setLinkError(err)
      return
    }
    if (!isEdit || state?.mode !== 'edit') return

    setDrafting(true)
    try {
      const res = await fetch('/api/admin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'banner',
          resource_id: state.banner.id,
          draft_data: buildPayload('published'),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '建立草稿失敗' })
        return
      }
      setDraftState({
        draftId: json.data.draft_id,
        previewUrl: json.data.preview_url,
        expiresAt: json.data.expires_at,
      })
    } finally {
      setDrafting(false)
    }
  }

  async function handleDraftPublish() {
    if (!draftState) return
    const res = await fetch(`/api/admin/drafts/${draftState.draftId}/publish`, {
      method: 'POST',
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.message ?? '發布失敗')
    }
    toast({ title: 'Banner 已發布' })
    onPublished?.()
  }

  const previewBg = imageUrl
    ? undefined
    : `linear-gradient(to bottom right, var(--gradient-from, #f97316), var(--gradient-to, #d97706))`

  return (
    <>
      <Dialog
        open={!!state}
        onOpenChange={(v) => {
          if (!v) onClose()
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? '編輯 Banner' : '新增 Banner'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `${TYPE_LABELS[selectedType]} — 修改後立即生效`
                : '填入資訊後儲存，可拖曳調整排序'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── 類型選擇（只有新增時顯示）────────────────────────── */}
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>Banner 類型</Label>
                <Select
                  value={selectedType}
                  onValueChange={(v) => setSelectedType(v as BannerType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">首頁 Banner</SelectItem>
                    <SelectItem value="sponsor">贊助商</SelectItem>
                    <SelectItem value="shop">商城</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── 桌面圖片 ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <Label>桌面圖片</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                建議尺寸：{SIZE_HINTS[selectedType].desktop}
              </p>
              <ImageUploader
                bucketName="company-assets"
                filePath={desktopPath}
                onUpload={(url) => setImageUrl(url)}
                currentImageUrl={imageUrl || undefined}
              />
            </div>

            {/* ── 行動版圖片 ────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <Label>行動版圖片（選填）</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                建議尺寸：{SIZE_HINTS[selectedType].mobile}
                。若不上傳則行動版使用桌面圖片。
              </p>
              <ImageUploader
                bucketName="company-assets"
                filePath={mobilePath}
                onUpload={(url) => setMobileImageUrl(url)}
                currentImageUrl={mobileImageUrl || undefined}
              />
            </div>

            {/* ── 標題 / 副標題 ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>標題（選填）</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Banner 標題"
                />
              </div>
              <div className="space-y-1.5">
                <Label>副標題（選填）</Label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="副標題"
                />
              </div>
            </div>

            {/* ── 連結 URL ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>連結 URL（選填）</Label>
              <Input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setLinkError('')
                }}
                onBlur={() => setLinkError(validateLink(link))}
                placeholder="https://..."
                type="url"
                className={cn(
                  linkError &&
                    'border-destructive focus-visible:ring-destructive',
                )}
              />
              {linkError && (
                <p className="text-xs text-destructive">{linkError}</p>
              )}
            </div>

            {/* ── Alt 文字 ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Alt 文字（選填）</Label>
              <Input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="圖片說明文字（SEO 與無障礙）"
              />
            </div>

            {/* ── 背景漸層 ──────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>背景漸層 CSS（選填）</Label>
              <Input
                value={bgClass}
                onChange={(e) => setBgClass(e.target.value)}
                placeholder="from-orange-500 to-amber-600"
              />
              <p className="text-xs text-muted-foreground">
                無圖片時顯示此漸層（Tailwind 類別）
              </p>
            </div>

            {/* ── 排程設定（Collapsible）────────────────────────────── */}
            <div className="overflow-hidden rounded-lg border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
                onClick={() => setShowSchedule((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  排程設定
                  {(startsAt || endsAt) && (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      已設定
                    </Badge>
                  )}
                </span>
                {showSchedule ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showSchedule && (
                <div className="space-y-3 border-t px-4 pb-4 pt-3">
                  <p className="text-xs text-muted-foreground">
                    留空表示無限制，到期後 Banner 將自動隱藏。
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">開始時間</Label>
                      <Input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">結束時間</Label>
                      <Input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  {startsAt &&
                    endsAt &&
                    new Date(startsAt) >= new Date(endsAt) && (
                      <p className="text-xs text-destructive">
                        結束時間必須晚於開始時間
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* ── 預覽效果 ──────────────────────────────────────────── */}
            <div className="space-y-2">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showPreview ? '隱藏預覽' : '顯示預覽'}
              </button>

              {showPreview && (
                <div className="overflow-hidden rounded-lg border">
                  <p className="px-2 pb-1 pt-1.5 text-[10px] text-muted-foreground">
                    預覽（行動版）
                  </p>
                  <div
                    className={cn(
                      'relative flex w-full items-center justify-center overflow-hidden',
                      PREVIEW_H[selectedType],
                      !imageUrl &&
                        cn(
                          'bg-gradient-to-br',
                          bgClass || 'from-orange-500 to-amber-600',
                        ),
                    )}
                    style={imageUrl ? undefined : { background: previewBg }}
                  >
                    {(mobileImageUrl || imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mobileImageUrl || imageUrl}
                        alt={altText || title || 'Banner preview'}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    {(title || subtitle) && (
                      <div className="relative z-10 px-4 text-center">
                        {title && (
                          <p className="text-sm font-bold text-white drop-shadow">
                            {title}
                          </p>
                        )}
                        {subtitle && (
                          <p className="mt-0.5 text-xs text-white/80 drop-shadow">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving || drafting}
            >
              取消
            </Button>
            {isEdit && (
              <Button
                variant="outline"
                onClick={handleDraftAndPreview}
                disabled={saving || drafting || !!linkError}
                className="gap-1.5"
              >
                {drafting && <Loader2 className="h-4 w-4 animate-spin" />}
                儲存草稿 &amp; 預覽
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={saving || drafting || !!linkError}
              className="gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '直接發布' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {draftState && (
        <PreviewLinkDialog
          draftId={draftState.draftId}
          previewUrl={draftState.previewUrl}
          expiresAt={draftState.expiresAt}
          onPublish={handleDraftPublish}
          onClose={() => {
            setDraftState(null)
            onClose()
          }}
        />
      )}
    </>
  )
}

// ── datetime-local ↔ ISO 互轉 ─────────────────────────────────────────────────

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Sortable Banner Card ──────────────────────────────────────────────────────

function BannerCard({
  banner,
  onEdit,
  onDelete,
  onToggle,
}: {
  banner: Banner
  onEdit: (b: Banner) => void
  onDelete: (b: Banner) => void
  onToggle: (b: Banner, v: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const hasSchedule = !!(banner.starts_at || banner.ends_at)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card transition-shadow',
        isDragging ? 'z-50 opacity-80 shadow-2xl' : 'hover:shadow-md',
        !banner.is_active && 'opacity-50',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 cursor-grab rounded bg-black/30 p-1 text-white opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
        aria-label="拖曳排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Draft badge */}
      {banner.status === 'draft' && (
        <div className="absolute right-2 top-2 z-10">
          <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white">
            草稿
          </Badge>
        </div>
      )}

      {/* Image / gradient preview */}
      <div
        className={cn(
          'relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br',
          banner.bg_class ?? 'from-gray-100 to-gray-200',
        )}
      >
        {banner.image_url ? (
          <Image
            src={banner.image_url}
            alt={banner.alt_text ?? banner.title ?? ''}
            fill
            className="object-cover"
            sizes="200px"
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-white/50" />
        )}
        <div className="absolute inset-0 flex items-end bg-black/20 p-2">
          {banner.title && (
            <span className="line-clamp-1 text-xs font-semibold text-white">
              {banner.title}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-2 p-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {banner.is_active ? '啟用' : '停用'}
          </Badge>
          {hasSchedule && (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[10px]"
            >
              <CalendarClock className="h-2.5 w-2.5" />
              {banner.starts_at ? fmtDate(banner.starts_at) : '∞'}
              {' ~ '}
              {banner.ends_at ? fmtDate(banner.ends_at) : '∞'}
            </Badge>
          )}
          {banner.link && (
            <span
              className="max-w-[120px] truncate text-[10px] text-muted-foreground"
              title={banner.link}
            >
              {banner.link.replace('https://', '')}
            </span>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between gap-2">
          <Switch
            checked={banner.is_active}
            onCheckedChange={(v) => onToggle(banner, v)}
            aria-label="切換啟用狀態"
          />
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onEdit(banner)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onDelete(banner)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Banner Tab ────────────────────────────────────────────────────────────────

function BannerTab({ type }: { type: BannerType }) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editState, setEditState] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/banners?type=${type}`)
      const json = await res.json()
      setBanners(json.data?.banners ?? [])
    } catch {
      toast({ variant: 'destructive', title: '載入失敗' })
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(form: FormPayload) {
    if (editState?.mode === 'edit') {
      const res = await fetch(`/api/admin/banners/${editState.banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已更新 Banner' })
    } else {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已新增 Banner' })
    }
    load()
  }

  async function handleToggle(banner: Banner, value: boolean) {
    setBanners((bs) =>
      bs.map((b) => (b.id === banner.id ? { ...b, is_active: value } : b)),
    )
    await fetch(`/api/admin/banners/${banner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: value }),
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/banners/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast({ title: '已刪除' })
      load()
    } catch {
      toast({ variant: 'destructive', title: '刪除失敗' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = banners.findIndex((b) => b.id === active.id)
    const newIdx = banners.findIndex((b) => b.id === over.id)
    const reordered = arrayMove(banners, oldIdx, newIdx).map((b, i) => ({
      ...b,
      sort_order: i,
    }))
    setBanners(reordered)
    await fetch('/api/admin/banners/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        items: reordered.map((b) => ({ id: b.id, sort_order: b.sort_order })),
      }),
    })
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setEditState({ mode: 'add', type })}>
          <Plus className="mr-1 h-4 w-4" />
          新增 Banner
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-16 text-center text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm">尚無 Banner，點選「新增 Banner」開始</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={banners.map((b) => b.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {banners.map((b) => (
                <BannerCard
                  key={b.id}
                  banner={b}
                  onEdit={(banner) => setEditState({ mode: 'edit', banner })}
                  onDelete={setDeleteTarget}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit Dialog */}
      <BannerDialog
        state={editState}
        onClose={() => setEditState(null)}
        onSave={handleSave}
        onPublished={load}
      />

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              刪除後無法復原，圖片將從 Storage 一併移除。 確定要刪除「
              {deleteTarget?.title ?? '此 Banner'}」？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBannersPage() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Banner 管理</h1>
      </div>

      <Tabs defaultValue="hero">
        <TabsList>
          <TabsTrigger value="hero">首頁 Banner</TabsTrigger>
          <TabsTrigger value="sponsor">贊助商 Logo</TabsTrigger>
          <TabsTrigger value="shop">商城 Banner</TabsTrigger>
        </TabsList>

        {(['hero', 'sponsor', 'shop'] as BannerType[]).map((t) => (
          <TabsContent key={t} value={t}>
            <BannerTab type={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
