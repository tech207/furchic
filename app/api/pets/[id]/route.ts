import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updatePetSchema } from '@/lib/validations/pet'

type CaregiverRow = { role: 'owner' | 'caregiver' }

async function getCaregiverRole(
  petId: string,
  userId: string,
): Promise<'owner' | 'caregiver' | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', petId)
    .eq('user_id', userId)
    .single()
  return (data as unknown as CaregiverRow | null)?.role ?? null
}

export const GET = withAuth(async (_req, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const role = await getCaregiverRole(petId, user.id)
  if (!role) return apiError('找不到寵物', 404, 'NOT_FOUND')

  const supabase = createClient()

  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('*, nfc_cards ( id, status, bound_at, card_serial )')
    .eq('id', petId)
    .single()

  if (petError || !pet) return apiError('找不到寵物', 404, 'NOT_FOUND')

  const { data: caregivers } = await supabase
    .from('pet_caregivers')
    .select(
      `id, role, display_name, contact_methods, is_visible,
      sort_order, invited_at, accepted_at, created_at,
      users ( id, name, avatar_url )`,
    )
    .eq('pet_id', petId)
    .order('sort_order', { ascending: true })

  const petData = pet as unknown as Record<string, unknown>
  const nfcRaw = petData.nfc_cards
  const nfc_card = Array.isArray(nfcRaw)
    ? (nfcRaw[0] ?? null)
    : (nfcRaw ?? null)

  return apiSuccess({
    pet: { ...petData, nfc_cards: undefined, nfc_card },
    caregivers: (caregivers as unknown as unknown[]) ?? [],
    nfc_card,
  })
})

export const PUT = withAuth(async (req: NextRequest, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const role = await getCaregiverRole(petId, user.id)
  if (!role) return apiError('找不到寵物', 404, 'NOT_FOUND')
  if (role !== 'owner') return apiError('僅限飼主操作', 403, 'FORBIDDEN')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = updatePetSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const clean = Object.fromEntries(
    Object.entries(result.data).filter(([, v]) => v !== undefined),
  )
  if (Object.keys(clean).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }
  clean.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data: pet, error } = await admin
    .from('pets')
    .update(clean as never)
    .eq('id', petId)
    .select()
    .single()

  if (error || !pet) {
    console.error('[PUT /api/pets/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ pet: pet as unknown as Record<string, unknown> })
})

export const DELETE = withAuth(async (_req, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  const { data: caregiver } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!caregiver) return apiError('找不到寵物', 404, 'NOT_FOUND')
  if ((caregiver as unknown as CaregiverRow).role !== 'owner')
    return apiError('僅限飼主操作', 403, 'FORBIDDEN')

  const { data: pet } = await supabase
    .from('pets')
    .select('card_status')
    .eq('id', petId)
    .single()

  if (!pet) return apiError('找不到寵物', 404, 'NOT_FOUND')

  if ((pet as unknown as { card_status: string }).card_status !== 'none') {
    return apiError('已申請製卡的寵物無法刪除', 409, 'CARD_EXISTS')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('pets').delete().eq('id', petId)

  if (error) {
    console.error('[DELETE /api/pets/[id]]', error.message)
    return apiError('刪除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
