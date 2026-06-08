import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type CodeRow = {
  code: string
  batch_name: string | null
  expires_at: string | null
  used_by: string | null
  used_at: string | null
}

function getStatus(row: CodeRow): string {
  if (row.used_by) return '已使用'
  if (row.expires_at && new Date(row.expires_at) < new Date()) return '已過期'
  return '未使用'
}

function escapeCsv(val: string | null | undefined): string {
  if (!val) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const batchName = url.searchParams.get('batch_name')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? 'all'
  const now = new Date().toISOString()
  const admin = createAdminClient()

  let query = admin
    .from('redemption_codes')
    .select('code, batch_name, expires_at, used_by, used_at')
    .order('created_at', { ascending: false })

  if (batchName) query = query.ilike('batch_name', `%${batchName}%`)
  if (status === 'used') query = query.not('used_by', 'is', null)
  if (status === 'unused')
    query = query
      .is('used_by', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
  if (status === 'expired')
    query = query
      .is('used_by', null)
      .not('expires_at', 'is', null)
      .lt('expires_at', now)

  const { data, error } = await query
  if (error) return new Response('匯出失敗', { status: 500 })

  const rows = (data as unknown as CodeRow[]) ?? []

  const header = '代碼,批次名稱,到期日,狀態,使用者ID,使用時間'
  const csvRows = rows.map((r) =>
    [
      escapeCsv(r.code),
      escapeCsv(r.batch_name),
      escapeCsv(
        r.expires_at ? new Date(r.expires_at).toLocaleDateString('zh-TW') : '',
      ),
      escapeCsv(getStatus(r)),
      escapeCsv(r.used_by),
      escapeCsv(r.used_at ? new Date(r.used_at).toLocaleString('zh-TW') : ''),
    ].join(','),
  )

  const csv = [header, ...csvRows].join('\n')
  const filename = `redemption-codes-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response('﻿' + csv, {
    // BOM for Excel UTF-8
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
