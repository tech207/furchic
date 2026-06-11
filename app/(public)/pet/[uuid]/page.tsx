import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Phone,
  MessageCircle,
  Instagram,
  Facebook,
  Globe,
  ShieldAlert,
  PawPrint,
  Scissors,
  CreditCard,
  Hospital,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PetCardEditButton } from '@/components/pets/PetCardEditButton'
import { NfcScanTracker } from '@/components/pets/NfcScanTracker'
import { cn } from '@/lib/utils'

// ─── UUID validation ────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Types ──────────────────────────────────────────────────────────────────

type ContactMethod = {
  id: string
  type: 'phone' | 'line' | 'instagram' | 'facebook' | 'other'
  label: string
  value: string
  is_public: boolean
}

type PublicPet = {
  id: string
  name?: string
  breed?: string | null
  gender?: string | null
  birthday?: string | null
  is_neutered?: boolean
  chip_id?: string | null
  photo_url?: string | null
  vet_hospital?: string
  special_care?: boolean
  special_care_note?: string | null
}

type PublicCaregiver = {
  id: string
  display_name: string | null
  contact_methods: ContactMethod[]
  user: { id: string; name: string; avatar_url: string | null } | null
}

type CardResult =
  | { disabled: true }
  | { pet: PublicPet; caregivers: PublicCaregiver[] }

// ─── Data fetching (direct DB, no HTTP round-trip) ──────────────────────────

const FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  breed: 'breed',
  gender: 'gender',
  birthday: 'birthday',
  is_neutered: 'is_neutered',
  chip_id: 'chip_id',
  photo: 'photo_url',
  vet_hospital: 'vet_hospital',
  special_care: 'special_care',
  special_care_note: 'special_care_note',
}

