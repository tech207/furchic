'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Edit,
  ExternalLink,
  MapPin,
  Mic,
  PawPrint,
  QrCode,
  Shield,
  ShieldAlert,
  Tag,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CaregiversSection,
  type Caregiver,
} from '@/components/pets/CaregiversSection'
import { cn } from '@/lib/utils'

const CARD_STATUS_MAP = {
  none: {
    label: '尚未申請',
    class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  pending: {
    label: '製作中',
    class:
      'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  },
  active: {
    label: '已啟用',
    class:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  },
  disabled: {
    label: '已停用',
    class: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  },
}

const PUBLIC_FIELD_OPTIONS: { key: string; label: string; forced?: boolean }[] =
  [
    { key: 'name', label: '名字' },
    { key: 'breed', label: '品種' },
    { key: 'gender', label: '性別' },
    { key: 'birthday', label: '生日' },
    { key: 'is_neutered', label: '絕育狀態' },
    { key: 'chip_id', label: '晶片號碼' },
    { key: 'photo', label: '照片' },
    { key: 'vet_hospital', label: '固定醫院', forced: true },
    { key: 'special_care', label: '特殊照護', forced: true },
    { key: 'special_care_note', label: '照護說明' },
  ]

function calcAge(birthday: string | null): string | null {
  if (!birthday) return null
  const diff = Date.now() - new Date(birthday).getTime()
  const totalMonths = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000))
  if (totalMonths < 1) return '未滿 1 個月'
  if (totalMonths < 12) return `${totalMonths} 個月`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y} 歲 ${m} 個月` : `${y} 歲`
}

export type PetDetailData = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  birthday: string | null
  is_neutered: boolean
  chip_id: string | null
  photo_url: string | null
  ai_photo_url: string | null
  public_fields: string[]
  card_status: string
  vet_hospital: string
  special_care: boolean
  special_care_note: string | null
  nfc_card: {
    id: string
    status: string
    bound_at: string | null
    qr_url: string | null
  } | null
}

interface PetDetailClientProps {
  pet: PetDetailData
  caregivers: Caregiver[]
  myRole: 'owner' | 'caregiver'
  currentUserId: string
}

export function PetDetailClient({
  pet,
  caregivers,
  myRole,
  currentUserId,
}: PetDetailClientProps) {
  const cardStatus =
    CARD_STATUS_MAP[pet.card_status as keyof typeof CARD_STATUS_MAP] ??
    CARD_STATUS_MAP.none
  const photoSrc = pet.ai_photo_url ?? pet.photo_url

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{pet.name}</h1>
          {pet.breed && (
            <p className="mt-0.5 text-sm text-muted-foreground">{pet.breed}</p>
          )}
        </div>
        {myRole === 'owner' && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
          >
            <Link href={`/pets/${pet.id}/edit`}>
              <Edit className="h-3.5 w-3.5" />
              編輯
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="info">寵物資訊</TabsTrigger>
          <TabsTrigger value="caregivers">照護者</TabsTrigger>
          <TabsTrigger value="privacy">公開設定</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Info ─────────────────────────── */}
        <TabsContent value="info" className="space-y-4">
          {/* Photo */}
          {photoSrc ? (
            <div className="overflow-hidden rounded-2xl">
              <img
                src={photoSrc}
                alt={pet.name}
                className="h-56 w-full object-cover sm:h-72"
              />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30">
              <PawPrint className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}

          {/* Basic info */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              基本資料
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {pet.breed && (
                <InfoItem
                  icon={<Tag className="h-4 w-4" />}
                  label="品種"
                  value={pet.breed}
                />
              )}
              {pet.gender && (
                <InfoItem
                  icon={<PawPrint className="h-4 w-4" />}
                  label="性別"
                  value={pet.gender === 'male' ? '公' : '母'}
                />
              )}
              {pet.birthday && (
                <InfoItem
                  icon={<Calendar className="h-4 w-4" />}
                  label="年齡"
                  value={calcAge(pet.birthday) ?? ''}
                />
              )}
              <InfoItem
                icon={<Mic className="h-4 w-4" />}
                label="絕育"
                value={pet.is_neutered ? '已絕育' : '未絕育'}
              />
              {pet.chip_id && (
                <InfoItem
                  icon={<CreditCard className="h-4 w-4" />}
                  label="晶片"
                  value={pet.chip_id}
                />
              )}
              <InfoItem
                icon={<MapPin className="h-4 w-4" />}
                label="固定醫院"
                value={pet.vet_hospital}
                fullWidth
              />
            </div>

            {pet.special_care && (
              <>
                <Separator className="my-4" />
                <div className="flex items-start gap-3 rounded-lg bg-orange-50 p-3 dark:bg-orange-950/30">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      特殊照護需求
                    </p>
                    {pet.special_care_note && (
                      <p className="mt-1 text-sm text-orange-600/80 dark:text-orange-400/80">
                        {pet.special_care_note}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* NFC card status */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">NFC 卡狀態</h3>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  cardStatus.class,
                )}
              >
                {cardStatus.label}
              </span>
            </div>
            {pet.nfc_card && (
              <p className="mt-2 text-xs text-muted-foreground">
                卡號：{pet.nfc_card.id.split('-')[0]}…
                {pet.nfc_card.bound_at && (
                  <>
                    {' '}
                    · 綁定於{' '}
                    {new Date(pet.nfc_card.bound_at).toLocaleDateString(
                      'zh-TW',
                    )}
                  </>
                )}
              </p>
            )}
            {pet.card_status === 'none' && (
              <p className="mt-2 text-xs text-muted-foreground">
                尚未申請製卡，可至商店訂購含 NFC 卡的套組
              </p>
            )}
          </div>

          {/* NFC public card preview — only when card is active */}
          {pet.nfc_card?.status === 'active' && (
            <NfcPublicCardSection nfcCard={pet.nfc_card} petId={pet.id} />
          )}
        </TabsContent>

        {/* ── Tab 2: Caregivers ─────────────────── */}
        <TabsContent value="caregivers">
          <CaregiversSection
            petId={pet.id}
            initialCaregivers={caregivers}
            currentUserId={currentUserId}
            myRole={myRole}
          />
        </TabsContent>

        {/* ── Tab 3: Privacy ────────────────────── */}
        <TabsContent value="privacy">
          <PrivacyTab petId={pet.id} initialFields={pet.public_fields} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoItem({
  icon,
  label,
  value,
  fullWidth,
}: {
  icon: React.ReactNode
  label: string
  value: string
  fullWidth?: boolean
}) {
  return (
    <div className={cn('flex items-start gap-2.5', fullWidth && 'col-span-2')}>
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

// ── NFC Public Card Section ───────────────────────────────────────────────────

type NfcCardProp = NonNullable<PetDetailData['nfc_card']>

function NfcPublicCardSection({
  nfcCard,
  petId,
}: {
  nfcCard: NfcCardProp
  petId: string
}) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [cardDisabled, setCardDisabled] = useState(false)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const cardUrl = `${siteUrl}/pet/${nfcCard.id}`

  // Use stored QR if available; fall back to qrserver API
  const qrSrc =
    nfcCard.qr_url ??
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&data=${encodeURIComponent(cardUrl)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(cardUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available (non-HTTPS / blocked)
    }
  }

  async function disableCard() {
    if (!window.confirm('確定要停用此 NFC 卡？停用後掃描將無法查看寵物資訊。'))
      return
    setDisabling(true)
    try {
      const res = await fetch(`/api/pets/${petId}/card-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disabled' }),
      })
      if (res.ok) setCardDisabled(true)
    } finally {
      setDisabling(false)
    }
  }

  if (cardDisabled) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          NFC 卡已停用
        </p>
        <p className="mt-1 text-xs text-red-600/80">
          掃描此卡的人將無法查看任何寵物資訊。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">NFC 公開名片</h3>
          <p className="text-xs text-muted-foreground">
            這是任何人掃描您的 NFC 卡或 QR Code 後看到的頁面
          </p>
        </div>
      </div>

      {/* QR preview + action buttons */}
      <div className="flex items-start gap-4">
        {/* Clickable QR thumbnail */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogTrigger asChild>
            <button
              aria-label="放大 QR Code"
              className="relative h-24 w-24 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border bg-white transition hover:opacity-80"
            >
              <Image
                src={qrSrc}
                alt="NFC 公開名片 QR Code"
                fill
                className="object-contain p-1"
                sizes="96px"
                unoptimized={!nfcCard.qr_url}
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-xs p-6 text-center">
            <div className="relative mx-auto h-64 w-64">
              <Image
                src={qrSrc}
                alt="NFC 公開名片 QR Code"
                fill
                className="object-contain"
                sizes="256px"
                unoptimized={!nfcCard.qr_url}
              />
            </div>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              {cardUrl}
            </p>
          </DialogContent>
        </Dialog>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => window.open(`/pet/${nfcCard.id}`, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            預覽名片頁
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? '已複製！' : '複製連結'}
          </Button>
        </div>
      </div>

      {/* Disable warning */}
      <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <p className="text-xs text-red-600 dark:text-red-400">
          卡片遺失？
          <button
            onClick={disableCard}
            disabled={disabling}
            className="ml-1 font-semibold underline underline-offset-2 hover:opacity-70 disabled:opacity-40"
          >
            {disabling ? '停用中…' : '點擊停用'}
          </button>
          可立即保護個資
        </p>
      </div>
    </div>
  )
}

