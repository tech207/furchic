// ── Types ─────────────────────────────────────────────────────────────────────

export type CodeFormat = 'alpha' | 'numeric' | 'alphanumeric'

// Exclude visually ambiguous chars (I/O/0/1/l)
const CHARSETS: Record<CodeFormat, string> = {
  alpha: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  numeric: '23456789',
  alphanumeric: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
}

// ── generateCode ──────────────────────────────────────────────────────────────
// Returns a single code: "PREFIX-XXXX-XXXX" (or "XXXX-XXXX" if no prefix).
// Body length is always `length` chars, split into groups of 4 with hyphens.

export function generateCode(
  prefix: string,
  format: CodeFormat = 'alphanumeric',
  length = 8,
): string {
  const charset = CHARSETS[format]
  const body = Array.from(
    { length },
    () => charset[Math.floor(Math.random() * charset.length)],
  ).join('')

  // Group body into blocks of 4
  const grouped = (body.match(/.{1,4}/g) ?? [body]).join('-')

  return prefix.trim() ? `${prefix.trim().toUpperCase()}-${grouped}` : grouped
}

// ── generateUniqueCodes ───────────────────────────────────────────────────────
// Generates `count` unique codes not present in `existingCodes`.
// Throws if it cannot produce enough codes within the attempt budget.

export function generateUniqueCodes(
  count: number,
  prefix: string,
  format: CodeFormat,
  existingCodes: Set<string>,
  length = 8,
): string[] {
  const generated = new Set<string>()
  const result: string[] = []
  const maxAttempts = count * 20

  for (
    let attempt = 0;
    result.length < count && attempt < maxAttempts;
    attempt++
  ) {
    const code = generateCode(prefix, format, length)
    if (!existingCodes.has(code) && !generated.has(code)) {
      generated.add(code)
      result.push(code)
    }
  }

  if (result.length < count) {
    throw new Error(
      `無法產生足夠的唯一兌換碼（產生 ${result.length}/${count}，可能字元空間不足）`,
    )
  }

  return result
}
