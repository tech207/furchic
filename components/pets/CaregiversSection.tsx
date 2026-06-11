'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  Check,
  LogOut,
  Trash2,
  UserPlus,
  Phone,
  MessageCircle,
  Instagram,
  Facebook,
  Globe,
  Edit3,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

export interface ContactMethod {
  id: string
  type: 'phone' | 'line' | 'instagram' | 'facebook' | 'other'
  label: string
  value: string
  is_public: boolean
}

export interface Caregiver {
  id: string
  role: 'owner' | 'caregiver'
  display_name: string | null
  contact_methods: ContactMethod[]
  is_visible: boolean
  sort_order: number
  users: {
    id: string
    name: string
    avatar_url: string | null
  } | null
}

interface CaregiversSectionProps {
  petId: string
  initialCaregivers: Caregiver[]
  currentUserId: string
  myRole: 'owner' | 'caregiver'
}

const CONTACT_ICONS: Record<ContactMethod['type'], React.ElementType> = {
  phone: Phone,
  line: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  other: Globe,
}

const CONTACT_TYPE_LABELS: Record<ContactMethod['type'], string> = {
  phone: '電話',
  line: 'LINE',
  instagram: 'Instagram',
  facebook: 'Facebook',
  other: '其他',
}

const CONTACT_PLACEHOLDERS: Record<ContactMethod['type'], string> = {
  phone: '0912345678',
  line: 'LINE ID 或 @帳號',
  instagram: 'Instagram 帳號',
  facebook: 'Facebook 帳號或頁面',
  other: '連結或說明',
}

function getDisplayName(c: Caregiver): string {
  return c.display_name ?? c.users?.name ?? '未知用戶'
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

// ── Edit Contact Methods Dialog ───────────────────────────────────────────────

interface EditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caregiver: Caregiver
  petId: string
  onSaved: () => void
}

