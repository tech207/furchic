import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateCaregiverSchema } from '@/lib/validations/pet'

type CaregiverEntry = {
  id: string
  user_id: string
  role: 'owner' | 'caregiver'
}

export const PUT = withAuth(async (req: NextRequest, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  const caregiverId = ctx.params?.caregiverId as string | undefined
  if (!petId || !caregiverId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  // Get current user's role for this pet
  const { data: myEntryRaw } = await supabase
    .from('pet_caregivers')
    .select('id, user_id, role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!myEntryRaw) return apiError('找不到寵物', 404, 'NOT_FOUND')
  const myEntry = myEntryRaw as unknown as CaregiverEntry

  // Get target caregiver entry
  const { data: targetEntryRaw } = await supabase
    .from('pet_caregivers')
    .select('id, user_id, role')
    .eq('id', caregiverId)
    .eq('pet_id', petId)
    .single()

  if (!targetEntryRaw) return apiError('找不到照護者', 404, 'NOT_FOUND')
  const targetEntry = targetEntryRaw as unknown as CaregiverEntry

  const isSelf = targetEntry.user_id === user.id
  const isOwner = myEntry.role === 'owner'

  if (!isSelf && !isOwner) return apiError('無操作權限', 403, 'FORBIDDEN')

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = updateCaregiverSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const validated = result.data
  const updates: Record<string, unknown> = {}

  if (isSelf) {
    if (validated.display_name !== undefined)
      updates.display_name = validated.display_name
    if (validated.contact_methods !== undefined)
      updates.contact_methods = validated.contact_methods
    if (validated.is_visible !== undefined)
      updates.is_visible = validated.is_visible
  }
  if (isOwner && validated.sort_order !== undefined) {
    updates.sort_order = validated.sort_order
  }

  if (Object.keys(updates).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'EMPTY_UPDATE')
  }

  const admin = createAdminClient()
  const { data: caregiver, error } = await admin
    .from('pet_caregivers')
    .update(updates as never)
    .eq('id', caregiverId)
    .select(
      `id, role, display_name, contact_methods, is_visible,
      sort_order, invited_at, accepted_at, created_at,
      users ( id, name, avatar_url )`,
    )
    .single()

  if (error || !caregiver) {
    console.error(
      '[PUT /api/pets/[id]/caregivers/[caregiverId]]',
      error?.message,
    )
    return apiError('更新失敗', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({
    caregiver: caregiver as unknown as Record<string, unknown>,
  })
})

export const DELETE = withAuth(async (_req, ctx, user) => {
  const petId = ctx.params?.id as string | undefined
  const caregiverId = ctx.params?.caregiverId as string | undefined
  if (!petId || !caregiverId) return apiError('缺少 ID', 400, 'MISSING_ID')

  const supabase = createClient()

  // Get current user's role for this pet
  const { data: myEntryRaw } = await supabase
    .from('pet_caregivers')
    .select('id, user_id, role')
    .eq('pet_id', petId)
    .eq('user_id', user.id)
    .single()

  if (!myEntryRaw) return apiError('找不到寵物', 404, 'NOT_FOUND')
  const myEntry = myEntryRaw as unknown as CaregiverEntry

  // Get target caregiver entry
  const { data: targetEntryRaw } = await supabase
    .from('pet_caregivers')
    .select('id, user_id, role')
    .eq('id', caregiverId)
    .eq('pet_id', petId)
    .single()

  if (!targetEntryRaw) return apiError('找不到照護者', 404, 'NOT_FOUND')
  const targetEntry = targetEntryRaw as unknown as CaregiverEntry

  const isSelf = targetEntry.user_id === user.id
  const isOwner = myEntry.role === 'owner'

  // Prevent removing the owner entry entirely
  if (targetEntry.role === 'owner') {
    return apiError('飼主無法被移除', 403, 'CANNOT_REMOVE_OWNER')
  }

  // Permission: owner can remove others, caregiver can only remove themselves
  if (!isOwner && !isSelf) return apiError('無操作權限', 403, 'FORBIDDEN')

  const admin = createAdminClient()
  const { error } = await admin
    .from('pet_caregivers')
    .delete()
    .eq('id', caregiverId)

  if (error) {
    console.error(
      '[DELETE /api/pets/[id]/caregivers/[caregiverId]]',
      error.message,
    )
    return apiError('操作失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