async function getCardData(uuid: string): Promise<CardResult | null> {
  if (!UUID_REGEX.test(uuid)) return null

  const supabase = createClient()

  const { data: nfcCardRaw } = await supabase
    .from('nfc_cards')
    .select('id, pet_id, status')
    .eq('id', uuid)
    .single()

  if (!nfcCardRaw) return null
  const nfcCard = nfcCardRaw as unknown as { id: string; pet_id: string | null }
  if (!nfcCard.pet_id) return null

  const { data: petRaw } = await supabase
    .from('pets')
    .select(
      'id, name, breed, gender, birthday, is_neutered, chip_id, photo_url, public_fields, card_status, vet_hospital, special_care, special_care_note',
    )
    .eq('id', nfcCard.pet_id)
    .single()

  if (!petRaw) return null
  const pet = petRaw as unknown as Record<string, unknown>

  if (pet.card_status === 'disabled') return { disabled: true }

  // Filter to only public fields
  const publicFields = Array.isArray(pet.public_fields)
    ? (pet.public_fields as string[])
    : []
  const publicPet: Record<string, unknown> = { id: pet.id }
  for (const field of publicFields) {
    const col = FIELD_TO_COLUMN[field]
    if (col && pet[col] !== undefined) {
      publicPet[field === 'photo' ? 'photo_url' : col] = pet[col]
    }
  }

  // Visible caregivers with is_public contact methods only
  type RawCaregiver = {
    id: string
    display_name: string | null
    contact_methods: ContactMethod[]
    sort_order: number
    users: { id: string; name: string; avatar_url: string | null } | null
  }

  const { data: caregiversRaw } = await supabase
    .from('pet_caregivers')
    .select(
      'id, display_name, contact_methods, sort_order, users ( id, name, avatar_url )',
    )
    .eq('pet_id', nfcCard.pet_id)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  const caregivers = ((caregiversRaw as unknown as RawCaregiver[]) ?? []).map(
    (c) => ({
      id: c.id,
      display_name: c.display_name,
      contact_methods: (c.contact_methods ?? []).filter((m) => m.is_public),
      user: c.users ?? null,
    }),
  )

  return { pet: publicPet as PublicPet, caregivers }
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { uuid: string }
}): Promise<Metadata> {
  if (!UUID_REGEX.test(params.uuid)) {
    return { title: '找不到頁面 | Pet.chic Weekend' }
  }

  const data = await getCardData(params.uuid)
  if (!data || 'disabled' in data) {
    return { title: '寵物名片 | Pet.chic Weekend' }
  }

  const { pet } = data
  const name = pet.name ?? '毛孩'
  const breedPart = pet.breed ? `（${pet.breed}）` : ''
  const description = `這是 ${name}${breedPart} 的寵物緊急聯絡資訊，請聯絡以下照護者`

  return {
    title: `${name} 的緊急聯絡卡 | Pet.chic Weekend`,
    description,
    openGraph: {
      title: `${name} 的緊急聯絡卡`,
      description,
      ...(pet.photo_url && {
        images: [{ url: pet.photo_url, width: 800, height: 800, alt: name }],
      }),
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${name} 的緊急聯絡卡 | Pet.chic Weekend`,
      description,
      ...(pet.photo_url && { images: [pet.photo_url] }),
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcAge(birthday: string): string {
  const diff = Date.now() - new Date(birthday).getTime()
  const months = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000))
  if (months < 1) return '未滿 1 個月'
  if (months < 12) return `${months} 個月`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m > 0 ? `${y} 歲 ${m} 個月` : `${y} 歲`
}

function contactHref(m: ContactMethod): string {
  switch (m.type) {
    case 'phone':
      return `tel:${m.value.replace(/\s|-/g, '')}`
    case 'line':
      return `https://line.me/ti/p/${m.value.startsWith('@') ? m.value : `~${m.value}`}`
    case 'instagram':
      return `https://instagram.com/${m.value.replace(/^@/, '')}`
    case 'facebook':
      return `https://facebook.com/${m.value}`
    default:
      return m.value.startsWith('http') ? m.value : `https://${m.value}`
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DisabledPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gray-50 px-6 py-16 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200">
        <PawPrint className="h-12 w-12 text-gray-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-gray-600">
          此寵物卡片目前已停用
        </h1>
        <p className="text-sm text-gray-400">
          飼主可在 Pet.chic Weekend WebApp 重新啟用
        </p>
      </div>
    </main>
  )
}

const CONTACT_ICON: Record<ContactMethod['type'], React.ElementType> = {
  phone: Phone,
  line: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  other: Globe,
}

const CONTACT_LABEL: Record<ContactMethod['type'], string> = {
  phone: '電話',
  line: 'LINE',
  instagram: 'Instagram',
  facebook: 'Facebook',
  other: '連結',
}

function CaregiverCard({ c }: { c: PublicCaregiver }) {
  const displayName = c.display_name ?? c.user?.name ?? '照護者'
  const initials = displayName.slice(0, 2)
  const phones = c.contact_methods.filter((m) => m.type === 'phone')
  const socials = c.contact_methods.filter((m) => m.type !== 'phone')

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      {/* Caregiver identity */}
      <div className="mb-4 flex items-center gap-3">
        {c.user?.avatar_url ? (
          <img
            src={c.user.avatar_url}
            alt={displayName}
            className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{displayName}</p>
          {c.contact_methods.length === 0 && (
            <p className="text-xs text-gray-400">無聯絡方式</p>
          )}
        </div>
      </div>

      {/* Phone — prominent call button */}
      {phones.map((m) => (
        <a
          key={m.id}
          href={contactHref(m)}
          className="mb-3 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-green-500 px-5 text-base font-semibold text-white shadow-md transition-transform active:scale-95"
        >
          <Phone className="h-5 w-5" />
          {m.label || m.value}
        </a>
      ))}

      {/* Social / other contacts */}
      {socials.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {socials.map((m) => {
            const Icon = CONTACT_ICON[m.type]
            return (
              <a
                key={m.id}
                href={contactHref(m)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <Icon className="h-4 w-4" />
                {m.label || CONTACT_LABEL[m.type]}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── JSON-LD ─────────────────────────────────────────────────────────────────

function JsonLd({
  pet,
  caregivers,
  url,
}: {
  pet: PublicPet
  caregivers: PublicCaregiver[]
  url: string
}) {
  const phoneCaregivers = caregivers
    .map((c) => {
      const phone = c.contact_methods.find((m) => m.type === 'phone')
      if (!phone) return null
      return {
        '@type': 'Person',
        name: c.display_name ?? c.user?.name ?? '照護者',
        telephone: phone.value,
      }
    })
    .filter(Boolean)

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${pet.name ?? '毛孩'} 的緊急聯絡卡`,
    description: `這是 ${pet.name ?? '毛孩'} 的寵物緊急聯絡資訊`,
    url,
    ...(pet.photo_url && { image: pet.photo_url }),
    mainEntity: {
      '@type': 'Animal',
      name: pet.name ?? '毛孩',
      ...(pet.photo_url && { image: pet.photo_url }),
      ...(pet.breed && { description: pet.breed }),
      ...(pet.birthday && { birthDate: pet.birthday }),
      ...(phoneCaregivers.length > 0 && {
        owns: phoneCaregivers,
      }),
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PetCardPage({
  params,
}: {
  params: { uuid: string }
}) {
  if (!UUID_REGEX.test(params.uuid)) notFound()

  const data = await getCardData(params.uuid)
  if (!data) notFound()

  if ('disabled' in data) return <DisabledPage />

  const { pet, caregivers } = data
  const name = pet.name ?? '毛孩'
  const age = pet.birthday ? calcAge(pet.birthday) : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const pageUrl = `${appUrl}/pet/${params.uuid}`

  return (
    <>
      {/* JSON-LD */}
      <JsonLd pet={pet} caregivers={caregivers} url={pageUrl} />

      {/* NFC scan analytics */}
      <NfcScanTracker uuid={params.uuid} />

      {/* Edit button (client-side auth check) */}
      <PetCardEditButton petId={pet.id} />

      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-sm px-4 pb-16 pt-12">
          {/* ── Hero ─────────────────────────────── */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            {/* Photo */}
            <div
              className={cn(
                'h-32 w-32 overflow-hidden rounded-full ring-4 ring-primary/30 ring-offset-4',
                !pet.photo_url && 'bg-primary/10',
              )}
            >
              {pet.photo_url ? (
                <img
                  src={pet.photo_url}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <PawPrint className="h-16 w-16 text-primary/50" />
                </div>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                {name}
              </h1>
              {(pet.breed || age) && (
                <p className="text-sm text-gray-500">
                  {[pet.breed, age].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* ── Info card ────────────────────────── */}
          {(pet.gender ||
            pet.is_neutered !== undefined ||
            pet.chip_id ||
            pet.vet_hospital ||
            pet.special_care) && (
            <div className="mb-6 divide-y divide-gray-100 rounded-2xl border bg-white shadow-sm">
              {pet.gender && (
                <InfoRow
                  icon={<PawPrint className="h-4 w-4" />}
                  label="性別"
                  value={pet.gender === 'male' ? '公' : '母'}
                />
              )}
              {pet.is_neutered !== undefined && (
                <InfoRow
                  icon={<Scissors className="h-4 w-4" />}
                  label="絕育"
                  value={pet.is_neutered ? '已絕育' : '未絕育'}
                />
              )}
              {pet.chip_id && (
                <InfoRow
                  icon={<CreditCard className="h-4 w-4" />}
                  label="晶片號碼"
                  value={pet.chip_id}
                />
              )}
              {pet.vet_hospital && (
                <InfoRow
                  icon={<Hospital className="h-4 w-4" />}
                  label="固定醫院"
                  value={pet.vet_hospital}
                />
              )}
              {pet.special_care && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <div>
                    <p className="text-sm font-semibold text-orange-600">
                      特殊照護需求
                    </p>
                    {pet.special_care_note && (
                      <p className="mt-0.5 text-sm text-gray-600">
                        {pet.special_care_note}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Caregivers ───────────────────────── */}
          {caregivers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  緊急聯絡人
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {caregivers.map((c) => (
                <CaregiverCard key={c.id} c={c} />
              ))}
            </div>
          )}

          {/* ── Brand footer ─────────────────────── */}
          <div className="mt-12 flex flex-col items-center gap-1.5 text-gray-400">
            <div className="h-px w-16 bg-gray-200" />
            <div className="flex items-center gap-1.5 pt-2">
              <PawPrint className="h-4 w-4 text-primary/60" />
              <span className="text-sm font-semibold tracking-wide text-gray-500">
                Pet.chic Weekend
              </span>
            </div>
            <p className="text-xs text-gray-400">讓每隻毛孩都有一張安心名片</p>
          </div>
        </div>
      </main>
    </>
  )
}

// ─── Helper component ────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0 text-gray-400">{icon}</span>
      <span className="min-w-[72px] text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}
