import { z } from 'zod'

export const userSchema = z.object({})

export type UserInput = z.infer<typeof userSchema>
