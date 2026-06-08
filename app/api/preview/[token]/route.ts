import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type DraftRow = {
  id: string
  resource_type: string
  resource_id: string | null
  draft_data: Record<string, unknown>
  expires_at: string
  published_at: string | null
  created_at: string
}

// ── GET /api/preview/[token] ──────────────────────────────────────────────────
// Public endpoint — no auth required; token acts as the access key.
// Uses service-role client to bypass RLS.

export async function GET(
  _req: NextRequest,
  ctx: { params?: Record<string, string> },
) {
  const token = ctx.params?.token
  if (!token) {
    return Response.json(
      { error: 'NOT_FOUND', message: '預覽連結無效' },
      { status: 404 },
    )
  }

  // draft_previews is not in the generated Database type yet; use any-cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any

  const { data: raw, error } = (await client
    .from('draft_previews')
    .select(
      'id, resource_type, resource_id, draft_data, expires_at, published_at, created_at',
    )
    .eq('preview_token', token)
    .maybeSingle()) as { data: DraftRow | null; error: unknown }

  if (error || !raw) {
    return Response.json(
      { error: 'NOT_FOUND', message: '預覽連結無效或已移除' },
      { status: 404 },
    )
  }

  // Expired and not published
  if (new Date(raw.expires_at) < new Date() && !raw.published_at) {
    return Response.json(
      { error: 'EXPIRED', message: '預覽連結已過期' },
      { status: 410 },
    )
  }

  return Response.json(
    {
      data: {
        id: raw.id,
        resource_type: raw.resource_type,
        resource_id: raw.resource_id,
        draft_data: raw.draft_data,
        expires_at: raw.expires_at,
        published_at: raw.published_at,
        created_at: raw.created_at,
      },
    },
    {
      status: 200,
      headers: {
        // Previews are personal/admin-only; don't cache in shared caches
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
