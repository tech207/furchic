import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { vendorLoginSchema } from '@/lib/validations/vendor'
import {
  authRateLimit,
  hashIp,
  rateLimitResponse,
} from '@/lib/security/rate-limit'

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(hashIp(request))
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = vendorLoginSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { email, password } = result.data
  const supabase = createClient()

  // 1. Supabase signInWithPassword（設定 Session Cookie）
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (authError || !authData.session) {
    return apiError('帳號或密碼錯誤', 401, 'INVALID_CREDENTIALS')
  }

  // 2. 確認 vendor_account 存在
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: account } = await admin
    .from('vendor_accounts')
    .select(
      '*, vendor:vendors(id, company_name, brand_name, status, logo_url, category, default_commission_rate)',
    )
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!account) {
    // 有 Auth 用戶但沒有 vendor_account → 清除 session，統一回傳「帳號或密碼錯誤」
    await supabase.auth.signOut()
    return apiError('帳號或密碼錯誤', 401, 'INVALID_CREDENTIALS')
  }

  const vendor = account.vendor as { status: string } | null

  // 3. 確認 vendor.status
  if (!vendor || vendor.status === 'pending') {
    await supabase.auth.signOut()
    return apiError('帳號審核中，請等待通知', 403, 'PENDING_APPROVAL')
  }

  if (vendor.status === 'rejected') {
    await supabase.auth.signOut()
    return apiError('申請未通過，如有疑問請聯絡平台', 403, 'VENDOR_REJECTED')
  }

  if (vendor.status !== 'approved') {
    await supabase.auth.signOut()
    return apiError('帳號已停用，請聯絡平台', 403, 'VENDOR_SUSPENDED')
  }

  // 4. 更新 last_login_at
  await admin
    .from('vendor_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', account.id)

  return apiSuccess({
    user: {
      id: authData.user.id,
      email: authData.user.email,
    },
    vendor: account.vendor,
    vendor_account: {
      id: account.id,
      vendor_id: account.vendor_id,
      role: account.role,
      permissions: account.permissions,
    },
  })
}
