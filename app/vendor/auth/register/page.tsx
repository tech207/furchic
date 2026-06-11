'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Store,
} from 'lucide-react'
import Link from 'next/link'
import {
  VENDOR_CATEGORIES,
  vendorCategoryValues,
} from '@/lib/validations/vendor'

// ── Step schemas ───────────────────────────────────────────────────────────────

const step1Schema = z.object({
  company_name: z.string().min(1, '請輸入公司名稱').max(100),
  brand_name: z.string().min(1, '請輸入品牌名稱').max(100),
  tax_id: z.string().optional().or(z.literal('')),
  category: z.enum(vendorCategoryValues as [string, ...string[]], {
    errorMap: () => ({ message: '請選擇商家類別' }),
  }),
  website_url: z
    .string()
    .url('請輸入正確的網址格式')
    .optional()
    .or(z.literal('')),
})

const step2Schema = z.object({
  contact_name: z.string().min(1, '請輸入負責人姓名').max(50),
  contact_email: z.string().email('請輸入正確的 Email 格式'),
  contact_phone: z
    .string()
    .regex(/^09\d{8}$/, '請輸入有效的手機號碼（09 開頭，共 10 碼）'),
  company_phone: z.string().optional().or(z.literal('')),
  description: z.string().max(500, '最多 500 字').optional().or(z.literal('')),
})

const step3Schema = z.object({
  agreed_to_terms: z.boolean().refine((v) => v === true, '請同意服務條款'),
})

type Step1Input = z.infer<typeof step1Schema>
type Step2Input = z.infer<typeof step2Schema>
type Step3Input = z.infer<typeof step3Schema>

// ── Small UI helpers ───────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-400">{message}</p>
}

