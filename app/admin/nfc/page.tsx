'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Nfc,
  PawPrint,
  RotateCcw,
  Search,
  X,
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
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { readNfcCard } from '@/lib/utils/nfc'

// ── Types ─────────────────────────────────────────────────────────────────────

type PrintRequest = {
  id: string
  status: 'pending' | 'printing'
  source: 'onsite' | 'online'
  created_at: string
  pets: {
    id: string
    name: string
    breed: string | null
    ai_photo_url: string | null
    photo_url: string | null
  } | null
  users: { id: string; name: string } | null
}

type CardPhase =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'ready'; uuid: string; serial: string }
  | { phase: 'already_bound'; uuid: string; serial: string }
  | { phase: 'error'; message: string }

// ── Environment detection (client-only) ───────────────────────────────────────

function useNfcEnv() {
  const [env, setEnv] = useState<{
    isSecure: boolean
    isWebNfc: boolean
    isChrome: boolean
    isAndroid: boolean
  } | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    setEnv({
      isSecure:
        location.protocol === 'https:' || location.hostname === 'localhost',
      isWebNfc: 'NDEFReader' in window,
      isChrome: /Chrome/.test(ua) && !/Edg|OPR|Firefox/.test(ua),
      isAndroid: /Android/.test(ua),
    })
  }, [])

  return env
}

// ── Block 1 – Search ──────────────────────────────────────────────────────────

