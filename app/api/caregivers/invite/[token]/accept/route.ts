import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type InvitationRow = {
  id: string
  pet_id: string
  inviter_id: string
  status: string
  expires_at: string
  created_at: string
}

export const POST = withAuth(async (_req, ctx, user) => {
  const token = ctx.params?.token as string | undefined
  if (!token) return apiError('缺少 token', 400, 'MISSING_TOKEN')

  const admin = createAdminClient()

  // Validate invitation
  const { data: invRaw, error: invError } = await admin
    .from('pet_caregiver_invitations')
    .select('id, pet_id, inviter_id, status, expires_at, created_at')
    .eq('token', token)
    .single()

  if (invError || !invRaw) return apiError('邀請連結無效', 404, 'INVALID_TOKEN')

  const inv = invRaw as unknown as InvitationRow

  if (inv.status !== 'pending')
    return apiError('此邀請已使用或已過期', 410, 'INVITATION_USED')
  if (new Date(inv.expires_at) < new Date())
    return apiError('此邀請連結已過期', 410, 'INVITATION_EXPIRED')

  // Check not already a caregiver
  const { data: existing } = await admin
    .from('pet_caregivers')
    .select('id')
    .eq('pet_id', inv.pet_id)
    .eq('user_id', user.id)
    .single()

  if (existing)
    return apiError('您已是此寵物的照護者', 409, 'ALREADY_CAREGIVER')

  // Check caregiver limit
  const { data: limitSetting } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'max_caregivers_per_pet')
    .single()
  const settingValue = (limitSetting as unknown as { value: unknown } | null)
    ?.value
  const maxCaregivers = typeof settingValue === 'number' ? settingValue : 5

  const { count } = await admin
    .from('pet_caregivers')
    .select('*', { count: 'exact', head: true })
    .eq('pet_id', inv.pet_id)

  if ((count ?? 0) >= maxCaregivers) {
    return apiError('此寵物照護者已達上限', 422, 'CAREGIVER_LIMIT_EXCEEDED')
  }

  // INSERT pet_caregivers
  const { error: insertError } = await admin.from('pet_caregivers').insert({
    pet_id: inv.pet_id,
    user_id: user.id,
    role: 'caregiver',
    invited_at: inv.created_at,
    accepted_at: new Date().toISOString(),
  })

  if (insertError) {
    console.error(
      '[POST /api/caregivers/invite/[token]/accept] insert',
      insertError.message,
    )
    return apiError('加入失敗', 500, 'JOIN_FAILED')
  }

  // Mark invitation as accepted
  await admin
    .from('pet_caregiver_invitations')
    .update({ status: 'accepted' } as never)
    .eq('id', inv.id)

  return apiSuccess({ pet_id: inv.pet_id })
})
