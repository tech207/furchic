import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('card_print_requests')
    .select(
      `id, status, source, created_at,
      pets ( id, name, breed, ai_photo_url, photo_url ),
      users ( id, name )`,
    )
    .in('status', ['pending', 'printing'])
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[GET /api/admin/nfc/search]', error.message)
    return apiError('搜尋失敗', 500, 'FETCH_FAILED')
  }

  type Row = {
    id: string
    status: string
    source: string
    created_at: string
    pets: {
      id: string
      name: string
      breed: string | null
      ai_photo_url: string | null
      photo_url: string | null
    } | null
    users: { id: string; name: string } | null
  }

  let requests = (data as unknown as Row[]) ?? []

  if (q) {
    const lower = q.toLowerCase()
    requests = requests.filter(
      (r) =>
        r.pets?.name?.toLowerCase().includes(lower) ||
        r.users?.name?.toLowerCase().includes(lower) ||
        r.id.toLowerCase().startsWith(lower),
    )
  }

  return apiSuccess({ requests })
})
