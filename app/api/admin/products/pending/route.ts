import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const LIMIT = 20

// ── GET /api/admin/products/pending ──────────────────────────────────────────
// Returns vendor products awaiting review (is_approved=false, vendor_id IS NOT NULL).

export const GET = withAdmin(async (req: NextRequest, _ctx, _user) => {
  const url = new URL(req.url)
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const search = url.searchParams.get('search') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  let query = admin
    .from('products')
    .select(
      `
      id, name, description, base_price, images, status, is_approved, created_at, updated_at,
      vendor:vendor_id (
        id, company_name, brand_name, vendor_type, contact_email, status
      )
    `,
      { count: 'exact' },
    )
    .not('vendor_id', 'is', null)
    .eq('is_approved', false)
    .order('created_at', { ascending: true }) // oldest first — review queue order
    .range((page - 1) * LIMIT, page * LIMIT - 1)

  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/admin/products/pending]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({
    products: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / LIMIT),
  })
})
