import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

const ALL_PERMISSIONS = [
  'dashboard',
  'orders',
  'members',
  'products',
  'banners',
  'settings',
  'logistics',
  'payments',
  'policies',
  'faqs',
  'partners',
  'redemption',
  'coupons',
  'promotions',
  'rewards',
  'nfc',
  'print',
  'staff',
] as const

type AdminUserRow = {
  admin_role_id: string | null
  is_active_admin: boolean | null
}
type AdminRoleRow = { name: string; permissions: string[] }

async function getPermissions(userId: string): Promise<string[]> {
  const base = ALL_PERMISSIONS.filter((p) => p !== 'staff')
  try {
    // admin_role_id / is_active_admin are added by migration 008 (S08-A).
    // Casting to any because these columns are not yet in the generated Database type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createAdminClient() as any

    const { data: userRow } = (await client
      .from('users')
      .select('admin_role_id, is_active_admin')
      .eq('id', userId)
      .maybeSingle()) as { data: AdminUserRow | null }

    if (!userRow) return [...base]
    if (userRow.is_active_admin === false) return []
    if (!userRow.admin_role_id) return [...base] // backward-compat: full access

    const { data: roleRow } = (await client
      .from('admin_roles')
      .select('name, permissions')
      .eq('id', userRow.admin_role_id)
      .maybeSingle()) as { data: AdminRoleRow | null }

    if (!roleRow) return [...base]
    if (roleRow.name === 'super_admin') return [...ALL_PERMISSIONS]
    return Array.isArray(roleRow.permissions) ? roleRow.permissions : [...base]
  } catch {
    return [...base]
  }
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'admin') {
    redirect('/auth?next=/admin')
  }

  const permissions = await getPermissions(user.id)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar permissions={permissions} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
