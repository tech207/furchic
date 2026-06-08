import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 50

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const user_id = url.searchParams.get('user_id')?.trim() ?? ''
  const type = url.searchParams.get('type')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const admin = createAdminClient()

  let query = admin
    .from('reward_transactions')
    .select(
      'id, user_id, type, points, note, order_id, created_at, users(id, name, email)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (user_id) query = query.eq('user_id', user_id)
  if (type)
    query = query.eq(
      'type',
      type as 'earned' | 'spent' | 'adjusted' | 'expired',
    )

  const { data, error, count } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ transactions: data ?? [], total: count ?? 0, page })
})
