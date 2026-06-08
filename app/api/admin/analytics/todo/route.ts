import { withAdmin, apiSuccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

type PrintRow = {
  id: string
  status: string
  source: string
  created_at: string
  pets: { name: string } | null
}
type OrderRow = {
  id: string
  status: string
  total_amount: number
  created_at: string
}
type VariantRow = {
  id: string
  name: string
  sku: string
  stock: number
  low_stock_threshold: number
  products: { name: string } | null
}

export const GET = withAdmin(async () => {
  const admin = createAdminClient()

  const [printsRes, ordersRes, variantsRes] = await Promise.all([
    admin
      .from('card_print_requests')
      .select('id, status, source, created_at, pets(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5),
    admin
      .from('orders')
      .select('id, status, total_amount, created_at')
      .in('status', ['paid', 'processing'])
      .order('created_at', { ascending: true })
      .limit(5),
    admin
      .from('product_variants')
      .select('id, name, sku, stock, low_stock_threshold, products(name)')
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .limit(100),
  ])

  const prints = (printsRes.data as unknown as PrintRow[]) ?? []
  const orders = (ordersRes.data as unknown as OrderRow[]) ?? []
  const variants = (variantsRes.data as unknown as VariantRow[]) ?? []

  const lowStock = variants
    .filter((v) => v.stock <= v.low_stock_threshold)
    .slice(0, 5)

  return apiSuccess({ prints, shipments: orders, low_stock: lowStock })
})
