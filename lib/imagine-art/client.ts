/**
 * Imagine Art API client — server-side only.
 *
 * Endpoint reference (verify with your API plan documentation):
 *   POST  {BASE}/image/generations          → submit generate job
 *   POST  {BASE}/image/remove-background    → submit remove-bg job
 *   POST  {BASE}/image/enhance              → submit enhance job
 *   GET   {BASE}/image/generations/{id}     → poll job status
 *
 * Set IMAGINE_ART_BASE_URL in .env to override the default.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type GenerateModel = 'imagine-art-2.0' | 'nano-banana-2' | 'gpt-image-2'

export type AspectRatio =
  | '1:1'
  | '9:16'
  | '16:9'
  | '4:3'
  | '3:4'
  | '2:3'
  | '3:2'
  | '21:9'
  | '4:5'
  | '5:4'

export interface ImagineArtJobResult {
  jobId: string
}

export interface ImagineArtStatusResult {
  status: JobStatus
  resultUrl?: string
  progress?: number
}

// ── Internal response shapes ───────────────────────────────────────────────────

interface SubmitResponse {
  id?: string
  job_id?: string
  task_id?: string
  uuid?: string
  status?: string
}

interface StatusResponse {
  id?: string
  status?: string
  output?: { url?: string; image_url?: string }[]
  output_url?: string
  result_url?: string
  image_url?: string
  progress?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireApiKey(): string {
  const key = process.env.IMAGINE_ART_API_KEY
  if (!key) throw new Error('IMAGINE_ART_API_KEY is not set')
  return key
}

const BASE_URL = (
  process.env.IMAGINE_ART_BASE_URL ?? 'https://api.imagine.art/v1'
).replace(/\/$/, '')

async function post<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireApiKey()}`,
    },
    body: JSON.stringify(body),
    // Next.js — don't cache AI job submissions
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Imagine Art API ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${requireApiKey()}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Imagine Art API GET ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

/** Extract the job ID from the varied response shapes the API might return. */
function extractJobId(data: SubmitResponse): string {
  const id = data.id ?? data.job_id ?? data.task_id ?? data.uuid
  if (!id) throw new Error('Imagine Art API returned no job ID')
  return id
}

/** Normalise the job status field. */
function normaliseStatus(raw: string | undefined): JobStatus {
  const s = (raw ?? '').toLowerCase()
  if (s === 'completed' || s === 'done' || s === 'success' || s === 'succeeded')
    return 'completed'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'processing' || s === 'running' || s === 'generating')
    return 'processing'
  return 'queued'
}

/** Extract result URL from the varied response shapes. */
function extractResultUrl(data: StatusResponse): string | undefined {
  return (
    data.result_url ??
    data.output_url ??
    data.image_url ??
    data.output?.[0]?.url ??
    data.output?.[0]?.image_url
  )
}

// ── Public client ─────────────────────────────────────────────────────────────

/**
 * Submit a background-removal job.
 * @param imageUrl Must be a fully qualified URL accessible to the Imagine Art API.
 */
export async function removeBg(imageUrl: string): Promise<ImagineArtJobResult> {
  const data = await post<SubmitResponse>('/image/remove-background', {
    image_url: imageUrl,
  })
  return { jobId: extractJobId(data) }
}

/**
 * Submit an image-generation job.
 * @param prompt    Text description of the desired image.
 * @param aspectRatio  Defaults to '1:1'.
 * @param model     Defaults to 'imagine-art-2.0'.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = '1:1',
  model: GenerateModel = 'imagine-art-2.0',
): Promise<ImagineArtJobResult> {
  const data = await post<SubmitResponse>('/image/generations', {
    prompt,
    aspect_ratio: aspectRatio,
    model,
  })
  return { jobId: extractJobId(data) }
}

/**
 * Submit an image-enhancement job.
 */
export async function enhanceImage(
  imageUrl: string,
): Promise<ImagineArtJobResult> {
  const data = await post<SubmitResponse>('/image/enhance', {
    image_url: imageUrl,
  })
  return { jobId: extractJobId(data) }
}

/**
 * Poll a job for its current status and, when complete, the result URL.
 */
export async function getJobStatus(
  jobId: string,
): Promise<ImagineArtStatusResult> {
  const data = await get<StatusResponse>(
    `/image/generations/${encodeURIComponent(jobId)}`,
  )

  const status = normaliseStatus(data.status)
  const resultUrl = status === 'completed' ? extractResultUrl(data) : undefined

  return {
    status,
    resultUrl,
    ...(data.progress !== undefined && { progress: data.progress }),
  }
}
