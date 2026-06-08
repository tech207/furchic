import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  validateCouponRow,
  calcCouponDiscount,
  type CouponRow,
} from '@/lib/utils/promotions'

export const POST = withAuth(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ valid: false, error: 'NOT_FOUND' })
  }

  const { code, subtotal } = body as { code?: unknown; subtotal?: unknown }

  if (!code || typeof code !== 'string') {
    return Response.json({ valid: false, error: 'NOT_FOUND' })
  }

  const sub = typeof subtotal === 'number' && subtotal >= 0 ? subtotal : 0
  const admin = createAdminClient()

  const { data } = await admin
    .from('coupons')
    .select(
      'id, code, name, type, value, min_amount, max_discount, is_active, starts_at, expires_at, max_uses, used_count',
    )
    .eq('code', code.toUpperCase().trim())
    .single()

  if (!data) return Response.json({ valid: false, error: 'NOT_FOUND' })

  const result = validateCouponRow(data as unknown as CouponRow, sub)

  if (!result.valid) {
    return Response.json({
      valid: false,
      error: result.error,
      ...(result.min_amount !== undefined && { min_amount: result.min_amount }),
    })
  }

  return apiSuccess({
    valid: true,
    discount_amount: result.discount_amount,
    coupon: {
      id: result.coupon.id,
      name: result.coupon.name,
      type: result.coupon.type,
      value: result.coupon.value,
    },
  })
})
