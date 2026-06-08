'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Crown,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: string[]
  sort_order: number
}

type Member = {
  id: string
  name: string
  email: string | null
  phone: string | null
  reward_points: number
  total_spent: number
}

type TxRow = {
  id: string
  user_id: string
  type: string
  points: number
  note: string | null
  created_at: string
  users: { id: string; name: string; email: string | null } | null
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const levelSchema = z.object({
  name: z.string().min(1, '必填').max(50),
  min_spent: z.coerce.number().int().min(0),
  reward_rate: z.coerce
    .number()
    .min(0)
    .max(100)
    .transform((v) => v / 100),
  discount_rate: z.coerce
    .number()
    .min(0)
    .max(100)
    .transform((v) => v / 100),
  benefits: z.string().transform((s) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  ),
})
type LevelFormRaw = {
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: string
}

const adjustSchema = z.object({
  points: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, '點數不可為 0'),
  note: z.string().max(200).optional(),
})
type AdjustForm = z.infer<typeof adjustSchema>

// ── SortableRow ───────────────────────────────────────────────────────────────

function SortableRow({
  level,
  onEdit,
  onDelete,
}: {
  level: Level
  onEdit: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-3 rounded-xl border bg-card px-4 py-3',
        isDragging && 'z-50 opacity-50 shadow-lg',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Crown className="h-4 w-4 shrink-0 text-orange-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{level.name}</span>
          <Badge variant="outline" className="text-xs">
            消費 ≥ NT${level.min_spent.toLocaleString()}
          </Badge>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
          <span>回饋 {(level.reward_rate * 100).toFixed(0)}%</span>
          <span>折扣 {(level.discount_rate * 100).toFixed(0)}%</span>
          {Array.isArray(level.benefits) && level.benefits.length > 0 && (
            <span>{level.benefits.length} 項權益</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-500 hover:bg-red-50 hover:text-red-700"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 1: 等級設定 ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function LevelsTab() {
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialog] = useState(false)
  const [editTarget, setEdit] = useState<Level | null>(null)
  const [deleteTarget, setDel] = useState<Level | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const form = useForm<LevelFormRaw>({
    defaultValues: {
      name: '',
      min_spent: 0,
      reward_rate: 0,
      discount_rate: 0,
      benefits: '',
    },
  })

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.fetch('/api/admin/member-levels')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setLevels(json.data?.levels ?? [])
    } catch {
      toast({ variant: 'destructive', title: '載入等級失敗' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  // Drag sort
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = levels.findIndex((l) => l.id === active.id)
    const newIdx = levels.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(levels, oldIdx, newIdx).map((l, i) => ({
      ...l,
      sort_order: i,
    }))
    setLevels(reordered)
    await Promise.all(
      reordered.map((l) =>
        window.fetch(`/api/admin/member-levels/${l.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: l.sort_order }),
        }),
      ),
    )
  }

  // Open dialog
  function openAdd() {
    setEdit(null)
    form.reset({
      name: '',
      min_spent: 0,
      reward_rate: 0,
      discount_rate: 0,
      benefits: '',
    })
    setDialog(true)
  }
  function openEdit(lv: Level) {
    setEdit(lv)
    form.reset({
      name: lv.name,
      min_spent: lv.min_spent,
      reward_rate: lv.reward_rate * 100,
      discount_rate: lv.discount_rate * 100,
      benefits: Array.isArray(lv.benefits) ? lv.benefits.join('\n') : '',
    })
    setDialog(true)
  }

  async function onSubmit(raw: LevelFormRaw) {
    setSaving(true)
    try {
      const parsed = levelSchema.parse(raw)
      const url = editTarget
        ? `/api/admin/member-levels/${editTarget.id}`
        : '/api/admin/member-levels'
      const method = editTarget ? 'PUT' : 'POST'
      const body = editTarget
        ? parsed
        : { ...parsed, sort_order: levels.length }
      const res = await window.fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '儲存失敗')
      toast({ title: editTarget ? '等級已更新' : '等級已新增' })
      setDialog(false)
      fetch()
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.fetch(
        `/api/admin/member-levels/${deleteTarget.id}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '刪除失敗')
      toast({ title: '等級已刪除' })
      setDel(null)
      fetch()
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">拖曳可調整顯示順序</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetch}>
            <RefreshCw className="mr-1 h-4 w-4" />
            重整
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" />
            新增等級
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          尚無等級設定
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={levels.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {levels.map((lv) => (
                <SortableRow
                  key={lv.id}
                  level={lv}
                  onEdit={() => openEdit(lv)}
                  onDelete={() => setDel(lv)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? '編輯等級' : '新增等級'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>等級名稱</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="min_spent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最低累計消費（NT$）</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="reward_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>回饋率（%）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discount_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>折扣率（%）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="benefits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>等級權益（每行一項）</FormLabel>
                    <FormControl>
                      <textarea
                        className="h-24 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialog(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? '儲存中…' : '儲存'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除等級</DialogTitle>
            <DialogDescription>
              確定要刪除「{deleteTarget?.name}」？若有會員持有此等級將無法刪除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDel(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? '刪除中…' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 2: 系統設定 ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function SettingsTab() {
  const [rate, setRate] = useState(50)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/cart')
        if (!res.ok) return
        const json = await res.json()
        const val = json.data?.reward_max_usage_rate
        if (typeof val === 'number') setRate(Math.round(val * 100))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'reward.max_usage_rate',
          value: rate / 100,
        }),
      })
      if (!res.ok) throw new Error('儲存失敗')
      toast({ title: '設定已儲存' })
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h3 className="font-semibold">回饋金最大折抵比率</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            每筆訂單最多可用回饋金折抵的比例（相對於訂單總額）
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">折抵上限</span>
            <span className="font-semibold text-orange-600">{rate}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {saving ? '儲存中…' : '儲存設定'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Tab 3: 手動調整 ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function AdjustTab() {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Member | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { points: 0, note: '' },
  })

  function handleSearch(v: string) {
    setSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) {
      setMembers([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/admin/members?search=${encodeURIComponent(v)}`,
        )
        const json = await res.json()
        setMembers(json.data?.members ?? [])
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  function selectMember(m: Member) {
    setSelected(m)
    setSearch('')
    setMembers([])
    form.reset({ points: 0, note: '' })
  }

  async function onSubmit(values: AdjustForm) {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/rewards/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selected.id, ...values }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? '調整失敗')
      toast({
        title: `已調整 ${values.points > 0 ? '+' : ''}${values.points} 點，新餘額：${json.data?.new_balance ?? 0} 點`,
      })
      setSelected({
        ...selected,
        reward_points: json.data?.new_balance ?? selected.reward_points,
      })
      form.reset({ points: 0, note: '' })
    } catch (e) {
      toast({ variant: 'destructive', title: String(e) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md space-y-5">
      {/* Member search */}
      <div className="space-y-2">
        <label className="text-sm font-medium">搜尋會員</label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="姓名、Email 或手機"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && (
            <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
        </div>
        {members.length > 0 && (
          <div className="overflow-hidden rounded-lg border shadow-sm">
            {members.map((m) => (
              <button
                key={m.id}
                className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
                onClick={() => selectMember(m)}
              >
                <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.email} · 餘額 {m.reward_points} 點
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected member card */}
      {selected && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-sm text-muted-foreground">
                {selected.email}
              </div>
              <div className="mt-1 text-sm">
                目前回饋金：
                <strong className="text-orange-600">
                  {selected.reward_points} 點
                </strong>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelected(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>調整點數（正數增加，負數扣除）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="例：100 或 -50"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備注（選填）</FormLabel>
                    <FormControl>
                      <Input placeholder="例：活動補點、誤扣修正" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? '處理中…' : '確認調整'}
              </Button>
            </form>
          </Form>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Main Page ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminRewardsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Crown className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">會員等級與回饋金</h1>
      </div>

      <Tabs defaultValue="levels">
        <TabsList className="mb-4">
          <TabsTrigger value="levels">等級設定</TabsTrigger>
          <TabsTrigger value="settings">系統設定</TabsTrigger>
          <TabsTrigger value="adjust">手動調整</TabsTrigger>
        </TabsList>
        <TabsContent value="levels">
          <LevelsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="adjust">
          <AdjustTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
