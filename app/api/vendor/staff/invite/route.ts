import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withVendorAuth } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

const VALID_PERMISSIONS = ['products', 'orders', 'reports'] as const

const inviteSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  permissions: z
    .array(z.enum(VALID_PERMISSIONS))
    .max(3, '權限數量超出範圍')
    .default([]),
})

// ── POST /api/vendor/staff/invite ─────────────────────────────────────────────

export const POST = withVendorAuth(async (req: NextRequest, _ctx, account) => {
  if (account.role !== 'owner') {
    return apiError('只有主帳號才能邀請員工', 403, 'OWNER_ONLY')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效的請求格式', 400, 'INVALID_JSON')
  }

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
  }

  const { email, permissions } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Check this email is not already a member of this vendor
  const { data: existing } = await admin
    .from('vendor_accounts')
    .select('id')
    .eq('vendor_id', account.vendor_id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return apiError('此 Email 已是此廠商的帳號成員', 409, 'ALREADY_MEMBER')
  }

  // Send Supabase invite email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/vendor/auth/setup`,
    })

  if (inviteError || !inviteData?.user) {
    const msg = inviteError?.message ?? ''
    if (
      msg.toLowerCase().includes('already been registered') ||
      msg.toLowerCase().includes('already registered')
    ) {
      return apiError(
        '此 Email 已有其他帳號，無法使用邀請方式，請聯絡平台協助處理',
        409,
        'EMAIL_TAKEN',
      )
    }
    console.error('[vendor/staff/invite]', inviteError)
    return apiError('邀請郵件發送失敗，請稍後再試', 500, 'INVITE_FAILED')
  }

  // Create vendor_account (is_active=false until staff sets up password)
  const { data: newAccount, error: insertErr } = await admin
    .from('vendor_accounts')
    .insert({
      vendor_id: account.vendor_id,
      user_id: inviteData.user.id,
      email,
      phone: '',
      role: 'staff',
      permissions,
      is_active: false,
      invited_by: account.id,
    })
    .select('id')
    .single()

  if (insertErr || !newAccount) {
    console.error('[vendor/staff/invite] insert vendor_account', insertErr)
    return apiError('帳號建立失敗', 500, 'INSERT_FAILED')
  }

  return apiSuccess({ message: '邀請已發送，對方設定密碼後即可登入' }, 201)
})
