import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

// ── Data fetching ─────────────────────────────────────────────────────────────

type PolicyData = {
  slug: string
  title: string
  content: string | null
  content_type: string
  meta_title: string | null
  meta_description: string | null
  last_published_at: string | null
}

async function getPolicy(slug: string): Promise<PolicyData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/policies/${slug}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json.data as PolicyData) ?? null
  } catch {
    return null
  }
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const policy = await getPolicy(params.slug)
  if (!policy) return {}
  return {
    title: policy.meta_title ?? policy.title,
    description: policy.meta_description ?? undefined,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PolicyPage({
  params,
}: {
  params: { slug: string }
}) {
  const policy = await getPolicy(params.slug)
  if (!policy) notFound()

  const publishedDate = policy.last_published_at
    ? new Date(policy.last_published_at).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Header */}
        <header className="mb-10 border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {policy.title}
          </h1>
          {publishedDate && (
            <p className="mt-2 text-sm text-muted-foreground">
              最後更新：{publishedDate}
            </p>
          )}
        </header>

        {/* Content */}
        {policy.content ? (
          <article className="prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-li:leading-7 prose-ol:pl-5 prose-ul:pl-5 max-w-none">
            <ReactMarkdown>{policy.content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground">（尚無內容）</p>
        )}

        {/* Back link */}
        <div className="mt-12 border-t pt-6">
          <a
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← 返回首頁
          </a>
        </div>
      </div>
    </div>
  )
}
