'use client'

import { Skeleton } from '@/components/ui/skeleton'

type Step = {
  name: string
  event: string
  count: number
  rate: number
  conv: number
}

type Props = {
  steps: Step[]
  loading?: boolean
}

// Funnel colors: warm gradient
const FILLS = ['#fb923c', '#f97316', '#ea580c', '#c2410c']

export function ConversionFunnel({ steps, loading }: Props) {
  if (loading) return <Skeleton className="h-52 w-full rounded-xl" />
  if (!steps.length)
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border text-sm text-muted-foreground">
        暫無漏斗資料
      </div>
    )

  const W = 900
  const H = 72
  const GAP = 6
  const MINW = 0.18
  const totalH = steps.length * (H + GAP)

  // Pre-compute widths
  const widths = steps.map((s) => W * Math.max(MINW, s.rate / 100))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: 360 }}
        aria-label="轉換漏斗"
      >
        {steps.map((step, i) => {
          const w = widths[i]
          const wNext = i < steps.length - 1 ? widths[i + 1] : w * 0.7
          const x = (W - w) / 2
          const xN = (W - wNext) / 2
          const y = i * (H + GAP)
          // Trapezoid vertices: top-left → top-right → bottom-right → bottom-left
          const pts = `${x},${y} ${x + w},${y} ${xN + wNext},${y + H} ${xN},${y + H}`

          return (
            <g key={step.event}>
              <polygon points={pts} fill={FILLS[i] ?? '#9a3412'} />

              {/* Step name */}
              <text
                x={W / 2}
                y={y + H / 2 - 7}
                textAnchor="middle"
                fill="white"
                fontSize={15}
                fontWeight="700"
              >
                {step.name}
              </text>

              {/* Count + conv rate */}
              <text
                x={W / 2}
                y={y + H / 2 + 11}
                textAnchor="middle"
                fill="rgba(255,255,255,0.88)"
                fontSize={12}
              >
                {step.count.toLocaleString()} 人
                {i > 0 && `　轉換率 ${step.conv}%`}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend row */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {steps.map((s, i) => (
          <div key={s.event} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: FILLS[i] ?? '#9a3412' }}
            />
            <span>
              {s.name}：{s.count.toLocaleString()}
            </span>
            {i > 0 && (
              <span className="font-medium text-orange-600">({s.conv}%)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
