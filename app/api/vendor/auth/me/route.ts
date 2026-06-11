import { withVendorAuth } from '@/lib/vendor/guards'
import { apiSuccess } from '@/lib/auth/guards'

export const GET = withVendorAuth(async (_req, _ctx, account) => {
  return apiSuccess({
    vendor_account: {
      id: account.id,
      vendor_id: account.vendor_id,
      email: account.email,
      phone: account.phone,
      role: account.role,
      is_active: account.is_active,
      last_login_at: account.last_login_at,
      created_at: account.created_at,
    },
    vendor: account.vendor,
    permissions: Array.isArray(account.permissions) ? account.permissions : [],
  })
})
