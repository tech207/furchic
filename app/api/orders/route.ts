import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculatePromotions,
  validateCouponRow,
  type PromotionRow,
  type CouponRow,
} from '@/lib/utils/promotions'

// ── Row types ─────────────────────────────────────────────────────────────────

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
      vendor_id: string | null
    } | null
  } | null
}

type LogisticsRow = {
  shipping_fee: number
  free_shipping_threshold: number | null
}

type OrderBody = {
  shipping_method: string
  recipient_name: string
  recipient_phone: string
  recipient_address?: string
  cvs_store_id?: string
  cvs_store_name?: string
  coupon_code?: string
  reward_points_used?: number
  note?: string
}

// ── POST /api/orders ──────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: OrderBody
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const {
    shipping_method,
    recipient_name,
    recipient_phone,
    recipient_address,
    cvs_store_id,
    cvs_store_name,
    coupon_code,
    reward_points_used: rawPoints = 0,
    note,
  } = body

  if (!shipping_method)
    return apiError('請選擇物流方式', 400, 'MISSING_SHIPPING_METHOD')
  if (!recipient_name)
    return apiError('請填寫收件人姓名', 400, 'MISSING_RECIPIENT_NAME')
  if (!recipient_phone)
    return apiError('請填寫收件人電話', 400, 'MISSING_RECIPIENT_PHONE')

  const admin = createAdminClient()

  // ── 1. Load cart ──────────────────────────────────────────────────────────

  const { data: cartRaw, error: cartErr } = await admin
    .from('carts')
    .select(
      `
      variant_id, quantity,
      product_variants (
        id, price, stock, is_active,
        products ( id, base_price, is_active, vendor_id )
      )
    `,
    )
    .eq('user_id', user.id)

  if (cartErr) return apiError('無法載入購物車', 500, 'FETCH_FAILED')

  const rows = (cartRaw as unknown as CartRow[]) ?? []
  if (rows.length === 0) return apiError('購物車是空的', 400, 'EMPTY_CART')

  let subtotal = 0
  let itemCount = 0
  const orderItems: {
    variant_id: string
    quantity: number
    unit_price: number
  }[] = []
  // Track quantity per vendor to determine primary vendor (for commission)
  const vendorQtyMap = new Map<string, number>()

  for (const row of rows) {
    const variant = row.product_variants
    const product = variant?.products
    if (!variant || !product || !product.is_active || !variant.is_active)
      continue
    const qty = Math.min(row.quantity, variant.stock)
    if (qty === 0) continue
    const unitPrice = variant.price ?? product.base_price
    subtotal += unitPrice * qty
    itemCount += qty
    orderItems.push({
      variant_id: row.variant_id,
      quantity: qty,
      unit_price: unitPrice,
    })
    if (product.vendor_id) {
      vendorQtyMap.set(
        product.vendor_id,
        (vendorQtyMap.get(product.vendor_id) ?? 0) + qty,
      )
    }
  }

  // Primary vendor = the vendor with the most item quantity in this order
  let primaryVendorId: string | null = null
  let maxVendorQty = 0
  for (const [vid, qty] of vendorQtyMap) {
    if (qty > maxVendorQty) {
      maxVendorQty = qty
      primaryVendorId = vid
    }
  }

  if (subtotal === 0)
    return apiError('購物車中沒有可結帳的商品', 400, 'EMPTY_CART')

  // ── 2. Load reward rate ───────────────────────────────────────────────────

  let rewardRate = 0
  if (user.member_level_id) {
    const { data: levelRaw } = await admin
      .from('member_levels')
      .select('reward_rate')
      .eq('id', user.member_level_id)
      .single()
    rewardRate =
      (levelRaw as unknown as { reward_rate: number } | null)?.reward_rate ?? 0
  }

  // ── 3. Promotions ─────────────────────────────────────────────────────────

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

  // ── 4. Coupon ─────────────────────────────────────────────────────────────

  let coupon_discount = 0
  let coupon_id: string | null = null

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
        coupon_id = validation.coupon.id
      }
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

  // ── 6. Shipping fee（從 logistics_settings 讀取，不再使用固定值）────────

  const { data: logisticsRaw, error: logisticsErr } = await admin
    .from('logistics_settings')
    .select('shipping_fee, free_shipping_threshold')
    .eq('logistics_type', shipping_method)
    .eq('is_enabled', true)
    .single()

  if (logisticsErr || !logisticsRaw) {
    return apiError('不支援的物流方式', 400, 'INVALID_LOGISTICS_METHOD')
  }

  const logistics = logisticsRaw as unknown as LogisticsRow

  // Fallback to global free_shipping_amount when per-logistics threshold is null
  const { data: globalSettingRaw } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'cart.free_shipping_amount')
    .single()

  const globalThreshold =
    (globalSettingRaw as unknown as { value: number } | null)?.value ?? 1000
  const threshold = logistics.free_shipping_threshold ?? globalThreshold
  const isFreeShipping = hasPromotionFreeShipping || subtotal >= threshold
  const shipping_fee = isFreeShipping ? 0 : logistics.shipping_fee

  // ── 7. Total ──────────────────────────────────────────────────────────────

  const productAmount = Math.max(
    0,
    subtotal - promotions_discount - coupon_discount - reward_points_discount,
  )
  const total_amount = productAmount + shipping_fee
  const reward_points_to_earn = Math.floor((productAmount * rewardRate) / 100)

  // ── 8. Create order ───────────────────────────────────────────────────────

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'pending',
      subtotal,
      promotions_discount,
      coupon_id,
      coupon_discount,
      reward_points_used,
      reward_points_discount,
      shipping_fee,
      total_amount,
      shipping_method,
      recipient_name,
      recipient_phone,
      recipient_address: recipient_address ?? null,
      cvs_store_id: cvs_store_id ?? null,
      cvs_store_name: cvs_store_name ?? null,
      note: note ?? null,
      vendor_id: primaryVendorId,
      sales_channel: 'online_daily',
    } as never)
    .select('id')
    .single()

  if (orderErr || !order)
    return apiError('建立訂單失敗', 500, 'ORDER_CREATE_FAILED')

  const orderId = (order as { id: string }).id

  // ── 9. Insert order items ─────────────────────────────────────────────────

  const { error: itemsErr } = await admin
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: orderId })) as never)

  if (itemsErr) {
    await admin.from('orders').delete().eq('id', orderId)
    return apiError('建立訂單明細失敗', 500, 'ORDER_ITEMS_FAILED')
  }

  // ── 10. Deduct stock + clear cart ─────────────────────────────────────────

  await Promise.all([
    ...orderItems.map((item) =>
      (admin as any).rpc('decrement_stock', {
        variant_id: item.variant_id,
        qty: item.quantity,
      }),
    ),
    admin.from('carts').delete().eq('user_id', user.id),
  ])

  // ── 11. Apply coupon usage + reward points ────────────────────────────────

  const sideEffects: PromiseLike<unknown>[] = []

  if (coupon_id) {
    // used_count is incremented by a DB trigger on order_items insert
  }

  if (reward_points_used > 0) {
    sideEffects.push(
      admin
        .from('users')
        .update({
          reward_points: user.reward_points - reward_points_used,
        } as never)
        .eq('id', user.id),
    )
  }

  if (reward_points_to_earn > 0) {
    sideEffects.push(
      admin.from('reward_transactions').insert({
        user_id: user.id,
        order_id: orderId,
        type: 'earn',
        points: reward_points_to_earn,
        description: '訂單消費點數回饋',
      } as never),
    )
  }

  await Promise.allSettled(sideEffects)

  return apiSuccess({ order_id: orderId, total_amount, shipping_fee }, 201)
})
