import { Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductPriceDraftData = {
  sale_price: number
  variant_id: string
  product_name?: string
  variant_name?: string
  base_price?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `NT$ ${n.toLocaleString('zh-TW')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductPricePreview({ data }: { data: ProductPriceDraftData }) {
  const hasBase = typeof data.base_price === 'number'
  const savings = hasBase ? data.base_price! - data.sale_price : null
  const pct =
    savings && data.base_price
      ? Math.round((savings / data.base_price) * 100)
      : null

  return (
    <div className="mx-auto max-w-sm space-y-6">
      {/* Card */}
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        {/* Image placeholder */}
        <div className="relative flex h-56 flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-50 to-amber-100">
          <Tag className="h-10 w-10 text-orange-300" />
          <p className="text-sm font-medium text-orange-400">商品圖片</p>
          <Badge className="absolute right-3 top-3 border-0 bg-rose-500 text-white hover:bg-rose-500">
            特價中
          </Badge>
        </div>

        {/* Info */}
        <div className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold leading-tight">
              {data.product_name ?? '商品名稱'}
            </p>
            {data.variant_name && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {data.variant_name}
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="space-y-1">
            {hasBase && (
              <p className="text-sm text-muted-foreground line-through">
                原價 {fmt(data.base_price!)}
              </p>
            )}
            <p className="text-2xl font-bold text-rose-600">
              {fmt(data.sale_price)}
            </p>
            {savings !== null && savings > 0 && (
              <p className="text-xs font-medium text-green-600">
                節省 {fmt(savings)}
                {pct !== null && `（${pct}% off）`}
              </p>
            )}
          </div>

          {/* Variant ID for reference */}
          <p className="font-mono text-[11px] text-muted-foreground/60">
            Variant: {data.variant_id}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        ✦ 以上為草稿特價預覽，尚未正式生效
      </p>
    </div>
  )
}
