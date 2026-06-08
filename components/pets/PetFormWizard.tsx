'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PawPrint,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ImageUploader } from '@/components/common/ImageUploader'
import { cn } from '@/lib/utils'

const SPECIES_OPTIONS = [
  { value: 'dog', label: '狗' },
  { value: 'cat', label: '貓' },
  { value: 'rabbit', label: '兔子' },
  { value: 'bird', label: '鳥類' },
  { value: 'hamster', label: '倉鼠' },
  { value: 'other', label: '其他' },
]

const BREEDS_BY_SPECIES: Record<string, string[]> = {
  dog: [
    '柴犬',
    '貴賓犬（玩具型）',
    '貴賓犬（迷你型）',
    '貴賓犬（標準型）',
    '黃金獵犬',
    '拉布拉多',
    '法國鬥牛犬',
    '哈士奇',
    '邊境牧羊犬',
    '約克夏梗',
    '瑪爾濟斯',
    '比熊犬',
    '博美犬',
    '柯基犬（彭布洛克）',
    '薩摩耶',
    '雪納瑞（迷你型）',
    '巴哥犬',
    '比格犬',
    '大麥町',
    '德國牧羊犬',
    '臘腸犬',
    '西施犬',
    '吉娃娃',
    '阿拉斯加雪橇犬',
    '波士頓梗',
    '鬆獅犬',
    '秋田犬',
    '米克斯（狗）',
  ],
  cat: [
    '英國短毛貓',
    '美國短毛貓',
    '布偶貓',
    '波斯貓',
    '緬因貓',
    '蘇格蘭摺耳貓',
    '暹羅貓',
    '孟加拉貓',
    '俄羅斯藍貓',
    '阿比西尼亞貓',
    '挪威森林貓',
    '緬甸貓',
    '土耳其安哥拉貓',
    '東方短毛貓',
    '加拿大無毛貓',
    '橘貓',
    '三花貓',
    '虎斑貓',
    '米克斯（貓）',
  ],
  rabbit: [
    '荷蘭矮兔',
    '侏儒兔',
    '安哥拉兔',
    '雷克斯兔',
    '獅子頭兔',
    '垂耳兔',
    '米克斯（兔）',
  ],
  bird: [
    '虎皮鸚鵡',
    '玄鳳鸚鵡',
    '桃面愛情鸚鵡',
    '太平洋鸚鵡',
    '文鳥',
    '金絲雀',
    '其他鳥類',
  ],
  hamster: [
    '黃金鼠（敘利亞倉鼠）',
    '坎貝爾侏儒倉鼠',
    '俄羅斯侏儒倉鼠',
    '冬白侏儒倉鼠',
    '布丁鼠',
    '三線鼠',
    '其他倉鼠',
  ],
  other: [],
}

function detectSpeciesFromBreed(breed: string | null | undefined): string {
  if (!breed) return ''
  for (const [sp, breeds] of Object.entries(BREEDS_BY_SPECIES)) {
    if (breeds.includes(breed)) return sp
  }
  return 'other'
}

export interface PetFormInitialData {
  name: string
  breed: string | null
  gender: 'male' | 'female' | null
  birthday: string | null
  is_neutered: boolean
  chip_id: string | null
  vet_hospital: string
  special_care: boolean
  special_care_note: string | null
  photo_url: string | null
}

interface PetFormWizardProps {
  mode: 'create' | 'edit'
  petId?: string
  userId: string
  initialData?: PetFormInitialData
}