function Label({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block text-sm font-medium text-gray-300">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  )
}

function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1.5 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${className}`}
    />
  )
}

function Select({
  className = '',
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`mt-1.5 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
    />
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              s < current
                ? 'bg-indigo-600 text-white'
                : s === current
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900'
                  : 'bg-gray-700 text-gray-500'
            }`}
          >
            {s < current ? <CheckCircle2 className="h-4 w-4" /> : s}
          </div>
          {s < total && (
            <div
              className={`h-px w-8 ${s < current ? 'bg-indigo-600' : 'bg-gray-700'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type AccumulatedData = Partial<Step1Input & Step2Input>

export default function VendorRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accumulated, setAccumulated] = useState<AccumulatedData>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ── Step 1 form ──────────────────────────────────────────────────────────────
  const form1 = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: accumulated,
    mode: 'onBlur',
  })

  // ── Step 2 form ──────────────────────────────────────────────────────────────
  const form2 = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: accumulated,
    mode: 'onBlur',
  })

  // ── Step 3 form ──────────────────────────────────────────────────────────────
  const form3 = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: { agreed_to_terms: false },
  })

  function onStep1(data: Step1Input) {
    setAccumulated((prev) => ({ ...prev, ...data }))
    setStep(2)
  }

  function onStep2(data: Step2Input) {
    setAccumulated((prev) => ({ ...prev, ...data }))
    setStep(3)
  }

  async function onStep3(data: Step3Input) {
    if (!data.agreed_to_terms) return
    setSubmitError(null)
    setSubmitting(true)

    try {
      const payload = { ...accumulated, agreed_to_terms: true }
      const res = await fetch('/api/vendor/auth/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        setSubmitError(json.message ?? '申請失敗，請稍後再試')
        return
      }
      setDone(true)
    } catch {
      setSubmitError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const categoryLabel =
    VENDOR_CATEGORIES.find((c) => c.value === accumulated.category)?.label ?? ''

  // ── Success state ────────────────────────────────────────────────────────────

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50 ring-2 ring-green-600">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">申請已送出！</h2>
          <p className="mt-3 text-sm text-gray-400">
            我們將在 3-5 個工作天內完成審核，
            <br />
            審核結果將寄送至{' '}
            <strong className="text-white">{accumulated.contact_email}</strong>
          </p>
          <button
            type="button"
            onClick={() => router.push('/vendor/auth')}
            className="mt-8 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            返回登入頁
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg">
            <Store className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">申請廠商進駐</h1>
        </div>

        <StepIndicator current={step} total={3} />

        <div className="rounded-2xl bg-gray-800 p-8 ring-1 ring-gray-700">
          {/* ── Step 1：基本資訊 ───────────────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={form1.handleSubmit(onStep1)} noValidate>
              <h2 className="mb-6 text-base font-semibold text-white">
                基本資訊
              </h2>
              <div className="space-y-4">
                <div>
                  <Label required>公司名稱</Label>
                  <Input
                    placeholder="例：毛孩生活股份有限公司"
                    {...form1.register('company_name')}
                  />
                  <FieldError
                    message={form1.formState.errors.company_name?.message}
                  />
                </div>
                <div>
                  <Label required>品牌名稱</Label>
                  <Input
                    placeholder="例：Pawsome Life"
                    {...form1.register('brand_name')}
                  />
                  <FieldError
                    message={form1.formState.errors.brand_name?.message}
                  />
                </div>
                <div>
                  <Label required>商家類別</Label>
                  <Select {...form1.register('category')}>
                    <option value="">請選擇</option>
                    {VENDOR_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <FieldError
                    message={form1.formState.errors.category?.message}
                  />
                </div>
                <div>
                  <Label>統一編號（選填）</Label>
                  <Input
                    placeholder="12345678"
                    maxLength={8}
                    {...form1.register('tax_id')}
                  />
                  <FieldError
                    message={form1.formState.errors.tax_id?.message}
                  />
                </div>
                <div>
                  <Label>官方網站（選填）</Label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    {...form1.register('website_url')}
                  />
                  <FieldError
                    message={form1.formState.errors.website_url?.message}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                下一步 <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* ── Step 2：聯絡資訊 ───────────────────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={form2.handleSubmit(onStep2)} noValidate>
              <h2 className="mb-6 text-base font-semibold text-white">
                聯絡資訊
              </h2>
              <div className="space-y-4">
                <div>
                  <Label required>負責人姓名</Label>
                  <Input
                    placeholder="例：王小明"
                    {...form2.register('contact_name')}
                  />
                  <FieldError
                    message={form2.formState.errors.contact_name?.message}
                  />
                </div>
                <div>
                  <Label required>公司信箱（登入帳號）</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="vendor@example.com"
                    {...form2.register('contact_email')}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    審核通過後將作為廠商後台登入帳號
                  </p>
                  <FieldError
                    message={form2.formState.errors.contact_email?.message}
                  />
                </div>
                <div>
                  <Label required>負責人手機</Label>
                  <Input
                    type="tel"
                    placeholder="0912345678"
                    maxLength={10}
                    {...form2.register('contact_phone')}
                  />
                  <FieldError
                    message={form2.formState.errors.contact_phone?.message}
                  />
                </div>
                <div>
                  <Label>公司電話（選填）</Label>
                  <Input
                    type="tel"
                    placeholder="02-12345678"
                    {...form2.register('company_phone')}
                  />
                  <FieldError
                    message={form2.formState.errors.company_phone?.message}
                  />
                </div>
                <div>
                  <Label>品牌介紹（選填）</Label>
                  <textarea
                    rows={3}
                    placeholder="簡短介紹您的品牌或商品特色…"
                    {...form2.register('description')}
                    className="mt-1.5 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <FieldError
                    message={form2.formState.errors.description?.message}
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 rounded-lg border border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一步
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                >
                  下一步 <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3：確認與同意 ─────────────────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={form3.handleSubmit(onStep3)} noValidate>
              <h2 className="mb-6 text-base font-semibold text-white">
                確認與同意
              </h2>

              {/* Summary */}
              <div className="mb-6 space-y-3 rounded-lg bg-gray-900/60 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  申請摘要
                </p>
                <SummaryRow label="公司名稱" value={accumulated.company_name} />
                <SummaryRow label="品牌名稱" value={accumulated.brand_name} />
                <SummaryRow label="商家類別" value={categoryLabel} />
                <SummaryRow label="負責人" value={accumulated.contact_name} />
                <SummaryRow
                  label="公司信箱"
                  value={accumulated.contact_email}
                />
                <SummaryRow
                  label="聯絡手機"
                  value={accumulated.contact_phone}
                />
                {accumulated.tax_id && (
                  <SummaryRow label="統一編號" value={accumulated.tax_id} />
                )}
                {accumulated.website_url && (
                  <SummaryRow
                    label="官方網站"
                    value={accumulated.website_url}
                  />
                )}
              </div>

              {/* Terms */}
              <div className="mb-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    {...form3.register('agreed_to_terms')}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-300">
                    我已閱讀並同意{' '}
                    <Link
                      href="/policy/service"
                      target="_blank"
                      className="text-indigo-400 hover:underline"
                    >
                      服務條款
                    </Link>
                    ，並確認以上資料正確無誤
                  </span>
                </label>
                <FieldError
                  message={form3.formState.errors.agreed_to_terms?.message}
                />
              </div>

              {submitError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 rounded-lg border border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一步
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '送出申請'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          已有帳號？{' '}
          <Link href="/vendor/auth" className="text-indigo-400 hover:underline">
            直接登入
          </Link>
        </p>
      </div>
    </main>
  )
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="truncate text-right text-white">{value}</span>
    </div>
  )
}
