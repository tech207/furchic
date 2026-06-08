import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [todayRes, pendingRes, monthRes] = await Promise.all([
    // Today's paid transactions
    admin
      .from('payment_transactions')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', todayStart.toISOString()),

    // Orders pending payment with checkout initiated (ecpay_order_id set)
    admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .not('ecpay_order_id', 'is', null),

    // This month's paid transactions
    admin
      .from('payment_transactions')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', monthStart.toISOString()),
  ])

  if (todayRes.error || pendingRes.error || monthRes.error) {
    return apiError('統計載入失敗', 500, 'STATS_FAILED')
  }

  const todayTxs = todayRes.data ?? []
  const monthTxs = monthRes.data ?? []

  return apiSuccess({
    todayCount: todayTxs.length,
    todayAmount: todayTxs.reduce((s, t) => s + (t.amount as number), 0),
    pendingCount: pendingRes.count ?? 0,
    monthlyAmount: monthTxs.reduce((s, t) => s + (t.amount as number), 0),
  })
})
