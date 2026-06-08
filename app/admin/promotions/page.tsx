'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { PreviewLinkDialog } from '@/components/admin/PreviewLinkDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  createPromotionSchema,
  updatePromotionSchema,
  type CreatePromotionInput,
} from '@/lib/validations/promotion'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminPromotion = {
  id: string
  name: string
  description: string | null
  discount_type: 'fixed' | 'percent' | 'free_shipping'
  discount_value: number
  condition_type: 'amount' | 'quantity' | 'member_level'
  condition_value: number
  condition_level_id: string | null
  is_stackable: boolean
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  created_at: string
}

type MemberLevel = { id: string; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDiscount(
  type: 'fixed' | 'percent' | 'free_shipping',
  value: number,
) {
  if (type === 'fixed') return `折 NT$ ${value.toLocaleString()}`
  if (type === 'percent') return `折 ${value}%`
  if (type === 'free_shipping') return '免運費'
  return '—'
}

function fmtCondition(
  type: 'amount' | 'quantity' | 'member_level',
  value: number,
  levelId: string | null,
  levels: MemberLevel[],
) {
  if (type === 'amount') return `消費滿 NT$ ${value.toLocaleString()}`
  if (type === 'quantity') return `數量 ≥ ${value} 件`
  if (type === 'member_level') {
    const level = levels.find((l) => l.id === levelId)
    return `會員等級：${level?.name ?? levelId ?? '—'}`
  }
  return '—'
}

function fmtDate(s: string | null) {
  if (!s) return '無期限'
  return new Date(s).toLocaleDateString('zh-TW')
}

// ── Promotion form dialog ─────────────────────────────────────────────────────

type PromotionDialogProps = {
  open: boolean
  editTarget: AdminPromotion | null
  memberLevels: MemberLevel[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

type PromoDraftState = {
  draftId: string
  previewUrl: string
  expiresAt: string
}

function PromotionDialog({
  open,
  editTarget,
  memberLevels,
  onOpenChange,
  onSaved,
}: PromotionDialogProps) {
  const { toast } = useToast()
  const isEdit = !!editTarget

  const [drafting, setDrafting] = useState(false)
  const [draftState, setDraftState] = useState<PromoDraftState | null>(null)

  const form = useForm<CreatePromotionInput>({
    resolver: zodResolver(
      isEdit ? updatePromotionSchema : createPromotionSchema,
    ) as never,
    defaultValues: {
      name: '',
      description: undefined,
      discount_type: 'fixed',
      discount_value: 100,
      condition_type: 'amount',
      condition_value: 500,
      condition_level_id: undefined,
      is_stackable: true,
      is_active: true,
      starts_at: undefined,
      expires_at: undefined,
    },
  })

  const watchDiscountType = form.watch('discount_type')
  const watchConditionType = form.watch('condition_type')

  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.reset({
        name: editTarget.name,
        description: editTarget.description ?? undefined,
        discount_type: editTarget.discount_type,
        discount_value: editTarget.discount_value,
        condition_type: editTarget.condition_type,
        condition_value: editTarget.condition_value,
        condition_level_id: editTarget.condition_level_id ?? undefined,
        is_stackable: editTarget.is_stackable,
        is_active: editTarget.is_active,
        starts_at: editTarget.starts_at
          ? editTarget.starts_at.slice(0, 16)
          : undefined,
        expires_at: editTarget.expires_at
          ? editTarget.expires_at.slice(0, 16)
          : undefined,
      })
    } else {
      form.reset({
        name: '',
        discount_type: 'fixed',
        discount_value: 100,
        condition_type: 'amount',
        condition_value: 500,
        is_stackable: true,
        is_active: true,
      })
    }
  }, [open, editTarget, form])

  async function onSubmit(data: CreatePromotionInput) {
    const url = isEdit
      ? `/api/admin/promotions/${editTarget!.id}`
      : '/api/admin/promotions'
    const method = isEdit ? 'PUT' : 'POST'

    // For free_shipping, force discount_value to 0
    if (data.discount_type === 'free_shipping') data.discount_value = 0
    // For non-member_level, clear level id
    if (data.condition_type !== 'member_level') data.condition_level_id = null

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()

    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: json.message ?? (isEdit ? '更新失敗' : '建立失敗'),
      })
      return
    }

    toast({ title: isEdit ? '促銷活動已更新' : '促銷活動已建立' })
    onOpenChange(false)
    onSaved()
  }

  async function handleDraftAndPreview(data: CreatePromotionInput) {
    if (!editTarget) return
    setDrafting(true)
    try {
      const res = await fetch('/api/admin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'promotion',
          resource_id: editTarget.id,
          draft_data: data as unknown as Record<string, unknown>,
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
    toast({ title: '促銷活動已發布' })
    onSaved()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? '編輯促銷活動' : '新增促銷活動'}
            </DialogTitle>
            <DialogDescription>設定自動套用的促銷優惠規則</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>活動名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="夏日滿額折" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（選填）</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="顯示給顧客看的說明"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>折扣類型</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fixed">固定折扣（NT$）</SelectItem>
                          <SelectItem value="percent">
                            百分比折扣（%）
                          </SelectItem>
                          <SelectItem value="free_shipping">免運費</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchDiscountType !== 'free_shipping' && (
                  <FormField
                    control={form.control}
                    name="discount_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchDiscountType === 'fixed'
                            ? '折扣金額（NT$）'
                            : '折扣百分比（%）'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={
                              watchDiscountType === 'percent' ? 100 : undefined
                            }
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Condition type + value */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>觸發條件</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="amount">消費滿額</SelectItem>
                          <SelectItem value="quantity">商品數量</SelectItem>
                          <SelectItem value="member_level">會員等級</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchConditionType === 'member_level' ? (
                  <FormField
                    control={form.control}
                    name="condition_level_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>指定會員等級</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(v) => field.onChange(v || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇等級" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {memberLevels.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="condition_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchConditionType === 'amount'
                            ? '門檻金額（NT$）'
                            : '商品件數'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>開始時間（空=立即）</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value || null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expires_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>到期時間（空=無期限）</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value || null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Switches */}
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="is_stackable"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-xl border px-4 py-3">
                      <div className="flex-1">
                        <FormLabel className="text-sm font-medium">
                          可疊加折扣
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          關閉時，同類型促銷只取最優惠的一項
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-xl border px-4 py-3">
                      <div className="flex-1">
                        <FormLabel className="text-sm font-medium">
                          啟用促銷
                        </FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={form.formState.isSubmitting || drafting}
                >
                  取消
                </Button>
                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={form.handleSubmit(handleDraftAndPreview)}
                    disabled={form.formState.isSubmitting || drafting}
                    className="gap-1.5"
                  >
                    {drafting && <Loader2 className="h-4 w-4 animate-spin" />}
                    儲存草稿 &amp; 預覽
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || drafting}
                  className="gap-1.5"
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? '直接發布' : '建立'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
            onOpenChange(false)
          }}
        />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPromotionsPage() {
  const { toast } = useToast()
  const [promotions, setPromotions] = useState<AdminPromotion[]>([])
  const [memberLevels, setLevels] = useState<MemberLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialog] = useState(false)
  const [editTarget, setEdit] = useState<AdminPromotion | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [promsRes, levelsRes] = await Promise.all([
        fetch('/api/admin/promotions'),
        fetch('/api/admin/member-levels').catch(() => null),
      ])

      if (promsRes.ok) {
        const j = await promsRes.json()
        setPromotions(j.data.promotions ?? [])
      }
      if (levelsRes?.ok) {
        const j = await levelsRes.json()
        setLevels(j.data?.levels ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleToggle(id: string, is_active: boolean) {
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active } : p)),
    )
    const res = await fetch(`/api/admin/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) {
      setPromotions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !is_active } : p)),
      )
      toast({ variant: 'destructive', title: '更新失敗' })
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
    } else {
      setPromotions((prev) => prev.filter((p) => p.id !== id))
      toast({ title: '促銷活動已刪除' })
    }
    setDeleteId(null)
  }

  const columnHelper = useMemo(() => createColumnHelper<AdminPromotion>(), [])

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: '名稱',
        cell: ({ getValue, row }) => (
          <div>
            <p className="font-medium">{getValue()}</p>
            {row.original.description && (
              <p className="max-w-[160px] truncate text-xs text-muted-foreground">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'discount',
        header: '折扣',
        cell: ({ row }) => (
          <Badge variant="secondary">
            {fmtDiscount(
              row.original.discount_type,
              row.original.discount_value,
            )}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'condition',
        header: '條件',
        cell: ({ row }) =>
          fmtCondition(
            row.original.condition_type,
            row.original.condition_value,
            row.original.condition_level_id,
            memberLevels,
          ),
      }),
      columnHelper.accessor('is_stackable', {
        header: '可疊加',
        size: 80,
        cell: ({ getValue }) => (
          <Badge variant={getValue() ? 'outline' : 'secondary'}>
            {getValue() ? '是' : '否'}
          </Badge>
        ),
      }),
      columnHelper.accessor('expires_at', {
        header: '有效期至',
        cell: ({ getValue }) => fmtDate(getValue()),
      }),
      columnHelper.accessor('is_active', {
        header: '狀態',
        size: 80,
        cell: ({ getValue, row }) => (
          <Switch
            checked={getValue()}
            onCheckedChange={(v) => void handleToggle(row.original.id, v)}
          />
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '操作',
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEdit(row.original)
                setDialog(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnHelper, promotions, memberLevels],
  )

  const table = useReactTable({
    data: promotions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">促銷活動管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              共 {promotions.length} 個活動（自動套用，不需輸入碼）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              />
              重新整理
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEdit(null)
                setDialog(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              新增促銷
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b bg-muted/30">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              {loading ? (
                <tbody>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={columns.length} className="px-3 py-2.5">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : promotions.length === 0 ? (
                <tbody>
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      尚無促銷活動
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2.5 align-middle text-sm"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <PromotionDialog
        open={dialogOpen}
        editTarget={editTarget}
        memberLevels={memberLevels}
        onOpenChange={setDialog}
        onSaved={() => void loadData()}
      />

      {/* Delete confirm */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>刪除促銷活動</DialogTitle>
            <DialogDescription>此操作無法還原。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && void handleDelete(deleteId)}
            >
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
