import { z } from 'zod'

export const createPromotionSchema = z.object({
  name: z.string().min(1, '請輸入名稱').max(100),
  description: z.string().max(500).nullable().optional(),
  discount_type: z.enum(['fixed', 'percent', 'free_shipping']),
  discount_value: z.number().int().min(0),
  condition_type: z.enum(['amount', 'quantity', 'member_level']),
  condition_value: z.number().int().min(0).default(0),
  condition_level_id: z.string().uuid().nullable().optional(),
  is_stackable: z.boolean().default(true),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
})

export const updatePromotionSchema = createPromotionSchema.partial()

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>
