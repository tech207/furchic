import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contact_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('[GET /api/contact-settings]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ contact_settings: data })
}
