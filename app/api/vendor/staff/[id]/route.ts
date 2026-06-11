import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withVendorAuth } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const VALID_PERMISSIONS = ['products', 'orders', 'reports'] as const

const updateSchema = z
  .object({
    permissions: z.array(z.enum(VALID_PERMISSIONS)).max(3).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => d.permissions !== undefined || d.is_active !== undefined, {
    message: '至少提供一個欄位',
  })

// ── PUT /api/vendor/staff/[id] ────────────────────────────────────────────────

export const PUT = withVendorAuth(async (req: NextRequest, ctx, account) => {
  if (account.role !== 'owner') {
    return apiError('只有主帳號才能修改員工設定', 403, 'OWNER_ONLY')
  }

  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少帳號 ID', 400, 'MISSING_ID')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Fetch target account — must belong to this vendor
  const { data: target } = await admin
    .from('vendor_accounts')
    .select('id, role, vendor_id')
    .eq('id', id)
    .eq('vendor_id', account.vendor_id)
    .maybeSingle()

  if (!target) return apiError('找不到帳號', 404, 'NOT_FOUND')

  // Cannot modify the owner account
  if ((target as { role: string }).role === 'owner') {
    return apiError('不能修改主帳號的設定', 403, 'CANNOT_MODIFY_OWNER')
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.permissions !== undefined)
    patch.permissions = parsed.data.permissions
  if (parsed.data.is_active !== undefined)
    patch.is_active = parsed.data.is_active

  const { error: updateErr } = await admin
    .from('vendor_accounts')
    .update(patch)
    .eq('id', id)

  if (updateErr) return apiError('更新失敗', 500, 'UPDATE_FAILED')

  return apiSuccess({ message: '已更新' })
})

// ── DELETE /api/vendor/staff/[id] ─────────────────────────────────────────────
// Soft-delete: set is_active = false. Cannot delete owner or self.

export const DELETE = withVendorAuth(async (_req, ctx, account) => {
  if (account.role !== 'owner') {
    return apiError('只有主帳號才能停用員工帳號', 403, 'OWNER_ONLY')
  }

  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少帳號 ID', 400, 'MISSING_ID')
  if (id === account.id)
    return apiError('不能停用自己的帳號', 400, 'CANNOT_DELETE_SELF')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: target } = await admin
    .from('vendor_accounts')
    .select('id, role, vendor_id')
    .eq('id', id)
    .eq('vendor_id', account.vendor_id)
    .maybeSingle()

  if (!target) return apiError('找不到帳號', 404, 'NOT_FOUND')

  if ((target as { role: string }).role === 'owner') {
    return apiError('不能停用主帳號', 403, 'CANNOT_DELETE_OWNER')
  }

  const { error } = await admin
    .from('vendor_accounts')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return apiError('操作失敗', 500, 'UPDATE_FAILED')

  return apiSuccess({ message: '帳號已停用' })
})
