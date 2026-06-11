'use client'

import type { ReactNode } from 'react'
import { VendorSidebar } from './VendorSidebar'
import { VendorHeader } from './VendorHeader'

export function VendorLayout({
  businessName,
  userEmail,
  permissions,
  children,
}: {
  businessName: string
  userEmail: string
  permissions: string[]
  children: ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <VendorSidebar businessName={businessName} permissions={permissions} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <VendorHeader businessName={businessName} userEmail={userEmail} />
        {/* pb-16 reserves space for mobile tab bar */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
      </div>
    </div>
  )
}
