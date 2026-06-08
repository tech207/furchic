import type { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { faqCategorySchema } from '@/lib/validations/about'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')

  if (category) {
    const parsed = faqCategorySchema.safeParse(category)
    if (!parsed.success) {
      return apiError(
        '無效的 FAQ 分類',
        400,
        'INVALID_CATEGORY',
        parsed.error.errors,
      )
    }
  }

  const supabase = createClient()
  let query = supabase
    .from('faqs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/faqs]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({ faqs: data ?? [] })
}
