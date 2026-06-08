// ── Shared types ───────────────────────────────────────────────────────────────

export type PromotionRow = {
  id: string
  name: string
  discount_type: 'fixed' | 'percent' | 'free_shipping'
  discount_value: number
  condition_type: 'amount' | 'quantity' | 'member_level'
  condition_value: number
  condition_level_id: string | null
  is_stackable: boolean
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
}

export type CartSummary = {
  subtotal: number
  itemCount: number
}

export type UserSummary = {
  member_level_id: string | null
}

export type AppliedPromotion = {
  promotion_id: string
  name: string
  discount_type: 'fixed' | 'percent' | 'free_shipping'
  discount_amount: number
  is_free_shipping: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActive(
  p: Pick<PromotionRow, 'is_active' | 'starts_at' | 'expires_at'>,
): boolean {
  if (!p.is_active) return false
  const now = new Date()
  if (p.starts_at && new Date(p.starts_at) > now) return false
  if (p.expires_at && new Date(p.expires_at) < now) return false
  return true
}

function meetsCondition(
  p: PromotionRow,
  cart: CartSummary,
  user: UserSummary,
): boolean {
  switch (p.condition_type) {
    case 'amount':
      return cart.subtotal >= p.condition_value
    case 'quantity':
      return cart.itemCount >= p.condition_value
    case 'member_level':
      return (
        !!p.condition_level_id && user.member_level_id === p.condition_level_id
      )
  }
}

function calcDiscount(p: PromotionRow, subtotal: number): number {
  switch (p.discount_type) {
    case 'fixed':
      return Math.min(p.discount_value, subtotal)
    case 'percent':
      return Math.round((subtotal * p.discount_value) / 100)
    case 'free_shipping':
      return 0
  }
}

// ── Core calculation ──────────────────────────────────────────────────────────
// All stackable promotions apply; for non-stackable only the best (highest
// discount) one is selected.

export function calculatePromotions(
  cart: CartSummary,
  user: UserSummary,
  promotions: PromotionRow[],
): AppliedPromotion[] {
  const qualifying = promotions.filter(
    (p) => isActive(p) && meetsCondition(p, cart, user),
  )
  if (qualifying.length === 0) return []

  const stackable = qualifying.filter((p) => p.is_stackable)
  const nonStackable = qualifying.filter((p) => !p.is_stackable)

  // Among non-stackable: pick the one with highest discount
  const bestNonStackable =
    nonStackable.length > 0
      ? nonStackable.reduce((best, p) =>
          calcDiscount(p, cart.subtotal) >= calcDiscount(best, cart.subtotal)
            ? p
            : best,
        )
      : null

  const applied = [
    ...stackable,
    ...(bestNonStackable ? [bestNonStackable] : []),
  ]

  return applied.map((p) => ({
    promotion_id: p.id,
    name: p.name,
    discount_type: p.discount_type,
    discount_amount: calcDiscount(p, cart.subtotal),
    is_free_shipping: p.discount_type === 'free_shipping',
  }))
}

// ── Coupon helpers ────────────────────────────────────────────────────────────

export type CouponRow = {
  id: string
  code: string
  name: string
  type: 'fixed' | 'percent'
  value: number
  min_amount: number
  max_discount: number | null
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
}

export type CouponValidationResult =
  | { valid: true; coupon: CouponRow; discount_amount: number }
  | {
      valid: false
      error: 'NOT_FOUND' | 'EXPIRED' | 'MAX_USES' | 'MIN_AMOUNT'
      min_amount?: number
    }

export function calcCouponDiscount(
  coupon: CouponRow,
  subtotal: number,
): number {
  if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal)
  const pct = Math.round((subtotal * coupon.value) / 100)
  return coupon.max_discount !== null ? Math.min(pct, coupon.max_discount) : pct
}

export function validateCouponRow(
  coupon: CouponRow,
  subtotal: number,
): CouponValidationResult {
  if (!coupon.is_active) return { valid: false, error: 'NOT_FOUND' }
  const now = new Date()
  if (coupon.starts_at && new Date(coupon.starts_at) > now)
    return { valid: false, error: 'NOT_FOUND' }
  if (coupon.expires_at && new Date(coupon.expires_at) < now)
    return { valid: false, error: 'EXPIRED' }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
    return { valid: false, error: 'MAX_USES' }
  if (subtotal < coupon.min_amount)
    return { valid: false, error: 'MIN_AMOUNT', min_amount: coupon.min_amount }
  return {
    valid: true,
    coupon,
    discount_amount: calcCouponDiscount(coupon, subtotal),
  }
}
