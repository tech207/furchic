import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { emailRegisterSchema } from '@/lib/validations/user'
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

  const result = emailRegisterSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { email, password } = result.data
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return apiError(
        '此 Email 已被使用，請直接登入或使用「忘記密碼」',
        409,
        'EMAIL_EXISTS',
      )
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return apiError('系統暫時繁忙，請 1 分鐘後再試', 429, 'RATE_LIMITED')
    }
    if (msg.includes('invalid') && msg.includes('email')) {
      return apiError('請輸入有效的 Email 地址', 400, 'INVALID_EMAIL')
    }
    console.error('[register]', error.message)
    return apiError('註冊失敗，請稍後再試', 500, 'REGISTER_FAILED')
  }

  if (!data.user) {
    return apiError('註冊失敗，請稍後再試', 500, 'REGISTER_FAILED')
  }

  return apiSuccess({ isNewUser: true }, 201)
}
