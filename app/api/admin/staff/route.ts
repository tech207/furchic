import type { NextRequest } from 'next/server'
import { withSuperAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppUser } from '@/lib/auth/session'

type StaffRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  is_active_admin: boolean
  admin_role_id: string | null
  last_login_at: string | null
  invited_at: string | null
  invited_by: string | null
  admin_roles: {
    id: string
    name: string
    display_name: string
  } | null
}

// ── GET /api/admin/staff ──────────────────────────────────────────────────────

export const GET = withSuperAdmin(async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('users')
    .select(
      'id, name, email, phone, is_active_admin, admin_role_id, last_login_at, invited_at, invited_by, admin_roles(id, name, display_name)',
    )
    .eq('role', 'admin')
    .order('invited_at', { ascending: false, nullsFirst: false })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({ staff: (data as unknown as StaffRow[]) ?? [] })
})

// ── POST /api/admin/staff ─────────────────────────────────────────────────────

export const POST = withSuperAdmin(
  async (req: NextRequest, _ctx, user: AppUser) => {
    let body: { email?: string; name?: string; admin_role_id?: string }
    try {
      body = await req.json()
    } catch {
      return apiError('無效的請求格式', 400, 'INVALID_JSON')
    }

    const { email, name, admin_role_id } = body

    if (!email || !name || !admin_role_id) {
      return apiError(
        '缺少必填欄位：email、name、admin_role_id',
        400,
        'MISSING_FIELDS',
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return apiError('Email 格式不正確', 400, 'INVALID_EMAIL')
    }

    const admin = createAdminClient()

    // ── 1. 確認角色存在 ──────────────────────────────────────────────────────────
    const { data: roleData, error: roleErr } = await admin
      .from('admin_roles')
      .select('id, name')
      .eq('id', admin_role_id)
      .maybeSingle()

    if (roleErr || !roleData)
      return apiError('指定角色不存在', 400, 'INVALID_ROLE')

    // ── 2. 送出邀請信 ────────────────────────────────────────────────────────────
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

    const { data: inviteData, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo: `${siteUrl}/admin`,
      })

    if (inviteErr) {
      const msg = inviteErr.message.includes('already')
        ? '此 Email 已有帳號，請直接在用戶列表中設定管理員角色'
        : `邀請失敗：${inviteErr.message}`
      return apiError(msg, 400, 'INVITE_FAILED')
    }

    const invitedUserId = inviteData.user?.id
    if (!invitedUserId)
      return apiError('邀請成功但無法取得用戶 ID', 500, 'INVITE_ERROR')

    // ── 3. 寫入 users 表（upsert） ───────────────────────────────────────────────
    const now = new Date().toISOString()

    await admin.from('users').upsert(
      {
        id: invitedUserId,
        name,
        email,
        role: 'admin',
        admin_role_id,
        is_active_admin: true,
        invited_by: user.id,
        invited_at: now,
      },
      { onConflict: 'id' },
    )

    return apiSuccess({ invited: true, user_id: invitedUserId }, 201)
  },
)
