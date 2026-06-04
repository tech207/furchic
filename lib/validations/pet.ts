import { z } from 'zod'

export const petSchema = z.object({})

export type PetInput = z.infer<typeof petSchema>
