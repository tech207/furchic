/**
 * Server-side input sanitization utilities.
 * No external dependencies — pure string manipulation.
 */

// ── HTML sanitization ─────────────────────────────────────────────────────────

/**
 * Strips all HTML tags and escapes remaining special characters.
 * Use when you want to store plain text that originated from user HTML input.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // strip <script>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // strip <style>
    .replace(/<[^>]+>/g, '') // strip all remaining tags
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[\da-f]+);)/gi, '&amp;') // escape bare &
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

// ── General input sanitization ────────────────────────────────────────────────

const DEFAULT_MAX_LENGTH = 5000

/**
 * Trims whitespace, truncates to maxLength, removes null bytes and control chars.
 * Use on all user-supplied string inputs before DB storage.
 */
export function sanitizeInput(
  input: string,
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  return input
    .trim()
    .replace(/\x00/g, '') // null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // control chars (keep \t \n \r)
    .slice(0, maxLength)
}

/**
 * Sanitizes a short single-line input (names, titles, labels).
 * Strips newlines and limits to 200 chars by default.
 */
export function sanitizeLine(input: string, maxLength = 200): string {
  return sanitizeInput(input.replace(/[\r\n]/g, ' '), maxLength)
}

// ── URL validation ────────────────────────────────────────────────────────────

const SAFE_PROTOCOLS = ['https:', 'http:']

/**
 * Validates a URL and optionally restricts to specific domains.
 * Returns false for javascript:, data:, and other dangerous protocols.
 */
export function validateUrl(url: string, allowedDomains?: string[]): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)

    if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return false

    if (allowedDomains && allowedDomains.length > 0) {
      const hostname = parsed.hostname.toLowerCase()
      return allowedDomains.some((domain) => {
        const d = domain.toLowerCase()
        return hostname === d || hostname.endsWith(`.${d}`)
      })
    }

    return true
  } catch {
    return false
  }
}

// ── Supabase Storage URL validation ──────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/**
 * Validates that a URL belongs to the project's Supabase Storage.
 * Use when accepting image URLs from clients.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const supabaseParsed = SUPABASE_URL ? new URL(SUPABASE_URL) : null
    if (supabaseParsed && parsed.hostname !== supabaseParsed.hostname)
      return false
    return parsed.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

// ── SQL injection prevention helpers ─────────────────────────────────────────

/**
 * Sanitizes a search term for use in Supabase `.ilike()`.
 * Escapes Postgres LIKE wildcard characters.
 */
export function sanitizeSearch(term: string, maxLength = 100): string {
  return sanitizeLine(term, maxLength).replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// ── Number validation helpers ─────────────────────────────────────────────────

/** Clamps a number to [min, max] and ensures it's finite. */
export function sanitizeNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
