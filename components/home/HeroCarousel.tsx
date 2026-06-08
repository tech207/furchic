'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type HeroBanner = {
  id: string
  title: string | null
  subtitle: string | null
  image_url: string | null
  link: string | null
  bg_class: string | null
}

const PAWS = ['🐾', '🐱', '🐶', '🐰', '🐹']

export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const plugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }))
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    plugin.current,
  ])
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCurrent(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  if (!banners.length) return null

  return (
    <section className="relative h-[300px] w-full select-none overflow-hidden md:h-[500px]">
      {/* Visual slides – absolute-stacked fade */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          aria-hidden={i !== current}
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            i === current ? 'z-10 opacity-100' : 'z-0 opacity-0',
            'bg-gradient-to-br',
            b.bg_class ?? 'from-orange-500 to-amber-600',
          )}
        >
          {/* Decorative paw prints */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {PAWS.map((p, pi) => (
              <span
                key={pi}
                className="absolute text-6xl text-white/10 md:text-8xl"
                style={{
                  top: `${10 + pi * 18}%`,
                  right: `${5 + pi * 8}%`,
                  transform: `rotate(${pi * 25}deg)`,
                }}
              >
                {p}
              </span>
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full max-w-3xl flex-col items-start justify-center px-8 md:px-20">
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-white/70 md:text-base">
              Furchic NFC 智能卡
            </p>
            {b.title && (
              <h2 className="mb-3 text-3xl font-extrabold leading-tight text-white md:mb-4 md:text-6xl">
                {b.title}
              </h2>
            )}
            {b.subtitle && (
              <p className="mb-6 max-w-md text-sm text-white/85 md:mb-8 md:text-xl">
                {b.subtitle}
              </p>
            )}
            {b.link && (
              <Link
                href={b.link}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-orange-600 shadow-lg transition-colors hover:bg-orange-50 md:px-8 md:py-3 md:text-base"
              >
                立即探索 →
              </Link>
            )}
          </div>
        </div>
      ))}

      {/* Embla scroll container – invisible, used only for autoplay / navigation logic */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-0"
        ref={emblaRef}
      >
        <div className="flex h-full">
          {banners.map((b) => (
            <div key={b.id} className="h-full min-w-full flex-none" />
          ))}
        </div>
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={() => emblaApi?.scrollPrev()}
        className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/40 md:left-5 md:h-11 md:w-11"
        aria-label="上一張"
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>
      <button
        onClick={() => emblaApi?.scrollNext()}
        className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/40 md:right-5 md:h-11 md:w-11"
        aria-label="下一張"
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>

      {/* Dot navigation */}
      <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
        {banners.map((_, i) => (
          <button
            key={i}
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
    </section>
  )
}
