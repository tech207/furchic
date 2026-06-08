import { createAdminClient } from '@/lib/supabase/admin'

export type BannerType = 'hero' | 'sponsor' | 'shop'

export type Banner = {
  id: string
  type: BannerType
  title: string | null
  subtitle: string | null
  image_url: string | null
  mobile_image_url: string | null
  alt_text: string | null
  link_url: string | null
  bg_class: string | null
  is_active: boolean
  status: 'draft' | 'published' | 'archived'
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  created_at: string
}

const SELECT_COLS =
  'id, type, title, subtitle, image_url, mobile_image_url, alt_text, link_url, bg_class, is_active, status, starts_at, ends_at, sort_order, created_at'

/** Returns all banners of a given type, ordered by sort_order (no filtering — for admin use). */
export async function readBanners(
  admin: ReturnType<typeof createAdminClient>,
  type: BannerType,
): Promise<Banner[]> {
  const { data } = await admin
    .from('banners')
    .select(SELECT_COLS)
    .eq('type', type)
    .order('sort_order', { ascending: true })
  return (data as unknown as Banner[]) ?? []
}
