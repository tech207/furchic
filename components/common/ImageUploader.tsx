'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export interface ImageUploaderProps {
  bucketName: string
  filePath: string
  onUpload: (url: string) => void
  maxSize?: number
  aspectRatio?: string
  currentImageUrl?: string
}

const VALID_MIME = ['image/jpeg', 'image/png', 'image/webp']

async function validateMagicBytes(file: File): Promise<boolean> {
  const buf = await file.slice(0, 12).arrayBuffer()
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return true
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return true
  return false
}

async function compressImage(
  file: File,
  maxPx = 1200,
  maxBytes = 1024 * 1024,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objUrl)
      let { width, height } = img
      if (width > maxPx) {
        height = Math.round((height * maxPx) / width)
        width = maxPx
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      let quality = 0.9
      function attempt() {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'))
              return
            }
            if (blob.size <= maxBytes || quality < 0.2) {
              resolve(blob)
              return
            }
            quality = Math.round((quality - 0.1) * 10) / 10
            attempt()
          },
          'image/jpeg',
          quality,
        )
      }
      attempt()
    }
    img.onerror = () => {
      URL.revokeObjectURL(objUrl)
      reject(new Error('Image load failed'))
    }
    img.src = objUrl
  })
}

export function ImageUploader({
  bucketName,
  filePath,
  onUpload,
  maxSize = 5 * 1024 * 1024,
  aspectRatio,
  currentImageUrl,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImageUrl ?? null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      )
      if (item) {
        const file = item.getAsFile()
        if (file) void processFile(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('paste', onPaste)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const processFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!VALID_MIME.includes(file.type)) {
        setError('僅支援 JPG、PNG、WebP 格式')
        return
      }
      const valid = await validateMagicBytes(file)
      if (!valid) {
        setError('檔案格式驗證失敗，請確認為有效圖片')
        return
      }
      if (file.size > maxSize * 4) {
        setError('檔案過大，請選擇較小的圖片')
        return
      }
      try {
        setUploading(true)
        setProgress(15)
        const blob = await compressImage(file)
        setProgress(40)

        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const previewUrl = URL.createObjectURL(blob)
        blobUrlRef.current = previewUrl
        setPreview(previewUrl)
        setProgress(55)

        const supabase = createClient()
        const { error: uploadErr } = await supabase.storage
          .from(bucketName)
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })
        if (uploadErr) throw uploadErr
        setProgress(90)

        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath)
        setProgress(100)
        onUpload(`${urlData.publicUrl}?t=${Date.now()}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : '上傳失敗，請稍後再試')
        setPreview(null)
      } finally {
        setUploading(false)
      }
    },
    [bucketName, filePath, maxSize, onUpload],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  function reset() {
    setPreview(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          <img
            src={preview}
            alt="預覽圖"
            className={cn(
              'mx-auto block max-h-72 w-full object-cover',
              aspectRatio === '1:1' && 'aspect-square',
            )}
          />
          <div className="absolute bottom-3 right-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={reset}
              className="gap-1.5 shadow-md"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新選擇
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
          )}
        >
          <UploadCloud
            className={cn(
              'h-10 w-10 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">
              拖曳或點擊上傳
            </p>
            <p className="text-xs text-muted-foreground">
              支援 JPG、PNG、WebP・Ctrl+V 貼上
            </p>
            <p className="text-xs text-muted-foreground">
              最大 {Math.round(maxSize / 1024 / 1024)} MB（自動壓縮至 1200px / 1
              MB）
            </p>
          </div>
        </div>
      )}

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-right text-[11px] text-muted-foreground">
            {progress}%
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <X className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void processFile(f)
        }}
      />
    </div>
  )
}
