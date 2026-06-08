'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, ImageIcon, Loader2, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed'

interface AiPhotoSectionProps {
  petId: string
  photoUrl: string | null
  aiPhotoUrl: string | null
  breed?: string | null
  onUpdate: (aiPhotoUrl: string) => void
}

// ── Styles for generation ─────────────────────────────────────────────────────

const STYLES = [
  {
    id: 'oil',
    label: '油畫',
    prompt: 'oil painting style, rich brushstrokes, artistic',
  },
  {
    id: 'watercolor',
    label: '水彩',
    prompt: 'watercolor painting, soft washes, delicate',
  },
  {
    id: 'cartoon',
    label: '卡通',
    prompt: 'cute cartoon illustration, bold outlines, vibrant',
  },
  {
    id: 'realistic',
    label: '寫實',
    prompt: 'photorealistic, detailed fur, natural studio lighting',
  },
] as const

type StyleId = (typeof STYLES)[number]['id']

// ── Polling ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 180_000 // 3 minutes

async function pollUntilDone(
  jobId: string,
  onProgress: (status: JobStatus, progress: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const start = Date.now()

  while (!signal.aborted) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    if (signal.aborted) break

    if (Date.now() - start > POLL_TIMEOUT_MS) {
      throw new Error('AI 處理超時，請重新嘗試')
    }

    const res = await fetch(`/api/ai/status/${jobId}`)
    const json = await res.json()
    const { status, result_url, progress } = json.data as {
      status: string
      result_url: string | null
      progress: number | null
    }

    const normalized = status as JobStatus
    onProgress(normalized, progress ?? 0)

    if (normalized === 'completed' && result_url) return result_url
    if (normalized === 'failed') throw new Error('AI 處理失敗，請重新嘗試')
  }

  throw new Error('操作已取消')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; class: string }> = {
    idle: { label: '待機中', class: 'bg-gray-100 text-gray-500' },
    queued: { label: '排隊中', class: 'bg-yellow-100 text-yellow-600' },
    processing: { label: 'AI 處理中', class: 'bg-blue-100 text-blue-600' },
    completed: { label: '完成', class: 'bg-green-100 text-green-700' },
    failed: { label: '失敗', class: 'bg-red-100 text-red-600' },
  }
  const cfg = map[status]
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.class)}
    >
      {cfg.label}
    </span>
  )
}

