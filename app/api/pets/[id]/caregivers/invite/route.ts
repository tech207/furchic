import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const POST = withAuth(async (_req, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  // Owner only
  const { data: myEntry } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!myEntry) return apiError('找不到寵物', 404, 'NOT_FOUND')
  if ((myEntry as unknown as { role: string }).role !== 'owner')
    return apiError('僅限飼主操作', 403, 'FORBIDDEN')

  // Check caregiver limit from system_settings
  const { data: limitSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'max_caregivers_per_pet')
    .single()
  const settingValue = (limitSetting as unknown as { value: unknown } | null)
    ?.value
  const maxCaregivers = typeof settingValue === 'number' ? settingValue : 5

  const { count } = await supabase
    .from('pet_caregivers')
    .select('*', { count: 'exact', head: true })
    .eq('pet_id', petId)

  if ((count ?? 0) >= maxCaregivers) {
    return apiError(
      `此寵物已達到最多 ${maxCaregivers} 位照護者上限`,
      422,
      'CAREGIVER_LIMIT_EXCEEDED',
    )
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  const { error } = await admin.from('pet_caregiver_invitations').insert({
    pet_id: petId,
    inviter_id: user.id,
    token,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[POST /api/pets/[id]/caregivers/invite]', error.message)
    return apiError('建立邀請失敗', 500, 'CREATE_FAILED')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${appUrl}/invite/${token}`

  return apiSuccess({ invite_url: inviteUrl }, 201)
})
