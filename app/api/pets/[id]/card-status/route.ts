import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cardStatusUpdateSchema } from '@/lib/validations/pet'

export const PUT = withAuth(async (req: NextRequest, ctx, user) => {
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
  if ((caregiver as unknown as { role: string }).role !== 'owner')
    return apiError('僅限飼主操作', 403, 'FORBIDDEN')

  const { data: pet } = await supabase
    .from('pets')
    .select('card_status')
    .eq('id', petId)
    .single()

  if (!pet) return apiError('找不到寵物', 404, 'NOT_FOUND')

  const currentStatus = (pet as unknown as { card_status: string }).card_status
  if (currentStatus !== 'active' && currentStatus !== 'disabled') {
    return apiError(
      '此寵物尚未取得 NFC 卡，無法切換狀態',
      422,
      'CARD_NOT_READY',
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = cardStatusUpdateSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('pets')
    .update({
      card_status: result.data.status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', petId)

  if (error) {
    console.error('[PUT /api/pets/[id]/card-status]', error.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ card_status: result.data.status })
})
