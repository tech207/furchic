import * as XLSX from 'xlsx'
import { withAdmin, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const MONTH_RE = /^\d{4}-(?:0[1-9]|1[0-2])$/

const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  processing: '處理中',
  shipped: '已出貨',
  done: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}
const CHANNEL_LABELS: Record<string, string> = {
  online_daily: '網路日常',
  online_campaign: '網路行銷活動',
  physical_event: '實體活動',
}

type VendorRow = {
  brand_name: string
  company_name: string
  contact_email: string
  contact_name: string
  default_commission_rate: number
}

type OrderRow = {
  id: string
  status: string
  sales_channel: string
  total_amount: number
  vendor_amount: number
  commission_amount: number
  commission_rate: number | null
  recipient_name: string | null
  recipient_address: string | null
  created_at: string
}

type ItemRow = {
  order_id: string
  product_name: string | null
  quantity: number
  unit_price: number
  product_variants: { sku: string; name: string } | null
}

// ── GET /api/admin/reports/export/vendor/[vendorId] ───────────────────────────

export const GET = withAdmin(async (req, ctx, _user) => {
  const vendorId = ctx.params?.vendorId as string | undefined
  if (!vendorId) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  const url = new URL(req.url)
  const month = url.searchParams.get('month')?.trim() ?? ''

  if (!month)
    return apiError('請提供月份（格式 YYYY-MM）', 400, 'MISSING_MONTH')
  if (!MONTH_RE.test(month)) {
    return apiError('月份格式錯誤，請使用 YYYY-MM', 400, 'INVALID_MONTH')
  }

  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0, 23, 59, 59, 999)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Fetch vendor info
  const { data: vendor, error: vendorErr } = await admin
    .from('vendors')
    .select(
      'brand_name, company_name, contact_email, contact_name, default_commission_rate',
    )
    .eq('id', vendorId)
    .single()

  if (vendorErr || !vendor) return apiError('找不到廠商', 404, 'NOT_FOUND')

  const v = vendor as VendorRow

  // Fetch orders for this vendor in the month
  const { data: orders, error: ordersErr } = await admin
    .from('orders')
    .select(
      'id, status, sales_channel, total_amount, vendor_amount, commission_amount, commission_rate, recipient_name, recipient_address, created_at',
    )
    .eq('vendor_id', vendorId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: true })

  if (ordersErr) return apiError('匯出失敗', 500, 'FETCH_FAILED')

  const orderList = (orders ?? []) as OrderRow[]
  const orderIds = orderList.map((o) => o.id)

  // Fetch items
  const itemsByOrder = new Map<string, ItemRow[]>()
  if (orderIds.length > 0) {
    const { data: items, error: itemsErr } = await admin
      .from('order_items')
      .select(
        'order_id, product_name, quantity, unit_price, product_variants(sku, name)',
      )
      .in('order_id', orderIds)

    if (itemsErr) return apiError('匯出失敗', 500, 'FETCH_FAILED')

    for (const item of (items ?? []) as ItemRow[]) {
      const list = itemsByOrder.get(item.order_id) ?? []
      list.push(item)
      itemsByOrder.set(item.order_id, list)
    }
  }

  // ── Sheet 1: 訂單明細 ─────────────────────────────────────────────────────

  const detailHeader = [
    '日期',
    '訂單號',
    '狀態',
    '銷售管道',
    '收件人',
    '收件地址',
    '商品名稱',
    'SKU',
    '數量',
    '單價',
    '商品廠商收款',
    '訂單金額',
    '廠商收款',
    '平台抽成',
    '抽成比例',
  ]
  const detailRows: (string | number)[][] = []

  for (const order of orderList) {
    const items = itemsByOrder.get(order.id) ?? []
    const base = [
      order.created_at.slice(0, 10),
      order.id,
      STATUS_LABELS[order.status] ?? order.status,
      CHANNEL_LABELS[order.sales_channel] ?? order.sales_channel,
      order.recipient_name ?? '',
      order.recipient_address ?? '',
    ]
    const orderTail = [
      order.total_amount,
      order.vendor_amount,
      order.commission_amount,
      `${order.commission_rate ?? 0}%`,
    ]

    if (items.length === 0) {
      detailRows.push([...base, '', '', '', '', '', ...orderTail])
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const gross = item.unit_price * item.quantity
        const rate = order.commission_rate ?? 0
        const itemVendorRevenue = Math.round(gross * (1 - rate / 100))
        detailRows.push([
          ...base,
          item.product_name ?? item.product_variants?.name ?? '',
          item.product_variants?.sku ?? '',
          item.quantity,
          item.unit_price,
          itemVendorRevenue,
          // Only print order totals on the first item row
          ...(i === 0 ? orderTail : ['', '', '', '']),
        ])
      }
    }
  }

  // ── Sheet 2: 月結摘要 ─────────────────────────────────────────────────────

  const activeOrders = orderList.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'refunded',
  )
  const grossTotal = activeOrders.reduce((s, o) => s + o.total_amount, 0)
  const commissionTotal = activeOrders.reduce(
    (s, o) => s + o.commission_amount,
    0,
  )
  const vendorPayable = activeOrders.reduce((s, o) => s + o.vendor_amount, 0)

  const summaryData: (string | number)[][] = [
    ['廠商資訊', ''],
    ['品牌名稱', v.brand_name],
    ['公司名稱', v.company_name],
    ['聯絡人', v.contact_name],
    ['Email', v.contact_email],
    ['預設抽成比例', `${v.default_commission_rate}%`],
    ['', ''],
    ['月份', month],
    ['', ''],
    ['項目', '金額'],
    ['有效訂單數', activeOrders.length],
    ['銷售總額', grossTotal],
    ['平台抽成', commissionTotal],
    ['應付廠商金額', vendorPayable],
    ['', ''],
    ['各管道訂單數', ''],
  ]

  for (const ch of ['online_daily', 'online_campaign', 'physical_event']) {
    const count = activeOrders.filter((o) => o.sales_channel === ch).length
    summaryData.push([CHANNEL_LABELS[ch], count])
  }

  // ── Build workbook ────────────────────────────────────────────────────────

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
  wsDetail['!cols'] = [
    { wch: 12 },
    { wch: 38 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 20 },
    { wch: 16 },
    { wch: 6 },
    { wch: 8 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 20 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsSummary, '月結摘要')
  XLSX.utils.book_append_sheet(wb, wsDetail, '訂單明細')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const filename = `commission-${v.brand_name}-${month}.xlsx`

  return new Response(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
})
