import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculatePromotions,
  validateCouponRow,
  type PromotionRow,
  type CouponRow,
} from '@/lib/utils/promotions'

// ── Cart item row from DB JOIN ─────────────────────────────────────────────────

type CartRow = {
  variant_id: string
  quantity: number
  product_variants: {
    id: string
    price: number | null
    stock: number
    is_active: boolean
    products: {
      id: string
      base_price: number
      is_active: boolean
    } | null
  } | null
}

// ── POST /api/checkout/calculate ──────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { coupon_code, reward_points_used: rawPoints = 0 } = body as {
    coupon_code?: string
    reward_points_used?: number
  }

  const admin = createAdminClient()

  // ── 1. Load cart ──────────────────────────────────────────────────────────

  const { data: cartRaw, error: cartErr } = await admin
    .from('carts')
    .select(
      `
      variant_id, quantity,
      product_variants (
        id, price, stock, is_active,
        products ( id, base_price, is_active )
      )
    `,
    )
    .eq('user_id', user.id)

  if (cartErr) return apiError('無法載入購物車', 500, 'FETCH_FAILED')

  const rows = (cartRaw as unknown as CartRow[]) ?? []
  const warnings: string[] = []

  let subtotal = 0
  let itemCount = 0

  for (const row of rows) {
    const variant = row.product_variants
    const product = variant?.products
    if (!variant || !product) continue
    if (!product.is_active || !variant.is_active) {
      warnings.push('部分商品已下架，已從計算中排除')
      continue
    }
    const qty = Math.min(row.quantity, variant.stock)
    if (qty === 0) {
      warnings.push('部分商品庫存不足，已從計算中排除')
      continue
    }
    subtotal += (variant.price ?? product.base_price) * qty
    itemCount += qty
  }

  if (subtotal === 0 && rows.length > 0) {
    return apiError('購物車中沒有可結帳的商品', 400, 'EMPTY_CART')
  }

  // ── 2. Load user member level (for reward_rate + member_level condition) ──

  let rewardRate = 0
  if (user.member_level_id) {
    const { data: level } = await admin
      .from('member_levels')
      .select('reward_rate')
      .eq('id', user.member_level_id)
      .single()
    rewardRate =
      (level as unknown as { reward_rate: number } | null)?.reward_rate ?? 0
  }

  // ── 3. Load & apply promotions ────────────────────────────────────────────

  const { data: promsRaw } = await admin
    .from('promotions')
    .select('*')
    .eq('is_active', true)

  const appliedPromotions = calculatePromotions(
    { subtotal, itemCount },
    { member_level_id: user.member_level_id },
    (promsRaw as unknown as PromotionRow[]) ?? [],
  )

  const promotions_discount = appliedPromotions.reduce(
    (s, p) => s + p.discount_amount,
    0,
  )
  const hasPromotionFreeShipping = appliedPromotions.some(
    (p) => p.is_free_shipping,
  )

  // ── 4. Validate coupon (if provided) ─────────────────────────────────────

  let couponResult: null | {
    id: string
    name: string
    type: string
    value: number
    discount_amount: number
  } = null
  let coupon_discount = 0

  if (coupon_code?.trim()) {
    const { data: couponData } = await admin
      .from('coupons')
      .select(
        'id, code, name, type, value, min_amount, max_discount, is_active, starts_at, expires_at, max_uses, used_count',
      )
      .eq('code', coupon_code.trim().toUpperCase())
      .single()

    if (couponData) {
      const validation = validateCouponRow(
        couponData as unknown as CouponRow,
        subtotal,
      )
      if (validation.valid) {
        coupon_discount = validation.discount_amount
        couponResult = {
          id: validation.coupon.id,
          name: validation.coupon.name,
          type: validation.coupon.type,
          value: validation.coupon.value,
          discount_amount: validation.discount_amount,
        }
      } else {
        warnings.push(`優惠碼無效（${validation.error}）`)
      }
    } else {
      warnings.push('優惠碼不存在')
    }
  }

  // ── 5. Reward points ──────────────────────────────────────────────────────

  const afterDiscounts = Math.max(
    0,
    subtotal - promotions_discount - coupon_discount,
  )
  const maxUsablePoints = Math.min(user.reward_points, afterDiscounts)
  const reward_points_used = Math.max(
    0,
    Math.min(Math.floor(rawPoints), maxUsablePoints),
  )
  const reward_points_discount = reward_points_used

  // ── 6. Shipping fee ───────────────────────────────────────────────────────

  const { data: settingsRaw } = await admin
    .from('system_settings')
    .select('key, value')
    .in('key', ['cart.free_shipping_amount', 'cart.shipping_fee'])

  const settingsMap = new Map(
    (
      settingsRaw as unknown as Array<{ key: string; value: unknown }> | null
    )?.map((r) => [r.key, r.value]) ?? [],
  )

  const freeShippingAmount =
    (settingsMap.get('cart.free_shipping_amount') as number) ?? 1000
  const baseShippingFee = (settingsMap.get('cart.shipping_fee') as number) ?? 60

  const isFreeShipping =
    hasPromotionFreeShipping || subtotal >= freeShippingAmount
  const shipping_fee = isFreeShipping ? 0 : baseShippingFee

  // ── 7. Total ──────────────────────────────────────────────────────────────

  const productAmount = Math.max(
    0,
    subtotal - promotions_discount - coupon_discount - reward_points_discount,
  )
  const total = productAmount + shipping_fee

  // ── 8. Reward points to earn ──────────────────────────────────────────────

  const reward_points_to_earn = Math.floor((productAmount * rewardRate) / 100)

  return apiSuccess({
    subtotal,
    promotions: appliedPromotions,
    promotions_discount,
    coupon: couponResult,
    coupon_discount,
    reward_points_used,
    reward_points_discount,
    shipping_fee,
    total,
    reward_points_to_earn,
    warnings,
  })
})
