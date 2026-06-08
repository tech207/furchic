import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { reorderPartnersSchema } from '@/lib/validations/about'

export const PUT = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = reorderPartnersSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { items } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const results = await Promise.allSettled(
    items.map(({ id, sort_order }) =>
      admin
        .from('partners')
        .update({ sort_order, updated_at: now } as never)
        .eq('id', id),
    ),
  )

  const errors = results
    .map((r, i) => {
      if (r.status === 'rejected')
        return { id: items[i].id, message: String(r.reason) }
      if (r.value.error)
        return { id: items[i].id, message: r.value.error.message }
      return null
    })
    .filter(Boolean)

  if (errors.length === items.length) {
    return apiError('排序更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ updated: items.length - errors.length, errors })
})
