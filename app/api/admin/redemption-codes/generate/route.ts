import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateUniqueCodes,
  type CodeFormat,
} from '@/lib/utils/code-generator'

const bodySchema = z.object({
  batch_name: z.string().min(1, '請輸入批次名稱').max(100),
  count: z.number().int().min(1).max(200),
  prefix: z
    .string()
    .max(10)
    .default('')
    .transform((s) => s.trim().toUpperCase()),
  format: z.enum(['alpha', 'numeric', 'alphanumeric']).default('alphanumeric'),
  expires_at: z.string().nullable().optional(),
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const { batch_name, count, prefix, format, expires_at } = parsed.data
  const admin = createAdminClient()

  // Load existing codes with same prefix for collision avoidance
  const { data: existingRaw } = await admin
    .from('redemption_codes')
    .select('code')
    .ilike('code', prefix ? `${prefix}-%` : '%')

  const existingCodes = new Set(
    (existingRaw as unknown as Array<{ code: string }> | null)?.map(
      (r) => r.code,
    ) ?? [],
  )

  let codes: string[]
  try {
    codes = generateUniqueCodes(
      count,
      prefix,
      format as CodeFormat,
      existingCodes,
    )
  } catch (e) {
    return apiError(String(e), 500, 'GENERATE_FAILED')
  }

  const now = new Date().toISOString()
  const rows = codes.map((code) => ({
    code,
    batch_name,
    used_count: 0,
    max_uses: 1,
    expires_at: expires_at ?? null,
    created_at: now,
  }))

  const { data: inserted, error } = await admin
    .from('redemption_codes')
    .insert(rows as never)
    .select()

  if (error || !inserted) {
    console.error('[generate redemption-codes]', error?.message)
    return apiError('批次寫入失敗', 500, 'INSERT_FAILED')
  }

  return apiSuccess(
    { codes: inserted as unknown as unknown[], count: inserted.length },
    201,
  )
})
