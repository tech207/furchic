import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Schema ────────────────────────────────────────────────────────────────────

const commissionUpdateSchema = z.object({
  rule_type: z.enum(['base', 'product', 'category', 'channel']).optional(),
  target_id: z.string().uuid().nullable().optional(),
  sales_channel: z.string().max(50).nullable().optional(),
  commission_rate: z.number().min(0).max(1).optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

// ── PUT /api/admin/commissions/[id] ──────────────────────────────────────────

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少規則 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = commissionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }
  if (Object.keys(parsed.data).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: existing } = await admin
    .from('vendor_commission_rules')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return apiError('找不到抽成規則', 404, 'NOT_FOUND')

  const { data, error } = await admin
    .from('vendor_commission_rules')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[PUT /api/admin/commissions/[id]]', error?.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ rule: data })
})

// ── DELETE /api/admin/commissions/[id] ───────────────────────────────────────

export const DELETE = withAdmin(async (_req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少規則 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: existing } = await admin
    .from('vendor_commission_rules')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return apiError('找不到抽成規則', 404, 'NOT_FOUND')

  const { error } = await admin
    .from('vendor_commission_rules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/admin/commissions/[id]]', error.message)
    return apiError('刪除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
