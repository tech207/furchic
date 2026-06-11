import { withVendorAuth, withVendorPermission } from '@/lib/vendor/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'

// ── GET /api/vendor/staff ─────────────────────────────────────────────────────
// Any authenticated vendor member can see the list; owner-only mutations are
// in the invite and [id] routes.

export const GET = withVendorAuth(async (_req, _ctx, account) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data, error } = await admin
    .from('vendor_accounts')
    .select(
      'id, email, phone, role, permissions, is_active, last_login_at, created_at, users(name, avatar_url)',
    )
    .eq('vendor_id', account.vendor_id)
    .order('role', { ascending: false }) // owner first
    .order('created_at', { ascending: true })

  if (error) return apiError('載入失敗', 500, 'FETCH_FAILED')

  return apiSuccess({
    staff: data ?? [],
    my_id: account.id,
    my_role: account.role,
  })
})
