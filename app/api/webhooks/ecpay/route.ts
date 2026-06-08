import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

// ── CheckMacValue verification ────────────────────────────────────────────────

function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function computeCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): string {
  const sorted = Object.entries(params)
    .filter(([k]) => k !== 'CheckMacValue')
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const raw = `HashKey=${hashKey}&${sorted.map(([k, v]) => `${k}=${v}`).join('&')}&HashIV=${hashIv}`
  const encoded = ecpayUrlEncode(raw).toLowerCase()

  return createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const hashKey = process.env.ECPAY_HASH_KEY
  const hashIv = process.env.ECPAY_HASH_IV

  if (!hashKey || !hashIv) {
    console.error('[ecpay-webhook] Missing ECPAY_HASH_KEY or ECPAY_HASH_IV')
    return new NextResponse('0|Error', { status: 500 })
  }

  // ECPay sends application/x-www-form-urlencoded
  let formText: string
  try {
    formText = await req.text()
  } catch {
    return new NextResponse('0|Error', { status: 400 })
  }

  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(formText)) {
    params[k] = v
  }

  // ── 1. Verify CheckMacValue ───────────────────────────────────────────────
  const received = params['CheckMacValue'] ?? ''
  const expected = computeCheckMacValue(params, hashKey, hashIv)

  if (received.toUpperCase() !== expected) {
    console.warn('[ecpay-webhook] CheckMacValue mismatch', {
      received,
      expected,
    })
    return new NextResponse('0|CheckMacValue Error')
  }

  // ── 2. Only process successful payments ───────────────────────────────────
  const rtnCode = params['RtnCode']
  const merchantTradeNo = params['MerchantTradeNo']
  const tradeNo = params['TradeNo']
  const paymentType = params['PaymentType'] ?? ''
  const tradeAmt = parseInt(params['TradeAmt'] ?? '0', 10)

  if (rtnCode !== '1') {
    console.info(
      '[ecpay-webhook] Non-success RtnCode',
      rtnCode,
      merchantTradeNo,
    )
    return new NextResponse('1|OK')
  }

  if (!merchantTradeNo) {
    return new NextResponse('0|Missing MerchantTradeNo')
  }

  const admin = createAdminClient()

  // ── 3. Find order (MerchantTradeNo = ecpay_order_id we set at checkout) ──
  const { data: order, error: orderErr } = (await admin
    .from('orders')
    .select('id, status, total_amount')
    .eq('ecpay_order_id', merchantTradeNo)
    .maybeSingle()) as unknown as {
    data: { id: string; status: string; total_amount: number } | null
    error: { message: string } | null
  }

  if (orderErr || !order) {
    console.error(
      '[ecpay-webhook] Order not found',
      merchantTradeNo,
      orderErr?.message,
    )
    return new NextResponse('0|Order not found')
  }

  // ── 4. Replay prevention: skip if already past pending ────────────────────
  if (order.status !== 'pending') {
    console.info(
      '[ecpay-webhook] Replayed payment, skipping',
      merchantTradeNo,
      order.status,
    )
    return new NextResponse('1|OK')
  }

  // ── 5. Validate amount matches ────────────────────────────────────────────
  if (Math.abs(tradeAmt - order.total_amount) > 1) {
    console.error('[ecpay-webhook] Amount mismatch', {
      tradeAmt,
      orderTotal: order.total_amount,
    })
    return new NextResponse('0|Amount mismatch')
  }

  // ── 6. Update order status to paid ───────────────────────────────────────
  const { error: updateErr } = await admin
    .from('orders')
    .update({
      status: 'paid',
      admin_note: `ECPay confirmed. TradeNo: ${tradeNo ?? ''}, PaymentType: ${paymentType}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (updateErr) {
    console.error(
      '[ecpay-webhook] Failed to update order',
      order.id,
      updateErr.message,
    )
    return new NextResponse('0|DB Error', { status: 500 })
  }

  // ── 7. Insert payment transaction record ─────────────────────────────────
  const paidAt = params['PaymentDate']
    ? new Date(params['PaymentDate'].replace(' ', 'T')).toISOString()
    : new Date().toISOString()

  const { error: txErr } = await admin.from('payment_transactions').insert({
    order_id: order.id,
    ecpay_trade_no: tradeNo ?? null,
    payment_type: paymentType || null,
    amount: tradeAmt,
    status: 'paid',
    paid_at: paidAt,
    ecpay_response: params as unknown as Json,
  })

  if (txErr) {
    // Non-fatal: order is already paid; log and continue
    console.error(
      '[ecpay-webhook] Failed to insert payment_transaction',
      order.id,
      txErr.message,
    )
  }

  console.info('[ecpay-webhook] Payment confirmed', {
    merchantTradeNo,
    amount: tradeAmt,
  })
  return new NextResponse('1|OK')
}
