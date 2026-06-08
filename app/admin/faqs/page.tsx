'use client'

import { useCallback, useEffect, useState } from 'react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Edit2,
  GripVertical,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Faq = {
  id: string
  question: string
  answer: string
  category: string
  sort_order: number
  is_active: boolean
}

type FaqFormData = {
  question: string
  answer: string
  category: string
}

type DialogState = { mode: 'add' } | { mode: 'edit'; faq: Faq } | null

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'all', label: '全部' },
  { value: 'nfc', label: 'NFC 卡' },
  { value: 'membership', label: '會員' },
  { value: 'shipping', label: '運送' },
  { value: 'payment', label: '付款' },
]

const CATEGORY_OPTIONS = [
  { value: 'general', label: '一般' },
  { value: 'nfc', label: 'NFC 卡' },
  { value: 'membership', label: '會員' },
  { value: 'shipping', label: '運送' },
  { value: 'payment', label: '付款' },
]

const CATEGORY_LABELS: Record<string, string> = {
  general: '一般',
  nfc: 'NFC 卡',
  membership: '會員',
  shipping: '運送',
  payment: '付款',
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  nfc: 'bg-blue-100 text-blue-700',
  membership: 'bg-purple-100 text-purple-700',
  shipping: 'bg-green-100 text-green-700',
  payment: 'bg-orange-100 text-orange-700',
}

// ── Sortable FAQ Card ─────────────────────────────────────────────────────────

function FaqCard({
  faq,
  onEdit,
  onDelete,
}: {
  faq: Faq
  onEdit: (faq: Faq) => void
  onDelete: (faq: Faq) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-shadow',
        isDragging ? 'z-50 opacity-80 shadow-2xl' : 'shadow-sm hover:shadow-md',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
        aria-label="拖曳排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {faq.question}
          </span>
          <Badge
            className={cn(
              'text-xs font-medium',
              CATEGORY_COLORS[faq.category] ?? 'bg-gray-100 text-gray-700',
            )}
            variant="secondary"
          >
            {CATEGORY_LABELS[faq.category] ?? faq.category}
          </Badge>
          <span className="text-xs text-muted-foreground">
            #{faq.sort_order + 1}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {faq.answer}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onEdit(faq)}
          aria-label="編輯"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(faq)}
          aria-label="刪除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Add / Edit Dialog ─────────────────────────────────────────────────────────

const EMPTY_FORM: FaqFormData = {
  question: '',
  answer: '',
  category: 'general',
}

function FaqDialog({
  state,
  onClose,
  onSave,
}: {
  state: DialogState
  onClose: () => void
  onSave: (data: FaqFormData) => Promise<void>
}) {
  const isEdit = state?.mode === 'edit'
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FaqFormData>(EMPTY_FORM)

  useEffect(() => {
    if (!state) return
    setForm(
      state.mode === 'edit'
        ? {
            question: state.faq.question,
            answer: state.faq.answer,
            category: state.faq.category,
          }
        : EMPTY_FORM,
    )
  }, [state])

  async function handleSubmit() {
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ variant: 'destructive', title: '問題與答案為必填' })
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={!!state}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯問題' : '新增問題'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改問題內容後儲存。' : '填寫問題與答案後新增。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              問題 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.question}
              onChange={(e) =>
                setForm((f) => ({ ...f, question: e.target.value }))
              }
              placeholder="輸入常見問題..."
              maxLength={200}
            />
            <p className="text-right text-xs text-muted-foreground">
              {form.question.length} / 200
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>
              答案 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={form.answer}
              onChange={(e) =>
                setForm((f) => ({ ...f, answer: e.target.value }))
              }
              placeholder="輸入詳細答案..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>分類</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? '儲存變更' : '新增'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/faqs')
      const json = await res.json()
      setFaqs((json.data?.faqs ?? []) as Faq[])
    } catch {
      toast({ variant: 'destructive', title: '載入失敗' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const displayed =
    activeTab === 'all' ? faqs : faqs.filter((f) => f.category === activeTab)

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave(data: FaqFormData) {
    if (dialogState?.mode === 'edit') {
      const res = await fetch(`/api/admin/faqs/${dialogState.faq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已更新問題' })
    } else {
      const res = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sort_order: faqs.length }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已新增問題' })
    }
    void load()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/faqs/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast({ title: '已刪除' })
      void load()
    } catch {
      toast({ variant: 'destructive', title: '刪除失敗' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ── Drag Reorder ────────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const visibleIds = displayed.map((f) => f.id)
    const oldVisibleIdx = visibleIds.indexOf(active.id as string)
    const newVisibleIdx = visibleIds.indexOf(over.id as string)

    const reorderedVisible = arrayMove(
      displayed,
      oldVisibleIdx,
      newVisibleIdx,
    ).map((f, i) => ({ ...f, sort_order: i }))

    // Merge back into full list
    const idxMap = new Map(reorderedVisible.map((f) => [f.id, f]))
    setFaqs((prev) => prev.map((f) => idxMap.get(f.id) ?? f))

    await fetch('/api/admin/faqs/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: reorderedVisible.map((f) => ({
          id: f.id,
          sort_order: f.sort_order,
        })),
      }),
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">FAQ 管理</h1>
        </div>
        <Button size="sm" onClick={() => setDialogState({ mode: 'add' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          新增問題
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
              activeTab === tab.value
                ? 'bg-orange-600 text-white'
                : 'border border-border bg-background text-muted-foreground hover:border-orange-200 hover:text-orange-600',
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs tabular-nums">
              (
              {tab.value === 'all'
                ? faqs.length
                : faqs.filter((f) => f.category === tab.value).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* FAQ List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-16 text-center text-muted-foreground">
          <HelpCircle className="h-10 w-10 opacity-30" />
          <p className="text-sm">此分類尚無問題，點選「新增問題」開始</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayed.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {displayed.map((faq) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => setDialogState({ mode: 'edit', faq: f })}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit Dialog */}
      <FaqDialog
        state={dialogState}
        onClose={() => setDialogState(null)}
        onSave={handleSave}
      />

      {/* Delete Confirm Dialog */}
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
              刪除後無法復原。確定要刪除「{deleteTarget?.question}」？
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
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
