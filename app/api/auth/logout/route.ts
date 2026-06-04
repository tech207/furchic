import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'

export async function POST() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('[logout]', error.message)
    return apiError('登出失敗', 500, 'LOGOUT_FAILED')
  }

  return apiSuccess({ message: '已成功登出' })
}
