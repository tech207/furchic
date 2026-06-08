'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ImageIcon,
  Loader2,
  MapPin,
  Package,
  Printer,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardPageState = 'eligible' | 'applied' | 'has_card' | 'ineligible'
export type IneligibleReason =
  | 'not_owner'
  | 'requests_disabled'
  | 'no_ai_photo'
  | 'no_vet_hospital'

export interface CardPet {
  id: string
  name: string
  breed: string | null
  ai_photo_url: string | null
  photo_url: string | null
  vet_hospital: string
  card_status: string
}

export interface ExistingRequest {
  id: string
  status: 'pending' | 'printing' | 'done'
  source: 'onsite' | 'online'
  created_at: string
}

export interface QualifyingOrder {
  id: string
  created_at: string
  total_amount: number
}

interface CardRequestFlowProps {
  petId: string
  pet: CardPet
  pageState: CardPageState
  ineligibleReason?: IneligibleReason | null
  existingRequest?: ExistingRequest | null
  qualifyingOrders?: QualifyingOrder[]
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: '確認資料' },
  { id: 2, label: '卡面預覽' },
  { id: 3, label: '申請方式' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                s.id < current
                  ? 'bg-primary text-white'
                  : s.id === current
                    ? 'bg-primary text-white ring-2 ring-primary/30 ring-offset-2'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {s.id < current ? <Check className="h-3.5 w-3.5" /> : s.id}
            </div>
            <span
              className={cn(
                'text-[11px] font-medium',
                s.id === current ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mb-4 h-px w-10 transition-colors',
                s.id < current ? 'bg-primary' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Status pages ──────────────────────────────────────────────────────────────

const REQUEST_STATUS = {
  pending: {
    label: '等待製作中',
    icon: Loader2,
    color: 'text-yellow-600',
    spin: true,
  },
  printing: {
    label: '印製中',
    icon: Printer,
    color: 'text-blue-600',
    spin: false,
  },
  done: {
    label: '製作完成！',
    icon: Check,
    color: 'text-green-600',
    spin: false,
  },
}

function AppliedState({ request }: { request: ExistingRequest }) {
  const s = REQUEST_STATUS[request.status]
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full bg-muted',
          s.color,
        )}
      >
        <s.icon className={cn('h-8 w-8', s.spin && 'animate-spin')} />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">{s.label}</p>
        <p className="text-sm text-muted-foreground">
          申請來源：{request.source === 'onsite' ? '現場兌換' : '線上訂單'}
        </p>
        <p className="text-xs text-muted-foreground">
          申請時間：{new Date(request.created_at).toLocaleString('zh-TW')}
        </p>
      </div>
      {request.status === 'done' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
          您的 NFC 卡已製作完成，即將或已寄出。收到後請至寵物詳情頁掃描綁定。
        </div>
      )}
    </div>
  )
}

function IneligibleState({
  petId,
  reason,
}: {
  petId: string
  reason?: IneligibleReason | null
}) {
  const messages: Record<
    IneligibleReason,
    { title: string; desc: string; action?: { label: string; href: string } }
  > = {
    not_owner: {
      title: '僅限飼主申請',
      desc: '只有飼主可以為寵物申請製卡，照護者無法操作此功能。',
    },
    requests_disabled: {
      title: '製卡申請暫停中',
      desc: '目前製卡申請功能暫時關閉，請稍後再試或聯繫客服。',
    },
    no_ai_photo: {
      title: '缺少 AI 去背照片',
      desc: '需要先上傳 AI 去背照片才能申請製卡，前往寵物資料頁面操作。',
      action: { label: '前往上傳照片', href: `/pets/${petId}` },
    },
    no_vet_hospital: {
      title: '缺少固定醫院資料',
      desc: '需要先填寫固定醫院才能申請製卡，這是緊急聯絡卡的必要資訊。',
      action: { label: '前往填寫資料', href: `/pets/${petId}/edit` },
    },
  }

  const info = reason
    ? messages[reason]
    : { title: '目前無申請資格', desc: '請確認寵物資料完整後再試。' }

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">{info.title}</p>
        <p className="text-sm text-muted-foreground">{info.desc}</p>
      </div>
      {info.action && (
        <Button asChild variant="outline">
          <Link href={info.action.href}>{info.action.label}</Link>
        </Button>
      )}
    </div>
  )
}

