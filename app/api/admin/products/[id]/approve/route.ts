import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── POST /api/admin/products/[id]/approve ─────────────────────────────────────

export const POST = withAdmin(async (_req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少商品 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const { data: product, error: fetchError } = await admin
    .from('products')
    .select('id, vendor_id, is_approved, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !product) return apiError('找不到商品', 404, 'NOT_FOUND')

  if (!(product as unknown as Record<string, unknown>).vendor_id) {
    return apiError('非廠商商品，無需審核', 400, 'NOT_VENDOR_PRODUCT')
  }
  if ((product as unknown as Record<string, unknown>).is_approved) {
    return apiError('商品已審核通過', 409, 'ALREADY_APPROVED')
  }

  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('products')
    .update({
      is_approved: true,
      is_active: true,
      status: 'approved',
      approved_at: now,
      approved_by: user.id,
      updated_at: now,
    } as never)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/products/[id]/approve]', error?.message)
    return apiError('審核失敗', 500, 'APPROVE_FAILED')
  }

  return apiSuccess({ product: data as unknown as Record<string, unknown> })
})
