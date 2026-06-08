'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  Settings2,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  Users2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffMember = {
  id: string
  name: string
  email: string | null
  is_active_admin: boolean
  admin_role_id: string | null
  last_login_at: string | null
  invited_at: string | null
  admin_roles: {
    id: string
    name: string
    display_name: string
  } | null
}

type RoleData = {
  id: string
  name: string
  display_name: string
  description: string | null
  permissions: string[]
  is_system: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  editor: 'bg-orange-100 text-orange-700 border-orange-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
}

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: '儀表板',
  orders: '訂單管理',
  members: '會員管理',
  products: '商品管理',
  banners: 'Banner 管理',
  settings: '系統設定',
  logistics: '物流管理',
  payments: '金流管理',
  policies: '政策管理',
  faqs: 'FAQ 管理',
  partners: '合作夥伴',
  redemption: '兌換碼',
  coupons: '優惠折扣',
  promotions: '促銷活動',
  rewards: '等級回饋金',
  nfc: 'NFC 綁定',
  print: '印製管理',
}

const SELECTABLE_PERMISSIONS = Object.entries(PERMISSION_LABELS)

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({
  name,
  displayName,
}: {
  name: string
  displayName?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        ROLE_STYLES[name] ?? ROLE_STYLES.viewer,
      )}
    >
      {displayName ?? name}
    </Badge>
  )
}

