import { z } from 'zod'

export const orderSchema = z.object({})

export type OrderInput = z.infer<typeof orderSchema>
