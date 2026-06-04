import { z } from 'zod'

export const couponSchema = z.object({})

export type CouponInput = z.infer<typeof couponSchema>
