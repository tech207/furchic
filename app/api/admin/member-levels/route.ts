import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const createSchema = z.object({
  name: z.string().min(1).max(50),
  min_spent: z.number().int().min(0),
  reward_rate: z.number().min(0).max(1),
  discount_rate: z.number().min(0).max(1),
  benefits: z.array(z.string()).default([]),
  sort_order: z.number().int().min(0).default(0),
})

export const GET = withAdmin(async (_req, _ctx, _user) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('member_levels')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')
  return apiSuccess({ levels: data ?? [] })
})

export const POST = withAdmin(async (req: NextRequest, _ctx, _user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success)
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('member_levels')
    .insert(parsed.data as never)
    .select()
    .single()

  if (error) return apiError('新增失敗', 500, 'INSERT_FAILED')
  return apiSuccess({ level: data }, 201)
})
