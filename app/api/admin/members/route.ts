import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 20

type UserRow = { id: string; [key: string]: unknown }
type PetRow = { user_id: string }
type OrderRow = { user_id: string }

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const level = url.searchParams.get('level')?.trim() ?? ''
  const provider = url.searchParams.get('provider')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const admin = createAdminClient()

  let query = admin
    .from('users')
    .select(
      'id, name, email, phone, avatar_url, role, auth_provider, member_level_id, reward_points, total_spent, created_at, member_levels(id, name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search)
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    )
  if (level) query = query.eq('member_level_id', level)
  if (provider) query = query.eq('auth_provider', provider)
  if (start_date) query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

  const { data, error, count } = await query
  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  const users = (data as unknown as UserRow[]) ?? []
  const ids = users.map((u) => u.id)

  if (ids.length === 0)
    return apiSuccess({ members: [], total: count ?? 0, page })

  const [petsRes, ordersRes] = await Promise.all([
    admin.from('pets').select('user_id').in('user_id', ids),
    admin
      .from('orders')
      .select('user_id')
      .in('user_id', ids)
      .neq('status', 'cancelled'),
  ])

  const petMap = new Map<string, number>()
  const orderMap = new Map<string, number>()
  ;((petsRes.data as unknown as PetRow[]) ?? []).forEach((p) =>
    petMap.set(p.user_id, (petMap.get(p.user_id) ?? 0) + 1),
  )
  ;((ordersRes.data as unknown as OrderRow[]) ?? []).forEach((o) =>
    orderMap.set(o.user_id, (orderMap.get(o.user_id) ?? 0) + 1),
  )

  const members = users.map((u) => ({
    ...u,
    pet_count: petMap.get(u.id) ?? 0,
    order_count: orderMap.get(u.id) ?? 0,
  }))

  return apiSuccess({ members, total: count ?? 0, page })
})
