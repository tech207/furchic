import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeBg } from '@/lib/imagine-art/client'

// ── SSRF guard: only allow Supabase Storage URLs ──────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_HOST = (() => {
  try {
    return new URL(SUPABASE_URL).hostname
  } catch {
    return ''
  }
})()

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Must be https, must be our Supabase project host, must be a storage path
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === SUPABASE_HOST &&
      parsed.pathname.startsWith('/storage/')
    )
  } catch {
    return false
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  image_url: z.string().url(),
})

// ── Per-route rate limit (20/day per user) ────────────────────────────────────

async function checkRemoveBgLimit(
  userId: string,
): Promise<{ allowed: boolean }> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.rpc(
      'increment_rate_limit' as never,
      {
        p_key: `removebg:${userId}`,
        p_window_seconds: 86_400,
        p_limit: 20,
      } as never,
    )
    return { allowed: (data as unknown as { is_allowed: boolean }).is_allowed }
  } catch {
    return { allowed: true } // fail open
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  // Rate limit
  const { allowed } = await checkRemoveBgLimit(user.id)
  if (!allowed) {
    return apiError(
      '今日去背次數已達上限（20 次），請明日再試',
      429,
      'RATE_LIMIT_EXCEEDED',
    )
  }

  // Parse body
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

  const { image_url } = result.data

  // SSRF guard
  if (!isAllowedImageUrl(image_url)) {
    return apiError(
      'image_url 必須是 Supabase Storage URL',
      422,
      'INVALID_IMAGE_URL',
    )
  }

  // Submit to Imagine Art
  try {
    const { jobId } = await removeBg(image_url)
    return apiSuccess({ job_id: jobId, status: 'queued' }, 202)
  } catch (err) {
    console.error(
      '[POST /api/ai/remove-bg]',
      err instanceof Error ? err.message : err,
    )
    return apiError(
      'AI 服務暫時無法使用，請稍後再試',
      503,
      'AI_SERVICE_UNAVAILABLE',
    )
  }
})
