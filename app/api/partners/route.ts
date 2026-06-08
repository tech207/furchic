import type { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const marqueeOnly = url.searchParams.get('marquee_only') === 'true'

  const supabase = createClient()
  let query = supabase
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (marqueeOnly) query = query.eq('is_marquee', true)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/partners]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ partners: data ?? [] })
}
