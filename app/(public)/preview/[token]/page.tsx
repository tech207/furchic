import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { FaqSection, type Faq } from '@/components/about/FaqSection'
import {
  BannerPreview,
  type BannerDraftData,
} from '@/components/preview/BannerPreview'
import {
  ProductPricePreview,
  type ProductPriceDraftData,
} from '@/components/preview/ProductPricePreview'
import {
  PromotionPreview,
  type PromotionDraftData,
} from '@/components/preview/PromotionPreview'

// ── Metadata ──────────────────────────────────────────────────────────────────
// Prevent search engines from indexing preview pages

export const metadata: Metadata = {
  title: '草稿預覽 | Pet.chic Weekend',
  robots: { index: false, follow: false },
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DraftPayload = {
  id: string
  resource_type: 'banner' | 'product_price' | 'promotion' | 'policy' | 'faq'
  resource_id: string | null
  draft_data: Record<string, unknown>
  expires_at: string
  published_at: string | null
  created_at: string
}

type FetchResult =
  | { ok: true; draft: DraftPayload }
  | { ok: false; code: 'NOT_FOUND' | 'EXPIRED' }

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getDraft(token: string): Promise<FetchResult> {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/preview/${token}`, {
      cache: 'no-store',
    })
    if (res.status === 410) return { ok: false, code: 'EXPIRED' }
    if (!res.ok) return { ok: false, code: 'NOT_FOUND' }
    const json = await res.json()
    return { ok: true, draft: json.data as DraftPayload }
  } catch {
    return { ok: false, code: 'NOT_FOUND' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RESOURCE_LABELS: Record<DraftPayload['resource_type'], string> = {
  banner: 'Banner',
  product_price: '商品特價',
  promotion: '促銷活動',
  policy: '政策頁面',
  faq: '常見問題',
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

// Fixed/sticky orange preview strip at the top of the content
function PreviewStrip({
  expiresAt,
  isPublished,
}: {
  expiresAt: string
  isPublished: boolean
}) {
  return (
    <div className="sticky top-0 z-40 flex flex-col gap-1 bg-orange-500 px-4 py-2.5 text-xs text-white shadow-md sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
      <span className="flex shrink-0 items-center gap-1.5 font-semibold">
        ⚠️ 草稿預覽模式 — 此頁面尚未正式發布
      </span>
      <span className="flex items-center gap-1 opacity-90 sm:before:mr-1 sm:before:content-['·']">
        <Clock className="inline h-3 w-3" />
        {isPublished ? '此草稿已發布' : `有效期至：${fmtExpiry(expiresAt)}`}
      </span>
      <Link
        href="/admin"
        className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2 opacity-90 hover:opacity-100 sm:ml-auto"
      >
        <ArrowLeft className="h-3 w-3" />
        回到後台發布
      </Link>
    </div>
  )
}

// Expired / not-found view
function InvalidView({ code }: { code: 'NOT_FOUND' | 'EXPIRED' }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-full bg-amber-100 p-4">
        <AlertCircle className="h-8 w-8 text-amber-600" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {code === 'EXPIRED' ? '此預覽連結已過期' : '此預覽連結不存在'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          預覽連結有效期為 24 小時，請重新從後台產生
        </p>
      </div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        返回後台
      </Link>
    </div>
  )
}

// ── Policy preview (reuses policy page styles) ────────────────────────────────

function PolicyPreview({ data }: { data: Record<string, unknown> }) {
  const title = (data.title as string | undefined) ?? '政策頁面預覽'
  const content =
    (data.content as string | undefined) ??
    (data.draft_content as string | undefined)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">（草稿內容）</p>
      </header>
      {content ? (
        <article className="prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-li:leading-7 prose-ol:pl-5 prose-ul:pl-5 max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">（尚無內容）</p>
      )}
    </div>
  )
}

// ── FAQ preview (reuses FaqSection) ──────────────────────────────────────────

function FaqPreview({ data }: { data: Record<string, unknown> }) {
  const faqs = (data.faqs as Faq[] | undefined) ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">常見問題（預覽）</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          以下為草稿版 FAQ，尚未正式發布
        </p>
      </header>
      <FaqSection initialFaqs={faqs} />
    </div>
  )
}

// ── Resource renderer ─────────────────────────────────────────────────────────

function ResourceContent({ draft }: { draft: DraftPayload }) {
  const { resource_type: type, draft_data: data } = draft

  switch (type) {
    case 'banner':
      return (
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <BannerPreview data={data as unknown as BannerDraftData} />
        </div>
      )

    case 'product_price':
      return (
        <div className="px-4 py-12">
          <ProductPricePreview
            data={data as unknown as ProductPriceDraftData}
          />
        </div>
      )

    case 'promotion':
      return (
        <div className="px-4 py-12">
          <PromotionPreview data={data as unknown as PromotionDraftData} />
        </div>
      )

    case 'policy':
      return <PolicyPreview data={data} />

    case 'faq':
      return <FaqPreview data={data} />

    default:
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          不支援的資源類型：{type}
        </div>
      )
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PreviewPage({
  params,
}: {
  params: { token: string }
}) {
  const result = await getDraft(params.token)

  if (!result.ok) {
    return <InvalidView code={result.code} />
  }

  const { draft } = result
  const label = RESOURCE_LABELS[draft.resource_type] ?? draft.resource_type

  return (
    <div>
      {/* Sticky preview strip */}
      <PreviewStrip
        expiresAt={draft.expires_at}
        isPublished={!!draft.published_at}
      />

      {/* Content heading */}
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <p className="mb-1 text-xs text-muted-foreground">
          草稿 ID：<span className="font-mono">{draft.id}</span>
        </p>
        <h2 className="text-lg font-semibold">{label} — 草稿預覽</h2>
        <div className="mt-4 border-b" />
      </div>

      {/* Resource-specific preview */}
      <ResourceContent draft={draft} />
    </div>
  )
}
