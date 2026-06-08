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

type DataPoint = {
  product_id: string
  name: string
  total_sold: number
  revenue: number
}

type Props = {
  data: DataPoint[]
  loading?: boolean
}

export function ProductRankChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-72 w-full rounded-xl" />
  if (!data.length)
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        暫無銷售資料
      </div>
    )

  const formatted = data.map((d) => ({
    ...d,
    label: d.name.length > 14 ? d.name.slice(0, 14) + '…' : d.name,
  }))

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(200, data.length * 36 + 32)}
    >
      <BarChart
        layout="vertical"
        data={formatted}
        margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f0f0f0"
          horizontal={false}
        />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(v: unknown, name: string) =>
            name === 'total_sold'
              ? [`${v} 件`, '銷售數量']
              : [`NT$${Number(v).toLocaleString()}`, '銷售金額']
          }
        />
        <Bar
          dataKey="total_sold"
          fill="#f97316"
          radius={[0, 3, 3, 0]}
          maxBarSize={28}
          label={{ position: 'right', fontSize: 11 }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
