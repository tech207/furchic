import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { emailLoginSchema } from '@/lib/validations/user'
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

  const result = emailLoginSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const { email, password } = result.data
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session) {
    return apiError('Email 或密碼錯誤', 401, 'INVALID_CREDENTIALS')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name, phone')
    .eq('id', data.user.id)
    .single()

  const profileData = profile as unknown as {
    name: string | null
    phone: string | null
  } | null
  const isNewUser = !profileData?.name || !profileData?.phone

  return apiSuccess({
    isNewUser,
    nextUrl: isNewUser ? '/profile/setup?welcome=1' : '/pets',
  })
}
