import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/auth/guards'
import { createRateLimiter } from '@/lib/rate-limit'

const isLimited = createRateLimiter('vendor-report-export', 3, 60_000)

const VALID_CHANNELS = ['online_daily', 'online_campaign', 'physical_event']
const CHANNEL_LABELS: Record<string, string> = {
  online_daily: '網路日常',
  online_campaign: '網路行銷活動',
  physical_event: '實體活動',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  processing: '處理中',
  shipped: '已出貨',
  done: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
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

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

// ── GET /api/vendor/reports/export ───────────────────────────────────────────

export const GET = withVendorPermission(
  'reports',
  async (req: NextRequest, _ctx, account) => {
    if (isLimited(account.vendor_id)) {
      return apiError('匯出頻率超限，請稍後再試', 429, 'RATE_LIMITED')
    }

    const url = new URL(req.url)
    const channel = url.searchParams.get('channel')?.trim() ?? ''
    const start_date = url.searchParams.get('start_date')?.trim() ?? ''
    const end_date = url.searchParams.get('end_date')?.trim() ?? ''
    const format = url.searchParams.get('format')?.trim() ?? 'csv'

    if (channel && !VALID_CHANNELS.includes(channel)) {
      return apiError('無效的銷售管道', 400, 'INVALID_CHANNEL')
    }
    if (format !== 'csv' && format !== 'xlsx') {
      return apiError('格式須為 csv 或 xlsx', 400, 'INVALID_FORMAT')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const vendorId = account.vendor_id

    // Fetch orders
    let ordersQuery = admin
      .from('orders')
      .select(
        'id, status, sales_channel, total_amount, vendor_amount, commission_amount, commission_rate, recipient_name, recipient_address, created_at',
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (channel) ordersQuery = ordersQuery.eq('sales_channel', channel)
    if (start_date)
      ordersQuery = ordersQuery.gte('created_at', `${start_date}T00:00:00.000Z`)
    if (end_date)
      ordersQuery = ordersQuery.lte('created_at', `${end_date}T23:59:59.999Z`)

    const { data: orders, error: ordersErr } = await ordersQuery
    if (ordersErr) return apiError('匯出失敗', 500, 'FETCH_FAILED')

    const orderList = (orders ?? []) as OrderRow[]
    const orderIds = orderList.map((o) => o.id)

    // Fetch items (only for non-empty order list)
    let itemsByOrder = new Map<string, ItemRow[]>()

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

    // Build rows: one row per order × item
    const dataRows: (string | number)[][] = []

    for (const order of orderList) {
      const items = itemsByOrder.get(order.id) ?? []
      const baseRow = [
        order.id,
        order.created_at.slice(0, 10),
        STATUS_LABELS[order.status] ?? order.status,
        CHANNEL_LABELS[order.sales_channel] ?? order.sales_channel,
        order.recipient_name ?? '',
        order.recipient_address ?? '',
        order.total_amount,
        order.vendor_amount,
        order.commission_amount,
        `${order.commission_rate ?? 0}%`,
      ]

      if (items.length === 0) {
        dataRows.push([...baseRow, '', '', '', '', ''])
      } else {
        for (const item of items) {
          const gross = item.unit_price * item.quantity
          const rate = order.commission_rate ?? 0
          const vendorItemRevenue = Math.round(gross * (1 - rate / 100))
          dataRows.push([
            ...baseRow,
            item.product_name ?? item.product_variants?.name ?? '',
            item.product_variants?.sku ?? '',
            item.quantity,
            item.unit_price,
            vendorItemRevenue,
          ])
        }
      }
    }

    const header = [
      '訂單號',
      '日期',
      '狀態',
      '銷售管道',
      '收件人',
      '收件地址',
      '訂單金額',
      '廠商收款',
      '平台抽成',
      '抽成比例',
      '商品名稱',
      'SKU',
      '數量',
      '單價',
      '商品廠商收款',
    ]

    const dateTag =
      start_date || end_date
        ? `${start_date || ''}~${end_date || ''}`
        : new Date().toISOString().slice(0, 10)
    const filename = `vendor-report-${dateTag}`

    if (format === 'csv') {
      const csvRows = dataRows.map((r) => r.map(esc).join(','))
      const csv = '﻿' + [header.join(','), ...csvRows].join('\n')
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    }

    // xlsx
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows])
    ws['!cols'] = header.map((_, i) =>
      [0, 10].includes(i) ? { wch: 38 } : { wch: 14 },
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '銷售報表')
    const buf = XLSX.write(wb, {
      type: 'array',
      bookType: 'xlsx',
    }) as ArrayBuffer

    return new Response(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    })
  },
)
