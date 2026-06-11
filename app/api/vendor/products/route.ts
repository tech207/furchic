import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withVendorAuth, withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

// ── Schemas ───────────────────────────────────────────────────────────────────

const VENDOR_PRODUCT_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
] as const

const vendorCreateProductSchema = z.object({
  name: z.string().min(1, '請輸入商品名稱').max(200),
  description: z.string().max(5000).nullable().optional(),
  base_price: z.number().int().min(0, '價格不可為負'),
  images: z.array(z.string().url()).max(6).default([]),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(['draft', 'pending']).default('pending'),
})

const LIMIT = 20

// ── GET /api/vendor/products ──────────────────────────────────────────────────

export const GET = withVendorAuth(async (req: NextRequest, _ctx, account) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const search = url.searchParams.get('search') ?? ''

  if (
    status &&
    !(VENDOR_PRODUCT_STATUSES as readonly string[]).includes(status)
  ) {
    return apiError('無效的狀態過濾條件', 400, 'INVALID_STATUS')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  let query = admin
    .from('products')
    .select(
      `id, name, description, base_price, images, status, is_approved, is_active,
       category, meta, created_at, updated_at,
       product_variants(id)`,
      { count: 'exact' },
    )
    .eq('vendor_id', account.vendor_id)
    .order('created_at', { ascending: false })
    .range((page - 1) * LIMIT, page * LIMIT - 1)

  if (status) query = query.eq('status', status)
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/vendor/products]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  return apiSuccess({
    products: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / LIMIT),
  })
})

// ── POST /api/vendor/products ─────────────────────────────────────────────────

export const POST = withVendorPermission(
  'products',
  async (req: NextRequest, _ctx, account) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid request body', 400, 'INVALID_JSON')
    }

    const parsed = vendorCreateProductSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('驗證失敗', 400, 'VALIDATION_ERROR', parsed.error.errors)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const now = new Date().toISOString()
    const { status, ...productFields } = parsed.data

    const { data, error } = await admin
      .from('products')
      .insert({
        ...productFields,
        vendor_id: account.vendor_id,
        is_approved: false,
        is_active: false,
        status,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('[POST /api/vendor/products]', error?.message)
      return apiError('建立失敗', 500, 'CREATE_FAILED')
    }

    return apiSuccess({ product: data }, 201)
  },
)
