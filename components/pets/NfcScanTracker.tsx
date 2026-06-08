'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

export function NfcScanTracker({ uuid }: { uuid: string }) {
  useEffect(() => {
    trackEvent('nfc_scan', { uuid })
  }, [uuid])
  return null
}
