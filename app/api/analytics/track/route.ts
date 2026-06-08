import type { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyticsRateLimit } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const { event_type, page_url, properties } = body as Record<string, unknown>
  if (!event_type || typeof event_type !== 'string')
    return new Response(null, { status: 204 })

  const sessionId =
    req.cookies.get('session_id')?.value ??
    req.headers.get('x-session-id') ??
    'anon'

  const rl = await analyticsRateLimit(sessionId)
  if (!rl.allowed) return new Response(null, { status: 204 })

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  const ip_hash = ip
    ? createHash('sha256').update(ip).digest('hex').slice(0, 16)
    : null

  const admin = createAdminClient()
  await admin.from('analytics_events').insert({
    event_type,
    page_url: typeof page_url === 'string' ? page_url : '/',
    properties: (properties as Record<string, unknown>) ?? null,
    ip_hash,
    session_id: sessionId,
  } as never)

  return new Response(null, { status: 204 })
}
