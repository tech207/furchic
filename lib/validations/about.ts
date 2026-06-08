import { z } from 'zod'

export const faqCategorySchema = z.enum([
  'general',
  'membership',
  'nfc',
  'shipping',
  'payment',
])
export const partnerCategorySchema = z.enum(['brand', 'store', 'enterprise'])

export const createFaqSchema = z.object({
  question: z.string().min(1, '請輸入問題').max(200),
  answer: z.string().min(1, '請輸入答案'),
  category: faqCategorySchema.default('general'),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

export const updateFaqSchema = createFaqSchema.partial()

export const createPartnerSchema = z.object({
  name: z.string().min(1, '請輸入合作夥伴名稱').max(100),
  description: z.string().nullable().optional(),
  logo_url: z.string().url('請輸入有效的圖片網址').nullable().optional(),
  website_url: z.string().url('請輸入有效的網站網址').nullable().optional(),
  category: partnerCategorySchema.default('brand'),
  is_marquee: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

export const updatePartnerSchema = createPartnerSchema.partial()

export const reorderPartnersSchema = z.object({
  items: z
    .array(
      z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }),
    )
    .min(1)
    .max(500),
})

export const updateContactSettingsSchema = z.object({
  email: z.string().email('請輸入有效的 Email').max(100).nullable().optional(),
  line_url: z.string().url('請輸入有效的 LINE 網址').nullable().optional(),
  form_title: z.string().min(1).max(100).optional(),
  form_description: z.string().nullable().optional(),
})

export type CreateFaqInput = z.infer<typeof createFaqSchema>
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>
export type ReorderPartnersInput = z.infer<typeof reorderPartnersSchema>
export type UpdateContactSettingsInput = z.infer<
  typeof updateContactSettingsSchema
>
