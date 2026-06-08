import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { reorderSchema } from '@/lib/validations/product'

export const PUT = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { items } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Batch update via individual updates (Supabase JS has no batch update by PK)
  const results = await Promise.allSettled(
    items.map(({ id, sort_order }) =>
      admin
        .from('products')
        .update({ sort_order, updated_at: now } as never)
        .eq('id', id),
    ),
  )

  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  )
  if (failed.length > 0) {
    console.error(
      '[PUT /api/admin/products/reorder] partial failure',
      failed.length,
    )
  }

  const errors = results
    .map((r, i) =>
      r.status === 'fulfilled' && r.value.error
        ? { id: items[i].id, message: r.value.error.message }
        : null,
    )
    .filter(Boolean)

  if (errors.length === items.length) {
    return apiError('排序更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ updated: items.length - errors.length, errors })
})
