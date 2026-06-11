'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function VendorHeader({
  businessName,
  userEmail,
}: {
  businessName: string
  userEmail: string
}) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/vendor/auth')
    router.refresh()
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4 lg:px-6">
      {/* Business name / account switcher */}
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
      >
        {businessName}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-gray-400 sm:block">
          {userEmail}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut className="h-3.5 w-3.5" />
          登出
        </button>
      </div>
    </header>
  )
}
