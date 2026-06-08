import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest, ctx) => {
  const slug = ctx.params?.slug as string | undefined
  if (!slug) return apiError('缺少 slug', 400, 'MISSING_SLUG')

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('policies')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return apiError('找不到政策', 404, 'NOT_FOUND')

  return apiSuccess({ policy: data })
})

// ── PUT ───────────────────────────────────────────────────────────────────────

export const PUT = withAdmin(async (req: NextRequest, ctx) => {
  const slug = ctx.params?.slug as string | undefined
  if (!slug) return apiError('缺少 slug', 400, 'MISSING_SLUG')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }

  if ('title' in body) patch.title = body.title
  if ('meta_title' in body) patch.meta_title = body.meta_title
  if ('meta_description' in body) patch.meta_description = body.meta_description

  if ('status' in body) {
    patch.status = body.status
    if (body.status === 'published' && 'content' in body) {
      patch.content = body.content
      patch.last_published_at = now
    } else if (body.status === 'draft' && 'content' in body) {
      patch.draft_content = body.content
    }
  } else if ('content' in body) {
    patch.content = body.content
  }

  if (Object.keys(patch).length === 1) {
    return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('policies')
    .update(patch as never)
    .eq('slug', slug)
    .select('slug, title, status, last_published_at, updated_at')
    .maybeSingle()

  if (error || !data) return apiError('更新失敗', 500, 'UPDATE_FAILED')

  return apiSuccess({ policy: data })
})

// ── POST /publish ─────────────────────────────────────────────────────────────

export const POST = withAdmin(async (_req: NextRequest, ctx) => {
  const slug = ctx.params?.slug as string | undefined
  if (!slug) return apiError('缺少 slug', 400, 'MISSING_SLUG')

  const admin = createAdminClient()

  type PolicyRow = { draft_content: string | null }

  // Fetch current draft_content
  const { data: current, error: fetchErr } = (await (admin as any)
    .from('policies')
    .select('draft_content')
    .eq('slug', slug)
    .maybeSingle()) as { data: PolicyRow | null; error: unknown }

  if (fetchErr || !current) return apiError('找不到政策', 404, 'NOT_FOUND')
  if (!current.draft_content) return apiError('沒有草稿可發布', 400, 'NO_DRAFT')

  const now = new Date().toISOString()

  const { data, error } = (await (admin as any)
    .from('policies')
    .update({
      content: current.draft_content,
      draft_content: null,
      status: 'published',
      last_published_at: now,
      updated_at: now,
    })
    .eq('slug', slug)
    .select('slug, title, status, last_published_at')
    .maybeSingle()) as { data: unknown; error: unknown }

  if (error || !data) return apiError('發布失敗', 500, 'PUBLISH_FAILED')

  return apiSuccess({ policy: data })
})