function SearchBlock({
  selected,
  onSelect,
  onClear,
}: {
  selected: PrintRequest | null
  onSelect: (r: PrintRequest) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PrintRequest[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/nfc/search?q=${encodeURIComponent(q)}`,
      )
      const json = await res.json()
      if (res.ok) setResults((json.data?.requests as PrintRequest[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void doSearch(query), 300)
  }, [query, doSearch])

  if (selected) {
    const photo = selected.pets?.ai_photo_url ?? selected.pets?.photo_url
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary bg-primary/5 p-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PawPrint className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{selected.pets?.name ?? '—'}</p>
          {selected.pets?.breed && (
            <p className="text-xs text-muted-foreground">
              {selected.pets.breed}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            👤 {selected.users?.name ?? '—'}
          </p>
        </div>
        <Badge
          variant={selected.source === 'online' ? 'default' : 'secondary'}
          className="shrink-0 text-xs"
        >
          {selected.source === 'online' ? '線上' : '現場'}
        </Badge>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full p-1 hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋寵物名、飼主名或申請單號…"
          className="w-full rounded-xl border bg-background py-3 pl-9 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border bg-background shadow-sm">
          {results.map((r) => {
            const photo = r.pets?.ai_photo_url ?? r.pets?.photo_url
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelect(r)
                  setQuery('')
                  setResults([])
                }}
                className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {photo ? (
                    <Image
                      src={photo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PawPrint className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.pets?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.users?.name ?? '—'}
                  </p>
                </div>
                <Badge
                  variant={r.source === 'online' ? 'default' : 'secondary'}
                  className="shrink-0 text-xs"
                >
                  {r.source === 'online' ? '線上' : '現場'}
                </Badge>
              </button>
            )
          })}
        </div>
      )}

      {query.trim() && !loading && results.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          沒有符合的待綁定申請
        </p>
      )}
    </div>
  )
}

// ── Block 2 – NFC scan ────────────────────────────────────────────────────────

function NfcScanBlock({
  cardPhase,
  onPhaseChange,
}: {
  cardPhase: CardPhase
  onPhaseChange: (p: CardPhase) => void
}) {
  const env = useNfcEnv()
  const [manualUuid, setManualUuid] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  async function startScan() {
    onPhaseChange({ phase: 'scanning' })
    try {
      const result = await readNfcCard()
      onPhaseChange({ phase: 'ready', ...result })
    } catch (err) {
      onPhaseChange({
        phase: 'error',
        message: err instanceof Error ? err.message : 'NFC 感應失敗，請重試',
      })
    }
  }

  function submitManual() {
    const uuid = manualUuid.trim().toLowerCase()
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    if (!uuidRe.test(uuid)) {
      setManualError(
        '請輸入有效的 UUID（xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）',
      )
      return
    }
    setManualError(null)
    onPhaseChange({ phase: 'ready', uuid, serial: '' })
  }

  // ── Ready ──
  if (cardPhase.phase === 'ready') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-500 bg-green-50 p-3 dark:bg-green-950/20">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            卡片已感應
          </p>
          <p className="break-all font-mono text-xs text-green-600/80 dark:text-green-500">
            {cardPhase.uuid}
          </p>
          {cardPhase.serial && (
            <p className="text-xs text-green-600/60">
              序號: {cardPhase.serial}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onPhaseChange({ phase: 'idle' })}
          className="shrink-0 rounded-full p-1 hover:bg-green-100 dark:hover:bg-green-900/50"
        >
          <X className="h-4 w-4 text-green-600" />
        </button>
      </div>
    )
  }

  // ── Already bound ──
  if (cardPhase.phase === 'already_bound') {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-xl border border-orange-400 bg-orange-50 p-3 dark:bg-orange-950/20">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-orange-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              此卡片已綁定
            </p>
            <p className="break-all font-mono text-xs text-orange-500/70">
              {cardPhase.uuid}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => onPhaseChange({ phase: 'idle' })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重新感應
        </Button>
      </div>
    )
  }

  // ── Error ──
  if (cardPhase.phase === 'error') {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {cardPhase.message}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => onPhaseChange({ phase: 'idle' })}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重試
        </Button>
        <ManualInput
          value={manualUuid}
          onChange={(v) => {
            setManualUuid(v)
            setManualError(null)
          }}
          error={manualError}
          onSubmit={submitManual}
        />
      </div>
    )
  }

  // ── Idle / Scanning ──
  const envReady = !!env
  const nfcSupported = env?.isWebNfc && env.isSecure

  return (
    <div className="space-y-3">
      {envReady && !nfcSupported && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {!env!.isSecure
              ? '需要 HTTPS 才能使用 Web NFC。'
              : '此環境不支援 Web NFC，請改用 Chrome Android，或使用下方手動輸入。'}
          </span>
        </div>
      )}

      {nfcSupported && (
        <button
          type="button"
          onClick={cardPhase.phase === 'scanning' ? undefined : startScan}
          disabled={cardPhase.phase === 'scanning'}
          className={cn(
            'relative w-full rounded-2xl border-2 py-12 text-center transition-all',
            cardPhase.phase === 'scanning'
              ? 'cursor-wait border-primary bg-primary/5'
              : 'cursor-pointer border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5',
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center">
              {cardPhase.phase === 'scanning' && (
                <>
                  <span className="absolute h-20 w-20 animate-ping rounded-full bg-primary/20" />
                  <span className="absolute h-14 w-14 animate-pulse rounded-full bg-primary/15" />
                </>
              )}
              <Nfc
                className={cn(
                  'relative z-10 h-10 w-10',
                  cardPhase.phase === 'scanning'
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              />
            </div>
            <div>
              <p
                className={cn(
                  'font-medium',
                  cardPhase.phase === 'scanning'
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {cardPhase.phase === 'scanning'
                  ? '感應中，請將 NFC 卡靠近…'
                  : '點擊開始感應 NFC 卡'}
              </p>
              {cardPhase.phase === 'idle' && (
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  等待感應
                </p>
              )}
            </div>
          </div>
        </button>
      )}

      {(!nfcSupported || !envReady) && (
        <ManualInput
          value={manualUuid}
          onChange={(v) => {
            setManualUuid(v)
            setManualError(null)
          }}
          error={manualError}
          onSubmit={submitManual}
        />
      )}
    </div>
  )
}

function ManualInput({
  value,
  onChange,
  error,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  error: string | null
  onSubmit: () => void
}) {
  return (
    <div className="space-y-1.5 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        手動輸入卡片 UUID
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button size="sm" onClick={onSubmit}>
          確認
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Block 3 – Confirm binding ─────────────────────────────────────────────────

function ConfirmBlock({
  request,
  card,
  onBound,
  onCardAlreadyBound,
}: {
  request: PrintRequest
  card: CardPhase & { phase: 'ready' }
  onBound: () => void
  onCardAlreadyBound: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const petName = request.pets?.name ?? ''
  const photo = request.pets?.ai_photo_url ?? request.pets?.photo_url
  const nameMatches = confirmName.trim().toLowerCase() === petName.toLowerCase()

  async function handleBind() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/nfc/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_id: request.pets?.id,
          card_uuid: card.uuid,
          card_serial: card.serial || undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.error === 'CARD_ALREADY_BOUND') {
          setOpen(false)
          onCardAlreadyBound()
          return
        }
        setError(json.message ?? '綁定失敗，請稍後再試')
        return
      }

      setOpen(false)
      toast({ title: `${petName} 綁定成功！` })
      onBound()
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Pet + card side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-center">
          <p className="text-xs font-medium text-muted-foreground">選定寵物</p>
          <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-xl bg-muted">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <PawPrint className="h-7 w-7 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{petName}</p>
            {request.pets?.breed && (
              <p className="text-xs text-muted-foreground">
                {request.pets.breed}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-center">
          <p className="text-xs font-medium text-muted-foreground">感應卡片</p>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
            <CreditCard className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="break-all font-mono text-xs leading-tight text-muted-foreground">
            {card.uuid.slice(0, 13)}…
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          綁定後卡片將<strong className="mx-0.5">永久</strong>與此寵物鎖定，操作
          <strong className="mx-0.5">無法撤銷</strong>，請確認資訊無誤。
        </span>
      </div>

      <Button
        size="lg"
        className="w-full gap-1.5"
        onClick={() => {
          setConfirmName('')
          setError(null)
          setOpen(true)
        }}
      >
        <CreditCard className="h-4 w-4" />
        確認綁定
      </Button>

      {/* Double-confirm dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>二次確認綁定</DialogTitle>
            <DialogDescription>
              請輸入寵物名稱「<strong>{petName}</strong>」以確認此操作。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <input
              value={confirmName}
              onChange={(e) => {
                setConfirmName(e.target.value)
                setError(null)
              }}
              placeholder={`輸入「${petName}」`}
              autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              disabled={!nameMatches || submitting}
              onClick={handleBind}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              確認綁定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Success overlay ────────────────────────────────────────────────────────────

function SuccessOverlay({
  petName,
  onDismiss,
}: {
  petName: string
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-green-500">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/20">
        <CheckCircle2 className="h-16 w-16 text-white" />
      </div>
      <div className="text-center text-white">
        <p className="text-4xl font-bold">綁定成功！</p>
        <p className="mt-2 text-xl opacity-80">{petName}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 rounded-full border border-white/40 px-8 py-2.5 text-sm text-white hover:bg-white/10"
      >
        繼續下一張
      </button>
    </div>
  )
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white transition-colors',
        done ? 'bg-primary' : 'bg-muted-foreground/60',
      )}
    >
      {n}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminNfcPage() {
  const [selected, setSelected] = useState<PrintRequest | null>(null)
  const [cardPhase, setCardPhase] = useState<CardPhase>({ phase: 'idle' })
  const [successPet, setSuccessPet] = useState<string | null>(null)

  const readyToBind = selected !== null && cardPhase.phase === 'ready'

  function handleBound() {
    setSuccessPet(selected?.pets?.name ?? '寵物')
    setSelected(null)
    setCardPhase({ phase: 'idle' })
  }

  function handleCardAlreadyBound() {
    if (cardPhase.phase !== 'ready') return
    setCardPhase({
      phase: 'already_bound',
      uuid: cardPhase.uuid,
      serial: cardPhase.serial,
    })
  }

  if (successPet) {
    return (
      <SuccessOverlay
        petName={successPet}
        onDismiss={() => setSuccessPet(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4">
        <h1 className="text-lg font-bold">NFC 卡綁定</h1>
        <p className="text-xs text-muted-foreground">現場 POS 操作介面</p>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
        {/* Block 1 */}
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <StepBadge n={1} done={!!selected} />
            <h2 className="font-semibold">選擇待綁定寵物</h2>
          </div>
          <SearchBlock
            selected={selected}
            onSelect={setSelected}
            onClear={() => setSelected(null)}
          />
        </section>

        {/* Block 2 */}
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <StepBadge n={2} done={cardPhase.phase === 'ready'} />
            <h2 className="font-semibold">感應 NFC 卡片</h2>
          </div>
          <NfcScanBlock cardPhase={cardPhase} onPhaseChange={setCardPhase} />
        </section>

        {/* Block 3 */}
        <section
          className={cn(
            'space-y-3 rounded-2xl border bg-card p-4 shadow-sm transition-opacity duration-200',
            !readyToBind && 'pointer-events-none opacity-40',
          )}
        >
          <div className="flex items-center gap-2">
            <StepBadge n={3} done={false} />
            <h2 className="font-semibold">確認綁定</h2>
          </div>

          {readyToBind ? (
            <ConfirmBlock
              request={selected}
              card={cardPhase as CardPhase & { phase: 'ready' }}
              onBound={handleBound}
              onCardAlreadyBound={handleCardAlreadyBound}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              完成步驟 1 和 2 後即可綁定
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
