import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Banner } from '@/lib/banner-helpers'
import type { RouteHandlerContext } from '@/lib/auth/guards'

function storagePathFrom(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const path = new URL(url).pathname.replace(
      /^\/storage\/v1\/object\/public\/company-assets\//,
      '',
    )
    return path || null
  } catch {
    return null
  }
}

export const PUT = withAdmin(
  async (req: NextRequest, ctx: RouteHandlerContext) => {
    const id = ctx.params?.id as string | undefined
    if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('無效請求', 400, 'INVALID_JSON')
    }

    const {
      title,
      subtitle,
      image_url,
      mobile_image_url,
      alt_text,
      link_url,
      bg_class,
      is_active,
      status,
      starts_at,
      ends_at,
    } = body as Partial<Banner>

    // Only include fields that were explicitly provided
    const updates: Record<string, unknown> = {}
    if ('title' in (body as object)) updates.title = title ?? null
    if ('subtitle' in (body as object)) updates.subtitle = subtitle ?? null
    if ('image_url' in (body as object)) updates.image_url = image_url ?? null
    if ('mobile_image_url' in (body as object))
      updates.mobile_image_url = mobile_image_url ?? null
    if ('alt_text' in (body as object)) updates.alt_text = alt_text ?? null
    if ('link_url' in (body as object)) updates.link_url = link_url ?? null
    if ('bg_class' in (body as object)) updates.bg_class = bg_class ?? null
    if ('is_active' in (body as object)) updates.is_active = is_active
    if ('status' in (body as object)) updates.status = status
    if ('starts_at' in (body as object)) updates.starts_at = starts_at ?? null
    if ('ends_at' in (body as object)) updates.ends_at = ends_at ?? null

    if (Object.keys(updates).length === 0) {
      return apiError('沒有可更新的欄位', 400, 'NO_FIELDS')
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('banners')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116')
        return apiError('找不到 Banner', 404, 'NOT_FOUND')
      console.error('[PUT /api/admin/banners/[id]]', error.message)
      return apiError('更新失敗', 500, 'UPDATE_FAILED')
    }

    return apiSuccess({ banner: data as unknown as Banner })
  },
)

export const DELETE = withAdmin(
  async (_req: NextRequest, ctx: RouteHandlerContext) => {
    const id = ctx.params?.id as string | undefined
    if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

    const admin = createAdminClient()

    // Fetch before delete to get image URLs for storage cleanup
    const { data: existing } = await admin
      .from('banners')
      .select('image_url, mobile_image_url')
      .eq('id', id)
      .single()

    if (!existing) return apiError('找不到 Banner', 404, 'NOT_FOUND')

    const { error } = await admin.from('banners').delete().eq('id', id)
    if (error) {
      console.error('[DELETE /api/admin/banners/[id]]', error.message)
      return apiError('刪除失敗', 500, 'DELETE_FAILED')
    }

    // Clean up storage objects (fire-and-forget, don't fail the response)
    const paths = [
      storagePathFrom(
        (existing as unknown as { image_url: string | null }).image_url,
      ),
      storagePathFrom(
        (existing as unknown as { mobile_image_url: string | null })
          .mobile_image_url,
      ),
    ].filter((p): p is string => p !== null)

    if (paths.length > 0) {
      const admin2 = createAdminClient()
      await admin2.storage
        .from('company-assets')
        .remove(paths)
        .catch(() => null)
    }

    return apiSuccess({ deleted: true })
  },
)
