import type { NextRequest } from 'next/server'
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const PUT = withSuperAdmin(async (req: NextRequest, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少角色 ID', 400, 'MISSING_ID')

  let body: {
    display_name?: string
    description?: string
    permissions?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const admin = createAdminClient()

  // ── 確認角色存在且非系統角色 ─────────────────────────────────────────────────
  const { data: roleRaw, error: fetchErr } = await admin
    .from('admin_roles')
    .select('id, is_system')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !roleRaw) return apiError('角色不存在', 404, 'NOT_FOUND')

  const role = roleRaw as { id: string; is_system: boolean }

  if (role.is_system) {
    return apiError('系統預設角色的名稱與權限不可修改', 400, 'SYSTEM_ROLE')
  }

  // ── Selective patch ───────────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {}

  if ('display_name' in body && body.display_name?.trim()) {
    patch.display_name = body.display_name.trim()
  }
  if ('description' in body) {
    patch.description = body.description ?? null
  }
  if ('permissions' in body) {
    if (!Array.isArray(body.permissions)) {
      return apiError('permissions 必須為陣列', 400, 'INVALID_PERMISSIONS')
    }
    patch.permissions = body.permissions
  }

  if (Object.keys(patch).length === 0) {
    return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')
  }

  const { data, error } = await admin
    .from('admin_roles')
    .update(patch as never)
    .eq('id', id)
    .select('id, name, display_name, description, permissions, is_system')
    .single()

  if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')

  return apiSuccess({ role: data })
})
