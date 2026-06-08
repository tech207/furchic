import type { NextRequest } from 'next/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Draft row type ────────────────────────────────────────────────────────────

type DraftRow = {
  id: string
  resource_type: string
  resource_id: string | null
  draft_data: Record<string, unknown>
  expires_at: string
  published_at: string | null
}

// ── Publisher functions per resource type ─────────────────────────────────────

async function publishProductPrice(
  resourceId: string | null,
  data: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ resource_id: string }> {
  const variantId = (data.variant_id as string | undefined) ?? resourceId
  if (!variantId) throw new Error('缺少 variant_id')

  const price = data.sale_price as number | undefined
  if (typeof price !== 'number')
    throw new Error('draft_data.sale_price 必須為數字')

  const { error } = await admin
    .from('product_variants')
    .update({ price } as never)
    .eq('id', variantId)

  if (error) throw new Error(`更新商品特價失敗：${error.message}`)
  return { resource_id: variantId }
}

async function publishBanner(
  resourceId: string | null,
  data: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ resource_id: string }> {
  if (!resourceId) throw new Error('缺少 resource_id')

  // Omit non-column fields that may appear in the snapshot
  const { id: _id, created_at: _ca, ...patch } = data as Record<string, unknown>

  const { error } = await admin
    .from('banners')
    .update(patch as never)
    .eq('id', resourceId)

  if (error) throw new Error(`更新 Banner 失敗：${error.message}`)
  return { resource_id: resourceId }
}

async function publishPromotion(
  resourceId: string | null,
  data: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ resource_id: string }> {
  if (!resourceId) throw new Error('缺少 resource_id')

  const { id: _id, created_at: _ca, ...patch } = data as Record<string, unknown>

  const { error } = await admin
    .from('promotions')
    .update(patch as never)
    .eq('id', resourceId)

  if (error) throw new Error(`更新促銷活動失敗：${error.message}`)
  return { resource_id: resourceId }
}

async function publishPolicy(
  resourceId: string | null,
  data: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ resource_id: string }> {
  if (!resourceId) throw new Error('缺少 resource_id')

  const patch: Record<string, unknown> = {
    status: 'published',
    last_published_at: new Date().toISOString(),
  }
  if ('content' in data) patch.content = data.content
  if ('draft_content' in data) patch.draft_content = null // clear draft
  if ('title' in data) patch.title = data.title
  if ('meta_title' in data) patch.meta_title = data.meta_title
  if ('meta_description' in data) patch.meta_description = data.meta_description

  const { error } = await admin
    .from('policies')
    .update(patch as never)
    .eq('id', resourceId)

  if (error) throw new Error(`更新政策頁面失敗：${error.message}`)
  return { resource_id: resourceId }
}

type FaqItem = {
  id?: string
  question: string
  answer: string
  category?: string
  sort_order?: number
  is_active?: boolean
}

async function publishFaq(
  data: Record<string, unknown>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ resource_id: null }> {
  const faqs = data.faqs as FaqItem[] | undefined
  if (!Array.isArray(faqs)) throw new Error('draft_data.faqs 必須為陣列')

  // Batch upsert: rows with id are updated; rows without id are inserted
  const upsertRows = faqs.map((faq, idx) => ({
    ...(faq.id ? { id: faq.id } : {}),
    question: faq.question,
    answer: faq.answer,
    category: faq.category ?? 'general',
    sort_order: faq.sort_order ?? idx,
    is_active: faq.is_active ?? true,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('faqs')
    .upsert(upsertRows as never, { onConflict: 'id' })

  if (error) throw new Error(`批次更新 FAQ 失敗：${error.message}`)
  return { resource_id: null }
}

// ── POST /api/admin/drafts/[id]/publish ───────────────────────────────────────

export const POST = withAdmin(async (_req: NextRequest, ctx) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少草稿 ID', 400, 'MISSING_ID')

  // draft_previews is not in the generated Database type yet; use any-cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createAdminClient() as any
  const admin = createAdminClient()

  // ── 1. Fetch draft ─────────────────────────────────────────────────────────
  const { data: raw, error: fetchErr } = (await client
    .from('draft_previews')
    .select(
      'id, resource_type, resource_id, draft_data, expires_at, published_at',
    )
    .eq('id', id)
    .maybeSingle()) as { data: DraftRow | null; error: unknown }

  if (fetchErr || !raw) return apiError('草稿不存在', 404, 'NOT_FOUND')

  if (raw.published_at)
    return apiError('此草稿已發布', 409, 'ALREADY_PUBLISHED')

  if (new Date(raw.expires_at) < new Date()) {
    return apiError('草稿已過期，請重新建立', 410, 'EXPIRED')
  }

  // ── 2. Publish by resource type ────────────────────────────────────────────
  let result: { resource_id: string | null }

  try {
    switch (raw.resource_type) {
      case 'product_price':
        result = await publishProductPrice(
          raw.resource_id,
          raw.draft_data,
          admin,
        )
        break
      case 'banner':
        result = await publishBanner(raw.resource_id, raw.draft_data, admin)
        break
      case 'promotion':
        result = await publishPromotion(raw.resource_id, raw.draft_data, admin)
        break
      case 'policy':
        result = await publishPolicy(raw.resource_id, raw.draft_data, admin)
        break
      case 'faq':
        result = await publishFaq(raw.draft_data, admin)
        break
      default:
        return apiError(
          `不支援的資源類型：${raw.resource_type}`,
          400,
          'UNSUPPORTED_TYPE',
        )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '發布失敗'
    return apiError(msg, 500, 'PUBLISH_FAILED')
  }

  // ── 3. Mark draft as published ─────────────────────────────────────────────
  const { error: updateErr } = await client
    .from('draft_previews')
    .update({ published_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) {
    // Non-fatal: resource already updated; log and continue
    console.error('[drafts/publish] failed to mark published_at', id, updateErr)
  }

  return apiSuccess({ success: true, resource_id: result.resource_id })
})
