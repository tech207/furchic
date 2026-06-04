import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ──────────────────────────────────────────────────────────────────────

export type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

type LineTokenResponse = {
  access_token: string
  token_type: string
  refresh_token: string
  expires_in: number
  scope: string
  id_token?: string
}

// ── Cookie names & options ─────────────────────────────────────────────────────

export const LINE_STATE_COOKIE = 'line_oauth_state'
export const LINE_NEXT_COOKIE = 'auth_next_url'

/**
 * Options for the CSRF state cookie.
 * Call sites: the API route that initiates LINE login
 * (e.g. GET /api/auth/line) sets this cookie before redirecting.
 */
export const LINE_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 600, // 10 minutes
  sameSite: 'lax' as const,
  path: '/',
} as const

// ── LINE API endpoints ─────────────────────────────────────────────────────────

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile'

// ── Authorization URL ─────────────────────────────────────────────────────────

/**
 * Build the LINE authorization URL.
 *
 * Usage (in the route that initiates login):
 *   const state = crypto.randomUUID()
 *   cookieStore.set(LINE_STATE_COOKIE, state, LINE_STATE_COOKIE_OPTIONS)
 *   return NextResponse.redirect(buildLineAuthUrl(state))
 */
export function buildLineAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID!,
    // redirect_uri must match the value in LINE Developers console exactly
    redirect_uri: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL!,
    state,
    scope: 'profile openid email',
  })
  return `${LINE_AUTH_URL}?${params.toString()}`
}

// ── Token exchange ─────────────────────────────────────────────────────────────

export async function exchangeLineCode(code: string): Promise<LineTokenResponse> {
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      // Must be identical to the value used when building the auth URL
      redirect_uri: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL!,
      client_id: process.env.LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE token exchange failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<LineTokenResponse>
}

// ── Profile ────────────────────────────────────────────────────────────────────

export async function getLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch LINE profile (${res.status})`)
  }
  return res.json() as Promise<LineProfile>
}

/**
 * Decode the LINE ID token (a JWT) to extract the `email` claim.
 *
 * Trust model: the token was obtained server-side in exchange for a short-lived
 * authorization code — it does not need to be signature-verified here.
 * Returns null if the token is malformed or the claim is absent.
 */
export function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3 || !parts[1]) return null
    const json = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(json) as Record<string, unknown>
    return typeof payload.email === 'string' && payload.email.length > 0
      ? payload.email
      : null
  } catch {
    return null
  }
}

// ── Supabase Auth integration ──────────────────────────────────────────────────

/**
 * Derive a stable, server-only password for LINE users.
 *
 * This is combined with NEXTAUTH_SECRET so the value cannot be derived
 * without access to the server secret. It is never shown to users.
 *
 * Scheme: HMAC-SHA256(secret, "line:{lineUserId}")
 */
export function deriveLinePassword(lineUserId: string): string {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is not set — cannot derive LINE password')
  }
  return createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(`line:${lineUserId}`)
    .digest('hex')
}

/**
 * Ensure a LINE user has a corresponding entry in Supabase Auth.
 *
 * - First login:  creates the user (synthetic email, confirmed, deterministic password)
 * - Repeat login: createUser returns a duplicate-email error, which is silently ignored;
 *                 the subsequent signInWithPassword in the callback will succeed
 *
 * Synthetic email format: `line_{userId}@furchic-oauth.internal`
 * Using a synthetic email avoids conflicts with real email registrations (Google / email)
 * and eliminates the need for account-linking logic at this layer.
 *
 * The real email (if LINE provides one) is stored in user_metadata so that
 * handle_new_user trigger can optionally populate public.users.email.
 */
export async function upsertLineUser(
  profile: LineProfile,
  realEmail: string | null,
): Promise<void> {
  const admin = createAdminClient()
  const syntheticEmail = `line_${profile.userId}@furchic-oauth.internal`

  const { error } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: deriveLinePassword(profile.userId),
    email_confirm: true,
    user_metadata: {
      provider: 'line',
      line_uid: profile.userId,
      full_name: profile.displayName,
      avatar_url: profile.pictureUrl ?? null,
      picture: profile.pictureUrl ?? null,
      // Preserved so handle_new_user trigger can store the real email
      real_email: realEmail ?? null,
    },
  })

  // A duplicate-email error means the user already exists — that is expected on every
  // subsequent login and must not be treated as a failure.
  if (error && !isDuplicateEmailError(error.message)) {
    throw new Error(`LINE upsert failed: ${error.message}`)
  }
}

function isDuplicateEmailError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('already been registered') ||
    lower.includes('already registered') ||
    lower.includes('duplicate') ||
    lower.includes('unique constraint')
  )
}
