import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// Forward-only state machine (+ cancellation from active states)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['done'],
  done: ['refunded'],
  cancelled: [],
  refunded: [],
}

const updateSchema = z
  .object({
    status: z
      .enum([
        'pending',
        'paid',
        'processing',
        'shipped',
        'done',
        'cancelled',
        'refunded',
      ])
      .optional(),
    tracking_number: z.string().max(100).optional(),
    logistics_company: z.string().max(100).optional(),
    admin_note: z.string().max(2000).optional(),
    ecpay_order_id: z.string().max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, '至少提供一個欄位')

export const GET = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const [orderRes, itemsRes, logsRes] = await Promise.all([
    admin
      .from('orders')
      .select('*, users(id, name, email, phone, avatar_url)')
      .eq('id', id)
      .single(),
    admin.from('order_items').select('*').eq('order_id', id).order('id'),
    admin
      .from('order_audit_logs')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (orderRes.error || !orderRes.data)
    return apiError('找不到訂單', 404, 'NOT_FOUND')

  return apiSuccess({
    order: orderRes.data,
    items: itemsRes.data ?? [],
    audit_logs: logsRes.data ?? [],
  })
})

export const PUT = withAdmin(async (req: NextRequest, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const admin = createAdminClient()

  // Fetch current order
  const { data: current } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .single()
  if (!current) return apiError('找不到訂單', 404, 'NOT_FOUND')

  const c = current as unknown as { id: string; status: string }

  // Validate state transition
  if (parsed.data.status) {
    const allowed = VALID_TRANSITIONS[c.status] ?? []
    if (!allowed.includes(parsed.data.status)) {
      return apiError(
        `不允許的狀態變更：${c.status} → ${parsed.data.status}`,
        400,
        'INVALID_TRANSITION',
      )
    }
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.status !== undefined)
    updatePayload.status = parsed.data.status
  if (parsed.data.tracking_number !== undefined)
    updatePayload.tracking_number = parsed.data.tracking_number
  if (parsed.data.logistics_company !== undefined)
    updatePayload.logistics_company = parsed.data.logistics_company
  if (parsed.data.admin_note !== undefined)
    updatePayload.admin_note = parsed.data.admin_note
  if (parsed.data.ecpay_order_id !== undefined)
    updatePayload.ecpay_order_id = parsed.data.ecpay_order_id

  const { data: updated, error: updateErr } = await admin
    .from('orders')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return apiError('更新失敗', 500, 'UPDATE_FAILED')

  // Write audit log for status change or shipment update
  const auditActions: string[] = []
  if (parsed.data.status) auditActions.push('status_changed')
  if (parsed.data.tracking_number || parsed.data.logistics_company)
    auditActions.push('shipment_updated')
  if (parsed.data.admin_note !== undefined) auditActions.push('note_updated')

  if (auditActions.length > 0) {
    await admin.from('order_audit_logs').insert({
      order_id: id,
      admin_id: user.id,
      action: auditActions.join(','),
      old_status: parsed.data.status ? c.status : null,
      new_status: parsed.data.status ?? null,
      note: parsed.data.admin_note ?? null,
    } as never)
  }

  return apiSuccess({ order: updated })
})
