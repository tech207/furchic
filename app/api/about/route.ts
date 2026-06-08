import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FALLBACK = {
  name: 'Furchic',
  tagline: '讓每一個毛孩，都被世界溫柔記得',
  description:
    'Furchic 是專為寵物飼主設計的 NFC 智能卡服務。我們深信每一隻毛孩都值得被妥善保護，透過現代科技讓寵物資訊隨時可得，在緊急時刻發揮最大守護力量。',
  story:
    '創立於 2024 年，Furchic 從一個飼主的真實需求出發：當寵物走失或意外受傷時，如何讓陌生人快速了解並聯繫到主人？NFC 智能卡就是答案。我們結合精緻設計與先進技術，讓寵物安全不再是奢侈。',
  email: 'hello@furchic.com',
  phone: '+886-2-1234-5678',
  address: '台北市信義區信義路五段 7 號',
  social: {
    instagram: 'https://instagram.com/furchic',
    facebook: 'https://facebook.com/furchic',
    line: 'https://line.me/ti/p/@furchic',
  },
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'company_name',
        'company_description',
        'company_email',
        'company_phone',
        'company_address',
      ])

    const settings: Record<string, unknown> = {}
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      settings[row.key] = row.value
    }

    const result = {
      name: (settings['company_name'] as string) || FALLBACK.name,
      tagline: FALLBACK.tagline,
      description:
        (settings['company_description'] as string) || FALLBACK.description,
      story: FALLBACK.story,
      email: (settings['company_email'] as string) || FALLBACK.email,
      phone: (settings['company_phone'] as string) || FALLBACK.phone,
      address: (settings['company_address'] as string) || FALLBACK.address,
      social: FALLBACK.social,
    }

    return NextResponse.json(
      { data: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    )
  } catch {
    return NextResponse.json(
      { data: FALLBACK },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    )
  }
}
