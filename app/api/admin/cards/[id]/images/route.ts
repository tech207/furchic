import crypto from 'crypto'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  type ReqRow = {
    id: string
    card_front_url: string | null
    card_back_url: string | null
    pet_id: string
    pets: { name: string; ai_photo_url: string | null } | null
  }

  const { data: reqRaw } = await admin
    .from('card_print_requests')
    .select(
      'id, card_front_url, card_back_url, pet_id, pets ( name, ai_photo_url )',
    )
    .eq('id', id)
    .single()

  if (!reqRaw) return apiError('找不到申請記錄', 404, 'NOT_FOUND')
  const request = reqRaw as unknown as ReqRow

  // If images already generated, return cached URLs
  if (request.card_front_url && request.card_back_url) {
    return apiSuccess({
      front_url: request.card_front_url,
      back_url: request.card_back_url,
    })
  }

  if (!request.pets?.ai_photo_url) {
    return apiError('寵物尚未上傳 AI 去背照片', 422, 'NO_AI_PHOTO')
  }

  const pythonUrl = process.env.PYTHON_API_URL?.replace(/\/$/, '')
  const pythonKey = process.env.PYTHON_API_KEY
  if (!pythonUrl || !pythonKey) {
    return apiError('製卡服務尚未設定', 503, 'SERVICE_UNAVAILABLE')
  }

  // NOTE: In production, use the actual NFC chip UUID assigned during manufacturing.
  // For now, use request ID as the card UUID for the QR code.
  const cardUuid = crypto.randomUUID()

  try {
    const res = await fetch(`${pythonUrl}/generate-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': pythonKey },
      body: JSON.stringify({
        uuid: cardUuid,
        pet_name: request.pets.name,
        pet_ai_photo_url: request.pets.ai_photo_url,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      console.error('[admin/cards/images] Python API', res.status)
      return apiError('卡面生成失敗', 503, 'GENERATION_FAILED')
    }

    const data = await res.json()
    const { front_url, back_url } = data as {
      front_url: string
      back_url: string
    }

    // Persist generated URLs so we don't regenerate on subsequent calls
    await admin
      .from('card_print_requests')
      .update({ card_front_url: front_url, card_back_url: back_url } as never)
      .eq('id', id)

    return apiSuccess({ front_url, back_url })
  } catch (err) {
    console.error('[admin/cards/images] fetch error', err)
    return apiError('製卡服務暫時無法連線', 503, 'SERVICE_UNAVAILABLE')
  }
})
