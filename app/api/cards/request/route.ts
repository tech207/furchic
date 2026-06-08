import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  pet_id: z.string().uuid(),
  redemption_code: z.string().min(1).max(40).optional(),
  order_id: z.string().uuid().optional(),
})

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { pet_id, redemption_code, order_id } = parsed.data

  if (!redemption_code && !order_id) {
    return apiError('請提供兌換碼或訂單 ID', 400, 'MISSING_SOURCE')
  }

  const supabase = createClient()
  const admin = createAdminClient()

  // Owner check
  const { data: caregiverRaw } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', pet_id)
    .eq('user_id', user.id)
    .single()

  if (
    !caregiverRaw ||
    (caregiverRaw as unknown as { role: string }).role !== 'owner'
  ) {
    return apiError('找不到寵物或無操作權限', 404, 'NOT_FOUND')
  }

  // Pet requirements
  const { data: petRaw } = await supabase
    .from('pets')
    .select('id, name, ai_photo_url, vet_hospital, card_status')
    .eq('id', pet_id)
    .single()

  if (!petRaw) return apiError('找不到寵物', 404, 'NOT_FOUND')
  type PetRow = {
    id: string
    name: string
    ai_photo_url: string | null
    vet_hospital: string
    card_status: string
  }
  const pet = petRaw as unknown as PetRow

  if (!pet.ai_photo_url)
    return apiError('請先上傳 AI 去背照片', 422, 'NO_AI_PHOTO')
  if (!pet.vet_hospital)
    return apiError('請先填寫固定醫院', 422, 'NO_VET_HOSPITAL')
  if (pet.card_status !== 'none')
    return apiError('此寵物已有製卡申請或已有 NFC 卡', 409, 'CARD_EXISTS')

  // No duplicate check
  const { data: existing } = await supabase
    .from('card_print_requests')
    .select('id')
    .eq('pet_id', pet_id)
    .limit(1)
    .single()

  if (existing) return apiError('此寵物已有製卡申請', 409, 'ALREADY_REQUESTED')

  // Determine source and validate
  let source: 'onsite' | 'online'
  let redemptionCodeId: string | null = null
  let validatedOrderId: string | null = null
  let codeUsedCount = 0

  if (redemption_code) {
    source = 'onsite'

    const { data: codeRaw } = await supabase
      .from('redemption_codes')
      .select('id, used_by, expires_at, used_count, max_uses')
      .eq('code', redemption_code.toUpperCase())
      .single()

    if (!codeRaw) return apiError('兌換碼不存在', 400, 'INVALID_CODE')
    type CodeRow = {
      id: string
      used_by: string | null
      expires_at: string | null
      used_count: number
      max_uses: number
    }
    const code = codeRaw as unknown as CodeRow

    if (code.used_by) return apiError('此兌換碼已被使用', 400, 'CODE_USED')
    if (code.expires_at && new Date(code.expires_at) < new Date())
      return apiError('此兌換碼已過期', 400, 'CODE_EXPIRED')
    if (code.used_count >= code.max_uses)
      return apiError('此兌換碼已達使用上限', 400, 'CODE_LIMIT')

    redemptionCodeId = code.id
    codeUsedCount = code.used_count
  } else {
    source = 'online'

    const { data: orderRaw } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', order_id!)
      .eq('user_id', user.id)
      .single()

    if (!orderRaw) return apiError('找不到訂單', 404, 'ORDER_NOT_FOUND')
    const order = orderRaw as unknown as { id: string; status: string }

    const validStatuses = ['paid', 'processing', 'shipped', 'done']
    if (!validStatuses.includes(order.status))
      return apiError('訂單狀態不符合申請資格', 422, 'ORDER_NOT_ELIGIBLE')

    // Check order not already used
    const { data: usedReq } = await supabase
      .from('card_print_requests')
      .select('id')
      .eq('order_id', order_id!)
      .limit(1)
      .single()

    if (usedReq)
      return apiError('此訂單已用於其他製卡申請', 409, 'ORDER_ALREADY_USED')

    validatedOrderId = order.id
  }

  // INSERT request
  const { data: newReqRaw, error: insertErr } = await admin
    .from('card_print_requests')
    .insert({
      user_id: user.id,
      pet_id,
      source,
      status: 'pending',
      ...(redemptionCodeId && { redemption_code_id: redemptionCodeId }),
      ...(validatedOrderId && { order_id: validatedOrderId }),
    } as never)
    .select('id, status')
    .single()

  if (insertErr || !newReqRaw) {
    console.error('[cards/request] insert', insertErr?.message)
    return apiError('申請失敗，請稍後再試', 500, 'CREATE_FAILED')
  }

  // Mark redemption code used
  if (redemptionCodeId) {
    await admin
      .from('redemption_codes')
      .update({
        used_by: user.id,
        used_at: new Date().toISOString(),
        used_count: codeUsedCount + 1,
      } as never)
      .eq('id', redemptionCodeId)
  }

  // Update pet card_status → pending
  await admin
    .from('pets')
    .update({ card_status: 'pending' } as never)
    .eq('id', pet_id)

  const newReq = newReqRaw as unknown as { id: string; status: string }
  return apiSuccess({ request_id: newReq.id, status: newReq.status }, 201)
})
