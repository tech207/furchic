'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

type DataPoint = { date: string; count: number; revenue: number }

type Props = {
  data: DataPoint[]
  loading?: boolean
}

function fmtRevenue(v: number): string {
  return v >= 10000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
}

export function OrderTrendChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (!data.length)
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        暫無訂單資料
      </div>
    )

  const formatted = data.map((d) => ({ ...d, label: d.date.slice(5) }))

  return (
    <ResponsiveContainer width="100%" height={256}>
      <ComposedChart
        data={formatted}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="rev"
          orientation="left"
          tick={{ fontSize: 11 }}
          tickFormatter={fmtRevenue}
          width={48}
        />
        <YAxis
          yAxisId="cnt"
          orientation="right"
          tick={{ fontSize: 11 }}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          formatter={(v: unknown, name: string) =>
            name === 'revenue'
              ? [`NT$${Number(v).toLocaleString()}`, '營業額']
              : [`${v}`, '訂單數']
          }
          labelFormatter={(l) => `日期：${l}`}
        />
        <Legend formatter={(v) => (v === 'revenue' ? '營業額' : '訂單數')} />
        <Line
          yAxisId="rev"
          type="monotone"
          dataKey="revenue"
          stroke="#f97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="cnt"
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
