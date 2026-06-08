type Entry = { count: number; resetAt: number }
const stores = new Map<string, Map<string, Entry>>()

export function createRateLimiter(name: string, max: number, windowMs: number) {
  if (!stores.has(name)) stores.set(name, new Map())
  const store = stores.get(name)!
  return function isLimited(key: string): boolean {
    const now = Date.now()
    const entry = store.get(key)
    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return false
    }
    if (entry.count >= max) return true
    entry.count++
    return false
  }
}
