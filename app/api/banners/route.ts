import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type BannerType = 'hero' | 'sponsor' | 'shop'

// Minimal public shape returned to the frontend
type PublicBanner = {
  id: string
  type: BannerType
  title: string | null
  subtitle: string | null
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  link: string | null // mapped from link_url for backward compat
  bg_class: string | null
  sort_order: number
}

const FALLBACK: Record<BannerType, PublicBanner[]> = {
  hero: [
    {
      id: '1',
      type: 'hero',
      title: '讓愛更安心',
      subtitle: '一張 NFC 智能卡，守護你的毛寶貝',
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: '/shop',
      bg_class: 'from-orange-500 via-orange-600 to-amber-700',
      sort_order: 0,
    },
    {
      id: '2',
      type: 'hero',
      title: '掃描即刻認識',
      subtitle: '緊急情況下快速獲取寵物完整資訊',
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: '/about',
      bg_class: 'from-rose-500 via-orange-500 to-amber-500',
      sort_order: 1,
    },
    {
      id: '3',
      type: 'hero',
      title: '精緻設計美學',
      subtitle: '高質感卡面，時尚掛飾你的最愛',
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: '/shop',
      bg_class: 'from-amber-600 via-orange-500 to-red-500',
      sort_order: 2,
    },
  ],
  sponsor: [
    {
      id: 's1',
      type: 'sponsor',
      title: '寵物星球',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 0,
    },
    {
      id: 's2',
      type: 'sponsor',
      title: '毛寶寶世界',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 1,
    },
    {
      id: 's3',
      type: 'sponsor',
      title: '快樂汪汪',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 2,
    },
    {
      id: 's4',
      type: 'sponsor',
      title: '動物友好',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 3,
    },
    {
      id: 's5',
      type: 'sponsor',
      title: '寵愛無限',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 4,
    },
    {
      id: 's6',
      type: 'sponsor',
      title: '毛孩天地',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 5,
    },
    {
      id: 's7',
      type: 'sponsor',
      title: 'PetCare+',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 6,
    },
    {
      id: 's8',
      type: 'sponsor',
      title: '愛寵聯盟',
      subtitle: null,
      image_url: null,
      mobile_image_url: null,
      alt_text: null,
      link: null,
      bg_class: null,
      sort_order: 7,
    },
  ],
  shop: [],
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') ?? 'hero') as BannerType
  if (!['hero', 'sponsor', 'shop'].includes(type)) {
    return NextResponse.json({ data: [] }, { status: 400 })
  }

  try {
    const supabase = createClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('banners')
      .select(
        'id, type, title, subtitle, image_url, mobile_image_url, alt_text, link_url, bg_class, sort_order',
      )
      .eq('type', type)
      .eq('is_active', true)
      .eq('status', 'published')
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })

    if (error) throw error

    const result: PublicBanner[] =
      (data ?? []).length > 0
        ? (
            data as unknown as (PublicBanner & { link_url: string | null })[]
          ).map(({ link_url, ...rest }) => ({ ...rest, link: link_url }))
        : FALLBACK[type]

    return NextResponse.json(
      { data: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      },
    )
  } catch {
    return NextResponse.json({ data: FALLBACK[type] })
  }
}
