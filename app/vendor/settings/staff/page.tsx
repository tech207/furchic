'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UserPlus,
  Loader2,
  Users,
  ShieldCheck,
  MoreHorizontal,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffAccount = {
  id: string
  email: string
  phone: string
  role: 'owner' | 'staff'
  permissions: string[]
  is_active: boolean
  last_login_at: string | null
  created_at: string
  users: { name: string | null; avatar_url: string | null } | null
}

type Permission = { key: string; label: string; desc: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const PERMISSIONS: Permission[] = [
  { key: 'products', label: '商品管理', desc: '可新增、編輯商品' },
  { key: 'orders', label: '訂單查看', desc: '可查看訂單（不含個資）' },
  { key: 'reports', label: '報表查看', desc: '可查看銷售報表' },
]

const PERM_STYLE: Record<string, string> = {
  products: 'border-blue-200 bg-blue-50 text-blue-700',
  orders: 'border-purple-200 bg-purple-50 text-purple-700',
  reports: 'border-amber-200 bg-amber-50 text-amber-700',
}
const PERM_LABEL: Record<string, string> = {
  products: '商品',
  orders: '訂單',
  reports: '報表',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string, name?: string | null) {
  if (name?.trim()) return name.trim()[0].toUpperCase()
  return email[0].toUpperCase()
}

function formatLastLogin(ts: string | null) {
  if (!ts) return '尚未登入'
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '剛才'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`
  return d.toLocaleDateString('zh-TW')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorStaffPage() {
  const { toast } = useToast()

  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [myId, setMyId] = useState('')
  const [myRole, setMyRole] = useState<'owner' | 'staff'>('staff')
  const [loading, setLoading] = useState(true)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePerms, setInvitePerms] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<StaffAccount | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<StaffAccount | null>(
    null,
  )
  const [deactivating, setDeactivating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vendor/staff')
      const json = await res.json()
      if (res.ok) {
        setStaff(json.data.staff ?? [])
        setMyId(json.data.my_id ?? '')
        setMyRole(json.data.my_role ?? 'staff')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // ── Invite ─────────────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/vendor/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          permissions: invitePerms,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '邀請失敗' })
        return
      }
      toast({
        title: '邀請已發送',
        description: `邀請郵件已寄送至 ${inviteEmail.trim()}`,
      })
      setInviteOpen(false)
      setInviteEmail('')
      setInvitePerms([])
      void load()
    } finally {
      setInviting(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(s: StaffAccount) {
    setEditTarget(s)
    setEditPerms([...s.permissions])
    setEditActive(s.is_active)
  }

  async function handleSaveEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/vendor/staff/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPerms, is_active: editActive }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '更新失敗' })
        return
      }
      toast({ title: '已更新' })
      setEditTarget(null)
      void load()
    } finally {
      setSaving(false)
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      const res = await fetch(`/api/vendor/staff/${deactivateTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '操作失敗' })
        return
      }
      toast({ title: '帳號已停用' })
      setDeactivateTarget(null)
      void load()
    } finally {
      setDeactivating(false)
    }
  }

  const isOwner = myRole === 'owner'

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">員工帳號</h1>
          <p className="text-sm text-muted-foreground">管理後台存取權限</p>
        </div>
        {isOwner && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            邀請員工
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">尚無員工帳號</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  帳號
                </th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground sm:table-cell">
                  角色
                </th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">
                  權限
                </th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">
                  最後登入
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  狀態
                </th>
                {isOwner && <th className="w-10 px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((s) => {
                const isSelf = s.id === myId
                const displayName = s.users?.name || s.email.split('@')[0]
                const isInvitePending = !s.is_active && !s.last_login_at

                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    {/* Account */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                          {getInitials(s.email, s.users?.name)}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">
                            {displayName}
                            {isSelf && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                （我）
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {s.role === 'owner' ? (
                        <Badge
                          variant="outline"
                          className="border-gray-300 bg-gray-100 text-gray-700"
                        >
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          主帳號
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          員工
                        </Badge>
                      )}
                    </td>

                    {/* Permissions */}
                    <td className="hidden px-4 py-3 md:table-cell">
                      {s.role === 'owner' ? (
                        <span className="text-xs text-muted-foreground">
                          全部權限
                        </span>
                      ) : s.permissions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          無權限
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.permissions.map((p) => (
                            <Badge
                              key={p}
                              variant="outline"
                              className={cn('text-xs', PERM_STYLE[p])}
                            >
                              {PERM_LABEL[p] ?? p}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Last login */}
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      {formatLastLogin(s.last_login_at)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {isInvitePending ? (
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-700"
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          待接受
                        </Badge>
                      ) : s.is_active ? (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          啟用
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          停用
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    {isOwner && (
                      <td className="px-4 py-3">
                        {s.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>
                                編輯權限
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeactivateTarget(s)}
                                disabled={!s.is_active}
                              >
                                停用帳號
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invite Dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          if (!o) {
            setInviteOpen(false)
            setInviteEmail('')
            setInvitePerms([])
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>邀請員工</DialogTitle>
            <DialogDescription>
              對方將收到設定密碼的郵件，設定後即可登入後台。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="staff@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <Label>授予權限</Label>
              <div className="space-y-3 rounded-lg border p-4">
                {PERMISSIONS.map((p) => (
                  <div key={p.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`inv-perm-${p.key}`}
                      checked={invitePerms.includes(p.key)}
                      onCheckedChange={(checked) =>
                        setInvitePerms((prev) =>
                          checked
                            ? [...prev, p.key]
                            : prev.filter((k) => k !== p.key),
                        )
                      }
                    />
                    <label
                      htmlFor={`inv-perm-${p.key}`}
                      className="cursor-pointer space-y-0.5"
                    >
                      <p className="text-sm font-medium leading-none">
                        {p.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
            >
              取消
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              發送邀請
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編輯帳號設定</DialogTitle>
            <DialogDescription>{editTarget?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Permissions */}
            <div className="space-y-2">
              <Label>權限</Label>
              <div className="space-y-3 rounded-lg border p-4">
                {PERMISSIONS.map((p) => (
                  <div key={p.key} className="flex items-center gap-3">
                    <Checkbox
                      id={`edit-perm-${p.key}`}
                      checked={editPerms.includes(p.key)}
                      onCheckedChange={(checked) =>
                        setEditPerms((prev) =>
                          checked
                            ? [...prev, p.key]
                            : prev.filter((k) => k !== p.key),
                        )
                      }
                    />
                    <label
                      htmlFor={`edit-perm-${p.key}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {p.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Checkbox
                id="edit-active"
                checked={editActive}
                onCheckedChange={(c) => setEditActive(!!c)}
              />
              <label
                htmlFor="edit-active"
                className="cursor-pointer space-y-0.5"
              >
                <p className="text-sm font-medium">帳號啟用</p>
                <p className="text-xs text-muted-foreground">
                  取消勾選將暫停此員工的登入存取
                </p>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirm ─────────────────────────────────────────────── */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認停用帳號？</DialogTitle>
            <DialogDescription>
              停用後，{deactivateTarget?.email}{' '}
              將無法登入後台，可隨時在編輯中重新啟用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={deactivating}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              確認停用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