function Initials({ name }: { name: string | null }) {
  const letters = name
    ? name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
      {letters}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { toast } = useToast()

  // ── Tab 1: 人員列表 ───────────────────────────────────────────────────────
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)

  // 邀請 dialog state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviting, setInviting] = useState(false)

  // 修改角色 dialog state
  const [roleEditId, setRoleEditId] = useState<string | null>(null)
  const [newRoleId, setNewRoleId] = useState('')
  const [roleUpdating, setRoleUpdating] = useState(false)

  // 確認停用 dialog state
  const [disableId, setDisableId] = useState<string | null>(null)

  // ── Tab 2: 角色管理 ───────────────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleData[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)

  // 編輯角色 dialog state
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPermissions, setEditPermissions] = useState<string[]>([])
  const [savingRole, setSavingRole] = useState(false)

  // ── Computed ──────────────────────────────────────────────────────────────

  const nonSuperAdminRoles = roles.filter((r) => r.name !== 'super_admin')
  const roleEditTarget = staff.find((s) => s.id === roleEditId)
  const disableMember = staff.find((s) => s.id === disableId)
  const editRoleTarget = roles.find((r) => r.id === editRoleId)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const res = await fetch('/api/admin/staff')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setStaff(json.data?.staff ?? [])
    } catch {
      toast({ variant: 'destructive', title: '載入人員列表失敗' })
    } finally {
      setLoadingStaff(false)
    }
  }, [toast])

  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const res = await fetch('/api/admin/roles')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      const list: RoleData[] = json.data?.roles ?? []
      setRoles(list)
      // Pre-select first non-super_admin role for invite dialog
      const defaultRole = list.find((r) => r.name !== 'super_admin')
      if (defaultRole) setInviteRoleId((prev) => prev || defaultRole.id)
    } catch {
      toast({ variant: 'destructive', title: '載入角色列表失敗' })
    } finally {
      setLoadingRoles(false)
    }
  }, [toast])

  useEffect(() => {
    fetchStaff()
    fetchRoles()
  }, [fetchStaff, fetchRoles])

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim() || !inviteRoleId) {
      toast({ variant: 'destructive', title: '請填寫 Email、姓名並選擇角色' })
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          admin_role_id: inviteRoleId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast({ title: '邀請已發送', description: inviteEmail.trim() })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteName('')
      fetchStaff()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '發送邀請失敗',
        description: String(e),
      })
    } finally {
      setInviting(false)
    }
  }

  // ── Modify role ───────────────────────────────────────────────────────────

  async function handleRoleUpdate() {
    if (!roleEditId || !newRoleId) return
    setRoleUpdating(true)
    try {
      const res = await fetch(`/api/admin/staff/${roleEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_role_id: newRoleId }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '角色已更新' })
      setRoleEditId(null)
      fetchStaff()
    } catch {
      toast({ variant: 'destructive', title: '更新失敗' })
    } finally {
      setRoleUpdating(false)
    }
  }

  // ── Disable / Enable ──────────────────────────────────────────────────────

  async function handleConfirmDisable() {
    if (!disableId) return
    try {
      const res = await fetch(`/api/admin/staff/${disableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active_admin: false }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已停用帳號' })
      setDisableId(null)
      fetchStaff()
    } catch {
      toast({ variant: 'destructive', title: '操作失敗' })
    }
  }

  async function handleEnable(memberId: string) {
    try {
      const res = await fetch(`/api/admin/staff/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active_admin: true }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '已啟用帳號' })
      fetchStaff()
    } catch {
      toast({ variant: 'destructive', title: '操作失敗' })
    }
  }

  // ── Edit role ─────────────────────────────────────────────────────────────

  function openEditRole(role: RoleData) {
    setEditRoleId(role.id)
    setEditDisplayName(role.display_name)
    setEditDescription(role.description ?? '')
    setEditPermissions([...role.permissions])
  }

  function togglePermission(perm: string, checked: boolean) {
    setEditPermissions((prev) =>
      checked ? [...prev, perm] : prev.filter((p) => p !== perm),
    )
  }

  async function handleRoleSave() {
    if (!editRoleId) return
    setSavingRole(true)
    try {
      const res = await fetch(`/api/admin/roles/${editRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editDisplayName.trim(),
          description: editDescription.trim() || null,
          permissions: editPermissions,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: '角色已儲存' })
      setEditRoleId(null)
      fetchRoles()
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗' })
    } finally {
      setSavingRole(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-5 p-6">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Users2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">人員管理</h1>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">人員列表</TabsTrigger>
          <TabsTrigger value="roles">角色管理</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: 人員列表 ───────────────────────────────────────────── */}
        <TabsContent value="staff" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              邀請管理員
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  {[
                    '人員',
                    '角色',
                    '帳號狀態',
                    '邀請時間',
                    '最後登入',
                    '操作',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-gray-600"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingStaff ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : staff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-16 text-center text-muted-foreground"
                    >
                      <Users2 className="mx-auto mb-2 h-10 w-10 opacity-20" />
                      尚無人員資料
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b transition-colors hover:bg-gray-50"
                    >
                      {/* 人員 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Initials name={member.name} />
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.email ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* 角色 */}
                      <td className="px-4 py-3">
                        {member.admin_roles ? (
                          <RoleBadge
                            name={member.admin_roles.name}
                            displayName={member.admin_roles.display_name}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            未分配
                          </span>
                        )}
                      </td>
                      {/* 帳號狀態 */}
                      <td className="px-4 py-3">
                        {member.is_active_admin ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            啟用
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            已停用
                          </span>
                        )}
                      </td>
                      {/* 邀請時間 */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {member.invited_at
                          ? new Date(member.invited_at).toLocaleDateString(
                              'zh-TW',
                            )
                          : '—'}
                      </td>
                      {/* 最後登入 */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {member.last_login_at
                          ? new Date(member.last_login_at).toLocaleString(
                              'zh-TW',
                            )
                          : '從未登入'}
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-3">
                        {member.admin_roles?.name !== 'super_admin' && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setRoleEditId(member.id)
                                setNewRoleId(member.admin_role_id ?? '')
                              }}
                            >
                              <Shield className="mr-1 h-3 w-3" />
                              修改角色
                            </Button>
                            {member.is_active_admin ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setDisableId(member.id)}
                              >
                                <UserX className="mr-1 h-3 w-3" />
                                停用
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 border-green-200 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
                                onClick={() => handleEnable(member.id)}
                              >
                                <UserCheck className="mr-1 h-3 w-3" />
                                啟用
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Tab 2: 角色管理 ───────────────────────────────────────────── */}
        <TabsContent value="roles" className="mt-4">
          {loadingRoles ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Shield className="mx-auto mb-2 h-10 w-10 opacity-20" />
              尚無角色資料
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="space-y-3 rounded-xl border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <RoleBadge
                        name={role.name}
                        displayName={role.display_name}
                      />
                      {role.description && (
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      disabled={role.is_system}
                      title={role.is_system ? '系統角色無法修改' : undefined}
                      onClick={() => !role.is_system && openEditRole(role)}
                    >
                      <Settings2 className="mr-1 h-3 w-3" />
                      編輯
                    </Button>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      權限
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          無特定權限
                        </span>
                      ) : (
                        role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {PERMISSION_LABELS[perm] ?? perm}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog: 邀請管理員 ─────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>邀請管理員</DialogTitle>
            <DialogDescription>
              系統將發送邀請信到此 Email，對方點擊後可設定密碼登入後台。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                姓名 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="請輸入姓名"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇角色" />
                </SelectTrigger>
                <SelectContent>
                  {nonSuperAdminRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={
                inviting ||
                !inviteEmail.trim() ||
                !inviteName.trim() ||
                !inviteRoleId
              }
            >
              {inviting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {inviting ? '發送中...' : '發送邀請'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 修改角色 ───────────────────────────────────────────── */}
      <Dialog
        open={!!roleEditId}
        onOpenChange={(open) => {
          if (!open) setRoleEditId(null)
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>
              {roleEditTarget?.name}
              {roleEditTarget?.email && (
                <span className="block text-xs">{roleEditTarget.email}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>選擇角色</Label>
            <Select value={newRoleId} onValueChange={setNewRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="請選擇角色" />
              </SelectTrigger>
              <SelectContent>
                {nonSuperAdminRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleEditId(null)}
              disabled={roleUpdating}
            >
              取消
            </Button>
            <Button
              onClick={handleRoleUpdate}
              disabled={roleUpdating || !newRoleId}
            >
              {roleUpdating && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {roleUpdating ? '更新中...' : '確認修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 確認停用 ───────────────────────────────────────────── */}
      <Dialog
        open={!!disableId}
        onOpenChange={(open) => {
          if (!open) setDisableId(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認停用帳號</DialogTitle>
            <DialogDescription>
              停用後「{disableMember?.name ?? disableMember?.email ?? '此人員'}
              」將無法登入後台，可隨時重新啟用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDisable}>
              確認停用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 編輯角色（非系統角色）──────────────────────────────── */}
      <Dialog
        open={!!editRoleId}
        onOpenChange={(open) => {
          if (!open) setEditRoleId(null)
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯角色：{editRoleTarget?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>顯示名稱</Label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="角色顯示名稱"
              />
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="角色描述（選填）"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>權限</Label>
              <div className="grid grid-cols-2 gap-2">
                {SELECTABLE_PERMISSIONS.map(([perm, label]) => (
                  <label
                    key={perm}
                    htmlFor={`perm-${perm}`}
                    className="flex cursor-pointer select-none items-center gap-2"
                  >
                    <Checkbox
                      id={`perm-${perm}`}
                      checked={editPermissions.includes(perm)}
                      onCheckedChange={(v) => togglePermission(perm, !!v)}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRoleId(null)}
              disabled={savingRole}
            >
              取消
            </Button>
            <Button onClick={handleRoleSave} disabled={savingRole}>
              {savingRole && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              {savingRole ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
