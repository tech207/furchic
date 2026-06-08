import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type OrderRow = { status: string }

const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  processing: '處理中',
  shipped: '已出貨',
  done: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}

export const GET = withAdmin(async () => {
  const admin = createAdminClient()
  const { data } = await admin.from('orders').select('status')

  const rows = (data as unknown as OrderRow[]) ?? []
  const map = new Map<string, number>()
  rows.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1))

  const result = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
    }))

  return apiSuccess({ data: result })
})
