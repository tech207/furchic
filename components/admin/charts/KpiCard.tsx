'use client'

import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  value: string | number
  changePct?: number
  loading?: boolean
  onClick?: () => void
  icon?: ReactNode
  subtitle?: string
}

export function KpiCard({
  title,
  value,
  changePct,
  loading,
  onClick,
  icon,
  subtitle,
}: Props) {
  if (loading) return <Skeleton className="h-28 rounded-xl" />

  const isPositive = (changePct ?? 0) >= 0
  const hasChange = changePct !== undefined

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-xl border bg-card p-5 transition-all',
        onClick && 'cursor-pointer hover:border-orange-300 hover:shadow-sm',
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums leading-none">
          {value}
        </span>
        {hasChange && (
          <div
            className={cn(
              'flex items-center gap-0.5 pb-0.5 text-sm font-semibold',
              isPositive ? 'text-green-600' : 'text-red-500',
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {Math.abs(changePct)}%
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {subtitle ?? (hasChange ? 'vs 昨日' : '')}
      </p>
    </div>
  )
}
