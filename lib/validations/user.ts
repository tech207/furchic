import { z } from 'zod'

// ── Password ───────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, '密碼至少 8 字元')
  .regex(/[a-zA-Z]/, '密碼須包含英文字母')
  .regex(/[0-9]/, '密碼須包含數字')

// ── Email auth ─────────────────────────────────────────────────────────────────

export const emailLoginSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  password: z.string().min(1, '請輸入密碼'),
})
export type EmailLoginInput = z.infer<typeof emailLoginSchema>

export const emailRegisterSchema = z
  .object({
    email: z.string().email('請輸入有效的 Email'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '兩次密碼不一致',
    path: ['confirmPassword'],
  })
export type EmailRegisterInput = z.infer<typeof emailRegisterSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ── Profile setup ──────────────────────────────────────────────────────────────

export const profileSetupSchema = z.object({
  name: z.string().min(1, '請輸入姓名').max(50, '姓名最多 50 字'),
  phone: z
    .string()
    .regex(/^09\d{8}$/, '請輸入有效的手機號碼（例如：0912345678）'),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正確')
    .optional()
    .or(z.literal('')),
})
export type ProfileSetupInput = z.infer<typeof profileSetupSchema>

// ── User update (general) ──────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z
    .string()
    .regex(/^09\d{8}$/, '請輸入有效的手機號碼')
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  avatar_url: z.string().url().optional().or(z.literal('')),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>
