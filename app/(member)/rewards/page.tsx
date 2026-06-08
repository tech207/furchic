import type { Metadata } from 'next'
import Link from 'next/link'
import { Crown, TrendingUp, ArrowRight } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: '回饋金與等級',
  description: '了解會員等級制度與回饋金說明',
}

type Level = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: unknown
  sort_order: number
}

function fmtMoney(n: number) {
  return `NT$${n.toLocaleString('zh-TW')}`
}
function fmtPct(r: number) {
  return `${(r * 100).toFixed(0)}%`
}

export default async function RewardsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth')

  const admin = createAdminClient()
  const { data } = await admin
    .from('member_levels')
    .select(
      'id, name, min_spent, reward_rate, discount_rate, benefits, sort_order',
    )
    .order('sort_order', { ascending: true })

  const levels = (data as unknown as Level[]) ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      {/* CTA banner */}
      <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
        <div>
          <p className="font-semibold text-orange-700">
            您目前有 {user.reward_points.toLocaleString('zh-TW')} 點回饋金
          </p>
          <p className="mt-0.5 text-sm text-orange-600/80">
            前往會員中心查看完整紀錄與訂單資訊
          </p>
        </div>
        <Link
          href="/profile"
          className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          會員中心 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Level list */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">等級說明</h2>
        </div>

        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚未設定會員等級</p>
        ) : (
          <div className="grid gap-3">
            {levels.map((lv) => {
              const isCurrent = lv.id === user.member_level_id
              const benefits = Array.isArray(lv.benefits)
                ? (lv.benefits as string[])
                : []

              return (
                <div
                  key={lv.id}
                  className={cn(
                    'space-y-2 rounded-xl border p-4 transition-colors',
                    isCurrent
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-border bg-card',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Crown
                        className={cn(
                          'h-4 w-4',
                          isCurrent ? 'text-orange-500' : 'text-gray-400',
                        )}
                      />
                      <span
                        className={cn(
                          'font-semibold',
                          isCurrent && 'text-orange-600',
                        )}
                      >
                        {lv.name}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          目前等級
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      消費滿 {fmtMoney(lv.min_spent)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>
                      回饋率{' '}
                      <strong className="text-foreground">
                        {fmtPct(lv.reward_rate)}
                      </strong>
                    </span>
                    <span>
                      折扣率{' '}
                      <strong className="text-foreground">
                        {fmtPct(lv.discount_rate)}
                      </strong>
                    </span>
                  </div>

                  {benefits.length > 0 && (
                    <ul className="space-y-0.5 text-sm text-muted-foreground">
                      {benefits.map((b, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-orange-400" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
