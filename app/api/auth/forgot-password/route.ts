import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { forgotPasswordSchema } from '@/lib/validations/user'

export async function POST(request: NextRequest) {
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

  // Always attempt the reset — never reveal whether the email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  // Always return success regardless of whether email was found
  return apiSuccess({ message: '若該 Email 已註冊，重設密碼連結將發送至您的信箱' })
}
