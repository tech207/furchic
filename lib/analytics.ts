export type EventType =
  | 'page_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_complete'
  | 'nfc_scan'

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = sessionStorage.getItem('_furchic_sid')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('_furchic_sid', id)
  }
  return id
}

export function trackEvent(
  eventType: EventType,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  const sessionId = getSessionId()
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({
      event_type: eventType,
      page_url: window.location.pathname,
      properties: properties ?? null,
    }),
  }).catch(() => {})
}
