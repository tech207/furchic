'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X, PawPrint, LogOut, User, ChevronDown } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { label: '首頁', href: '/' },
  { label: '商店', href: '/shop' },
  { label: '關於我們', href: '/about' },
]

const MEMBER_MENU = [
  { label: '我的寵物', href: '/pets', icon: PawPrint },
  { label: '我的帳號', href: '/profile', icon: User },
]

// ── User dropdown ──────────────────────────────────────────────────────────────

function UserDropdown({
  user,
  onLogout,
}: {
  user: SupabaseUser
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    '會員'

  const avatarUrl =
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="max-w-[80px] truncate">{displayName}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border bg-white shadow-lg ring-1 ring-black/5">
          {MEMBER_MENU.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 first:rounded-t-xl hover:bg-orange-50 hover:text-orange-600"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <div className="my-1 border-t" />
          <button
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-2.5 rounded-b-xl px-4 py-2.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            登出
          </button>
        </div>
      )}
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null | undefined>(undefined)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
    router.refresh()
  }

  const resolved = user !== undefined

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-orange-600"
        >
          <span className="text-xl">🐾</span>
          Furchic
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === n.href
                  ? 'text-orange-600'
                  : 'text-gray-600 hover:text-orange-600',
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden min-w-[120px] items-center justify-end gap-2 md:flex">
          {resolved &&
            (user ? (
              <UserDropdown user={user} onLogout={handleLogout} />
            ) : (
              <Link href="/auth">
                <Button size="sm" className="rounded-full">
                  登入 / 註冊
                </Button>
              </Link>
            ))}
        </div>

        {/* Mobile toggle */}
        <button
          className="p-2 text-gray-600 hover:text-orange-600 md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="選單"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="space-y-1 border-t bg-white px-4 py-4 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'block py-2.5 text-sm font-medium transition-colors',
                pathname === n.href ? 'text-orange-600' : 'text-gray-600',
              )}
              onClick={() => setMenuOpen(false)}
            >
              {n.label}
            </Link>
          ))}

          <div className="mt-1 space-y-1 border-t pt-3">
            {resolved &&
              (user ? (
                <>
                  {MEMBER_MENU.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 py-2.5 text-sm font-medium text-gray-700"
                    >
                      <Icon className="h-4 w-4 text-orange-500" />
                      {label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }}
                    className="flex items-center gap-2.5 py-2.5 text-sm text-gray-400 hover:text-red-500"
                  >
                    <LogOut className="h-4 w-4" />
                    登出
                  </button>
                </>
              ) : (
                <Link href="/auth" onClick={() => setMenuOpen(false)}>
                  <Button size="sm" className="w-full rounded-full">
                    登入 / 註冊
                  </Button>
                </Link>
              ))}
          </div>
        </div>
      )}
    </header>
  )
}
