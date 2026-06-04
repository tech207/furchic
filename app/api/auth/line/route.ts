import { type NextRequest, NextResponse } from 'next/server'
import {
  buildLineAuthUrl,
  LINE_STATE_COOKIE,
  LINE_NEXT_COOKIE,
  LINE_STATE_COOKIE_OPTIONS,
} from '@/lib/auth/line'

// GET /api/auth/line?next=/pets
// Sets CSRF state cookie and redirects to LINE authorization URL
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/pets'

  // Whitelist: only allow relative paths
  const safeNext =
    next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/pets'

  const state = crypto.randomUUID()
  const lineUrl = buildLineAuthUrl(state)

  const response = NextResponse.redirect(lineUrl)
  response.cookies.set(LINE_STATE_COOKIE, state, LINE_STATE_COOKIE_OPTIONS)
  response.cookies.set(LINE_NEXT_COOKIE, safeNext, {
    ...LINE_STATE_COOKIE_OPTIONS,
    httpOnly: false, // readable by callback route handler
  })

  return response
}
