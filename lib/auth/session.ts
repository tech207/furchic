import { createClient } from '@/lib/supabase/server'

// Mirrors the `users` table schema — update if columns change
export type AppUser = {
  id: string
  name: string
  phone: string | null
  email: string | null
  gender: 'male' | 'female' | 'other' | null
  birthday: string | null
  auth_provider: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  member_level_id: string | null
  reward_points: number
  total_spent: number
  created_at: string
  updated_at: string
}

export class AuthError extends Error {
  readonly code: 'UNAUTHORIZED' | 'FORBIDDEN'
  readonly status: 401 | 403

  constructor(code: 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = code === 'UNAUTHORIZED' ? 401 : 403
  }
}

/**
 * Returns the authenticated user's full profile from the `users` table,
 * or null if the session is missing or invalid.
 *
 * JWT is validated server-side by Supabase; we never trust client-supplied ids.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return profile as unknown as AppUser | null
}

/** Throws {@link AuthError} with code UNAUTHORIZED if no valid session exists. */
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('UNAUTHORIZED', 'Authentication required')
  return user
}

/** Throws {@link AuthError} if the user is not authenticated or is not an admin. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('UNAUTHORIZED', 'Authentication required')
  if (user.role !== 'admin') throw new AuthError('FORBIDDEN', 'Admin access required')
  return user
}
