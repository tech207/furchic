import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { type BannerType, type Banner, readBanners } from '@/lib/banner-helpers'

export const GET = withAdmin(async (req: NextRequest) => {
  const type = (req.nextUrl.searchParams.get('type') ?? 'hero') as BannerType
  if (!['hero', 'sponsor', 'shop'].includes(type)) {
    return apiError('無效的 type', 400, 'INVALID_TYPE')
  }
  const admin = createAdminClient()
  const banners = await readBanners(admin, type)
  return apiSuccess({ banners })
})

export const POST = withAdmin(async (req: NextRequest) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('無效請求', 400, 'INVALID_JSON')
  }

  const {
    type,
    title,
    subtitle,
    image_url,
    mobile_image_url,
    alt_text,
    link_url,
    bg_class,
    status,
    starts_at,
    ends_at,
  } = body as {
    type: BannerType
    title?: string
    subtitle?: string
    image_url?: string
    mobile_image_url?: string
    alt_text?: string
    link_url?: string
    bg_class?: string
    status?: Banner['status']
    starts_at?: string
    ends_at?: string
  }

  if (!type || !['hero', 'sponsor', 'shop'].includes(type)) {
    return apiError('無效的 type', 400, 'INVALID_TYPE')
  }

  const admin = createAdminClient()

  // Determine next sort_order
  const { count } = await admin
    .from('banners')
    .select('id', { count: 'exact', head: true })
    .eq('type', type)

  const row = {
    type,
    title: title ?? null,
    subtitle: subtitle ?? null,
    image_url: image_url ?? null,
    mobile_image_url: mobile_image_url ?? null,
    alt_text: alt_text ?? null,
    link_url: link_url ?? null,
    bg_class: bg_class ?? null,
    is_active: true,
    status: status ?? 'published',
    starts_at: starts_at ?? null,
    ends_at: ends_at ?? null,
    sort_order: count ?? 0,
  }

  const { data, error } = await admin
    .from('banners')
    .insert(row as never)
    .select()
    .single()

  if (error) {
    console.error('[POST /api/admin/banners]', error.message)
    return apiError('建立失敗', 500, 'INSERT_FAILED')
  }

  return apiSuccess({ banner: data as unknown as Banner }, 201)
})
