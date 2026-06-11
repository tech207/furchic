import { z } from 'zod'

// ── Shared ─────────────────────────────────────────────────────────────────────

const twPhone = z
  .string()
  .regex(/^09\d{8}$/, '請輸入有效的手機號碼（09 開頭，共 10 碼）')

const passwordSchema = z
  .string()
  .min(8, '密碼至少 8 字元')
  .regex(/[a-zA-Z]/, '密碼須包含英文字母')
  .regex(/[0-9]/, '密碼須包含數字')

export const VENDOR_CATEGORIES = [
  { value: 'pet_food', label: '寵物食品' },
  { value: 'pet_supplies', label: '寵物用品' },
  { value: 'grooming', label: '美容護理' },
  { value: 'medical', label: '醫療健康' },
  { value: 'lifestyle', label: '生活風格' },
  { value: 'other', label: '其他' },
] as const

export const vendorCategoryValues = VENDOR_CATEGORIES.map((c) => c.value) as [
  string,
  ...string[],
]

// ── Apply（申請進駐）──────────────────────────────────────────────────────────

export const vendorApplySchema = z.object({
  company_name: z.string().min(1, '請輸入公司名稱').max(100),
  brand_name: z.string().min(1, '請輸入品牌名稱').max(100),
  contact_name: z.string().min(1, '請輸入負責人姓名').max(50),
  contact_email: z.string().email('請輸入正確的 Email 格式'),
  contact_phone: twPhone,
  company_phone: z.string().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal('')),
  category: z.enum(vendorCategoryValues as [string, ...string[]], {
    errorMap: () => ({ message: '請選擇商家類別' }),
  }),
  website_url: z
    .string()
    .url('請輸入正確的網址格式')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(500, '描述最多 500 字')
    .optional()
    .or(z.literal('')),
  agreed_to_terms: z.literal(true, {
    errorMap: () => ({ message: '請同意服務條款' }),
  }),
})
export type VendorApplyInput = z.infer<typeof vendorApplySchema>

// ── Login（廠商登入）──────────────────────────────────────────────────────────

export const vendorLoginSchema = z.object({
  email: z.string().email('請輸入正確的 Email'),
  password: z.string().min(1, '請輸入密碼'),
})
export type VendorLoginInput = z.infer<typeof vendorLoginSchema>

// ── Setup Password（設定初始密碼）─────────────────────────────────────────────

export const vendorSetupPasswordSchema = z
  .object({
    token: z.string().min(1, '缺少驗證 Token'),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: '兩次密碼不一致',
    path: ['confirm_password'],
  })
export type VendorSetupPasswordInput = z.infer<typeof vendorSetupPasswordSchema>

// ── Admin Reject ───────────────────────────────────────────────────────────────

export const adminRejectVendorSchema = z.object({
  reason: z.string().min(1, '請填寫拒絕原因').max(500),
})
export type AdminRejectVendorInput = z.infer<typeof adminRejectVendorSchema>
