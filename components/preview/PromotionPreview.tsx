import type { ReactNode } from 'react'
import { Gift, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PromotionDraftData = {
  name: string
  description?: string | null
  discount_type: 'fixed' | 'percent' | 'free_shipping'
  discount_value: number
  condition_type: 'amount' | 'quantity' | 'member_level'
  condition_value: number
  condition_level_id?: string | null
  is_stackable?: boolean
  is_active?: boolean
  starts_at?: string | null
  expires_at?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDiscount(
  type: PromotionDraftData['discount_type'],
  value: number,
): string {
  if (type === 'fixed') return `折 NT$ ${value.toLocaleString()}`
  if (type === 'percent') return `折 ${value}%`
  if (type === 'free_shipping') return '免運費'
  return '—'
}

function fmtCondition(
  type: PromotionDraftData['condition_type'],
  value: number,
): string {
  if (type === 'amount') return `消費滿 NT$ ${value.toLocaleString()}`
  if (type === 'quantity') return `數量 ≥ ${value} 件`
  if (type === 'member_level') return '指定會員等級'
  return '—'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const TYPE_ICON: Record<PromotionDraftData['discount_type'], ReactNode> = {
  fixed: <Gift className="h-5 w-5 text-orange-500" />,
  percent: <Sparkles className="h-5 w-5 text-purple-500" />,
  free_shipping: <Gift className="h-5 w-5 text-teal-500" />,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PromotionPreview({ data }: { data: PromotionDraftData }) {
  const isActive = data.is_active ?? true

  return (
    <div className="mx-auto max-w-lg">
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-3 border-b bg-gradient-to-br from-orange-50 to-amber-50 px-6 py-5">
          <div className="mt-0.5 shrink-0">{TYPE_ICON[data.discount_type]}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold leading-tight text-foreground">
                {data.name}
              </h2>
              {isActive ? (
                <Badge className="border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
                  啟用中
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  未啟用
                </Badge>
              )}
            </div>
            {data.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="divide-y text-sm">
          <Row
            label="折扣方式"
            value={fmtDiscount(data.discount_type, data.discount_value)}
          />
          <Row
            label="使用條件"
            value={fmtCondition(data.condition_type, data.condition_value)}
          />
          {data.condition_type === 'member_level' &&
            data.condition_level_id && (
              <Row label="指定等級" value={data.condition_level_id} mono />
            )}
          <Row
            label="可疊加使用"
            value={data.is_stackable ? '✓ 可與其他促銷合併' : '✗ 不可疊加'}
          />
          <Row
            label="有效期間"
            value={
              data.starts_at || data.expires_at
                ? `${data.starts_at ? fmtDate(data.starts_at) : '即日起'} → ${data.expires_at ? fmtDate(data.expires_at) : '無限期'}`
                : '無期限'
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>此為草稿預覽，尚未正式對顧客生效</span>
        </div>
      </div>
    </div>
  )
}

// ── Helper sub-component ──────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-3.5">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs' : 'font-medium'}>
        {value}
      </span>
    </div>
  )
}
