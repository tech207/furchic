'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  CreditCard,
  Gift,
  Handshake,
  HelpCircle,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Nfc,
  Package,
  Percent,
  Printer,
  ScrollText,
  Settings,
  ShoppingBag,
  Tag,
  Ticket,
  Truck,
  Users,
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
    title: '業務管理',
    items: [
      {
        label: '訂單管理',
        href: '/admin/orders',
        icon: ShoppingBag,
        permission: 'orders',
      },
      {
        label: '會員管理',
        href: '/admin/members',
        icon: Users,
        permission: 'members',
      },
      { label: 'NFC 卡管理', href: '/admin/nfc', icon: Nfc, permission: 'nfc' },
      {
        label: '列印管理',
        href: '/admin/print',
        icon: Printer,
        permission: 'print',
      },
    ],
  },
  {
    title: '商品管理',
    items: [
      {
        label: '商品列表',
        href: '/admin/products',
        icon: Package,
        permission: 'products',
      },
      {
        label: '優惠券',
        href: '/admin/coupons',
        icon: Tag,
        permission: 'coupons',
      },
      {
        label: '促銷活動',
        href: '/admin/promotions',
        icon: Megaphone,
        permission: 'promotions',
      },
      {
        label: '兌換碼',
        href: '/admin/redemption-codes',
        icon: Ticket,
        permission: 'redemption',
      },
      {
        label: '回饋金',
        href: '/admin/rewards',
        icon: Gift,
        permission: 'rewards',
      },
      {
        label: '折扣管理',
        href: '/admin/discounts',
        icon: Percent,
        permission: 'promotions',
      },
      {
        label: '物流管理',
        href: '/admin/logistics',
        icon: Truck,
        permission: 'logistics',
      },
      {
        label: '金流管理',
        href: '/admin/payments',
        icon: CreditCard,
        permission: 'payments',
      },
    ],
  },
  {
    title: '內容管理',
    items: [
      {
        label: 'Banner 管理',
        href: '/admin/banners',
        icon: ImageIcon,
        permission: 'banners',
      },
      {
        label: '合作夥伴',
        href: '/admin/partners',
        icon: Handshake,
        permission: 'partners',
      },
      {
        label: '關於我們',
        href: '/admin/about',
        icon: Building2,
        permission: 'policies',
      },
      {
        label: 'FAQ 管理',
        href: '/admin/faqs',
        icon: HelpCircle,
        permission: 'faqs',
      },
      {
        label: '服務政策',
        href: '/admin/policies',
        icon: ScrollText,
        permission: 'policies',
      },
    ],
  },
  {
    title: '系統',
    items: [
      {
        label: '人員管理',
        href: '/admin/staff',
        icon: Users2,
        permission: 'staff',
      },
    ],
  },
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
          ? 'bg-orange-50 text-orange-600'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-orange-600')} />
      {item.label}
    </Link>
  )
}

// ── AdminSidebar ──────────────────────────────────────────────────────────────

export function AdminSidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname()

  const canAccess = (permission?: string) =>
    !permission || permissions.includes(permission)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/admin"
          className="flex items-center gap-2 font-extrabold text-orange-600"
        >
          🐾 Furchic Admin
        </Link>
      </div>

      {/* Dashboard */}
      <div className="px-3 pt-4">
        <Link
          href="/admin"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/admin'
              ? 'bg-orange-50 text-orange-600'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
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

      {/* Footer — Settings */}
      <div className="border-t px-3 py-3">
        <Link
          href="/admin/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/admin/settings')
              ? 'bg-orange-50 text-orange-600'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          系統設定
        </Link>
      </div>
    </aside>
  )
}
