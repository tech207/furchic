import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const bulkShipSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1),
  logistics_company: z.string().max(100).optional(),
})

type OrderRow = { id: string; status: string }
const SHIPPABLE = ['paid', 'processing']

export const PUT = withAdmin(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const parsed = bulkShipSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const { order_ids, logistics_company } = parsed.data
  const admin = createAdminClient()

  // Fetch current statuses
  const { data: orders } = await admin
    .from('orders')
    .select('id, status')
    .in('id', order_ids)

  const rows = (orders as unknown as OrderRow[]) ?? []

  const notShippable = rows.filter((o) => !SHIPPABLE.includes(o.status))
  if (notShippable.length > 0) {
    return apiError(
      `以下訂單狀態不允許出貨：${notShippable.map((o) => o.id.slice(0, 8)).join(', ')}`,
      400,
      'INVALID_STATE',
    )
  }

  const now = new Date().toISOString()

  // Bulk update
  const { error } = await admin
    .from('orders')
    .update({
      status: 'shipped',
      logistics_company: logistics_company ?? null,
      updated_at: now,
    } as never)
    .in('id', order_ids)

  if (error) return apiError('批次出貨失敗', 500, 'UPDATE_FAILED')

  // Insert audit logs
  const logs = rows.map((o) => ({
    order_id: o.id,
    admin_id: user.id,
    action: 'status_changed',
    old_status: o.status,
    new_status: 'shipped',
    note: '批次出貨',
    created_at: now,
  }))

  await admin.from('order_audit_logs').insert(logs as never)

  return apiSuccess({ updated_count: order_ids.length })
})
