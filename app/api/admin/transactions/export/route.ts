import type { NextRequest } from 'next/server'
import { withAdmin, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRateLimiter } from '@/lib/rate-limit'

const isLimited = createRateLimiter('tx-export', 5, 60_000)

type TxRow = {
  id: string
  order_id: string
  ecpay_trade_no: string | null
  payment_type: string | null
  amount: number
  status: string
  paid_at: string | null
  orders: { ecpay_order_id: string | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  paid: '已付款',
  pending: '待付款',
  refunded: '已退款',
  failed: '失敗',
}

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export const GET = withAdmin(async (req: NextRequest, _ctx, user) => {
  if (isLimited(user.id))
    return apiError('匯出頻率超限，請稍候再試', 429, 'RATE_LIMITED')

  const url = new URL(req.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const payment_type_prefix =
    url.searchParams.get('payment_type_prefix')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''

  const admin = createAdminClient()

  let query = admin
    .from('payment_transactions')
    .select(
      'id, order_id, ecpay_trade_no, payment_type, amount, status, paid_at, orders(ecpay_order_id)',
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as never)
  if (payment_type_prefix)
    query = query.ilike('payment_type', `${payment_type_prefix}%`)
  if (start_date) query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) return new Response('匯出失敗', { status: 500 })

  const rows = (data as unknown as TxRow[]) ?? []
  const header = 'TransactionNo,OrderId,Amount,PaymentType,Status,PaidAt'
  const csvRows = rows.map((r) =>
    [
      esc(r.ecpay_trade_no),
      esc(r.orders?.ecpay_order_id ?? r.order_id),
      esc(r.amount),
      esc(r.payment_type),
      esc(STATUS_LABELS[r.status] ?? r.status),
      esc(r.paid_at ? new Date(r.paid_at).toLocaleString('zh-TW') : ''),
    ].join(','),
  )

  const csv = '﻿' + [header, ...csvRows].join('\n')
  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
