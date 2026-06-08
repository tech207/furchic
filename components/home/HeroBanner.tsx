'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeightConfig = {
  desktop: string
  mobile: string
}

const DEFAULT_HEIGHT: HeightConfig = { desktop: '480px', mobile: '300px' }

export type HeroBannerItem = {
  id: string
  title: string | null
  subtitle: string | null
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  link: string | null
  bg_class: string | null
}

// ── Default brand hero (empty state) ─────────────────────────────────────────

const PAWS = ['🐾', '🐱', '🐶', '🐰', '🐹']

function DefaultHero() {
  return (
    <section className="relative h-[300px] w-full overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 md:h-[500px]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PAWS.map((p, i) => (
          <span
            key={i}
            className="absolute text-6xl text-white/10 md:text-8xl"
            style={{
              top: `${10 + i * 18}%`,
              right: `${5 + i * 8}%`,
              transform: `rotate(${i * 25}deg)`,
            }}
          >
            {p}
          </span>
        ))}
      </div>
      <div className="relative z-10 flex h-full max-w-3xl flex-col items-start justify-center px-8 md:px-20">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-white/70 md:text-base">
          Furchic NFC 智能卡
        </p>
        <h2 className="mb-3 text-3xl font-extrabold leading-tight text-white md:mb-4 md:text-6xl">
          讓愛更安心
        </h2>
        <p className="mb-6 max-w-md text-sm text-white/85 md:mb-8 md:text-xl">
          一張 NFC 智能卡，守護你的毛寶貝
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-lg transition-colors hover:bg-orange-50 md:px-8 md:py-3 md:text-base"
        >
          立即探索 →
        </Link>
      </div>
    </section>
  )
}

// ── Gradient slide content (no image) ─────────────────────────────────────────

function GradientContent({ banner }: { banner: HeroBannerItem }) {
  return (
    <>
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br',
          banner.bg_class ?? 'from-orange-500 to-amber-600',
        )}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PAWS.map((p, i) => (
          <span
            key={i}
            className="absolute text-6xl text-white/10 md:text-8xl"
            style={{
              top: `${10 + i * 18}%`,
              right: `${5 + i * 8}%`,
              transform: `rotate(${i * 25}deg)`,
            }}
          >
            {p}
          </span>
        ))}
      </div>
      <div className="relative z-10 flex h-full max-w-3xl flex-col items-start justify-center px-8 md:px-20">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-white/70 md:text-base">
          Furchic NFC 智能卡
        </p>
        {banner.title && (
          <h2 className="mb-3 text-3xl font-extrabold leading-tight text-white md:mb-4 md:text-6xl">
            {banner.title}
          </h2>
        )}
        {banner.subtitle && (
          <p className="mb-6 max-w-md text-sm text-white/85 md:mb-8 md:text-xl">
            {banner.subtitle}
          </p>
        )}
        {/* Rendered as <span> to avoid nested <a> when the slide itself is wrapped in <a> */}
        {banner.link && (
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-lg transition-colors hover:bg-orange-50 md:px-8 md:py-3 md:text-base">
            立即探索 →
          </span>
        )}
      </div>
    </>
  )
}

// ── Single banner slide ───────────────────────────────────────────────────────

function BannerSlide({ banner }: { banner: HeroBannerItem }) {
  const imgAlt = banner.alt_text || banner.title || 'Banner'

  const inner = banner.image_url ? (
    // Image banner — full-bleed responsive picture
    <picture className="absolute inset-0 block h-full w-full">
      <source
        media="(max-width: 768px)"
        srcSet={banner.mobile_image_url ?? banner.image_url}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.image_url}
        alt={imgAlt}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
    </picture>
  ) : (
    // Gradient banner — text content
    <GradientContent banner={banner} />
  )

  if (banner.link) {
    return (
      <a
        href={banner.link}
        className="relative block h-full w-full"
        aria-label={imgAlt}
        tabIndex={-1} // keyboard navigation handled at carousel level
      >
        {inner}
      </a>
    )
  }

  return <div className="relative h-full w-full">{inner}</div>
}

// ── Hero Banner ───────────────────────────────────────────────────────────────

export default function HeroBanner({
  banners,
  height = DEFAULT_HEIGHT,
}: {
  banners: HeroBannerItem[]
  height?: HeightConfig
}) {
  const single = banners.length === 1

  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }))

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: !single },
    single ? [] : [autoplay.current],
  )

  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (emblaApi) setCurrent(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  // Track current slide
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  // Global keyboard navigation (← →)
  useEffect(() => {
    if (single) return
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        emblaApi?.scrollPrev()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        emblaApi?.scrollNext()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [emblaApi, single])

  // Early return placed after all hooks to satisfy Rules of Hooks
  if (banners.length === 0) return <DefaultHero />

  return (
    <section
      style={
        {
          '--bh-sm': height.mobile,
          '--bh-lg': height.desktop,
        } as React.CSSProperties
      }
      className="relative w-full select-none overflow-hidden [height:var(--bh-sm)] md:[height:var(--bh-lg)]"
      aria-label="Hero Banner 輪播"
      aria-roledescription="carousel"
      onMouseEnter={() => !single && autoplay.current.stop()}
      onMouseLeave={() => !single && autoplay.current.play()}
    >
      {/* Embla scroll container */}
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full" aria-live={single ? undefined : 'polite'}>
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className="h-full min-w-full flex-none"
              role="group"
              aria-roledescription="slide"
              aria-label={`第 ${i + 1} 張，共 ${banners.length} 張`}
            >
              <BannerSlide banner={banner} />
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next arrows — only when multiple banners */}
      {!single && (
        <>
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/50 md:left-5 md:h-11 md:w-11"
            aria-label="上一張"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/50 md:right-5 md:h-11 md:w-11"
            aria-label="下一張"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        </>
      )}

      {/* Dot navigation — only when multiple banners */}
      {!single && (
        <div
          className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2"
          role="tablist"
          aria-label="輪播頁籤"
        >
          {banners.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`第 ${i + 1} 張`}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === current
                  ? 'w-7 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/70',
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}
