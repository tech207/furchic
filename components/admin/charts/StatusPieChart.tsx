'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

type DataPoint = { status: string; label: string; count: number }

const COLORS = [
  '#f97316',
  '#3b82f6',
  '#8b5cf6',
  '#22c55e',
  '#10b981',
  '#6b7280',
  '#ef4444',
]

type Props = {
  data: DataPoint[]
  loading?: boolean
}

export function StatusPieChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!data.length)
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        暫無訂單資料
      </div>
    )

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="42%"
          outerRadius={75}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: unknown) => [`${v} 筆`, '訂單數']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
