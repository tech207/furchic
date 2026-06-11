import type { ReactNode } from 'react'
import { getCurrentUser } from '@/lib/auth/session'
import { getCurrentVendorAccount } from '@/lib/vendor/session'
import { VendorLayout } from '@/components/vendor/VendorLayout'

export default async function VendorRootLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getCurrentUser()
  const vendorAccount = user ? await getCurrentVendorAccount() : null

  // Auth pages (or unauthenticated): render bare — no sidebar
  if (!vendorAccount || !user) {
    return <>{children}</>
  }

  const permissions = Array.isArray(vendorAccount.permissions)
    ? vendorAccount.permissions
    : []

  return (
    <VendorLayout
      businessName={
        vendorAccount.vendor?.brand_name ??
        vendorAccount.vendor?.company_name ??
        vendorAccount.email
      }
      userEmail={user.email ?? ''}
      permissions={permissions}
    >
      {children}
    </VendorLayout>
  )
}
