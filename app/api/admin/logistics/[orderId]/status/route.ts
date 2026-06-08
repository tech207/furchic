import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLogisticsStatus } from '@/lib/ecpay/logistics'

type OrderRow = {
  id: string
  tracking_number: string | null
}

export const GET = withAdmin(async (_req: NextRequest, ctx) => {
  const orderId = ctx.params?.orderId as string | undefined
  if (!orderId) return apiError('缺少訂單 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // ── 1. 取得訂單追蹤號 ─────────────────────────────────────────────────────

  const { data: orderRaw, error: orderErr } = await admin
    .from('orders')
    .select('id, tracking_number')
    .eq('id', orderId)
    .single()

  if (orderErr || !orderRaw)
    return apiError('訂單不存在', 404, 'ORDER_NOT_FOUND')

  const order = orderRaw as unknown as OrderRow

  if (!order.tracking_number) {
    return apiError('此訂單尚未有追蹤單號', 400, 'NO_TRACKING_NUMBER')
  }

  // ── 2. 呼叫綠界 API 取得最新狀態 ─────────────────────────────────────────

  let result: Awaited<ReturnType<typeof getLogisticsStatus>>
  try {
    result = await getLogisticsStatus(order.tracking_number)
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : '物流狀態查詢失敗',
      502,
      'ECPAY_ERROR',
    )
  }

  // ── 3. 更新 orders 表的物流狀態 ──────────────────────────────────────────

  await admin
    .from('orders')
    .update({
      logistics_status: result.status,
      logistics_status_at: result.updated_at,
    } as never)
    .eq('id', orderId)

  return apiSuccess(result)
})
