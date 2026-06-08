import type { NextRequest } from 'next/server'
import { withAdmin, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRateLimiter } from '@/lib/rate-limit'

const isLimited = createRateLimiter('members-export', 5, 60_000)

type MemberRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  auth_provider: string | null
  reward_points: number
  total_spent: number
  created_at: string
  member_levels: { name: string } | null
}

function esc(v: string | null | number | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export const GET = withAdmin(async (req: NextRequest, _ctx, user) => {
  if (isLimited(user.id)) return apiError('匯出頻率超限', 429, 'RATE_LIMITED')

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const level = url.searchParams.get('level')?.trim() ?? ''
  const admin = createAdminClient()

  let query = admin
    .from('users')
    .select(
      'id, name, email, phone, role, auth_provider, reward_points, total_spent, created_at, member_levels(name)',
    )
    .order('created_at', { ascending: false })

  if (search)
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
    )
  if (level) query = query.eq('member_level_id', level)

  const { data, error } = await query
  if (error) return new Response('匯出失敗', { status: 500 })

  const rows = (data as unknown as MemberRow[]) ?? []

  const header =
    'ID,姓名,Email,電話,角色,登入方式,等級,回饋金,累計消費,加入日期'
  const csvRows = rows.map((r) =>
    [
      esc(r.id),
      esc(r.name),
      esc(r.email),
      esc(r.phone),
      esc(r.role === 'admin' ? 'Admin' : '一般會員'),
      esc(r.auth_provider ?? 'email'),
      esc(r.member_levels?.name ?? '—'),
      esc(r.reward_points),
      esc(r.total_spent),
      esc(new Date(r.created_at).toLocaleDateString('zh-TW')),
    ].join(','),
  )

  const csv = '﻿' + [header, ...csvRows].join('\n')
  const filename = `members-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
