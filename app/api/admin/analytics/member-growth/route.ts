import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type UserRow = { created_at: string }

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const days = Math.min(
    30,
    Math.max(7, Number(url.searchParams.get('days') ?? '7')),
  )
  const admin = createAdminClient()

  const startDate = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data } = await admin
    .from('users')
    .select('created_at')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })

  const rows = (data as unknown as UserRow[]) ?? []

  const grouped = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    grouped.set(d, 0)
  }

  rows.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    if (grouped.has(d)) grouped.set(d, (grouped.get(d) ?? 0) + 1)
  })

  const result = Array.from(grouped.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  return apiSuccess({ data: result })
})
