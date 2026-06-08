import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export const GET = withAuth(async (_req, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  // Verify access (owner or caregiver)
  const { data: myEntry } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!myEntry) return apiError('找不到寵物', 404, 'NOT_FOUND')

  const { data: caregivers, error } = await supabase
    .from('pet_caregivers')
    .select(
      `id, role, display_name, contact_methods, is_visible,
      sort_order, invited_at, accepted_at, created_at,
      users ( id, name, avatar_url )`,
    )
    .eq('pet_id', petId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[GET /api/pets/[id]/caregivers]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ caregivers: (caregivers as unknown as unknown[]) ?? [] })
})
