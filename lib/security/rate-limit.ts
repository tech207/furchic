/**
 * DB-backed rate limiter using system_settings.
 * Key format: rl:{identifier}:{window_bucket}
 *
 * NOTE: For high-throughput production use, replace with Redis.
 * This approach is suitable for apps with moderate traffic.
 * system_settings entries with rl: prefix should be cleaned up periodically
 * (e.g., via a Supabase Edge Function cron: DELETE WHERE key LIKE 'rl:%').
 */

import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number // seconds until window resets
}

// In-memory fallback (same instance, sub-ms latency)
const memStore = new Map<string, { count: number; resetAt: number }>()

function memCheck(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

/**
 * DB-backed rate limit. Falls back to in-memory if Supabase is unavailable.
 * Race conditions near the limit are acceptable (soft limit).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const bucket = Math.floor(now / windowMs)
  const storeKey = `rl:${key}:${bucket}`
  const resetAt = (bucket + 1) * windowMs
  const retryAfter = Math.ceil((resetAt - now) / 1000)

  // Fast path: check in-memory first to avoid DB round-trip when clearly allowed
  const mem = memCheck(storeKey, limit, windowMs)
  if (!mem.allowed) return mem

  try {
    const admin = createAdminClient()
    const { data } = (await admin
      .from('system_settings')
      .select('value')
      .eq('key', storeKey)
      .maybeSingle()) as unknown as { data: { value: unknown } | null }

    const current = typeof data?.value === 'number' ? (data.value as number) : 0

    if (current >= limit) {
      return { allowed: false, remaining: 0, retryAfter }
    }

    // Atomic-ish upsert (best-effort; slight over-counting possible under burst)
    await admin
      .from('system_settings')
      .upsert(
        {
          key: storeKey,
          value: (current + 1) as never,
          description: 'rate-limit-entry',
        },
        { onConflict: 'key' },
      )

    return { allowed: true, remaining: limit - current - 1 }
  } catch {
    // DB unavailable → use in-memory result
    return mem
  }
}

// ── Preset rate limit configurations ─────────────────────────────────────────

/** Hash an IP address for privacy-safe storage */
export function hashIp(req: Request | { headers: Headers }): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return createHash('sha256')
    .update(ip + (process.env.RATE_LIMIT_SALT ?? 'furchic'))
    .digest('hex')
    .slice(0, 16)
}

/** /api/auth/*  – 20 req / 15 min per IP */
export async function authRateLimit(ipHash: string): Promise<RateLimitResult> {
  return checkRateLimit(`auth:${ipHash}`, 20, 15 * 60 * 1000)
}

/** /api/ai/*  – 10 req / day per user */
export async function aiRateLimit(userId: string): Promise<RateLimitResult> {
  const dayKey = new Date().toISOString().slice(0, 10)
  return checkRateLimit(`ai:${userId}:${dayKey}`, 10, 24 * 60 * 60 * 1000)
}

/** /api/admin/[...]/export  – 5 req / min per user */
export async function exportRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkRateLimit(`export:${userId}`, 5, 60 * 1000)
}

/** /api/analytics/track  – 60 req / min per session */
export async function analyticsRateLimit(
  sessionId: string,
): Promise<RateLimitResult> {
  return checkRateLimit(`analytics:${sessionId}`, 60, 60 * 1000)
}

/** General /api/*  – 100 req / min per user */
export async function generalRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  return checkRateLimit(`general:${userId}`, 100, 60 * 1000)
}

/** Returns a 429 Response with Retry-After header */
export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: 'RATE_LIMITED', message: '請求過於頻繁，請稍後再試' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter ?? 60),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}
