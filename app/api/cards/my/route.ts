import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export const GET = withAuth(async (_req, _ctx, user) => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('card_print_requests')
    .select(
      `id, status, source, card_front_url, card_back_url, note, created_at,
      pets ( id, name, breed, ai_photo_url, photo_url, card_status )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/cards/my]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ requests: (data as unknown as unknown[]) ?? [] })
})
