import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PaymentMethod = {
  id: string
  payment_type: string
  display_name: string
  description: string | null
  icon_emoji: string | null
  ecpay_payment_type: string | null
  settings: Record<string, unknown>
  sort_order: number
}

export async function GET(): Promise<Response> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('payment_settings')
    .select(
      'id, payment_type, display_name, description, icon_emoji, ecpay_payment_type, settings, sort_order',
    )
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: '載入付款方式失敗' }, { status: 500 })
  }

  return NextResponse.json({ data: (data as unknown as PaymentMethod[]) ?? [] })
}
