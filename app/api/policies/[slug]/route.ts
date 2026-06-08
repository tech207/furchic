import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PolicyRow = {
  slug: string
  title: string
  content: string | null
  content_type: string
  meta_title: string | null
  meta_description: string | null
  last_published_at: string | null
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const { slug } = params

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('policies')
    .select(
      'slug, title, content, content_type, meta_title, meta_description, last_published_at',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: '找不到政策頁面' }, { status: 404 })
  }

  return NextResponse.json(
    { data: data as unknown as PolicyRow },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    },
  )
}
