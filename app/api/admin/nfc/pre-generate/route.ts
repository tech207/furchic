import type { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPetCardUrl } from '@/lib/utils/nfc'

const bodySchema = z.object({
  count: z.number().int().min(1).max(200),
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { count } = parsed.data
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://furchic.com'
  ).replace(/\/$/, '')

  const cards = Array.from({ length: count }, () => {
    const id = crypto.randomUUID()
    return {
      id,
      qr_url: buildPetCardUrl(baseUrl, id),
      status: 'unbound' as const,
    }
  })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('nfc_cards')
    .insert(cards as never)
    .select('id')

  if (error) {
    console.error('[POST /api/admin/nfc/pre-generate]', error.message)
    return apiError('批次建立失敗', 500, 'CREATE_FAILED')
  }

  const uuids = (data as unknown as Array<{ id: string }>).map((r) => r.id)
  return apiSuccess({ uuids, count: uuids.length }, 201)
})
