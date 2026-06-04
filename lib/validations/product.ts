import { z } from 'zod'

export const productSchema = z.object({})

export type ProductInput = z.infer<typeof productSchema>
