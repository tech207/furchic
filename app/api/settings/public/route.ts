import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Keys that are safe to expose publicly (no sensitive data)
const PUBLIC_KEYS = [
  'free_shipping_amount',
  'gift_nfc_amount',
  'gift_nfc_enabled',
  'gift_nfc_start_at',
  'gift_nfc_end_at',
  'reward_max_usage_rate',
  'card_request_enabled',
  'max_pets_per_user',
  'max_caregivers_per_pet',
]

const PUBLIC_DEFAULTS: Record<string, unknown> = {
  free_shipping_amount: 1500,
  gift_nfc_amount: 2500,
  gift_nfc_enabled: false,
  gift_nfc_start_at: null,
  gift_nfc_end_at: null,
  reward_max_usage_rate: 0.5,
  card_request_enabled: true,
  max_pets_per_user: 5,
  max_caregivers_per_pet: 5,
}

export async function GET(): Promise<Response> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', PUBLIC_KEYS)

    const result: Record<string, unknown> = { ...PUBLIC_DEFAULTS }
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      result[row.key] = row.value
    }

    return NextResponse.json(
      { data: result },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
        },
      },
    )
  } catch {
    return NextResponse.json({ data: PUBLIC_DEFAULTS })
  }
}
