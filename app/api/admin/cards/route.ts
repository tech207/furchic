import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_STATUSES = ['pending', 'printing', 'done'] as const

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const search = url.searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = 20
  const offset = (page - 1) * limit

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return apiError('無效的狀態值', 400, 'INVALID_STATUS')
  }

  const validStatus = status as (typeof VALID_STATUSES)[number]
  const admin = createAdminClient()

  const { data, count, error } = await admin
    .from('card_print_requests')
    .select(
      `id, status, source, card_front_url, card_back_url, note, created_at,
      pets ( id, name, breed, ai_photo_url, photo_url ),
      users ( id, name ),
      redemption_codes ( id, code )`,
      { count: 'exact' },
    )
    .eq('status', validStatus)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[GET /api/admin/cards]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  type RequestRow = {
    pets?: { name?: string } | null
    users?: { name?: string } | null
  }

  let requests = (data as unknown as RequestRow[]) ?? []

  // In-memory search filter (pet name or owner name)
  if (search.trim()) {
    const lower = search.toLowerCase()
    requests = requests.filter(
      (r) =>
        r.pets?.name?.toLowerCase().includes(lower) ||
        r.users?.name?.toLowerCase().includes(lower),
    )
  }

  return apiSuccess({
    requests,
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
})
