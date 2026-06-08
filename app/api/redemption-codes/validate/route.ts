import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export const POST = withAuth(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const { code } = body as { code?: unknown }

  if (!code || typeof code !== 'string' || !code.trim()) {
    return Response.json({ valid: false, error: 'NOT_FOUND' })
  }

  const supabase = createClient()

  const { data } = await supabase
    .from('redemption_codes')
    .select('id, used_by, expires_at, used_count, max_uses')
    .eq('code', code.trim().toUpperCase())
    .single()

  if (!data) return Response.json({ valid: false, error: 'NOT_FOUND' })

  type Row = {
    id: string
    used_by: string | null
    expires_at: string | null
    used_count: number
    max_uses: number
  }
  const r = data as unknown as Row

  if (r.used_by) return Response.json({ valid: false, error: 'ALREADY_USED' })
  if (r.used_count >= r.max_uses)
    return Response.json({ valid: false, error: 'ALREADY_USED' })
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    return Response.json({ valid: false, error: 'EXPIRED' })
  }

  return apiSuccess({ valid: true, expires_at: r.expires_at })
})
