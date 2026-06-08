import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('policies')
    .select(
      'id, slug, title, content_type, status, last_published_at, meta_title, meta_description, updated_at',
    )
    .order('created_at', { ascending: true })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ policies: data ?? [] })
})
