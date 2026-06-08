import { withSuperAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withSuperAdmin(async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('admin_roles')
    .select(
      'id, name, display_name, description, permissions, is_system, created_at',
    )
    .order('created_at', { ascending: true })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ roles: data ?? [] })
})
