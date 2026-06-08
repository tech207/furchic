import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type InvitationRow = {
  id: string
  pet_id: string
  inviter_id: string
  status: string
  expires_at: string
}

type PetRow = { name: string; breed: string | null }
type UserRow = { name: string }

export const GET = withAuth(async (_req, ctx, user) => {
  const token = ctx.params?.token as string | undefined
  if (!token) return apiError('缺少 token', 400, 'MISSING_TOKEN')

  const admin = createAdminClient()

  const { data: invRaw, error: invError } = await admin
    .from('pet_caregiver_invitations')
    .select('id, pet_id, inviter_id, status, expires_at')
    .eq('token', token)
    .single()

  if (invError || !invRaw) return apiError('邀請連結無效', 404, 'INVALID_TOKEN')

  const inv = invRaw as unknown as InvitationRow

  if (inv.status !== 'pending')
    return apiError('此邀請已使用或已過期', 410, 'INVITATION_USED')
  if (new Date(inv.expires_at) < new Date())
    return apiError('此邀請連結已過期', 410, 'INVITATION_EXPIRED')

  // Check user is not already a caregiver for this pet
  const { data: existing } = await admin
    .from('pet_caregivers')
    .select('id')
    .eq('pet_id', inv.pet_id)
    .eq('user_id', user.id)
    .single()

  if (existing)
    return apiError('您已是此寵物的照護者', 409, 'ALREADY_CAREGIVER')

  // Fetch pet info
  const { data: petRaw } = await admin
    .from('pets')
    .select('name, breed')
    .eq('id', inv.pet_id)
    .single()

  const pet = petRaw as unknown as PetRow | null

  // Fetch inviter info
  const { data: inviterRaw } = await admin
    .from('users')
    .select('name')
    .eq('id', inv.inviter_id)
    .single()

  const inviter = inviterRaw as unknown as UserRow | null

  return apiSuccess({
    pet: { name: pet?.name ?? '', breed: pet?.breed ?? null },
    inviter: { name: inviter?.name ?? '' },
  })
})
