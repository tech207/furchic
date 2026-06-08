'use client'

import { useState } from 'react'
import { ChevronDown, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Faq = {
  id: string
  question: string
  answer: string
  category: string
  sort_order: number
}

type Category = {
  value: string
  label: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { value: 'all', label: '全部' },
  { value: 'nfc', label: 'NFC 卡' },
  { value: 'membership', label: '會員' },
  { value: 'shipping', label: '運送' },
  { value: 'payment', label: '付款' },
]

// ── Accordion Item ────────────────────────────────────────────────────────────

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: Faq
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white transition-shadow',
        isOpen
          ? 'border-orange-200 shadow-md'
          : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            'text-base font-semibold leading-snug transition-colors',
            isOpen ? 'text-orange-600' : 'text-gray-900',
          )}
        >
          {faq.question}
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300',
            isOpen && 'rotate-180 text-orange-500',
          )}
        />
      </button>

      {/* CSS grid-template-rows transition — smoothest approach */}
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-7 text-gray-600">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FaqSection({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered =
    activeCategory === 'all'
      ? initialFaqs
      : initialFaqs.filter((f) => f.category === activeCategory)

  function handleTabChange(cat: string) {
    setActiveCategory(cat)
    setOpenId(null)
  }

  return (
    <div>
      {/* Category Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => handleTabChange(cat.value)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200',
              activeCategory === cat.value
                ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-600',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <MessageCircle className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            此分類目前沒有問題，請聯絡我們
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq) => (
            <AccordionItem
              key={faq.id}
              faq={faq}
              isOpen={openId === faq.id}
              onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
