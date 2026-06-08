import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const PUT = withAdmin(async (req: NextRequest) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const { items } = body as { items?: { id: string; sort_order: number }[] }
  if (!Array.isArray(items) || items.length === 0) {
    return apiError('缺少 items', 400, 'INVALID_BODY')
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  await Promise.all(
    items.map(({ id, sort_order }) =>
      admin
        .from('faqs')
        .update({ sort_order, updated_at: now } as never)
        .eq('id', id),
    ),
  )

  return apiSuccess({ updated: items.length })
})
