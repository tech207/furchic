import { z } from 'zod'

export const PUBLIC_FIELDS_WHITELIST = [
  'name',
  'breed',
  'gender',
  'birthday',
  'is_neutered',
  'chip_id',
  'photo',
  'vet_hospital',
  'special_care',
  'special_care_note',
] as const

export type PublicField = (typeof PUBLIC_FIELDS_WHITELIST)[number]

// These fields are always public and cannot be hidden
export const ALWAYS_PUBLIC_FIELDS: string[] = ['vet_hospital', 'special_care']

const notFutureDate = (val: string | undefined | null) => {
  if (!val) return true
  const d = new Date(val)
  return !isNaN(d.getTime()) && d <= new Date()
}

export const createPetSchema = z
  .object({
    name: z.string().min(1, '寵物名稱必填').max(50, '名稱最多 50 字'),
    breed: z.string().max(100).optional(),
    gender: z.enum(['male', 'female']).optional(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正確')
      .optional(),
    is_neutered: z.boolean().default(false),
    chip_id: z.string().max(50).optional(),
    vet_hospital: z.string().min(1, '就醫醫院必填'),
    special_care: z.boolean().default(false),
    special_care_note: z.string().optional(),
    photo_url: z.string().url('請輸入有效的圖片 URL').optional(),
  })
  .refine((d) => notFutureDate(d.birthday), {
    message: '生日不能是未來日期',
    path: ['birthday'],
  })

export const updatePetSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    breed: z.string().max(100).nullable().optional(),
    gender: z.enum(['male', 'female']).nullable().optional(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    is_neutered: z.boolean().optional(),
    chip_id: z.string().max(50).nullable().optional(),
    vet_hospital: z.string().min(1).optional(),
    special_care: z.boolean().optional(),
    special_care_note: z.string().nullable().optional(),
    photo_url: z.string().url().nullable().optional(),
    ai_photo_url: z.string().url().nullable().optional(),
  })
  .refine((d) => notFutureDate(d.birthday), {
    message: '生日不能是未來日期',
    path: ['birthday'],
  })

export const privacyUpdateSchema = z.object({
  public_fields: z.array(z.string()),
})

export const cardStatusUpdateSchema = z.object({
  status: z.enum(['active', 'disabled']),
})

export const contactMethodSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['phone', 'line', 'instagram', 'facebook', 'other']),
  label: z.string().max(30),
  value: z.string().max(100),
  is_public: z.boolean(),
})

export const updateCaregiverSchema = z.object({
  display_name: z.string().max(50).nullable().optional(),
  contact_methods: z.array(contactMethodSchema).max(10).optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})
