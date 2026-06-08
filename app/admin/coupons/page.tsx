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
import { Plus, Pencil, Trash2, RefreshCw, Search, X, Tag } from 'lucide-react'
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
  createCouponSchema,
  updateCouponSchema,
  type CreateCouponInput,
  type UpdateCouponInput,
} from '@/lib/validations/coupon'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminCoupon = {
  id: string
  code: string
  name: string
  type: 'fixed' | 'percent'
  value: number
  min_amount: number
  max_discount: number | null
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '無期限'
  return new Date(s).toLocaleDateString('zh-TW')
}

function fmtDiscount(
  type: 'fixed' | 'percent',
  value: number,
  maxDiscount: number | null,
) {
  if (type === 'fixed') return `NT$ ${value.toLocaleString()}`
  return maxDiscount ? `${value}%（最高 NT$${maxDiscount}）` : `${value}%`
}

// ── Coupon form ───────────────────────────────────────────────────────────────

type CouponDialogProps = {
  open: boolean
  editTarget: AdminCoupon | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CouponDialog({
  open,
  editTarget,
  onOpenChange,
  onSaved,
}: CouponDialogProps) {
  const { toast } = useToast()
  const isEdit = !!editTarget

  const form = useForm<CreateCouponInput>({
    resolver: zodResolver(
      isEdit ? updateCouponSchema : createCouponSchema,
    ) as never,
    defaultValues: {
      code: '',
      name: '',
      type: 'fixed',
      value: 100,
      min_amount: 0,
      max_discount: undefined,
      is_active: true,
      starts_at: undefined,
      expires_at: undefined,
      max_uses: undefined,
    },
  })

  const watchType = form.watch('type')

  useEffect(() => {
    if (!open) return
    if (editTarget) {
      form.reset({
        code: editTarget.code,
        name: editTarget.name,
        type: editTarget.type,
        value: editTarget.value,
        min_amount: editTarget.min_amount,
        max_discount: editTarget.max_discount ?? undefined,
        is_active: editTarget.is_active,
        starts_at: editTarget.starts_at
          ? editTarget.starts_at.slice(0, 16)
          : undefined,
        expires_at: editTarget.expires_at
          ? editTarget.expires_at.slice(0, 16)
          : undefined,
        max_uses: editTarget.max_uses ?? undefined,
      })
    } else {
      form.reset({
        code: '',
        name: '',
        type: 'fixed',
        value: 100,
        min_amount: 0,
        is_active: true,
      })
    }
  }, [open, editTarget, form])

  async function onSubmit(data: CreateCouponInput) {
    const url = isEdit
      ? `/api/admin/coupons/${editTarget!.id}`
      : '/api/admin/coupons'
    const method = isEdit ? 'PUT' : 'POST'

    const payload = isEdit
      ? (Object.fromEntries(
          Object.entries(data).filter(([k]) => k !== 'code'),
        ) as UpdateCouponInput)
      : data

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()

    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: json.message ?? (isEdit ? '更新失敗' : '建立失敗'),
      })
      return
    }

    toast({ title: isEdit ? '優惠碼已更新' : '優惠碼已建立' })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯優惠碼' : '新增優惠碼'}</DialogTitle>
          <DialogDescription>設定折扣規則與使用條件</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Code */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優惠碼</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="SUMMER20"
                        disabled={isEdit}
                        className="font-mono uppercase"
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="夏日特惠" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>折扣類型</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">固定折扣（NT$）</SelectItem>
                        <SelectItem value="percent">百分比折扣（%）</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Value */}
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchType === 'fixed'
                        ? '折扣金額（NT$）'
                        : '折扣百分比（%）'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={watchType === 'percent' ? 100 : undefined}
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Min amount */}
              <FormField
                control={form.control}
                name="min_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最低消費（NT$，0=無限制）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Max discount (percent only) */}
              {watchType === 'percent' && (
                <FormField
                  control={form.control}
                  name="max_discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>折扣上限（NT$，空=無限制）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="無上限"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? e.target.valueAsNumber : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Max uses */}
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最大使用次數（空=無限）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="無限制"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? e.target.valueAsNumber : null,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Starts at */}
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
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expires at */}
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
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Is active */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-xl border px-4 py-3">
                  <div className="flex-1">
                    <FormLabel className="text-sm font-medium">
                      啟用優惠碼
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? '儲存中…'
                  : isEdit
                    ? '更新'
                    : '建立'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCouponsPage() {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialog] = useState(false)
  const [editTarget, setEdit] = useState<AdminCoupon | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ search })
      const res = await fetch(`/api/admin/coupons?${p}`)
      const json = await res.json()
      if (res.ok) setCoupons(json.data.coupons ?? [])
      else toast({ variant: 'destructive', title: json.message ?? '載入失敗' })
    } finally {
      setLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    void loadCoupons()
  }, [loadCoupons])

  async function handleToggle(id: string, is_active: boolean) {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active } : c)),
    )
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    if (!res.ok) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !is_active } : c)),
      )
      toast({ variant: 'destructive', title: '更新失敗' })
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'destructive', title: json.message ?? '刪除失敗' })
    } else {
      setCoupons((prev) => prev.filter((c) => c.id !== id))
      toast({ title: '優惠碼已刪除' })
    }
    setDeleteId(null)
  }

  const columnHelper = useMemo(() => createColumnHelper<AdminCoupon>(), [])

  const columns = useMemo(
    () => [
      columnHelper.accessor('code', {
        header: '代碼',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="font-mono">
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor('name', { header: '名稱' }),
      columnHelper.display({
        id: 'discount',
        header: '折扣',
        cell: ({ row }) =>
          fmtDiscount(
            row.original.type,
            row.original.value,
            row.original.max_discount,
          ),
      }),
      columnHelper.accessor('min_amount', {
        header: '最低消費',
        cell: ({ getValue }) =>
          getValue() > 0 ? `NT$ ${getValue().toLocaleString()}` : '—',
      }),
      columnHelper.display({
        id: 'uses',
        header: '使用次數',
        cell: ({ row }) => {
          const { used_count, max_uses } = row.original
          return `${used_count} / ${max_uses ?? '∞'}`
        },
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
    [columnHelper, coupons],
  )

  const table = useReactTable({
    data: coupons,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">優惠碼管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              共 {coupons.length} 筆
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCoupons()}
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
              新增優惠碼
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-6">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋優惠碼…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Table */}
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
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={columns.length} className="px-3 py-2.5">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : coupons.length === 0 ? (
                <tbody>
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      <Tag className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      尚無優惠碼
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

      {/* Create/Edit dialog */}
      <CouponDialog
        open={dialogOpen}
        editTarget={editTarget}
        onOpenChange={setDialog}
        onSaved={() => void loadCoupons()}
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
            <DialogTitle>刪除優惠碼</DialogTitle>
            <DialogDescription>
              此操作無法還原。若有使用紀錄將拒絕刪除。
            </DialogDescription>
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
