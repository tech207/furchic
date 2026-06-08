import { z } from 'zod'

// ── Query params ──���────────────────────────────────────────────────────────────

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  search: z.string().max(200).default(''),
})

// ── Product ─────────���────────────────────────────────���─────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1, '請輸入商品名稱').max(200),
  description: z.string().max(5000).nullable().optional(),
  base_price: z.number().int().min(0, '價格不可為負'),
  images: z.array(z.string().url()).max(10).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
})

export const updateProductSchema = createProductSchema.partial()

// ── Variant ───────────────────────────────────────────────────────────────────

const SKU_RE = /^[A-Za-z0-9_-]+$/

const variantOptionSchema = z.object({
  option_name: z.string().min(1).max(50),
  option_value: z.string().min(1).max(100),
})

export const createVariantSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100).regex(SKU_RE, 'SKU 只允許英文、數字、- 和 _'),
  price: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(5),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  is_preorder: z.boolean().default(false),
  preorder_note: z.string().max(200).nullable().optional(),
  options: z.array(variantOptionSchema).max(10).optional(),
})

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(SKU_RE, 'SKU 只允許英文、數字、- 和 _')
    .optional(),
  price: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_preorder: z.boolean().optional(),
  preorder_note: z.string().max(200).nullable().optional(),
})

// ── Stock ��────────────────────────────────────────────────────────────────────

export const stockAdjustSchema = z.object({
  variant_id: z.string().uuid(),
  change: z
    .number()
    .int()
    .refine((n) => n !== 0, '變更量不可為 0'),
  reason: z.enum(['manual', 'order', 'return', 'adjustment']),
  note: z.string().max(500).optional(),
})

// ── Reorder ────────���──────────────────────────────────────────────────────────

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }),
    )
    .min(1)
    .max(500),
})

// ── Types ───��───────────────────────────────��─────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateVariantInput = z.infer<typeof createVariantSchema>
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>
export type ReorderInput = z.infer<typeof reorderSchema>
