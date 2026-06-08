import type { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({ pet_id: z.string().uuid() })

async function checkPreviewLimit(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.rpc(
      'increment_rate_limit' as never,
      {
        p_key: `card-preview:${userId}`,
        p_window_seconds: 3600,
        p_limit: 5,
      } as never,
    )
    return (data as unknown as { is_allowed: boolean }).is_allowed
  } catch {
    return true // fail open
  }
}

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  if (!(await checkPreviewLimit(user.id))) {
    return apiError(
      '每小時卡面預覽已達上限（5 次）',
      429,
      'RATE_LIMIT_EXCEEDED',
    )
  }

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

  const { pet_id } = parsed.data
  const supabase = createClient()

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

  const { data: petRaw } = await supabase
    .from('pets')
    .select('id, name, ai_photo_url')
    .eq('id', pet_id)
    .single()

  if (!petRaw) return apiError('找不到寵物', 404, 'NOT_FOUND')
  const pet = petRaw as unknown as {
    id: string
    name: string
    ai_photo_url: string | null
  }

  if (!pet.ai_photo_url) {
    return apiError('請先上傳 AI 去背照片才能預覽卡面', 422, 'NO_AI_PHOTO')
  }

  const pythonUrl = process.env.PYTHON_API_URL?.replace(/\/$/, '')
  const pythonKey = process.env.PYTHON_API_KEY
  if (!pythonUrl || !pythonKey) {
    return apiError('製卡服務尚未設定', 503, 'SERVICE_UNAVAILABLE')
  }

  // Use a temporary UUID for preview (real UUID assigned when card is manufactured)
  const previewUuid = crypto.randomUUID()

  try {
    const res = await fetch(`${pythonUrl}/generate-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': pythonKey },
      body: JSON.stringify({
        uuid: previewUuid,
        pet_name: pet.name,
        pet_ai_photo_url: pet.ai_photo_url,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      console.error(
        '[cards/preview] Python API',
        res.status,
        await res.text().catch(() => ''),
      )
      return apiError('卡面生成失敗，請稍後再試', 503, 'GENERATION_FAILED')
    }

    const data = await res.json()
    return apiSuccess({ front_url: data.front_url, back_url: data.back_url })
  } catch (err) {
    console.error('[cards/preview] fetch error', err)
    return apiError('製卡服務暫時無法連線', 503, 'SERVICE_UNAVAILABLE')
  }
})
