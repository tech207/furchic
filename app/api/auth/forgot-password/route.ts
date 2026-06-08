import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { forgotPasswordSchema } from '@/lib/validations/user'
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

  const result = forgotPasswordSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { email } = result.data
  const supabase = createClient()

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  return apiSuccess({
    message: '若該 Email 已註冊，重設密碼連結將發送至您的信箱',
  })
}
