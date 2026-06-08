import type { NextRequest } from 'next/server'
import { withAdmin, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRateLimiter } from '@/lib/rate-limit'

const isLimited = createRateLimiter('orders-export', 5, 60_000)

type OrderRow = {
  id: string
  status: string
  total_amount: number
  ecpay_order_id: string | null
  tracking_number: string | null
  logistics_company: string | null
  recipient_name: string | null
  recipient_phone: string | null
  recipient_address: string | null
  created_at: string
  updated_at: string
  users: { name: string; email: string | null; phone: string | null } | null
}

function esc(v: string | null | number | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export const GET = withAdmin(async (req: NextRequest, _ctx, user) => {
  if (isLimited(user.id))
    return apiError('匯出頻率超限，請稍候再試', 429, 'RATE_LIMITED')

  const url = new URL(req.url)
  const status = url.searchParams.get('status')?.trim() ?? ''
  const start_date = url.searchParams.get('start_date')?.trim() ?? ''
  const end_date = url.searchParams.get('end_date')?.trim() ?? ''
  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select(
      'id, status, total_amount, ecpay_order_id, tracking_number, logistics_company, recipient_name, recipient_phone, recipient_address, created_at, updated_at, users(name, email, phone)',
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as never)
  if (start_date) query = query.gte('created_at', `${start_date}T00:00:00.000Z`)
  if (end_date) query = query.lte('created_at', `${end_date}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) return new Response('匯出失敗', { status: 500 })

  const rows = (data as unknown as OrderRow[]) ?? []

  const STATUS_LABELS: Record<string, string> = {
    pending: '待付款',
    paid: '已付款',
    processing: '處理中',
    shipped: '已出貨',
    done: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
  }

  const header =
    '訂單號,建立時間,狀態,會員姓名,Email,電話,收件人,收件電話,收件地址,金額,物流,追蹤單號,ECPay單號'
  const csvRows = rows.map((r) =>
    [
      esc(r.id),
      esc(new Date(r.created_at).toLocaleString('zh-TW')),
      esc(STATUS_LABELS[r.status] ?? r.status),
      esc(r.users?.name),
      esc(r.users?.email),
      esc(r.users?.phone),
      esc(r.recipient_name),
      esc(r.recipient_phone),
      esc(r.recipient_address),
      esc(r.total_amount),
      esc(r.logistics_company),
      esc(r.tracking_number),
      esc(r.ecpay_order_id),
    ].join(','),
  )

  const csv = '﻿' + [header, ...csvRows].join('\n')
  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
