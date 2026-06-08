import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 20

export const GET = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const payment_type_prefix =
    url.searchParams.get('payment_type_prefix')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const admin = createAdminClient()

  let query = admin
    .from('payment_transactions')
    .select(
      'id, order_id, ecpay_trade_no, payment_type, amount, status, paid_at, created_at, ecpay_response, orders(id, ecpay_order_id, recipient_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status as never)
  if (payment_type_prefix)
    query = query.ilike('payment_type', `${payment_type_prefix}%`)
  if (start_date) query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

  const { data, error, count } = await query

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({
    transactions: data ?? [],
    total: count ?? 0,
    page,
  })
})
