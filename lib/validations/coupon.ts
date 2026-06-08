import { z } from 'zod'

const CODE_RE = /^[A-Z0-9_-]+$/

// ── Coupon ────────────────────────────────────────────────────────────────────

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(1, '請輸入優惠碼')
    .max(50)
    .transform((s) => s.toUpperCase().trim())
    .refine((s) => CODE_RE.test(s), '只允許大寫英文、數字、- 和 _'),
  name: z.string().min(1, '請輸入名稱').max(100),
  type: z.enum(['fixed', 'percent']),
  value: z.number().int().min(1, '折扣值必須大於 0'),
  min_amount: z.number().int().min(0).default(0),
  max_discount: z.number().int().min(1).nullable().optional(),
  is_active: z.boolean().default(true),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  max_uses: z.number().int().min(1).nullable().optional(),
})

export const updateCouponSchema = createCouponSchema
  .omit({ code: true })
  .partial()

export type CreateCouponInput = z.infer<typeof createCouponSchema>
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>
