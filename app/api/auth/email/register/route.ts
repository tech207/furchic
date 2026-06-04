import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { emailRegisterSchema } from '@/lib/validations/user'

export async function POST(request: NextRequest) {
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
    // Use generic message to avoid revealing whether email is registered
    if (
      error.message.toLowerCase().includes('already') ||
      error.message.toLowerCase().includes('registered')
    ) {
      return apiError('此 Email 已被使用，請直接登入或使用「忘記密碼」', 409, 'EMAIL_EXISTS')
    }
    console.error('[register]', error.message)
    return apiError('註冊失敗，請稍後再試', 500, 'REGISTER_FAILED')
  }

  if (!data.user) {
    return apiError('註冊失敗，請稍後再試', 500, 'REGISTER_FAILED')
  }

  return apiSuccess({ isNewUser: true }, 201)
}
