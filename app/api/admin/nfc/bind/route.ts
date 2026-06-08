import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  pet_id: z.string().uuid(),
  card_uuid: z.string().uuid(),
  card_serial: z.string().max(64).optional(),
})

export const POST = withAdmin(async (req: NextRequest, _ctx, user) => {
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

  const { pet_id, card_uuid, card_serial } = parsed.data
  const admin = createAdminClient()

  // Validate pet exists and awaiting physical card
  const { data: petRaw } = await admin
    .from('pets')
    .select('id, name, card_status')
    .eq('id', pet_id)
    .single()

  if (!petRaw) return apiError('找不到寵物', 404, 'NOT_FOUND')
  const pet = petRaw as unknown as {
    id: string
    name: string
    card_status: string
  }

  if (pet.card_status !== 'pending') {
    return apiError(
      pet.card_status === 'active'
        ? '此寵物已有啟用中的 NFC 卡'
        : '此寵物尚未申請製卡，無法綁定',
      422,
      'PET_NOT_PENDING',
    )
  }

  // Validate NFC card exists in DB and is unbound
  const { data: cardRaw } = await admin
    .from('nfc_cards')
    .select('id, status, pet_id')
    .eq('id', card_uuid)
    .single()

  if (!cardRaw) {
    return apiError(
      '找不到此 NFC 卡記錄，請確認已完成預生成或 UUID 正確',
      404,
      'CARD_NOT_FOUND',
    )
  }

  const card = cardRaw as unknown as {
    id: string
    status: string
    pet_id: string | null
  }

  if (card.status === 'active') {
    return apiError(
      '此卡片已綁定其他寵物，無法重複綁定',
      409,
      'CARD_ALREADY_BOUND',
    )
  }

  const now = new Date().toISOString()

  // Bind: update nfc_cards
  const { error: cardErr } = await admin
    .from('nfc_cards')
    .update({
      status: 'active',
      pet_id,
      bound_at: now,
      bound_by: user.id,
      ...(card_serial ? { card_serial } : {}),
    } as never)
    .eq('id', card_uuid)

  if (cardErr) {
    console.error(
      '[POST /api/admin/nfc/bind] nfc_cards update',
      cardErr.message,
    )
    return apiError('綁定失敗，請稍後再試', 500, 'BIND_FAILED')
  }

  // Activate pet
  await admin
    .from('pets')
    .update({ card_status: 'active' } as never)
    .eq('id', pet_id)

  // Mark the matching print request as done (if in printing state)
  await admin
    .from('card_print_requests')
    .update({ status: 'done' } as never)
    .eq('pet_id', pet_id)
    .in('status', ['pending', 'printing'])

  // Audit log
  console.info(
    '[NFC_BIND]',
    JSON.stringify({
      admin_id: user.id,
      pet_id,
      card_uuid,
      card_serial: card_serial ?? null,
      timestamp: now,
    }),
  )

  return apiSuccess({
    success: true,
    nfc_card: { id: card_uuid, pet_id, status: 'active', bound_at: now },
  })
})