function PhotoComparison({
  originalUrl,
  resultUrl,
}: {
  originalUrl: string
  resultUrl: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <p className="text-center text-xs font-medium text-muted-foreground">
          原圖
        </p>
        <img
          src={originalUrl}
          alt="原始照片"
          className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-center text-xs font-medium text-primary">去背結果</p>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl ring-2 ring-primary/40">
          {/* Checker pattern for transparent background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          />
          <img
            src={resultUrl}
            alt="去背結果"
            className="relative h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  )
}

// ── Remove BG Tab ─────────────────────────────────────────────────────────────

function RemoveBgTab({
  petId,
  photoUrl,
  onUpdate,
}: {
  petId: string
  photoUrl: string | null
  onUpdate: (url: string) => void
}) {
  const { toast } = useToast()
  const [status, setStatus] = useState<JobStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleRemoveBg = useCallback(async () => {
    if (!photoUrl) return
    setStatus('queued')
    setProgress(0)
    setResultUrl(null)

    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    try {
      const res = await fetch('/api/ai/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: photoUrl }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: json.message ?? 'AI 去背失敗' })
        setStatus('failed')
        return
      }

      const jobId = json.data.job_id as string
      setStatus('processing')

      const url = await pollUntilDone(
        jobId,
        (s, p) => {
          setStatus(s)
          setProgress(p)
        },
        signal,
      )
      setResultUrl(url)
      setStatus('completed')
    } catch (err) {
      if (!signal.aborted) {
        toast({
          variant: 'destructive',
          title: err instanceof Error ? err.message : 'AI 去背失敗',
        })
        setStatus('failed')
      }
    }
  }, [photoUrl, toast])

  async function applyResult() {
    if (!resultUrl) return
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_photo_url: resultUrl }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: 'destructive', title: json.message ?? '更新失敗' })
        return
      }
      onUpdate(resultUrl)
      toast({ title: '已套用去背照片 ✓' })
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤，請稍後再試' })
    }
  }

  if (!photoUrl) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-10 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          請先在步驟 2 上傳寵物照片
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Original preview */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
        <img
          src={photoUrl}
          alt="原始照片"
          className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">原始照片</p>
          <StatusBadge status={status} />
        </div>
        {status === 'idle' || status === 'failed' ? (
          <Button
            size="sm"
            onClick={handleRemoveBg}
            className="shrink-0 gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            AI 去背
          </Button>
        ) : status === 'processing' || status === 'queued' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress > 0 ? `${progress}%` : '…'}
          </div>
        ) : null}
      </div>

      {/* Before / after comparison */}
      {status === 'completed' && resultUrl && (
        <div className="space-y-3">
          <PhotoComparison originalUrl={photoUrl} resultUrl={resultUrl} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => {
                setStatus('idle')
                setResultUrl(null)
              }}
            >
              <X className="h-3.5 w-3.5" />
              重新嘗試
            </Button>
            <Button size="sm" className="flex-1 gap-1.5" onClick={applyResult}>
              <Check className="h-3.5 w-3.5" />
              使用去背照片
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generate Image Tab ────────────────────────────────────────────────────────

function GenerateTab({
  petId,
  breed,
  onUpdate,
}: {
  petId: string
  breed?: string | null
  onUpdate: (url: string) => void
}) {
  const { toast } = useToast()
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('cartoon')
  const [customDesc, setCustomDesc] = useState('')
  const [status, setStatus] = useState<JobStatus>('idle')
  const [results, setResults] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = useCallback(async () => {
    const style = STYLES.find((s) => s.id === selectedStyle)!
    const breedPart = breed ? `a ${breed}` : 'a dog'
    const descPart = customDesc.trim() ? `, ${customDesc.trim()}` : ''
    const prompt = `Portrait of ${breedPart}${descPart}, ${style.prompt}`

    setStatus('queued')
    setResults([])
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    try {
      // Submit 2 generation jobs in parallel
      const [res1, res2] = await Promise.all([
        fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, aspect_ratio: '1:1' }),
        }),
        fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, aspect_ratio: '1:1' }),
        }),
      ])

      if (!res1.ok) {
        const j = await res1.json()
        toast({ variant: 'destructive', title: j.message ?? 'AI 生成失敗' })
        setStatus('failed')
        return
      }

      const [j1, j2] = await Promise.all([res1.json(), res2.json()])
      const jobIds = [
        j1.data.job_id as string,
        res2.ok ? (j2.data.job_id as string) : null,
      ].filter(Boolean) as string[]

      setStatus('processing')

      const urls = await Promise.all(
        jobIds.map((id) =>
          pollUntilDone(id, (s) => setStatus(s), signal).catch(() => null),
        ),
      )
      const validUrls = urls.filter((u): u is string => u !== null)

      if (validUrls.length === 0) {
        setStatus('failed')
        toast({ variant: 'destructive', title: 'AI 生成失敗，請重新嘗試' })
        return
      }

      setResults(validUrls)
      setStatus('completed')
    } catch (err) {
      if (!signal.aborted) {
        toast({
          variant: 'destructive',
          title: err instanceof Error ? err.message : 'AI 生成失敗',
        })
        setStatus('failed')
      }
    }
  }, [selectedStyle, customDesc, breed, toast])

  async function applyResult(url: string) {
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_photo_url: url }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: 'destructive', title: json.message ?? '更新失敗' })
        return
      }
      onUpdate(url)
      toast({ title: '已套用 AI 生成圖片 ✓' })
    } catch {
      toast({ variant: 'destructive', title: '網路錯誤，請稍後再試' })
    }
  }

  const isRunning = status === 'queued' || status === 'processing'

  return (
    <div className="space-y-4">
      {/* Style selector */}
      <div>
        <p className="mb-2 text-sm font-medium">選擇風格</p>
        <div className="grid grid-cols-4 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={isRunning}
              onClick={() => setSelectedStyle(s.id)}
              className={cn(
                'rounded-lg border py-2 text-xs font-medium transition-colors',
                selectedStyle === s.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          額外描述{' '}
          <span className="font-normal text-muted-foreground">（可選）</span>
        </label>
        <input
          type="text"
          value={customDesc}
          onChange={(e) => setCustomDesc(e.target.value)}
          disabled={isRunning}
          maxLength={100}
          placeholder="例如：戴著聖誕帽、在花園裡…"
          className="block w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isRunning}
        className="w-full gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 生成中（約 30 秒）…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            AI 生成
          </>
        )}
      </Button>

      {/* Results */}
      {status === 'completed' && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">選擇一張使用：</p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((url, i) => (
              <div key={url} className="group relative space-y-2">
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={url}
                    alt={`生成結果 ${i + 1}`}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => applyResult(url)}
                >
                  <Check className="h-3 w-3" />
                  使用此圖
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-xs text-muted-foreground"
            onClick={() => {
              setStatus('idle')
              setResults([])
            }}
          >
            重新生成
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AiPhotoSection({
  petId,
  photoUrl,
  aiPhotoUrl,
  breed,
  onUpdate,
}: AiPhotoSectionProps) {
  const [currentAiUrl, setCurrentAiUrl] = useState(aiPhotoUrl)

  function handleUpdate(url: string) {
    setCurrentAiUrl(url)
    onUpdate(url)
  }

  return (
    <div className="space-y-4">
      {/* Current AI photo preview */}
      {currentAiUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <img
            src={currentAiUrl}
            alt="AI 照片"
            className="h-14 w-14 rounded-lg object-cover ring-2 ring-primary/30"
          />
          <div>
            <p className="text-sm font-medium text-primary">已套用 AI 照片</p>
            <p className="text-xs text-muted-foreground">顯示於 NFC 名片</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="removebg">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="removebg" className="gap-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" />
            AI 去背
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            AI 生成
          </TabsTrigger>
        </TabsList>

        <TabsContent value="removebg" className="mt-4">
          <RemoveBgTab
            petId={petId}
            photoUrl={photoUrl}
            onUpdate={handleUpdate}
          />
        </TabsContent>

        <TabsContent value="generate" className="mt-4">
          <GenerateTab petId={petId} breed={breed} onUpdate={handleUpdate} />
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground">
        AI 功能每日限額：去背 20 次・生成 10 次
      </p>
    </div>
  )
}
