import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getJobStatus } from '@/lib/imagine-art/client'

// ── Magic-byte validation for re-upload ──────────────────────────────────────

async function validateImageMagicBytes(buf: ArrayBuffer): Promise<boolean> {
  const b = new Uint8Array(buf.slice(0, 12))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true // JPEG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return true // PNG
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 && // RIFF
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50 // WEBP
  )
    return true
  return false
}

// ── Upload result to Supabase Storage ────────────────────────────────────────

async function uploadResultToStorage(
  resultUrl: string,
  userId: string,
  jobId: string,
): Promise<string | null> {
  try {
    const imageRes = await fetch(resultUrl, { cache: 'no-store' })
    if (!imageRes.ok) return null

    const buf = await imageRes.arrayBuffer()
    const valid = await validateImageMagicBytes(buf)
    if (!valid) {
      console.warn(
        '[status] result image failed magic-bytes check, skipping upload',
      )
      return null
    }

    const contentType = imageRes.headers.get('content-type') ?? 'image/png'
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png'
    const storagePath = `${userId}/${jobId}.${ext}`

    const admin = createAdminClient()
    const { error } = await admin.storage
      .from('pet-photos')
      .upload(storagePath, buf, { contentType, upsert: true })

    if (error) {
      console.error('[status] storage upload error', error.message)
      return null
    }

    const { data: urlData } = admin.storage
      .from('pet-photos')
      .getPublicUrl(storagePath)

    return urlData.publicUrl
  } catch (err) {
    console.error('[status] uploadResultToStorage', err)
    return null
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, ctx, user) => {
  const jobId = ctx.params?.jobId as string | undefined
  if (!jobId) return apiError('缺少 jobId', 400, 'MISSING_JOB_ID')

  // Basic UUID format guard to prevent path-traversal / injection
  if (!/^[\w-]{4,128}$/.test(jobId)) {
    return apiError('jobId 格式無效', 400, 'INVALID_JOB_ID')
  }

  let statusResult: Awaited<ReturnType<typeof getJobStatus>>
  try {
    statusResult = await getJobStatus(jobId)
  } catch (err) {
    console.error(
      '[GET /api/ai/status]',
      err instanceof Error ? err.message : err,
    )
    return apiError('AI 服務暫時無法使用', 503, 'AI_SERVICE_UNAVAILABLE')
  }

  // When done: upload to Supabase Storage and return our CDN URL
  if (statusResult.status === 'completed' && statusResult.resultUrl) {
    const storedUrl = await uploadResultToStorage(
      statusResult.resultUrl,
      user.id,
      jobId,
    )
    return apiSuccess({
      status: 'completed',
      result_url: storedUrl ?? statusResult.resultUrl,
      progress: 100,
    })
  }

  return apiSuccess({
    status: statusResult.status,
    progress: statusResult.progress ?? null,
    result_url: null,
  })
})
