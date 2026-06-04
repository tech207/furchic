'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PawPrint, Loader2, CheckCircle } from 'lucide-react'
import { Suspense } from 'react'
import { profileSetupSchema, type ProfileSetupInput } from '@/lib/validations/user'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function SetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isWelcome = searchParams.get('welcome') === '1'

  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileSetupInput>({
    resolver: zodResolver(profileSetupSchema),
    mode: 'onBlur',
  })

  async function onSubmit(data: ProfileSetupInput) {
    setGlobalError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          ...(data.gender && { gender: data.gender }),
          ...(data.birthday && { birthday: data.birthday }),
        }),
      })

      if (!res.ok) {
        const json = (await res.json()) as { message?: string }
        setGlobalError(json.message ?? '儲存失敗，請稍後再試')
        return
      }

      router.push('/pets')
      router.refresh()
    } catch {
      setGlobalError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8820C] shadow-lg">
            <PawPrint className="h-8 w-8 text-white" />
          </div>
          {isWelcome ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">歡迎加入 Furchic！</h1>
              <p className="text-sm text-gray-500">請填寫基本資料，讓我們更了解您</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">完善個人資料</h1>
              <p className="text-sm text-gray-500">填寫後才能使用完整功能</p>
            </>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-100">

          {/* Progress */}
          <div className="mb-6 flex items-center gap-3 text-sm text-gray-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8820C] text-xs font-bold text-white">1</div>
            <span className="font-medium text-gray-900">填寫資料</span>
            <div className="h-px flex-1 bg-gray-200" />
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">2</div>
            <span>新增寵物</span>
          </div>

          {globalError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-5">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="請輸入您的姓名"
                  {...register('name')}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                />
                <FieldError message={errors.name?.message} />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  手機號碼 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="0912345678"
                  {...register('phone')}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                />
                <FieldError message={errors.phone?.message} />
                <p className="mt-1 text-xs text-gray-400">格式：09xxxxxxxx（用於緊急聯絡）</p>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700">性別</label>
                <div className="mt-1.5 flex gap-3">
                  {[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'other', label: '其他' },
                  ].map(({ value, label }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value={value}
                        {...register('gender')}
                        className="h-4 w-4 border-gray-300 text-[#E8820C] focus:ring-[#E8820C]"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                <FieldError message={errors.gender?.message} />
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-gray-700">生日</label>
                <input
                  type="date"
                  {...register('birthday')}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                />
                <FieldError message={errors.birthday?.message} />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8820C] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    儲存並繼續
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          資料僅用於 NFC 名片緊急聯絡顯示，受隱私政策保護
        </p>
      </div>
    </main>
  )
}

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E8820C]" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  )
}