function HasCardState({ pet }: { pet: CardPet }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CreditCard className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-bold">{pet.name} 已有 NFC 卡</p>
        <p className="text-sm text-muted-foreground">
          {pet.card_status === 'active'
            ? '卡片已啟用，掃描 NFC 可查看緊急聯絡資訊。'
            : '卡片目前已停用，可在寵物詳情頁重新啟用。'}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={`/pets/${pet.id}`}>查看寵物資訊</Link>
      </Button>
    </div>
  )
}

// ── Wizard steps ──────────────────────────────────────────────────────────────

function Step1({ pet, onNext }: { pet: CardPet; onNext: () => void }) {
  const hasAiPhoto = !!pet.ai_photo_url
  const hasVet = !!pet.vet_hospital
  const canProceed = hasAiPhoto && hasVet

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">確認寵物資料</h2>

      {/* Pet photo */}
      <div className="flex items-center gap-4">
        {pet.ai_photo_url || pet.photo_url ? (
          <img
            src={pet.ai_photo_url ?? pet.photo_url ?? ''}
            alt={pet.name}
            className="h-20 w-20 rounded-xl object-cover ring-2 ring-primary/30"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <div>
          <p className="font-semibold">{pet.name}</p>
          {pet.breed && (
            <p className="text-sm text-muted-foreground">{pet.breed}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Requirements checklist */}
      <div className="space-y-3">
        <RequirementRow
          ok={hasAiPhoto}
          label="AI 去背照片"
          failNote="卡面需要 AI 去背照片，請先上傳"
          icon={<ImageIcon className="h-4 w-4" />}
        />
        <RequirementRow
          ok={hasVet}
          label={hasVet ? `固定醫院：${pet.vet_hospital}` : '固定醫院（必填）'}
          failNote="緊急聯絡卡需填寫固定醫院"
          icon={<MapPin className="h-4 w-4" />}
        />
      </div>

      {!canProceed && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            請先完善資料才能繼續。前往
            <Link
              href={`/pets/${pet.id}/edit`}
              className="font-medium underline underline-offset-2"
            >
              編輯寵物資料
            </Link>
            。
          </span>
        </div>
      )}

      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full gap-1.5"
      >
        下一步
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function RequirementRow({
  ok,
  label,
  failNote,
  icon,
}: {
  ok: boolean
  label: string
  failNote: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'mt-0.5 shrink-0',
          ok ? 'text-green-600' : 'text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p
          className={cn('text-sm font-medium', !ok && 'text-muted-foreground')}
        >
          {label}
        </p>
        {!ok && <p className="mt-0.5 text-xs text-orange-600">{failNote}</p>}
      </div>
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          ok ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600',
        )}
      >
        {ok ? (
          <Check className="h-3 w-3" />
        ) : (
          <AlertCircle className="h-3 w-3" />
        )}
      </div>
    </div>
  )
}

function Step2({
  petId,
  preview,
  onPreviewReady,
  onBack,
  onNext,
}: {
  petId: string
  preview: { front: string; back: string } | null
  onPreviewReady: (p: { front: string; back: string }) => void
  onBack: () => void
  onNext: () => void
}) {
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (preview) return
    void loadPreview()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPreview() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet_id: petId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message ?? '預覽生成失敗')
        return
      }
      onPreviewReady({ front: json.data.front_url, back: json.data.back_url })
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">卡面預覽</h2>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="relative">
            <CreditCard className="h-16 w-16 text-primary/30" />
            <Loader2 className="absolute -right-1 -top-1 h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            AI 正在生成您的卡面，約需 15–30 秒…
          </p>
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={loadPreview}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新生成
          </Button>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-center text-xs font-medium text-muted-foreground">
                正面
              </p>
              <img
                src={preview.front}
                alt="卡面正面"
                className="w-full rounded-xl ring-1 ring-border"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-center text-xs font-medium text-muted-foreground">
                背面
              </p>
              <img
                src={preview.back}
                alt="卡面背面"
                className="w-full rounded-xl ring-1 ring-border"
              />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            預覽圖僅供參考，實際印製效果可能略有差異
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          上一步
        </Button>
        <Button
          onClick={onNext}
          disabled={!preview || loading}
          className="flex-1 gap-1.5"
        >
          下一步
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Step3({
  petId,
  qualifyingOrders,
  onBack,
  onSuccess,
}: {
  petId: string
  qualifyingOrders?: QualifyingOrder[]
  onBack: () => void
  onSuccess: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [source, setSource] = useState<'onsite' | 'online'>(
    qualifyingOrders && qualifyingOrders.length > 0 ? 'online' : 'onsite',
  )
  const [code, setCode] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(
    qualifyingOrders?.[0]?.id ?? '',
  )
  const [codeError, setCodeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (source === 'onsite') {
      if (!code.trim()) {
        setCodeError('請輸入兌換碼')
        return
      }
      if (!/^[A-Z0-9-]{4,40}$/i.test(code.trim())) {
        setCodeError('兌換碼格式不正確')
        return
      }
      setCodeError(null)
    }

    setError(null)
    setSubmitting(true)
    try {
      const body =
        source === 'onsite'
          ? { pet_id: petId, redemption_code: code.trim().toUpperCase() }
          : { pet_id: petId, order_id: selectedOrderId }

      const res = await fetch('/api/cards/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.message ?? '申請失敗，請稍後再試')
        return
      }

      toast({
        title: '製卡申請已送出！',
        description: '我們將盡快開始印製，完成後通知您。',
      })
      onSuccess()
      router.refresh()
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const hasOnlineOption = qualifyingOrders && qualifyingOrders.length > 0

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">選擇申請方式</h2>

      {/* Source selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSource('onsite')}
          className={cn(
            'rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
            source === 'onsite'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50',
          )}
        >
          🏪 現場兌換
        </button>
        <button
          type="button"
          onClick={() => setSource('online')}
          disabled={!hasOnlineOption}
          className={cn(
            'rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            source === 'online'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50',
          )}
        >
          🛒 線上訂單
        </button>
      </div>

      {source === 'onsite' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">兌換碼</label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setCodeError(null)
            }}
            className="block w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="FURCH-XXXX-XXXX"
            maxLength={40}
          />
          {codeError && <p className="text-xs text-destructive">{codeError}</p>}
        </div>
      )}

      {source === 'online' && hasOnlineOption && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">線上訂單資格</span>
            <Badge variant="secondary" className="text-xs">
              已驗證
            </Badge>
          </div>
          {qualifyingOrders!.map((order) => (
            <label
              key={order.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                selectedOrderId === order.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border',
              )}
            >
              <input
                type="radio"
                value={order.id}
                checked={selectedOrderId === order.id}
                onChange={() => setSelectedOrderId(order.id)}
                className="h-4 w-4 text-primary"
              />
              <div>
                <p className="text-sm font-medium">
                  訂單 #{order.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString('zh-TW')} · NT${' '}
                  {order.total_amount.toLocaleString()}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          上一步
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              送出中…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              確認申請
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CardRequestFlow({
  petId,
  pet,
  pageState,
  ineligibleReason,
  existingRequest,
  qualifyingOrders,
}: CardRequestFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [preview, setPreview] = useState<{
    front: string
    back: string
  } | null>(null)
  const [applied, setApplied] = useState(false)

  if (applied && existingRequest) {
    return <AppliedState request={existingRequest} />
  }

  if (pageState === 'ineligible') {
    return <IneligibleState petId={petId} reason={ineligibleReason} />
  }

  if (pageState === 'has_card') {
    return <HasCardState pet={pet} />
  }

  if (pageState === 'applied' && existingRequest) {
    return <AppliedState request={existingRequest} />
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <StepIndicator current={step} />

      {step === 1 && <Step1 pet={pet} onNext={() => setStep(2)} />}

      {step === 2 && (
        <Step2
          petId={petId}
          preview={preview}
          onPreviewReady={setPreview}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3
          petId={petId}
          qualifyingOrders={qualifyingOrders}
          onBack={() => setStep(2)}
          onSuccess={() => {
            router.push(`/pets/${petId}`)
          }}
        />
      )}
    </div>
  )
}
