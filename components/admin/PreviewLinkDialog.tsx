'use client'

import { useState, useEffect } from 'react'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  previewUrl: string
  expiresAt: string // ISO string
  draftId: string
  onPublish: () => Promise<void>
  onClose: () => void
}

// ── Countdown helper ──────────────────────────────────────────────────────────

function useCountdown(expiresAt: string): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setLabel('連結已失效')
        return
      }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setLabel(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 後失效`,
      )
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [expiresAt])

  return label
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PreviewLinkDialog({
  previewUrl,
  expiresAt,
  draftId: _draftId,
  onPublish,
  onClose,
}: Props) {
  const { toast } = useToast()

  const [copied, setCopied] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const timeLeft = useCountdown(expiresAt)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      toast({ variant: 'destructive', title: '複製失敗，請手動選取連結' })
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await onPublish()
      setShowConfirm(false)
      onClose()
    } catch {
      toast({ variant: 'destructive', title: '發布失敗，請稍後再試' })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      {/* ── Preview URL dialog ───────────────────────────────────────────── */}
      <Dialog
        open
        onOpenChange={(v) => {
          if (!v) onClose()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>草稿預覽連結</DialogTitle>
            <DialogDescription>
              以下連結 24 小時內有效，可分享給團隊成員確認效果
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={previewUrl}
                readOnly
                className="bg-muted font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
                title={copied ? '已複製' : '複製連結'}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="在新分頁開啟"
                onClick={() => window.open(previewUrl, '_blank', 'noopener')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-center text-xs tabular-nums text-muted-foreground">
              {timeLeft}
            </p>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose}>
              繼續編輯
            </Button>
            <Button onClick={() => setShowConfirm(true)}>確認發布</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Inner confirm dialog ─────────────────────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>確認發布</DialogTitle>
            <DialogDescription>
              確認後將立即對所有用戶生效，請確認預覽無誤後再發布。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={publishing}
            >
              取消
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="gap-1.5"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              立即發布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
