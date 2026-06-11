/**
 * Required Supabase SQL — run once in the SQL editor before deploying:
 *
 * CREATE TABLE IF NOT EXISTS rate_limits (
 *   key          TEXT PRIMARY KEY,
 *   count        INTEGER NOT NULL DEFAULT 1,
 *   window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   expires_at   TIMESTAMPTZ NOT NULL
 * );
 * CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at);
 *
 * CREATE OR REPLACE FUNCTION increment_rate_limit(
 *   p_key TEXT, p_window_seconds INTEGER, p_limit INTEGER
 * ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
 * DECLARE
 *   v_now         TIMESTAMPTZ := NOW();
 *   v_expires_at  TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
 *   v_count       INTEGER;
 * BEGIN
 *   INSERT INTO rate_limits (key, count, window_start, expires_at)
 *   VALUES (p_key, 1, v_now, v_expires_at)
 *   ON CONFLICT (key) DO UPDATE SET
 *     count        = CASE WHEN rate_limits.expires_at < v_now THEN 1
 *                         ELSE rate_limits.count + 1 END,
 *     window_start = CASE WHEN rate_limits.expires_at < v_now THEN v_now
 *                         ELSE rate_limits.window_start END,
 *     expires_at   = CASE WHEN rate_limits.expires_at < v_now THEN v_expires_at
 *                         ELSE rate_limits.expires_at END
 *   RETURNING count, expires_at INTO v_count, v_expires_at;
 *
 *   RETURN json_build_object(
 *     'is_allowed',  v_count <= p_limit,
 *     'retry_after', CASE WHEN v_count > p_limit
 *                    THEN GREATEST(0, EXTRACT(EPOCH FROM (v_expires_at - v_now))::INTEGER)
 *                    ELSE 0 END
 *   );
 * END; $$;
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ── Route matchers ─────────────────────────────────────────────────────────────

const MEMBER_BASES = [
  '/profile',
  '/pets',
  '/cart',
  '/checkout',
  '/orders',
  '/rewards',
]

function isMemberPath(p: string): boolean {
  return MEMBER_BASES.some((base) => p === base || p.startsWith(base + '/'))
}

function isAdminPath(p: string): boolean {
  // /admin/* and /api/admin/* — excluding /admin/auth
  return (
    (p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin')) &&
    !p.startsWith('/admin/auth')
  )
}

function isVendorPath(p: string): boolean {
  // /vendor/* — excluding /vendor/auth/*
  return (
    (p === '/vendor' || p.startsWith('/vendor/')) &&
    !p.startsWith('/vendor/auth')
  )
}

// ── SHA-256 hash (salted) — never store raw IPs ────────────────────────────────

async function hashValue(raw: string): Promise<string> {
  const salt = process.env.NEXTAUTH_SECRET ?? ''
  const bytes = new TextEncoder().encode(raw + salt)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Rate-limit config ──────────────────────────────────────────────────────────

type RLConfig = { prefix: string; limit: number; window: number; byIp: boolean }

function getRLConfig(pathname: string): RLConfig | null {
  if (!pathname.startsWith('/api/')) return null
  if (pathname.startsWith('/api/auth'))
    return { prefix: 'auth', limit: 20, window: 15 * 60, byIp: true }
  if (pathname.startsWith('/api/ai'))
    return { prefix: 'ai', limit: 10, window: 86_400, byIp: false }
  if (pathname.includes('/export'))
    return { prefix: 'export', limit: 5, window: 60, byIp: false }
  return { prefix: 'general', limit: 100, window: 60, byIp: false }
}

async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const admin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )
    const { data, error } = await admin.rpc('increment_rate_limit', {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    })
    if (error) {
      console.error('[rate-limit]', error.message)
      return { allowed: true, retryAfter: 0 } // fail open on DB error
    }
    const row = data as { is_allowed: boolean; retry_after: number }
    return { allowed: row.is_allowed, retryAfter: row.retry_after }
  } catch {
    return { allowed: true, retryAfter: 0 }
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Mutable response ref — Supabase needs to thread refreshed cookies through
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          toSet: Array<{
            name: string
            value: string
            options?: CookieOptions
          }>,
        ) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...(options ?? {}) }),
          )
        },
      },
    },
  )

  // Server-side JWT validation — never trust any client-supplied userId
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // ── 1. Member route protection ──────────────────────────────────────────────
  if (isMemberPath(pathname) && !authUser) {
    const url = new URL('/auth', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // ── 2. Admin route protection ───────────────────────────────────────────────
  if (isAdminPath(pathname)) {
    const isApiRoute = pathname.startsWith('/api/')

    if (!authUser) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Unauthorized' },
          { status: 401 },
        )
      }
      const url = new URL('/auth', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Double verification: JWT valid ✓ + DB role = 'admin' ✓
    // Service role bypasses RLS so the check is always authoritative
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )
    const { data: row, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (roleError || row?.role !== 'admin') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      )
    }
  }

  // ── 3. Vendor route protection ─────────────────────────────────────────────
  if (isVendorPath(pathname)) {
    if (!authUser) {
      const url = new URL('/vendor/auth', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const vendorClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    )
    const { data: vendorRow } = await vendorClient
      .from('vendor_accounts')
      .select('id, is_active')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (!vendorRow || !vendorRow.is_active) {
      const reason = vendorRow ? 'inactive' : 'no_account'
      const url = new URL('/vendor/auth', request.url)
      url.searchParams.set('reason', reason)
      return NextResponse.redirect(url)
    }
  }

  // ── 4. API rate limiting ────────────────────────────────────────────────────
  const rl = getRLConfig(pathname)
  if (rl) {
    const rawId = rl.byIp
      ? // Auth routes: key by IP
        (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown')
      : // All other API routes: key by user_id, fallback to IP for anon callers
        (authUser?.id ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'unknown')

    const key = `${rl.prefix}:${await hashValue(rawId)}`
    const { allowed, retryAfter } = await checkRateLimit(
      key,
      rl.limit,
      rl.window,
    )

    if (!allowed) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/pets/:path*',
    '/cart',
    '/checkout',
    '/orders/:path*',
    '/rewards',
    '/admin/:path*',
    '/vendor/:path*',
    '/api/:path*',
  ],
}
