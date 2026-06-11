import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const rejectSchema = z.object({
  reason: z.string().min(1, '請填寫拒絕原因').max(500),
})

// ── POST /api/admin/products/[id]/reject ──────────────────────────────────────

export const POST = withAdmin(async (req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: product, error: fetchError } = await admin
    .from('products')
    .select('id, vendor_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !product) return apiError('找不到商品', 404, 'NOT_FOUND')

  if (!(product as unknown as Record<string, unknown>).vendor_id) {
    return apiError('非廠商商品，無需審核', 400, 'NOT_VENDOR_PRODUCT')
  }

  const { data, error } = await admin
    .from('products')
    .update({
      is_approved: false,
      is_active: false,
      status: 'rejected',
      // Rejection metadata stored in the product's JSONB meta field
      meta: {
        rejection: {
          reason: parsed.data.reason,
          rejected_by: user.id,
          rejected_at: now,
        },
      },
      updated_at: now,
    } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/products/[id]/reject]', error?.message)
    return apiError('拒絕操作失敗', 500, 'REJECT_FAILED')
  }

  return apiSuccess({ product: data as unknown as Record<string, unknown> })
})
