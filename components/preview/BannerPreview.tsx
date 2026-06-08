import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BannerDraftData = {
  type?: 'hero' | 'sponsor' | 'shop'
  image_url?: string | null
  mobile_image_url?: string | null
  title?: string | null
  subtitle?: string | null
  link?: string | null
  bg_class?: string | null
  alt_text?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

// ── Height map ────────────────────────────────────────────────────────────────

const HEIGHT_CLASS: Record<string, string> = {
  hero: 'h-72 sm:h-96',
  shop: 'h-40 sm:h-56',
  sponsor: 'h-28 sm:h-36',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BannerPreview({ data }: { data: BannerDraftData }) {
  const type = data.type ?? 'hero'
  const heightCls = HEIGHT_CLASS[type] ?? HEIGHT_CLASS.hero
  const hasImage = !!(data.image_url || data.mobile_image_url)

  return (
    <div className="space-y-6">
      {/* Section label */}
      <p className="text-sm text-muted-foreground">
        Banner 類型：<span className="font-medium capitalize">{type}</span>
      </p>

      {/* Banner simulation */}
      <div className="relative overflow-hidden rounded-xl border shadow-sm">
        {/* Draft badge */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow">
          草稿預覽
        </div>

        {/* Banner area */}
        <div
          className={cn(
            'relative flex w-full items-center justify-center',
            heightCls,
            !hasImage &&
              cn(
                'bg-gradient-to-br',
                data.bg_class || 'from-orange-500 to-amber-600',
              ),
          )}
        >
          {hasImage && (
            <Image
              src={data.mobile_image_url || data.image_url || ''}
              alt={data.alt_text || data.title || 'Banner 預覽'}
              fill
              className="object-cover"
              unoptimized
            />
          )}

          {(data.title || data.subtitle) && (
            <div className="relative z-10 px-6 text-center drop-shadow-md">
              {data.title && (
                <p className="text-2xl font-bold text-white">{data.title}</p>
              )}
              {data.subtitle && (
                <p className="mt-1 text-base text-white/85">{data.subtitle}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
        {data.link && (
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">
              連結目標
            </span>
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 truncate text-primary hover:underline"
            >
              {data.link}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        )}
        {(data.starts_at || data.ends_at) && (
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">
              排程期間
            </span>
            <span>
              {data.starts_at ? fmtDate(data.starts_at) : '即日起'} →{' '}
              {data.ends_at ? fmtDate(data.ends_at) : '無限期'}
            </span>
          </div>
        )}
        {!data.link && !data.starts_at && !data.ends_at && (
          <p className="text-muted-foreground">此 Banner 無額外設定</p>
        )}
      </div>
    </div>
  )
}
