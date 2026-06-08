'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Bold,
  ChevronDown,
  ChevronUp,
  Italic,
  Link2,
  List,
  Loader2,
  Type,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type PolicySlug = 'service' | 'refund'

type Policy = {
  id: string
  slug: string
  title: string
  content: string | null
  draft_content: string | null
  content_type: string
  status: string
  last_published_at: string | null
  meta_title: string | null
  meta_description: string | null
  updated_at: string
}

const POLICY_TABS: { slug: PolicySlug; label: string }[] = [
  { slug: 'service', label: '服務政策' },
  { slug: 'refund', label: '退換貨政策' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Draft Banner ──────────────────────────────────────────────────────────────

function DraftBanner({
  updatedAt,
  publishing,
  discarding,
  onPublish,
  onDiscard,
}: {
  updatedAt: string
  publishing: boolean
  discarding: boolean
  onPublish: () => void
  onDiscard: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <span className="flex-1 whitespace-nowrap">
        📝 有未發布的草稿，最後儲存於 {fmtDate(updatedAt)}。
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={onPublish}
          disabled={publishing}
          className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
        >
          {publishing && <Loader2 className="h-3 w-3 animate-spin" />}
          發布草稿
        </button>
        <span className="text-amber-400">·</span>
        <button
          onClick={onDiscard}
          disabled={discarding}
          className="flex items-center gap-1 text-amber-700 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {discarding && <Loader2 className="h-3 w-3 animate-spin" />}
          放棄草稿
        </button>
      </div>
    </div>
  )
}

// ── Toolbar Button ────────────────────────────────────────────────────────────

function ToolBtn({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

// ── Policy Editor ─────────────────────────────────────────────────────────────

function PolicyEditor({ slug }: { slug: PolicySlug }) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [seoOpen, setSeoOpen] = useState(false)

  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)

  const debouncedContent = useDebounce(content, 500)

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/policies/${slug}`)
        const json = await res.json()
        if (!res.ok || !json.data?.policy) throw new Error()
        const p: Policy = json.data.policy
        setPolicy(p)
        setTitle(p.title)
        setContent(p.draft_content ?? p.content ?? '')
        setMetaTitle(p.meta_title ?? '')
        setMetaDesc(p.meta_description ?? '')
      } catch {
        toast({ variant: 'destructive', title: '載入政策失敗' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // ── Scroll sync ───────────────────────────────────────────────────────────

  function syncScroll() {
    if (textareaRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const insert = useCallback(
    (
      fn: (ta: HTMLTextAreaElement) => {
        next: string
        cursorStart: number
        cursorEnd: number
      },
    ) => {
      const ta = textareaRef.current
      if (!ta) return
      const { next, cursorStart, cursorEnd } = fn(ta)
      setContent(next)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(cursorStart, cursorEnd)
      })
    },
    [],
  )

  function toolBold() {
    insert((ta) => {
      const s = ta.selectionStart,
        e = ta.selectionEnd
      const sel = ta.value.slice(s, e) || 'text'
      return {
        next: ta.value.slice(0, s) + `**${sel}**` + ta.value.slice(e),
        cursorStart: s + 2,
        cursorEnd: s + 2 + sel.length,
      }
    })
  }

  function toolItalic() {
    insert((ta) => {
      const s = ta.selectionStart,
        e = ta.selectionEnd
      const sel = ta.value.slice(s, e) || 'text'
      return {
        next: ta.value.slice(0, s) + `*${sel}*` + ta.value.slice(e),
        cursorStart: s + 1,
        cursorEnd: s + 1 + sel.length,
      }
    })
  }

  function toolHeading() {
    insert((ta) => {
      const s = ta.selectionStart
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1
      const next =
        ta.value.slice(0, lineStart) + '### ' + ta.value.slice(lineStart)
      return { next, cursorStart: s + 4, cursorEnd: s + 4 }
    })
  }

  function toolList() {
    insert((ta) => {
      const s = ta.selectionStart
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1
      const next =
        ta.value.slice(0, lineStart) + '- ' + ta.value.slice(lineStart)
      return { next, cursorStart: s + 2, cursorEnd: s + 2 }
    })
  }

  function toolLink() {
    insert((ta) => {
      const s = ta.selectionStart,
        e = ta.selectionEnd
      const sel = ta.value.slice(s, e) || 'text'
      const ins = `[${sel}](url)`
      return {
        next: ta.value.slice(0, s) + ins + ta.value.slice(e),
        cursorStart: s + sel.length + 3,
        cursorEnd: s + sel.length + 6,
      }
    })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/admin/policies/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          status: 'draft',
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      setPolicy((prev) =>
        prev
          ? { ...prev, ...(json.data?.policy ?? {}), draft_content: content }
          : prev,
      )
      toast({ title: '草稿已儲存' })
    } catch {
      toast({ variant: 'destructive', title: '草稿儲存失敗' })
    } finally {
      setSavingDraft(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setShowPublishDialog(false)
    try {
      const res = await fetch(`/api/admin/policies/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          status: 'published',
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error()
      const now = new Date().toISOString()
      setPolicy((prev) =>
        prev
          ? {
              ...prev,
              ...(json.data?.policy ?? {}),
              content,
              draft_content: null,
              status: 'published',
              last_published_at: now,
            }
          : prev,
      )
      toast({ title: '已發布，前台立即生效' })
    } catch {
      toast({ variant: 'destructive', title: '發布失敗' })
    } finally {
      setPublishing(false)
    }
  }

  async function handlePublishDraft() {
    setPublishing(true)
    try {
      const res = await fetch(`/api/admin/policies/${slug}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error()
      setPolicy((prev) =>
        prev
          ? {
              ...prev,
              ...(json.data?.policy ?? {}),
              content: prev.draft_content ?? prev.content,
              draft_content: null,
              status: 'published',
            }
          : prev,
      )
      toast({ title: '草稿已發布' })
    } catch {
      toast({ variant: 'destructive', title: '發布草稿失敗' })
    } finally {
      setPublishing(false)
    }
  }

  async function handleDiscardDraft() {
    setDiscarding(true)
    try {
      await fetch(`/api/admin/policies/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', content: null }),
      })
      const published = policy?.content ?? ''
      setContent(published)
      setPolicy((prev) => (prev ? { ...prev, draft_content: null } : prev))
      toast({ title: '草稿已放棄，已還原為已發布版本' })
    } catch {
      toast({ variant: 'destructive', title: '放棄草稿失敗' })
    } finally {
      setDiscarding(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasDraft = !!(
    policy?.draft_content && policy.draft_content !== policy.content
  )

  const lineCount = content.split('\n').length

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Draft banner */}
      {hasDraft && (
        <DraftBanner
          updatedAt={policy!.updated_at}
          publishing={publishing}
          discarding={discarding}
          onPublish={handlePublishDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label>頁面標題</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-base font-medium"
        />
      </div>

      {/* Split editor */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Left — editor */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 border-b bg-muted/20 px-3 py-2">
            <ToolBtn title="粗體 (Ctrl+B)" onClick={toolBold}>
              <Bold className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn title="斜體 (Ctrl+I)" onClick={toolItalic}>
              <Italic className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn title="標題 H3" onClick={toolHeading}>
              <Type className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn title="清單" onClick={toolList}>
              <List className="h-3.5 w-3.5" />
            </ToolBtn>
            <ToolBtn title="插入連結" onClick={toolLink}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolBtn>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
              {lineCount} 行
            </span>
          </div>

          {/* Editor body: line numbers + textarea */}
          <div
            className="relative flex flex-1 overflow-hidden"
            style={{ height: 480 }}
          >
            {/* Line numbers */}
            <div
              ref={lineNumRef}
              className="shrink-0 select-none overflow-hidden border-r bg-muted/20 px-2 pt-2 text-right font-mono text-[11px] leading-[1.625rem] text-muted-foreground/50"
              style={{ minWidth: '2.75rem' }}
              aria-hidden
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={syncScroll}
              spellCheck={false}
              className="flex-1 resize-none bg-transparent p-2 font-mono text-sm leading-[1.625rem] outline-none"
              placeholder="在此輸入 Markdown 內容..."
            />
          </div>
        </div>

        {/* Right — preview */}
        <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/20 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              預覽
            </span>
          </div>
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{ height: 480 + 41 /* match toolbar height */ }}
          >
            {debouncedContent ? (
              <article className="prose prose-neutral prose-sm dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5 prose-p:text-muted-foreground prose-p:leading-7 prose-li:text-muted-foreground prose-li:leading-7 max-w-none">
                <ReactMarkdown>{debouncedContent}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                （無內容，左側輸入後即時更新）
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SEO settings (collapsible) */}
      <div className="rounded-xl border bg-card">
        <button
          type="button"
          onClick={() => setSeoOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          <span>SEO 設定</span>
          {seoOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {seoOpen && (
          <div className="space-y-4 border-t px-4 pb-4 pt-3">
            <div className="space-y-1.5">
              <Label>Meta 標題</Label>
              <Input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={title}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Meta 描述</Label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    metaDesc.length > 160
                      ? 'text-red-500'
                      : 'text-muted-foreground',
                  )}
                >
                  {metaDesc.length} / 160
                </span>
              </div>
              <Textarea
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                placeholder="搜尋引擎顯示的頁面描述，建議 120～160 字"
                rows={3}
                maxLength={200}
                className="resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">
          {policy?.last_published_at
            ? `最後發布：${fmtDate(policy.last_published_at)}`
            : '尚未發布'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={savingDraft || publishing}
            className="gap-1.5"
          >
            {savingDraft && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            儲存草稿
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            disabled={savingDraft || publishing}
            className="gap-1.5"
          >
            {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            發布
          </Button>
        </div>
      </div>

      {/* Publish confirm dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認發布</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            即將發布「{policy?.title}
            」，發布後前台用戶將立即看到更新內容。確認發布？
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPublishDialog(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="gap-1.5"
            >
              {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              確認發布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPoliciesPage() {
  const [activeSlug, setActiveSlug] = useState<PolicySlug>('service')

  return (
    <div className="max-w-6xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📋</span>
        <h1 className="text-2xl font-bold">服務政策</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {POLICY_TABS.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setActiveSlug(tab.slug)}
            className={cn(
              'rounded-lg border px-5 py-2 text-sm font-semibold transition-colors',
              activeSlug === tab.slug
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor — remount on slug change to reset state */}
      <PolicyEditor key={activeSlug} slug={activeSlug} />
    </div>
  )
}
