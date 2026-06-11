import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthError } from '@/lib/auth/session'

// ── Types ──────────────────────────────────────────────────────────────────────
// Mirrors V-A01_vendor_foundation.sql schema

export type Vendor = {
  id: string
  company_name: string
  brand_name: string
  vendor_type: 'permanent' | 'flash'
  contact_email: string
  contact_phone: string
  logo_url: string | null
  category: string | null
  status: 'pending' | 'approved' | 'suspended' | 'rejected'
  default_commission_rate: number
  created_at: string
  updated_at: string
}

export type VendorAccount = {
  id: string
  vendor_id: string
  user_id: string
  email: string
  phone: string
  role: 'owner' | 'staff'
  permissions: string[]
  is_active: boolean
  last_login_at: string | null
  created_at: string
  vendor: Vendor
}

// ── Session helpers ────────────────────────────────────────────────────────────

export async function getCurrentVendorAccount(): Promise<VendorAccount | null> {
  const supabase = createClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) return null

  // Use admin client to bypass RLS (avoids the SECURITY DEFINER circular issue
  // when calling from outside a policy context)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('vendor_accounts')
    .select('*, vendor:vendors(*)')
    .eq('user_id', authUser.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return null
  return data as VendorAccount
}

export async function requireVendorAuth(): Promise<VendorAccount> {
  const account = await getCurrentVendorAccount()
  if (!account) {
    throw new AuthError('UNAUTHORIZED', 'Vendor authentication required')
  }
  return account
}

export async function getVendorPermissions(): Promise<string[]> {
  const account = await getCurrentVendorAccount()
  if (!account) return []
  return Array.isArray(account.permissions) ? account.permissions : []
}
