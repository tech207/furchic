import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  status: z.enum(['printing', 'done']),
})

export const PUT = withAdmin(async (req: NextRequest, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

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

  const admin = createAdminClient()

  const { data: reqRaw } = await admin
    .from('card_print_requests')
    .select('id, status, pet_id')
    .eq('id', id)
    .single()

  if (!reqRaw) return apiError('找不到申請記錄', 404, 'NOT_FOUND')
  const request = reqRaw as unknown as {
    id: string
    status: string
    pet_id: string
  }

  // Prevent backward transitions
  const ORDER = { pending: 0, printing: 1, done: 2 }
  const current = ORDER[request.status as keyof typeof ORDER] ?? 0
  const next = ORDER[parsed.data.status]
  if (next <= current) {
    return apiError('不允許狀態倒退', 422, 'INVALID_TRANSITION')
  }

  const { error } = await admin
    .from('card_print_requests')
    .update({ status: parsed.data.status } as never)
    .eq('id', id)

  if (error) {
    console.error('[PUT /api/admin/cards/[id]/status]', error.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  // When done: set pet card_status to 'active'
  if (parsed.data.status === 'done') {
    await admin
      .from('pets')
      .update({ card_status: 'active' } as never)
      .eq('id', request.pet_id)
  }

  return apiSuccess({ status: parsed.data.status })
})