const STEPS = [
  { id: 1, label: '基本資料' },
  { id: 2, label: '照片' },
  { id: 3, label: '確認' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export function PetFormWizard({
  mode,
  petId,
  userId,
  initialData,
}: PetFormWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [tempPhotoId] = useState(() => Date.now())

  const [name, setName] = useState(initialData?.name ?? '')
  const [species, setSpecies] = useState(() =>
    detectSpeciesFromBreed(initialData?.breed),
  )
  const [breed, setBreed] = useState(initialData?.breed ?? '')
  const [gender, setGender] = useState<'male' | 'female' | ''>(
    initialData?.gender ?? '',
  )
  const [birthday, setBirthday] = useState(initialData?.birthday ?? '')
  const [isNeutered, setIsNeutered] = useState(
    initialData?.is_neutered ?? false,
  )
  const [chipId, setChipId] = useState(initialData?.chip_id ?? '')
  const [vetHospital, setVetHospital] = useState(
    initialData?.vet_hospital ?? '',
  )
  const [specialCare, setSpecialCare] = useState(
    initialData?.special_care ?? false,
  )
  const [specialCareNote, setSpecialCareNote] = useState(
    initialData?.special_care_note ?? '',
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initialData?.photo_url ?? null,
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validateStep1(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = '請輸入寵物名稱'
    if (name.trim().length > 50) errs.name = '名稱最多 50 字'
    if (!vetHospital.trim()) errs.vetHospital = '請輸入固定醫院'
    if (birthday && new Date(birthday) > new Date())
      errs.birthday = '生日不能是未來日期'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNextStep() {
    if (step === 1 && !validateStep1()) return
    setStep((s) => Math.min(s + 1, 3))
  }

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        ...(breed.trim() && { breed: breed.trim() }),
        ...(gender && { gender }),
        ...(birthday && { birthday }),
        is_neutered: isNeutered,
        ...(chipId.trim() && { chip_id: chipId.trim() }),
        vet_hospital: vetHospital.trim(),
        special_care: specialCare,
        ...(specialCare &&
          specialCareNote.trim() && {
            special_care_note: specialCareNote.trim(),
          }),
        ...(photoUrl && { photo_url: photoUrl }),
      }

      const url = mode === 'create' ? '/api/pets' : `/api/pets/${petId}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.message ?? '操作失敗，請稍後再試')
        return
      }
      const id =
        mode === 'create'
          ? (json.data as { pet: { id: string } }).pet.id
          : petId!
      router.push(`/pets/${id}`)
      router.refresh()
    } catch {
      setSubmitError('網路錯誤，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const photoPath = userId
    ? mode === 'edit' && petId
      ? `${userId}/${petId}.jpg`
      : `${userId}/temp_${tempPhotoId}.jpg`
    : `temp/${tempPhotoId}.jpg`

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <StepIndicator current={step} />

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold">基本資料</h2>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium">
              寵物名稱 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="毛毛"
            />
            <FieldError message={errors.name} />
          </div>

          {/* Species */}
          <div>
            <label className="block text-sm font-medium">種類</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {SPECIES_OPTIONS.map((sp) => (
                <button
                  key={sp.value}
                  type="button"
                  onClick={() => {
                    if (sp.value !== species) {
                      setSpecies(sp.value)
                      setBreed('')
                    }
                  }}
                  className={cn(
                    'rounded-xl border py-2.5 text-sm font-medium transition-colors',
                    species === sp.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Breed — shown only after species is selected */}
          {species && (
            <div>
              <label className="block text-sm font-medium">品種</label>
              <input
                type="text"
                list="breed-options"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={
                  species === 'other' ? '請輸入品種' : '選擇或輸入品種'
                }
              />
              <datalist id="breed-options">
                {(BREEDS_BY_SPECIES[species] ?? []).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          )}

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium">性別</label>
            <div className="mt-1.5 flex gap-4">
              {[
                { value: 'male', label: '公' },
                { value: 'female', label: '母' },
              ].map((g) => (
                <label
                  key={g.value}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    checked={gender === g.value}
                    onChange={() => setGender(g.value as 'male' | 'female')}
                    className="h-4 w-4 border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{g.label}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value=""
                  checked={gender === ''}
                  onChange={() => setGender('')}
                  className="h-4 w-4 border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">不填</span>
              </label>
            </div>
          </div>

          {/* Birthday */}
          <div>
            <label className="block text-sm font-medium">生日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <FieldError message={errors.birthday} />
          </div>

          {/* Is Neutered */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">已絕育</p>
              <p className="text-xs text-muted-foreground">已完成絕育手術</p>
            </div>
            <Switch checked={isNeutered} onCheckedChange={setIsNeutered} />
          </div>

          {/* Chip ID */}
          <div>
            <label className="block text-sm font-medium">晶片號碼</label>
            <input
              type="text"
              value={chipId}
              onChange={(e) => setChipId(e.target.value)}
              maxLength={50}
              className="mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="如無晶片請填「無」"
            />
          </div>

          {/* Vet Hospital */}
          <div>
            <label className="block text-sm font-medium">
              固定醫院 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={vetHospital}
              onChange={(e) => setVetHospital(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="XX 動物醫院"
            />
            <FieldError message={errors.vetHospital} />
          </div>

          {/* Special Care */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">特殊照護需求</p>
                <p className="text-xs text-muted-foreground">
                  有用藥、過敏或特殊狀況
                </p>
              </div>
              <Switch checked={specialCare} onCheckedChange={setSpecialCare} />
            </div>
            {specialCare && (
              <textarea
                value={specialCareNote}
                onChange={(e) => setSpecialCareNote(e.target.value)}
                rows={3}
                className="block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="請描述照護需求，例如：對花生過敏、每天需服藥一次…"
              />
            )}
          </div>
        </div>
      )}

      {/* Step 2: Photo */}
      {step === 2 && (
        <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">寵物照片</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              上傳後可用 AI 去背，讓名片更好看（可略過）
            </p>
          </div>
          <ImageUploader
            bucketName="pet-photos"
            filePath={photoPath}
            onUpload={(url) => setPhotoUrl(url)}
            currentImageUrl={photoUrl ?? undefined}
            aspectRatio="1:1"
          />
          <p className="text-xs text-muted-foreground">
            若不上傳照片可直接點「下一步」
          </p>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">確認資料</h2>
            {photoUrl && (
              <img
                src={photoUrl}
                alt={name}
                className="mb-4 h-32 w-32 rounded-xl object-cover ring-2 ring-border"
              />
            )}
            <dl className="space-y-2 text-sm">
              <SummaryRow label="名稱" value={name} />
              {species && (
                <SummaryRow
                  label="種類"
                  value={
                    SPECIES_OPTIONS.find((s) => s.value === species)?.label ??
                    species
                  }
                />
              )}
              {breed && <SummaryRow label="品種" value={breed} />}
              {gender && (
                <SummaryRow
                  label="性別"
                  value={gender === 'male' ? '公' : '母'}
                />
              )}
              {birthday && <SummaryRow label="生日" value={birthday} />}
              <SummaryRow
                label="絕育"
                value={isNeutered ? '已絕育' : '未絕育'}
              />
              {chipId && <SummaryRow label="晶片號碼" value={chipId} />}
              <SummaryRow label="固定醫院" value={vetHospital} />
              <SummaryRow label="特殊照護" value={specialCare ? '是' : '否'} />
              {specialCare && specialCareNote && (
                <SummaryRow label="照護說明" value={specialCareNote} />
              )}
            </dl>
          </div>

          {submitError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={isSubmitting}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            上一步
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/pets')}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            取消
          </Button>
        )}

        {step < 3 ? (
          <Button
            type="button"
            onClick={handleNextStep}
            className="ml-auto gap-1.5"
          >
            下一步
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="ml-auto gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                處理中…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {mode === 'create' ? '建立寵物' : '儲存變更'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
