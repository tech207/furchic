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

function getDisplayName(c: Caregiver): string {
  return c.display_name ?? c.users?.name ?? '未知用戶'
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

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
        {
          method: 'DELETE',
        },
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">
            共同照護者
          </h3>
          <Badge variant="secondary" className="text-xs">
            {initialCaregivers.length}
          </Badge>
        </div>
        {isOwner && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateInvite}
            disabled={isGenerating || isPending}
            className="gap-1.5 text-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            邀請照護者
          </Button>
        )}
      </div>

      {/* Caregiver list */}
      <div className="divide-y divide-border rounded-xl border bg-card">
        {initialCaregivers.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            目前沒有其他照護者
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
            <div key={caregiver.id} className="flex items-start gap-3 p-4">
              {/* Avatar */}
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage
                  src={caregiver.users?.avatar_url ?? undefined}
                  alt={displayName}
                />
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {displayName}
                  </span>
                  <Badge
                    variant={
                      caregiver.role === 'owner' ? 'default' : 'secondary'
                    }
                    className="text-[11px]"
                  >
                    {caregiver.role === 'owner' ? '飼主' : '照護者'}
                  </Badge>
                  {isSelf && (
                    <Badge variant="outline" className="text-[11px]">
                      我
                    </Badge>
                  )}
                </div>

                {/* Contact methods */}
                {caregiver.contact_methods.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {caregiver.contact_methods
                      .filter((m) => m.is_public || isSelf || isOwner)
                      .map((m) => {
                        const Icon = CONTACT_ICONS[m.type]
                        return (
                          <span
                            key={m.id}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]',
                              m.is_public
                                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {m.label || m.value}
                          </span>
                        )
                      })}
                  </div>
                )}

                {/* Visibility toggle */}
                {canToggle && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Switch
                      id={`visible-${caregiver.id}`}
                      checked={caregiver.is_visible}
                      onCheckedChange={(v) => handleToggleVisible(caregiver, v)}
                      disabled={isPending}
                      className="h-4 w-8 data-[state=checked]:bg-primary"
                    />
                    <label
                      htmlFor={`visible-${caregiver.id}`}
                      className="cursor-pointer text-[11px] text-muted-foreground"
                    >
                      顯示於 NFC 頁面
                    </label>
                  </div>
                )}
              </div>

              {/* Actions */}
              {canRemove && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                  onClick={() => openConfirmDialog(caregiver)}
                  aria-label={isSelf ? '退出' : '移除照護者'}
                >
                  {isSelf ? (
                    <LogOut className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite link dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邀請照護者</DialogTitle>
            <DialogDescription>
              分享以下連結，對方登入後即可加入。連結 7 天內有效。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {inviteUrl}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="shrink-0 gap-1.5"
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
