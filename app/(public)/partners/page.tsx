'use client'

import { useEffect, useState } from 'react'
import { Mail, Handshake, Globe, Loader2 } from 'lucide-react'
import type { Partner, PartnerCategory } from '@/types/database'

// ── Constants ─────────────────────────────────────────────────────────────────

type Tab = 'all' | PartnerCategory

const TABS: { value: Tab; label: string; desc: string }[] = [
  { value: 'all', label: '全部', desc: '所有合作夥伴' },
  {
    value: 'brand',
    label: '品牌聯名',
    desc: '與 Furchic 聯名推出限定款 NFC 寵物智能卡，讓您的品牌走進每一個寵物家庭。',
  },
  {
    value: 'store',
    label: '通路合作',
    desc: '透過您的通路銷售 Furchic 產品，共享寵物市場的龐大商機。',
  },
  {
    value: 'enterprise',
    label: '動物醫院・寵物店',
    desc: '成為 Furchic 認證合作夥伴，為您的客戶提供更完整的寵物安全解決方案。',
  },
]

const CATEGORY_COLORS: Record<PartnerCategory, string> = {
  brand: 'bg-purple-100 text-purple-600',
  store: 'bg-blue-100 text-blue-600',
  enterprise: 'bg-green-100 text-green-600',
}

// ── Partner card ──────────────────────────────────────────────────────────────

function PartnerCard({ p }: { p: Partner }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md">
      {/* Logo */}
      <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border bg-gray-50">
        {p.logo_url ? (
          <img
            src={p.logo_url}
            alt={p.name}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <span className="text-2xl font-bold text-gray-300">
            {p.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Name */}
      <div>
        <p className="font-semibold text-gray-900">{p.name}</p>
        {p.description && (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-400">
            {p.description}
          </p>
        )}
      </div>

      {/* Link */}
      {p.website_url && (
        <a
          href={p.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600"
        >
          <Globe className="h-3.5 w-3.5" />
          前往官網
        </a>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((j: { data?: { partners: Partner[] } }) => {
        setPartners(j.data?.partners ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered =
    tab === 'all' ? partners : partners.filter((p) => p.category === tab)
  const activeTab = TABS.find((t) => t.value === tab)!

  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-b from-orange-50 to-white py-20 text-center">
        <div className="container mx-auto max-w-2xl px-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100">
            <Handshake className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            合作夥伴
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-500">
            感謝所有與 Furchic 攜手同行的夥伴，
            <br />
            讓我們一起守護每一個毛孩的美好生活。
          </p>
        </div>
      </section>

      {/* Tab bar */}
      <div className="sticky top-16 z-30 border-b bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`shrink-0 border-b-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                tab === t.value
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-orange-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-12">
        {/* Tab description */}
        {tab !== 'all' && (
          <div className="mb-8 rounded-xl bg-orange-50 px-5 py-4 text-sm text-gray-600">
            <span
              className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[tab as PartnerCategory]}`}
            >
              {activeTab.label}
            </span>
            {activeTab.desc}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            <Handshake className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>此分類目前尚無合作夥伴</p>
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <PartnerCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-16 rounded-2xl bg-gray-50 py-12 text-center">
          <Mail className="mx-auto mb-3 h-10 w-10 text-orange-400" />
          <h2 className="mb-2 text-lg font-bold text-gray-900">有合作意向？</h2>
          <p className="mb-5 text-sm text-gray-500">
            請透過以下 Email 聯絡我們，我們將在 2 個工作天內回覆您。
          </p>
          <a
            href="mailto:partner@furchic.com"
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            partner@furchic.com
          </a>
        </div>
      </div>
    </main>
  )
}
