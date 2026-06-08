export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export function isAllowedImageType(type: string): type is AllowedImageType {
  return ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType)
}

// ── Magic-bytes validation (server) ───────────────────────────────────────────

/**
 * Detects the true image format from the first bytes of a buffer.
 * Returns null if the format is unknown or not allowed.
 */
export function validateImageMagicBytes(
  buffer: Buffer | ArrayBuffer | Uint8Array,
): 'jpeg' | 'png' | 'webp' | null {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer as ArrayBuffer)

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'png'

  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'webp'

  return null
}

/**
 * Reads the first 12 bytes of a Request body for magic-bytes validation.
 * Call before consuming the full body.
 */
export async function peekMagicBytes(req: Request): Promise<Uint8Array | null> {
  try {
    const reader = req.body?.getReader()
    if (!reader) return null
    const { value } = await reader.read()
    reader.releaseLock()
    return value ? value.slice(0, 12) : null
  } catch {
    return null
  }
}

// ── Client-side utilities (browser only) ─────────────────────────────────────

export interface CompressOptions {
  maxWidthPx?: number
  maxHeightPx?: number
  quality?: number // 0–1, default 0.85
  outputType?: 'image/jpeg' | 'image/webp'
}

/**
 * Compresses an image File using a canvas (browser only).
 * Returns a Blob with the compressed result.
 */
export function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<Blob> {
  const {
    maxWidthPx = 1920,
    maxHeightPx = 1920,
    quality = 0.85,
    outputType = 'image/jpeg',
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxWidthPx || height > maxHeightPx) {
        const ratio = Math.min(maxWidthPx / width, maxHeightPx / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context unavailable'))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        outputType,
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

/**
 * Validates magic bytes of a File object using FileReader (browser only).
 * Returns true if the detected format matches the declared MIME type.
 */
export function validateImageFileMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buf = e.target?.result
      if (!buf || !(buf instanceof ArrayBuffer)) return resolve(false)
      const detected = validateImageMagicBytes(new Uint8Array(buf))
      if (!detected) return resolve(false)
      const mimeMap: Record<string, AllowedImageType> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      }
      resolve(mimeMap[detected] === file.type)
    }
    reader.onerror = () => resolve(false)
    reader.readAsArrayBuffer(file.slice(0, 12))
  })
}
