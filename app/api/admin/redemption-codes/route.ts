import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 50

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const batchName = url.searchParams.get('batch_name')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? 'all' // all|unused|used|expired
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = admin
    .from('redemption_codes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (batchName) query = query.ilike('batch_name', `%${batchName}%`)
  if (search)
    query = query.or(`code.ilike.%${search}%,batch_name.ilike.%${search}%`)

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

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/admin/redemption-codes]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ codes: data ?? [], total: count ?? 0, page })
})
