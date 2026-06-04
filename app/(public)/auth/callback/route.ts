import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeLineCode,
  getLineProfile,
  extractEmailFromIdToken,
  deriveLinePassword,
  upsertLineUser,
  LINE_STATE_COOKIE,
  LINE_NEXT_COOKIE,
} from '@/lib/auth/line'

// ── Redirect safety ────────────────────────────────────────────────────────────

/**
 * Only allow redirecting to relative paths or same-origin URLs.
 * Prevents open-redirect attacks where an attacker supplies an external URL
 * as the `next` parameter.
 */
function isSafeRedirect(url: string): boolean {
  if (!url || url.length > 500) return false
  // Relative path (must not start with // which would be protocol-relative)
  if (url.startsWith('/') && !url.startsWith('//')) return true
  // Absolute same-origin
  try {
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL!).origin
    return new URL(url).origin === appOrigin
  } catch {
    return false
  }
}

function to(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url))
}

// ── New-user detection ─────────────────────────────────────────────────────────

type UserProfile = { name: string | null; phone: string | null }

async function resolveRedirect(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fallback: string,
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('name, phone')
    .eq('id', userId)
    .single()

  // Database type is a placeholder; cast is safe because the query selects these exact columns
  const profile = data as unknown as UserProfile | null
  const isNewUser = !profile?.name || !profile?.phone
  return isNewUser ? '/profile/setup?welcome=1' : fallback
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  // Provider rejected the auth request (user denied, or scope error)
  if (oauthError) {
    const desc = searchParams.get('error_description') ?? oauthError
    console.warn('[auth/callback] provider error:', desc)
    return to(request, `/auth?error=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    return to(request, '/auth?error=missing_code')
  }

  const cookieStore = cookies()

  // Post-auth destination: read from cookie, validated against whitelist
  const rawNext = cookieStore.get(LINE_NEXT_COOKIE)?.value ?? ''
  const nextUrl = isSafeRedirect(rawNext) ? rawNext : '/pets'

  // Detect LINE vs Google/Supabase by matching the CSRF state cookie
  const savedState = cookieStore.get(LINE_STATE_COOKIE)?.value
  const isLineCallback = Boolean(savedState && state && savedState === state)

  if (isLineCallback) {
    return handleLineCallback(request, code, nextUrl)
  }
  return handleSupabaseCallback(request, code, nextUrl)
}

// ── LINE callback ──────────────────────────────────────────────────────────────

async function handleLineCallback(
  request: NextRequest,
  code: string,
  nextUrl: string,
): Promise<NextResponse> {
  const cookieStore = cookies()

  try {
    // 1. Exchange authorization code for LINE tokens
    //    ⚠️  lineToken.access_token must never be logged
    const lineToken = await exchangeLineCode(code)

    // 2. Fetch user profile from LINE (userId, displayName, pictureUrl)
    const lineProfile = await getLineProfile(lineToken.access_token)

    // 3. Extract real email from the OpenID Connect ID token (may be null)
    const realEmail = lineToken.id_token
      ? extractEmailFromIdToken(lineToken.id_token)
      : null

    // 4. Ensure user exists in Supabase Auth
    //    Uses a synthetic email to avoid conflicts with Google/email accounts
    await upsertLineUser(lineProfile, realEmail)

    // 5. Sign in with the deterministic password to create a Supabase session
    const supabase = createClient()
    const syntheticEmail = `line_${lineProfile.userId}@furchic-oauth.internal`

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: deriveLinePassword(lineProfile.userId),
    })

    if (signInError || !signInData.session) {
      console.error('[auth/callback:LINE] signInWithPassword failed:', signInError?.message)
      return to(request, '/auth?error=line_signin_failed')
    }

    // 6. Refresh LINE profile metadata (displayName / avatar may have changed)
    await supabase.auth.updateUser({
      data: {
        full_name: lineProfile.displayName,
        avatar_url: lineProfile.pictureUrl ?? null,
        picture: lineProfile.pictureUrl ?? null,
        real_email: realEmail,
      },
    })

    // 7. Clean up CSRF state and next-URL cookies
    cookieStore.set(LINE_STATE_COOKIE, '', { maxAge: 0, path: '/' })
    cookieStore.set(LINE_NEXT_COOKIE, '', { maxAge: 0, path: '/' })

    // 8. Redirect: new users → profile setup; returning users → intended destination
    const redirectTo = await resolveRedirect(
      supabase,
      signInData.session.user.id,
      nextUrl,
    )
    return to(request, redirectTo)
  } catch (err) {
    console.error('[auth/callback:LINE]', err instanceof Error ? err.message : err)
    return to(request, '/auth?error=line_failed')
  }
}

// ── Google / Supabase PKCE callback ───────────────────────────────────────────

async function handleSupabaseCallback(
  request: NextRequest,
  code: string,
  nextUrl: string,
): Promise<NextResponse> {
  const cookieStore = cookies()

  try {
    const supabase = createClient()

    // Supabase reads the PKCE code verifier automatically from cookies
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.session) {
      console.error('[auth/callback:Google] exchangeCodeForSession failed:', error?.message)
      return to(request, '/auth?error=session_failed')
    }

    cookieStore.set(LINE_NEXT_COOKIE, '', { maxAge: 0, path: '/' })

    const redirectTo = await resolveRedirect(supabase, data.session.user.id, nextUrl)
    return to(request, redirectTo)
  } catch (err) {
    console.error('[auth/callback:Google]', err instanceof Error ? err.message : err)
    return to(request, '/auth?error=oauth_failed')
  }
}
