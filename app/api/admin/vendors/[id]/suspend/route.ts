import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const suspendSchema = z.object({
  reason: z.string().min(1, '請填寫停權原因').max(500),
})

// ── POST /api/admin/vendors/[id]/suspend ──────────────────────────────────────

export const POST = withAdmin(async (req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = suspendSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor } = await admin
    .from('vendors')
    .select('id, status, brand_name')
    .eq('id', id)
    .maybeSingle()

  if (!vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')
  if (vendor.status === 'suspended') {
    return apiError('此廠商已被停權', 409, 'ALREADY_SUSPENDED')
  }

  const now = new Date().toISOString()

  // 1. Suspend vendor — notes field stores suspension reason
  const { error: suspendError } = await admin
    .from('vendors')
    .update({
      status: 'suspended',
      notes: `[停權] ${parsed.data.reason}`,
      updated_at: now,
    })
    .eq('id', id)

  if (suspendError) {
    console.error(
      '[POST /api/admin/vendors/[id]/suspend]',
      suspendError.message,
    )
    return apiError('停權失敗', 500, 'SUSPEND_FAILED')
  }

  // 2. Deactivate all active products for this vendor
  const { error: productsError } = await admin
    .from('products')
    .update({ is_active: false, updated_at: now })
    .eq('vendor_id', id)
    .eq('is_active', true)

  if (productsError) {
    console.error(
      '[POST /api/admin/vendors/[id]/suspend] products:',
      productsError.message,
    )
  }

  return apiSuccess({
    success: true,
    message: `廠商「${vendor.brand_name as string}」已停權，所有商品已下架`,
  })
})

// ── DELETE /api/admin/vendors/[id]/suspend（解除停權）─────────────────────────

export const DELETE = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: vendor } = await admin
    .from('vendors')
    .select('id, status, brand_name')
    .eq('id', id)
    .maybeSingle()

  if (!vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')
  if (vendor.status !== 'suspended') {
    return apiError('此廠商並非停權狀態', 409, 'NOT_SUSPENDED')
  }

  const { error } = await admin
    .from('vendors')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/admin/vendors/[id]/suspend]', error.message)
    return apiError('解除停權失敗', 500, 'UNSUSPEND_FAILED')
  }

  return apiSuccess({
    success: true,
    message: `廠商「${vendor.brand_name as string}」已恢復上線`,
  })
})