// ── Privacy Tab ───────────────────────────────────────────────────────────────

function PrivacyTab({
  petId,
  initialFields,
}: {
  petId: string
  initialFields: string[]
}) {
  const [publicFields, setPublicFields] = useState<string[]>(initialFields)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  function toggle(key: string, on: boolean) {
    const next = on
      ? Array.from(new Set([...publicFields, key]))
      : publicFields.filter((f) => f !== key)
    const withForced = Array.from(
      new Set([...next, 'vet_hospital', 'special_care']),
    )
    setPublicFields(withForced)

    clearTimeout(timerRef.current)
    setSaved(false)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      await fetch(`/api/pets/${petId}/privacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_fields: withForced }),
      })
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 1000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          選擇要在 NFC 掃描頁面公開的欄位
        </p>
        <span
          className={cn(
            'flex items-center gap-1 text-xs transition-opacity',
            saving || saved ? 'opacity-100' : 'opacity-0',
          )}
        >
          {saved ? (
            <>
              <Check className="h-3 w-3 text-green-600" />
              <span className="text-green-600">已儲存</span>
            </>
          ) : (
            <>
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">儲存中…</span>
            </>
          )}
        </span>
      </div>

      <div className="divide-y divide-border rounded-xl border bg-card">
        {PUBLIC_FIELD_OPTIONS.map((opt) => {
          const isOn = publicFields.includes(opt.key)
          return (
            <div
              key={opt.key}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                {opt.forced && (
                  <p className="text-xs text-muted-foreground">
                    緊急資訊，強制公開
                  </p>
                )}
              </div>
              <Switch
                checked={isOn}
                disabled={opt.forced}
                onCheckedChange={(v) => toggle(opt.key, v)}
              />
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        * 固定醫院和特殊照護屬緊急資訊，無法隱藏
      </p>
    </div>
  )
}
