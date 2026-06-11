import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { vendorSetupPasswordSchema } from '@/lib/validations/vendor'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = vendorSetupPasswordSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { token, password } = result.data
  const supabase = createClient()

  // 1. 用 code（invite 連結中的 code 參數）換取 session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(token)

  if (sessionError || !sessionData.session) {
    return apiError(
      '連結無效或已過期，請聯絡平台重新發送',
      400,
      'INVALID_TOKEN',
    )
  }

  // 2. 確認這是廠商帳號（不允許一般消費者用此 API 設定密碼）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: vendorAccount } = await admin
    .from('vendor_accounts')
    .select('id, vendor_id')
    .eq('user_id', sessionData.session.user.id)
    .maybeSingle()

  if (!vendorAccount) {
    await supabase.auth.signOut()
    return apiError('此連結僅供廠商帳號使用', 403, 'NOT_VENDOR_ACCOUNT')
  }

  // 3. 更新密碼
  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) {
    console.error('[vendor/setup-password]', updateError.message)
    return apiError('密碼設定失敗，請稍後再試', 500, 'UPDATE_FAILED')
  }

  return apiSuccess({ message: '密碼設定成功，請重新登入' })
}
