import type { NextRequest } from 'next/server'
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppUser } from '@/lib/auth/session'

// ── PUT /api/admin/staff/[id] ─────────────────────────────────────────────────

export const PUT = withSuperAdmin(
  async (req: NextRequest, ctx, caller: AppUser) => {
    const id = ctx.params?.id as string | undefined
    if (!id) return apiError('缺少用戶 ID', 400, 'MISSING_ID')

    // Cannot modify self
    if (id === caller.id)
      return apiError('無法修改自己的管理員設定', 400, 'SELF_MODIFY')

    let body: { admin_role_id?: string; is_active_admin?: boolean }
    try {
      body = await req.json()
    } catch {
      return apiError('無效的請求格式', 400, 'INVALID_JSON')
    }

    const patch: Record<string, unknown> = {}

    if ('admin_role_id' in body) {
      // Validate role exists
      if (body.admin_role_id) {
        const admin = createAdminClient()
        const { data: role } = await admin
          .from('admin_roles')
          .select('id')
          .eq('id', body.admin_role_id)
          .maybeSingle()
        if (!role) return apiError('指定角色不存在', 400, 'INVALID_ROLE')
      }
      patch.admin_role_id = body.admin_role_id ?? null
    }

    if ('is_active_admin' in body) {
      patch.is_active_admin = Boolean(body.is_active_admin)
    }

    if (Object.keys(patch).length === 0) {
      return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')
    }

    const admin = createAdminClient()

    // Confirm target is an admin
    const { data: target } = (await admin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle()) as unknown as {
      data: { id: string; role: string } | null
    }

    if (!target) return apiError('用戶不存在', 404, 'NOT_FOUND')
    if (target.role !== 'admin')
      return apiError('此用戶不是管理員', 400, 'NOT_ADMIN')

    const { data, error } = await admin
      .from('users')
      .update(patch as never)
      .eq('id', id)
      .select('id, name, email, is_active_admin, admin_role_id')
      .single()

    if (error) return apiError('更新失敗', 500, 'UPDATE_FAILED')

    return apiSuccess({ user: data })
  },
)

// ── DELETE /api/admin/staff/[id] ──────────────────────────────────────────────

export const DELETE = withSuperAdmin(
  async (_req: NextRequest, ctx, caller: AppUser) => {
    const id = ctx.params?.id as string | undefined
    if (!id) return apiError('缺少用戶 ID', 400, 'MISSING_ID')

    if (id === caller.id)
      return apiError('無法移除自己的管理員權限', 400, 'SELF_MODIFY')

    const admin = createAdminClient()

    // Soft delete: revoke admin role, deactivate
    const { error } = await admin
      .from('users')
      .update({
        role: 'user',
        is_active_admin: false,
        admin_role_id: null,
      })
      .eq('id', id)
      .eq('role', 'admin')

    if (error) return apiError('操作失敗', 500, 'UPDATE_FAILED')

    return apiSuccess({ removed: true })
  },
)
