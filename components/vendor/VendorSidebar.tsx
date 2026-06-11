'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Users2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  permission?: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    title: '業務',
    items: [
      {
        label: '訂單管理',
        href: '/vendor/orders',
        icon: ShoppingBag,
        permission: 'orders',
      },
    ],
  },
  {
    title: '商品',
    items: [
      {
        label: '商品列表',
        href: '/vendor/products',
        icon: Package,
        permission: 'products',
      },
    ],
  },
  {
    title: '分析',
    items: [
      {
        label: '報表分析',
        href: '/vendor/reports',
        icon: BarChart3,
        permission: 'reports',
      },
    ],
  },
  {
    title: '管理',
    items: [
      {
        label: '商家設定',
        href: '/vendor/settings',
        icon: Settings,
      },
      {
        label: '員工帳號',
        href: '/vendor/settings/staff',
        icon: Users2,
        permission: 'staff',
      },
    ],
  },
]

const MOBILE_TABS: NavItem[] = [
  { label: '儀表板', href: '/vendor', icon: LayoutDashboard },
  {
    label: '商品',
    href: '/vendor/products',
    icon: Package,
    permission: 'products',
  },
  {
    label: '訂單',
    href: '/vendor/orders',
    icon: ShoppingBag,
    permission: 'orders',
  },
  { label: '設定', href: '/vendor/settings', icon: Settings },
]

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

// ── VendorSidebar ─────────────────────────────────────────────────────────────

export function VendorSidebar({
  businessName,
  permissions,
}: {
  businessName: string
  permissions: string[]
}) {
  const pathname = usePathname()

  const canAccess = (permission?: string) =>
    !permission || permissions.includes(permission)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-60 shrink-0 flex-col bg-gray-800 lg:flex">
        {/* Brand */}
        <div className="flex h-14 items-center border-b border-gray-700 px-4">
          <Link
            href="/vendor"
            className="flex items-center gap-2 text-sm font-bold text-white"
          >
            🏪 {businessName}
          </Link>
        </div>

        {/* Dashboard */}
        <div className="px-3 pt-4">
          <Link
            href="/vendor"
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/vendor'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200',
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            儀表板
          </Link>
        </div>

        {/* Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter((item) =>
              canAccess(item.permission),
            )
            if (!visible.length) return null
            return (
              <div key={group.title} className="mb-4">
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-700 bg-gray-900 lg:hidden">
        {MOBILE_TABS.filter((t) => canAccess(t.permission)).map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/vendor'
              ? pathname === '/vendor'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-indigo-400'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
