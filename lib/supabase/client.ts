import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// NEXT_PUBLIC_* vars must be accessed via literal property access (not dynamic
// process.env[key]) so Next.js can statically inline them into the client bundle.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
  if (!anon) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createBrowserClient<Database>(url, anon)
}
