import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  privacyUpdateSchema,
  PUBLIC_FIELDS_WHITELIST,
  ALWAYS_PUBLIC_FIELDS,
} from '@/lib/validations/pet'

export const PUT = withAuth(async (req: NextRequest, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  if (!petId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()
  const { data: caregiver } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!caregiver) return apiError('找不到寵物', 404, 'NOT_FOUND')
  if ((caregiver as unknown as { role: string }).role !== 'owner')
    return apiError('僅限飼主操作', 403, 'FORBIDDEN')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = privacyUpdateSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const allowedSet = new Set<string>(PUBLIC_FIELDS_WHITELIST)
  const validFields = result.data.public_fields.filter((f) => allowedSet.has(f))
  const finalFields = Array.from(
    new Set([...ALWAYS_PUBLIC_FIELDS, ...validFields]),
  )

  const admin = createAdminClient()
  const { error } = await admin
    .from('pets')
    .update({
      public_fields: finalFields,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', petId)

  if (error) {
    console.error('[PUT /api/pets/[id]/privacy]', error.message)
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ public_fields: finalFields })
})
