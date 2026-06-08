'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

type DataPoint = { date: string; count: number }

type Props = {
  data: DataPoint[]
  loading?: boolean
}

export function MemberGrowthChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!data.length)
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        暫無會員資料
      </div>
    )

  const formatted = data.map((d) => ({ ...d, label: d.date.slice(5) }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart
        data={formatted}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
        <Tooltip
          formatter={(v: unknown) => [`${v} 人`, '新增會員']}
          labelFormatter={(l) => `日期：${l}`}
        />
        <Bar
          dataKey="count"
          fill="#f97316"
          radius={[3, 3, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
