import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  ShieldCheck,
  QrCode,
  Lock,
  Heart,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import HeroBanner from '@/components/home/HeroBanner'
import { StepsSection } from '@/components/home/StepsSection'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Furchic — NFC 寵物智能卡',
  description:
    'Furchic 提供高質感 NFC 寵物智能卡，讓您的毛寶貝資訊隨掃即得，緊急時刻守護牠的安全。',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HeroBanner = {
  id: string
  title: string | null
  subtitle: string | null
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  link: string | null
  bg_class: string | null
}

type MarqueePartner = {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
}

type Product = {
  id: string
  name: string
  base_price: number
  images: string[] | null
  description: string | null
  min_price?: number | null
  product_variants?: { price: number | null }[]
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getHeroBanners(): Promise<HeroBanner[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/banners?type=hero`, {
      next: { revalidate: 300 },
    })
    const json = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

async function getMarqueePartners(): Promise<MarqueePartner[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/partners?marquee_only=true`, {
      next: { revalidate: 300 },
    })
    const json = await res.json()
    return json.data?.partners ?? []
  } catch {
    return []
  }
}

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/products?limit=4&sort=newest`, {
      next: { revalidate: 120 },
    })
    const json = await res.json()
    return json.data?.products ?? []
  } catch {
    return []
  }
}

// ── NFC Feature list ──────────────────────────────────────────────────────────

const NFC_FEATURES = [
  {
    icon: ShieldCheck,
    color: 'text-orange-500 bg-orange-50',
    title: '緊急守護',
    desc: '緊急情況下，掃描即可獲取寵物完整資訊與緊急聯絡人，第一時間守護毛孩。',
  },
  {
    icon: QrCode,
    color: 'text-blue-500 bg-blue-50',
    title: 'NFC + QR 雙模式',
    desc: '支援 NFC 感應與 QR Code 掃描，任何智慧型手機無需 App 即可使用。',
  },
  {
    icon: Lock,
    color: 'text-green-500 bg-green-50',
    title: '資料安全可控',
    desc: '您完全掌控哪些資訊公開顯示，敏感資訊加密保護，安心無虞。',
  },
  {
    icon: Heart,
    color: 'text-pink-500 bg-pink-50',
    title: '多寵物支援',
    desc: '一個帳號管理多隻寵物，每張卡各自綁定，家庭多寵輕鬆搞定。',
  },
]

// ── Mock NFC Card Mockup ──────────────────────────────────────────────────────

function NfcCardMockup() {
  return (
    <div className="relative mx-auto h-44 w-72 md:h-52 md:w-80">
      {/* Shadow card */}
      <div className="absolute inset-0 rotate-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 opacity-50 shadow-xl" />
      {/* Main card */}
      <div className="absolute inset-0 flex flex-col justify-between rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-wide text-white/90">
            Furchic
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        </div>
        {/* NFC chip */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-10 items-center justify-center rounded-md border border-white/30 bg-white/20">
            <div className="h-5 w-6 rounded-sm border-2 border-white/60" />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-24 rounded-full bg-white/30" />
            <div className="h-1.5 w-16 rounded-full bg-white/20" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wider text-white/70">
            NFC PET CARD
          </span>
          <div className="text-2xl text-white">🐾</div>
        </div>
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const images = Array.isArray(product.images) ? product.images : []
  const firstImg = images[0] ?? null
  const variants = Array.isArray(product.product_variants)
    ? product.product_variants
    : []
  const minPrice =
    typeof product.min_price === 'number'
      ? product.min_price
      : variants.reduce(
          (min, v) => Math.min(min, v.price ?? product.base_price),
          product.base_price,
        )

  return (
    <Link href={`/shop/${product.id}`} className="group block">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-gray-100">
        {firstImg ? (
          <Image
            src={firstImg}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
            <span className="mb-2 text-5xl">🐾</span>
            <span className="text-xs">Furchic</span>
          </div>
        )}
      </div>
      <h3 className="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-orange-600">
        {product.name}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        {product.description ?? ''}
      </p>
      <p className="mt-1 text-sm font-bold text-orange-600">
        NT${minPrice.toLocaleString()}
      </p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [heroBanners, marqueePartners, products] = await Promise.all([
    getHeroBanners(),
    getMarqueePartners(),
    getFeaturedProducts(),
  ])

  const doubled = [...marqueePartners, ...marqueePartners]

  return (
    <>
      {/* ── 1. Hero Banner ──────────────────────────────────────────────────── */}
      <HeroBanner banners={heroBanners} />

      {/* ── 2. Steps Section (Framer Motion) ───────────────────────────────── */}
      <StepsSection />

      {/* ── 3. Partner Marquee ─────────────────────────────────────────────── */}
      {marqueePartners.length > 0 && (
        <section className="overflow-hidden border-y bg-white py-12">
          <div className="container mx-auto mb-6 flex items-center justify-between px-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              合作夥伴
            </p>
            <Link
              href="/partners"
              className="text-xs text-orange-500 hover:text-orange-600 hover:underline"
            >
              查看全部 →
            </Link>
          </div>
          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />

            <div className="animate-marquee flex w-max">
              {doubled.map((p, i) => (
                <div
                  key={i}
                  className="mx-8 flex-none rounded-lg border border-gray-200 bg-gray-50 px-6 py-3 grayscale transition-all duration-300 hover:border-orange-200 hover:bg-orange-50 hover:grayscale-0"
                >
                  {p.logo_url ? (
                    <Image
                      src={p.logo_url}
                      alt={p.name}
                      width={100}
                      height={36}
                      className="h-9 w-auto object-contain"
                    />
                  ) : (
                    <span className="whitespace-nowrap text-sm font-semibold text-gray-500">
                      {p.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Featured Products ────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-orange-500">
                Products
              </p>
              <h2 className="text-3xl font-extrabold md:text-4xl">精選商品</h2>
            </div>
            <Link
              href="/shop"
              className="flex items-center gap-1 text-sm font-medium text-orange-600 transition-colors hover:text-orange-700"
            >
              查看全部 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50">
                    <span className="text-4xl">🐾</span>
                  </div>
                  <div className="h-3 w-3/4 rounded-full bg-gray-100" />
                  <div className="h-3 w-1/2 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. NFC Card Introduction ────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-2">
            {/* Left: Card mockup */}
            <div className="flex justify-center">
              <NfcCardMockup />
            </div>

            {/* Right: Features */}
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-500">
                NFC Technology
              </p>
              <h2 className="mb-4 text-3xl font-extrabold md:text-4xl">
                一卡在手，守護無憂
              </h2>
              <p className="mb-8 leading-relaxed text-muted-foreground">
                Furchic NFC
                智能卡融合先進感應技術與精緻工藝，為您的毛寶貝打造最完整的數位守護。
              </p>
              <div className="space-y-5">
                {NFC_FEATURES.map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.title} className="flex gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${f.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="mb-0.5 font-semibold">{f.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {f.desc}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-8">
                <Link href="/shop">
                  <Button className="rounded-full px-8">立即選購</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. CTA Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 py-24">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          {['🐾', '🐱', '🐶', '🐰', '🦜'].map((p, i) => (
            <span
              key={i}
              className="absolute text-8xl text-white/10"
              style={{
                bottom: `${10 + i * 15}%`,
                left: `${i * 22}%`,
                transform: `rotate(${i * 30 - 30}deg)`,
              }}
            >
              {p}
            </span>
          ))}
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/70">
            Join Furchic
          </p>
          <h2 className="mb-5 text-4xl font-extrabold leading-tight text-white md:text-6xl">
            讓愛，
            <br className="md:hidden" />
            從此有保障
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg text-white/85 md:text-xl">
            超過 10,000 位飼主選擇 Furchic，
            <br />
            今天就加入，給毛孩最好的守護。
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/pets">
              <Button
                size="lg"
                className="rounded-full bg-white px-10 text-base font-bold text-orange-600 shadow-lg hover:bg-orange-50"
              >
                掃描入會
              </Button>
            </Link>
            <Link href="/about">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white px-10 text-base font-bold text-white hover:bg-white/10"
              >
                了解更多
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
