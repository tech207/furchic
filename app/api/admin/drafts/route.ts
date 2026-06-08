import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppUser } from '@/lib/auth/session'

const VALID_TYPES = [
  'product_price',
  'banner',
  'faq',
  'policy',
  'promotion',
] as const
type ResourceType = (typeof VALID_TYPES)[number]

// ── POST /api/admin/drafts ────────────────────────────────────────────────────

export const POST = withAdmin(async (req: NextRequest, _ctx, user: AppUser) => {
  let body: {
    resource_type?: string
    resource_id?: string | null
    draft_data?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const { resource_type, resource_id = null, draft_data } = body

  // ── Validate ────────────────────────────────────────────────────────────────

  if (!resource_type || !VALID_TYPES.includes(resource_type as ResourceType)) {
    return apiError(
      `resource_type 必須為：${VALID_TYPES.join(' | ')}`,
      400,
      'INVALID_RESOURCE_TYPE',
    )
  }

  if (
    !draft_data ||
    typeof draft_data !== 'object' ||
    Array.isArray(draft_data)
  ) {
    return apiError('draft_data 必須為物件', 400, 'INVALID_DRAFT_DATA')
  }

  // FAQ 不需要 resource_id；其他類型建議提供
  if (resource_type !== 'faq' && !resource_id) {
    return apiError(
      '此資源類型需要提供 resource_id',
      400,
      'MISSING_RESOURCE_ID',
    )
  }

  // ── Insert ──────────────────────────────────────────────────────────────────

  // draft_previews is not in the generated Database type yet; use any-cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any
  const preview_token = crypto.randomUUID()
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')

  const { data, error } = (await client
    .from('draft_previews')
    .insert({
      resource_type,
      resource_id: resource_id ?? null,
      draft_data,
      preview_token,
      created_by: user.id,
    })
    .select('id, preview_token, expires_at')
    .single()) as {
    data: { id: string; preview_token: string; expires_at: string } | null
    error: unknown
  }

  if (error || !data) {
    console.error('[drafts] insert error', error)
    return apiError('建立草稿失敗', 500, 'INSERT_FAILED')
  }

  return apiSuccess(
    {
      draft_id: data.id,
      preview_token: data.preview_token,
      preview_url: `${siteUrl}/preview/${data.preview_token}`,
      expires_at: data.expires_at,
    },
    201,
  )
})
