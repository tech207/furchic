import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/session'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'
import { FaqSection, type Faq } from '@/components/about/FaqSection'

export const metadata: Metadata = {
  title: '關於我們',
  description:
    '了解 Pet.chic Weekend 的品牌故事、服務理念，以及我們如何以 NFC 科技守護每一隻毛孩的安全。',
}

type AboutInfo = {
  name: string
  tagline?: string
  description: string
  story?: string
  logo_url?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

type MemberLevel = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: Json
  sort_order: number
}

type PublicSettings = {
  reward_max_usage_rate?: unknown
  reward_max_rate?: unknown
}

const ABOUT_FALLBACK: AboutInfo = {
  name: 'Pet.chic Weekend',
  tagline: '讓每一個毛孩，都被世界溫柔記得',
  description:
    'Pet.chic Weekend 是專為寵物飼主設計的 NFC 智能卡服務。我們深信每一隻毛孩都值得被妥善保護，透過現代科技讓寵物資訊隨時可得，在緊急時刻發揮最大守護力量。',
  email: 'hello@furchic.com',
  phone: '+886-2-1234-5678',
}

function getBaseUrl() {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

async function getAboutData(): Promise<AboutInfo> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/about`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return ABOUT_FALLBACK
    const json = await res.json()
    return { ...ABOUT_FALLBACK, ...(json.data ?? {}) }
  } catch {
    return ABOUT_FALLBACK
  }
}

async function getMemberLevels(): Promise<MemberLevel[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/member-levels`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data?.levels ?? []) as MemberLevel[]
  } catch {
    return []
  }
}

async function getFaqs(): Promise<Faq[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/faqs`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data?.faqs ?? []) as Faq[]
  } catch {
    return []
  }
}

async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/settings/public`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return {}
    const json = await res.json()
    return (json.data ?? {}) as PublicSettings
  } catch {
    return {}
  }
}

function formatCurrency(value: number) {
  return `NT$${value.toLocaleString('zh-TW')}`
}

function formatPercent(value: unknown, fallback = '0%') {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  const normalized = number <= 1 ? number * 100 : number
  return `${Number.isInteger(normalized) ? normalized : normalized.toFixed(1)}%`
}

function normalizeBenefits(benefits: Json): string[] {
  if (Array.isArray(benefits)) {
    return benefits.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    )
  }

  if (benefits && typeof benefits === 'object') {
    return Object.values(benefits)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      )
  }

  return []
}

function brandParagraphs(info: AboutInfo) {
  const source = info.story?.trim() || info.description
  return source.split(/\n+/).filter(Boolean)
}

export default async function AboutPage() {
  const [aboutData, levels, settings, currentUser, faqs] = await Promise.all([
    getAboutData(),
    getMemberLevels(),
    getPublicSettings(),
    getCurrentUser(),
    getFaqs(),
  ])

  const rewardMaxUsage =
    settings.reward_max_usage_rate ?? settings.reward_max_rate ?? 50
  const description = aboutData.description || ABOUT_FALLBACK.description

  return (
    <div className="bg-white text-gray-950">
      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,#f97316_0%,#ea580c_42%,#b91c1c_100%)]">
        <div className="from-white/18 absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent" />
        <div className="container relative mx-auto px-6 py-20 text-white sm:py-24 lg:py-28">
          <nav
            aria-label="Breadcrumb"
            className="text-white/78 mb-10 flex items-center gap-2 text-sm"
          >
            <Link href="/" className="transition hover:text-white">
              首頁
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-white">關於我們</span>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-orange-100">
              About Pet.chic Weekend
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              關於 Pet.chic Weekend
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-orange-50 sm:text-lg">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto grid items-center gap-10 px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-rose-50 shadow-sm">
            {aboutData.logo_url ? (
              <div
                role="img"
                aria-label={aboutData.name}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${aboutData.logo_url})` }}
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col justify-between p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.26em] text-orange-600">
                    Pet Identity
                  </p>
                  <p className="mt-4 max-w-sm text-4xl font-black leading-tight text-gray-950">
                    一張卡，保存毛孩最重要的資訊。
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
                  <span className="h-px w-10 bg-orange-300" />
                  NFC Smart Card
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">
              BRAND STORY
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              我們的故事
            </h2>
            <div className="mt-6 space-y-4 text-base leading-8 text-gray-600">
              {brandParagraphs(aboutData).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {aboutData.email && (
                <a
                  href={`mailto:${aboutData.email}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 text-sm font-semibold text-gray-800 transition hover:border-orange-200 hover:bg-orange-100"
                >
                  <Mail className="h-5 w-5 shrink-0 text-orange-600" />
                  <span className="break-all">{aboutData.email}</span>
                </a>
              )}
              {aboutData.phone && (
                <a
                  href={`tel:${aboutData.phone}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 text-sm font-semibold text-gray-800 transition hover:border-orange-200 hover:bg-orange-100"
                >
                  <Phone className="h-5 w-5 shrink-0 text-orange-600" />
                  <span>{aboutData.phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-gray-50 py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">
              Membership
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              會員制度
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              登入後可在會員頁面查看個人等級、累積消費與下一階段升等進度。
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {levels.map((level) => {
              const isCurrent = currentUser?.member_level_id === level.id
              const benefits = normalizeBenefits(level.benefits)

              return (
                <article
                  key={level.id}
                  className={cn(
                    'relative flex min-h-[320px] flex-col rounded-3xl border bg-white p-6 shadow-sm transition',
                    isCurrent
                      ? 'border-orange-400 shadow-lg shadow-orange-200/70 ring-4 ring-orange-100'
                      : 'border-gray-200 hover:border-orange-200 hover:shadow-md',
                  )}
                >
                  {isCurrent && (
                    <div className="absolute right-5 top-5 rounded-full bg-orange-600 px-3 py-1 text-xs font-bold text-white">
                      當前等級
                    </div>
                  )}

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950 text-white">
                    {isCurrent ? (
                      <Star className="h-5 w-5 fill-white" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                  </div>
                  <h3 className="mt-5 text-2xl font-black text-gray-950">
                    {level.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    升等門檻：
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(level.min_spent)}
                    </span>
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-orange-50 p-4">
                      <p className="text-xs font-medium text-orange-700">
                        回饋率
                      </p>
                      <p className="mt-1 text-xl font-black text-orange-700">
                        {formatPercent(level.reward_rate)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-100 p-4">
                      <p className="text-xs font-medium text-gray-600">
                        折扣率
                      </p>
                      <p className="mt-1 text-xl font-black text-gray-950">
                        {formatPercent(level.discount_rate)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2">
                    {(benefits.length > 0
                      ? benefits
                      : ['專屬會員優惠', '累積消費自動升等']
                    ).map((benefit) => (
                      <div
                        key={benefit}
                        className="flex items-start gap-2 text-sm leading-6 text-gray-600"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <p className="text-sm font-bold text-orange-600">
                回饋金使用說明
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                結帳時可使用回饋金折抵，單筆最高可折抵訂單金額{' '}
                {formatPercent(rewardMaxUsage)}。
              </p>
            </div>
            <Button asChild className="mt-5 gap-2 rounded-full px-6 sm:mt-0">
              <Link href="/auth">
                立即加入會員
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section 4: FAQ ───────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-orange-600">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">
              常見問題
            </h2>
            <p className="mt-4 text-base leading-7 text-gray-600">
              找不到答案？歡迎透過下方聯絡資訊與我們聯繫。
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <FaqSection initialFaqs={faqs} />
          </div>
        </div>
      </section>
    </div>
  )
}
