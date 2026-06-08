// ── Web NFC type declarations ─────────────────────────────────────────────────
// These types are not in lib.dom.d.ts yet; declared here for Chrome Android.

declare global {
  interface NDEFReadingEvent extends Event {
    serialNumber: string
    message: {
      records: ReadonlyArray<{
        recordType: string
        data: DataView | null
        id: string | null
        mediaType: string | null
        encoding: string | null
        lang: string | null
      }>
    }
  }

  interface NDEFRecordInit {
    recordType: string
    data?: string | BufferSource
    id?: string
    lang?: string
    encoding?: string
    mediaType?: string
  }

  interface NDEFWriteOptions {
    overwrite?: boolean
    signal?: AbortSignal
  }

  class NDEFReader extends EventTarget {
    constructor()
    scan(options?: { signal?: AbortSignal }): Promise<void>
    write(
      message: string | { records: NDEFRecordInit[] },
      options?: NDEFWriteOptions,
    ): Promise<void>
    addEventListener(
      type: 'reading',
      handler: (event: NDEFReadingEvent) => void,
    ): void
    addEventListener(
      type: 'readingerror',
      handler: (event: Event) => void,
    ): void
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NFC_TIMEOUT_MS = 30_000
const UUID_RE =
  /\/pet\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

// ── Public helpers ────────────────────────────────────────────────────────────

export function buildPetCardUrl(baseUrl: string, uuid: string) {
  return new URL(`/pet/${uuid}`, baseUrl).toString()
}

/**
 * Scan the nearest NFC card and return its UUID and physical serial number.
 * UUID is extracted from a written URL NDEF record (e.g. /pet/{uuid}),
 * falling back to the chip serial if no URL record is present.
 * Rejects after 30 seconds.
 */
export async function readNfcCard(): Promise<{ uuid: string; serial: string }> {
  if (typeof window === 'undefined' || !('NDEFReader' in window)) {
    throw new Error('此瀏覽器不支援 Web NFC')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NFC_TIMEOUT_MS)
  let settled = false

  return new Promise<{ uuid: string; serial: string }>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = new (window as any).NDEFReader() as NDEFReader

    controller.signal.addEventListener('abort', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('NFC 感應逾時（30 秒），請重試'))
    })

    reader.scan({ signal: controller.signal }).catch((err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })

    reader.addEventListener('readingerror', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      controller.abort()
      reject(new Error('NFC 讀取錯誤，請確認卡片格式後重試'))
    })

    reader.addEventListener('reading', (event: NDEFReadingEvent) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      const serial = (event.serialNumber ?? '')
        .toLowerCase()
        .replace(/[:\s]/g, '')
      let uuid = serial

      // Prefer UUID extracted from a URL NDEF record
      const decoder = new TextDecoder()
      for (const record of event.message.records) {
        if (record.recordType === 'url' && record.data) {
          try {
            const url = decoder.decode(record.data)
            const match = UUID_RE.exec(url)
            if (match?.[1]) {
              uuid = match[1].toLowerCase()
              break
            }
          } catch {
            /* ignore */
          }
        }
      }

      // Abort scanning so the reader stops after the first read
      controller.abort()
      resolve({ uuid, serial })
    })
  })
}

/**
 * Write a URL NDEF record to the nearest NFC card.
 * Rejects after 30 seconds.
 */
export async function writeNfcUrl(url: string): Promise<void> {
  if (typeof window === 'undefined' || !('NDEFReader' in window)) {
    throw new Error('此瀏覽器不支援 Web NFC')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NFC_TIMEOUT_MS)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writer = new (window as any).NDEFReader() as NDEFReader
    await writer.write(
      { records: [{ recordType: 'url', data: url }] },
      { overwrite: true, signal: controller.signal },
    )
  } catch (err) {
    if (controller.signal.aborted)
      throw new Error('NFC 寫入逾時（30 秒），請重試')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
