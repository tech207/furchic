import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import {
  generateImage,
  type GenerateModel,
  type AspectRatio,
} from '@/lib/imagine-art/client'
import { aiRateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

// ── Schema ────────────────────────────────────────────────────────────────────

const VALID_MODELS: GenerateModel[] = [
  'imagine-art-2.0',
  'nano-banana-2',
  'gpt-image-2',
]
const VALID_RATIOS: AspectRatio[] = [
  '1:1',
  '9:16',
  '16:9',
  '4:3',
  '3:4',
  '2:3',
  '3:2',
  '21:9',
  '4:5',
  '5:4',
]

const bodySchema = z.object({
  prompt: z.string().min(1).max(500),
  aspect_ratio: z
    .enum(VALID_RATIOS as [AspectRatio, ...AspectRatio[]])
    .optional(),
  model: z.enum(VALID_MODELS as [GenerateModel, ...GenerateModel[]]).optional(),
})

// ── Route ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const rl = await aiRateLimit(user.id)
  if (!rl.allowed) return rateLimitResponse(rl)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }
  const result = bodySchema.safeParse(raw)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { prompt, aspect_ratio = '1:1', model } = result.data

  try {
    const { jobId } = await generateImage(prompt, aspect_ratio, model)
    return apiSuccess({ job_id: jobId }, 202)
  } catch (err) {
    console.error(
      '[POST /api/ai/generate-image]',
      err instanceof Error ? err.message : err,
    )
    return apiError(
      'AI 服務暫時無法使用，請稍後再試',
      503,
      'AI_SERVICE_UNAVAILABLE',
    )
  }
})
