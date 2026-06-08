import { createAdminClient } from '@/lib/supabase/admin'

const SETTING_KEYS = [
  'cart.free_shipping_amount',
  'cart.shipping_fee',
  'cart.gift_nfc_amount',
  'cart.gift_nfc_enabled',
] as const

export async function GET() {
  const admin = createAdminClient()

  const { data } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', [...SETTING_KEYS])

  const map = new Map((data ?? []).map((r) => [r.key, r.value]))

  return Response.json({
    data: {
      freeShippingAmount:
        (map.get('cart.free_shipping_amount') as number) ?? 1000,
      shippingFee: (map.get('cart.shipping_fee') as number) ?? 60,
      giftNfcAmount: (map.get('cart.gift_nfc_amount') as number) ?? 1500,
      giftNfcEnabled: (map.get('cart.gift_nfc_enabled') as boolean) ?? false,
    },
  })
}
