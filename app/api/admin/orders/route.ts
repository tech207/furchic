import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 20

type UserRow = { id: string }
type OrderRow = {
  id: string
  status: string
  total_amount: number
  created_at: string
  user_id: string
  users: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
  order_items: { product_name: string; quantity: number }[]
}
type StatusKey =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'done'
  | 'cancelled'
  | 'refunded'

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const search = url.searchParams.get('search')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const admin = createAdminClient()

  // Resolve user IDs from search term
  let searchUserIds: string[] = []
  if (search) {
    const { data: matchedUsers } = await admin
      .from('users')
      .select('id')
      .or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`,
      )
      .limit(200)
    searchUserIds = ((matchedUsers as unknown as UserRow[]) ?? []).map(
      (u) => u.id,
    )
  }

  let query = admin
    .from('orders')
    .select(
      'id, status, total_amount, shipping_fee, ecpay_order_id, tracking_number, logistics_company, logistics_status, logistics_status_at, recipient_name, recipient_phone, created_at, updated_at, user_id, users(id, name, email, phone), order_items(product_name, quantity)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status as StatusKey)
  if (start_date) query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

  if (search) {
    const conditions: string[] = [`id.ilike.%${search}%`]
    if (searchUserIds.length > 0)
      conditions.push(`user_id.in.(${searchUserIds.join(',')})`)
    query = query.or(conditions.join(','))
  }

  const { data, error, count } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  // Status counts (quick, no pagination)
  const { data: allStatuses } = await admin.from('orders').select('status')
  const statusCounts: Record<string, number> = {}
  ;((allStatuses ?? []) as unknown as { status: string }[]).forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1
  })

  // Today count
  const today = new Date().toISOString().slice(0, 10)
  const todayCount =
    ((allStatuses ?? []) as unknown as { status: string }[]).length === 0
      ? 0
      : undefined // placeholder — computed client-side from status_counts

  const now = new Date().toISOString().slice(0, 10)
  const { count: todayNew } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${now}T00:00:00.000Z`)

  return apiSuccess({
    orders: (data as unknown as OrderRow[]) ?? [],
    total: count ?? 0,
    page,
    status_counts: statusCounts,
    today_new: todayNew ?? 0,
  })
})