function EditContactDialog({
  open,
  onOpenChange,
  caregiver,
  petId,
  onSaved,
}: EditDialogProps) {
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState(caregiver.display_name ?? '')
  const [methods, setMethods] = useState<ContactMethod[]>(() =>
    caregiver.contact_methods.map((m) => ({ ...m })),
  )
  const [isSaving, setIsSaving] = useState(false)

  function addMethod() {
    setMethods((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'phone',
        label: '',
        value: '',
        is_public: true,
      },
    ])
  }

  function removeMethod(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id))
  }

  function updateMethod<K extends keyof ContactMethod>(
    id: string,
    field: K,
    value: ContactMethod[K],
  ) {
    setMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/pets/${petId}/caregivers/${caregiver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          contact_methods: methods,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
        return
      }
      toast({ title: '聯絡方式已更新' })
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤，請稍後再試' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯緊急聯絡資訊</DialogTitle>
          <DialogDescription>
            設定顯示名稱與聯絡方式，掃描 NFC 卡的人可以透過這些方式聯繫您
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          {/* Display name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">顯示名稱（選填）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={caregiver.users?.name ?? '照護者'}
              maxLength={50}
              className="block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">留空則顯示帳號名稱</p>
          </div>

          {/* Contact methods */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">聯絡方式</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addMethod}
                disabled={methods.length >= 10}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                新增
              </Button>
            </div>

            {methods.length === 0 && (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                尚未新增任何聯絡方式
                <br />
                <span className="text-xs">點擊「新增」加入電話或社群帳號</span>
              </div>
            )}

            <div className="space-y-3">
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="space-y-2.5 rounded-xl border bg-muted/20 p-3"
                >
                  {/* Type + Remove */}
                  <div className="flex items-center gap-2">
                    <select
                      value={m.type}
                      onChange={(e) =>
                        updateMethod(
                          m.id,
                          'type',
                          e.target.value as ContactMethod['type'],
                        )
                      }
                      className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {Object.entries(CONTACT_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMethod(m.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="刪除此聯絡方式"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Label */}
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) =>
                      updateMethod(m.id, 'label', e.target.value)
                    }
                    placeholder="標籤（如：手機、家用）"
                    maxLength={30}
                    className="block w-full rounded-lg border bg-background px-3 py-1.5 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  {/* Value */}
                  <input
                    type={m.type === 'phone' ? 'tel' : 'text'}
                    value={m.value}
                    onChange={(e) =>
                      updateMethod(m.id, 'value', e.target.value)
                    }
                    placeholder={CONTACT_PLACEHOLDERS[m.type]}
                    maxLength={100}
                    className="block w-full rounded-lg border bg-background px-3 py-1.5 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  {/* Public toggle */}
                  <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">公開顯示</p>
                      <p className="text-xs text-muted-foreground">
                        任何掃描 NFC 卡的人都能看到
                      </p>
                    </div>
                    <Switch
                      checked={m.is_public}
                      onCheckedChange={(v) =>
                        updateMethod(m.id, 'is_public', v)
                      }
                      className="h-4 w-8 data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                儲存中…
              </>
            ) : (
              '儲存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CaregiversSection({
  petId,
  initialCaregivers,
  currentUserId,
  myRole,
}: CaregiversSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const [confirmTarget, setConfirmTarget] = useState<Caregiver | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const [editTarget, setEditTarget] = useState<Caregiver | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const isOwner = myRole === 'owner'

  async function handleGenerateInvite() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/pets/${petId}/caregivers/invite`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: json.message ?? '無法建立邀請連結',
        })
        return
      }
      setInviteUrl(json.data.invite_url)
      setInviteDialogOpen(true)
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤，請稍後再試' })
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: 'destructive', title: '複製失敗，請手動複製' })
    }
  }

  async function handleToggleVisible(caregiver: Caregiver, value: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/pets/${petId}/caregivers/${caregiver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: value }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: 'destructive', title: json.message ?? '更新失敗' })
        return
      }
      router.refresh()
    })
  }

  function openConfirmDialog(caregiver: Caregiver) {
    setConfirmTarget(caregiver)
    setConfirmDialogOpen(true)
  }

  async function handleRemove() {
    if (!confirmTarget) return
    startTransition(async () => {
      const res = await fetch(
        `/api/pets/${petId}/caregivers/${confirmTarget.id}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      setConfirmDialogOpen(false)
      setConfirmTarget(null)
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? '操作失敗' })
        return
      }
      const isSelf = confirmTarget.users?.id === currentUserId
      toast({ title: isSelf ? '已退出照護群組' : '已移除照護者' })
      router.refresh()
    })
  }

  function openEditDialog(caregiver: Caregiver) {
    setEditTarget(caregiver)
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                共同照護者
              </h3>
              <Badge variant="secondary" className="text-xs">
                {initialCaregivers.length} 人
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              管理會出現在 NFC 公開頁面的照護者與聯絡方式。
            </p>
          </div>
          {isOwner && (
            <Button
              size="sm"
              onClick={handleGenerateInvite}
              disabled={isGenerating || isPending}
              className="w-full gap-1.5 sm:w-auto"
            >
              <UserPlus className="h-3.5 w-3.5" />
              邀請照護者
            </Button>
          )}
        </div>
      </div>

      {/* Caregiver list */}
      <div className="space-y-3">
        {initialCaregivers.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
            <UserPlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              目前沒有其他照護者
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              邀請家人或朋友一起管理緊急聯絡資訊。
            </p>
          </div>
        )}
        {initialCaregivers.map((caregiver) => {
          const displayName = getDisplayName(caregiver)
          const isSelf = caregiver.users?.id === currentUserId
          const canToggle = isSelf || isOwner
          const canRemove =
            (isOwner && caregiver.role !== 'owner') ||
            (isSelf && caregiver.role !== 'owner')

          return (
            <div
              key={caregiver.id}
              className="overflow-hidden rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-3">
                {/* Avatar */}
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage
                    src={caregiver.users?.avatar_url ?? undefined}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">
                        {displayName}
                      </span>
                      <Badge
                        variant={
                          caregiver.role === 'owner' ? 'default' : 'secondary'
                        }
                        className="shrink-0 text-[11px]"
                      >
                        {caregiver.role === 'owner' ? '飼主' : '照護者'}
                      </Badge>
                      {isSelf && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[11px]"
                        >
                          我
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {caregiver.is_visible
                        ? '會顯示於 NFC 公開頁'
                        : '不顯示於 NFC 公開頁'}
                    </p>
                  </div>

                  {/* Contact methods */}
                  {caregiver.contact_methods.length > 0 ? (
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      {caregiver.contact_methods
                        .filter((m) => m.is_public || isSelf || isOwner)
                        .map((m) => {
                          const Icon = CONTACT_ICONS[m.type]
                          const text = m.label || m.value
                          return (
                            <span
                              key={m.id}
                              title={text}
                              className={cn(
                                'flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                                m.is_public
                                  ? 'border-green-100 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
                                  : 'border-border bg-muted/40 text-muted-foreground',
                              )}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 truncate">{text}</span>
                              {!m.is_public && (
                                <span className="ml-auto shrink-0 text-[10px]">
                                  不公開
                                </span>
                              )}
                            </span>
                          )
                        })}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'rounded-lg border border-dashed px-3 py-2 text-xs',
                        isSelf
                          ? 'cursor-pointer border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                          : 'bg-muted/20 text-muted-foreground',
                      )}
                      onClick={
                        isSelf ? () => openEditDialog(caregiver) : undefined
                      }
                    >
                      {isSelf
                        ? '點擊設定緊急聯絡方式 →'
                        : '尚未設定公開聯絡方式'}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {/* Edit contact methods — only self */}
                    {isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={isPending}
                        onClick={() => openEditDialog(caregiver)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        編輯聯絡方式
                      </Button>
                    )}

                    {/* Visibility toggle */}
                    {canToggle && (
                      <label
                        htmlFor={`visible-${caregiver.id}`}
                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5"
                      >
                        <span className="text-xs text-muted-foreground">
                          顯示於 NFC 頁面
                        </span>
                        <Switch
                          id={`visible-${caregiver.id}`}
                          checked={caregiver.is_visible}
                          onCheckedChange={(v) =>
                            handleToggleVisible(caregiver, v)
                          }
                          disabled={isPending}
                          className="h-4 w-8 shrink-0 data-[state=checked]:bg-primary"
                        />
                      </label>
                    )}

                    {/* Remove/Leave */}
                    {canRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={isPending}
                        onClick={() => openConfirmDialog(caregiver)}
                        aria-label={isSelf ? '退出' : '移除照護者'}
                      >
                        {isSelf ? (
                          <LogOut className="h-4 w-4" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {isSelf ? '退出' : '移除'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit contact methods dialog */}
      {editTarget && (
        <EditContactDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          caregiver={editTarget}
          petId={petId}
          onSaved={() => router.refresh()}
        />
      )}

      {/* Invite link dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邀請照護者</DialogTitle>
            <DialogDescription>
              分享以下連結，對方登入後即可加入。連結 7 天內有效。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
            <p className="max-h-24 overflow-auto break-all rounded-lg bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {inviteUrl}
            </p>
            <Button
              size="sm"
              onClick={handleCopyLink}
              className="w-full gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  已複製
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  複製
                </>
              )}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            建議用 LINE
            或訊息分享給可信任的家人朋友。對方接受後，您仍可在此管理是否公開顯示。
          </p>
        </DialogContent>
      </Dialog>

      {/* Confirm remove/leave dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.users?.id === currentUserId
                ? '退出照護群組'
                : '移除照護者'}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.users?.id === currentUserId
                ? '確定要退出此寵物的照護群組嗎？'
                : `確定要移除 ${confirmTarget ? getDisplayName(confirmTarget) : ''} 嗎？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isPending}
            >
              確認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
