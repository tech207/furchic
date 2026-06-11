'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Loader2, Store } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  vendorLoginSchema,
  type VendorLoginInput,
} from '@/lib/validations/vendor'
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validations/user'

// ── Small components ───────────────────────────────────────────────────────────

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-400">{message}</p>
}

// ── Main content ───────────────────────────────────────────────────────────────

type Mode = 'login' | 'forgot'

const REASON_MESSAGES: Record<string, string> = {
  no_account: '此帳號尚未取得廠商資格',
  inactive: '此廠商帳號已停用，請聯絡平台管理員',
  suspended: '廠商帳號已停用，請聯絡平台管理員',
}

function VendorAuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/vendor'
  const reason = searchParams.get('reason') ?? ''

  const [mode, setMode] = useState<Mode>('login')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(
    REASON_MESSAGES[reason] ?? null,
  )
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const loginForm = useForm<VendorLoginInput>({
    resolver: zodResolver(vendorLoginSchema),
    mode: 'onBlur',
  })

  const forgotForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  })

  const supabase = createClient()

  async function onLogin(data: VendorLoginInput) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/vendor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        setError(json.message ?? '登入失敗，請稍後再試')
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  async function onForgot(data: ForgotPasswordInput) {
    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/vendor/auth/setup`,
      })
      setForgotSent(true)
    } catch {
      setError('寄送失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Furchic 廠商後台
          </h1>
          <p className="text-sm text-gray-400">
            {mode === 'forgot' ? '重設您的密碼' : '歡迎回來，請登入廠商帳號'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-gray-800 p-8 ring-1 ring-gray-700">
          {error && <ErrorAlert message={error} />}

          {/* ── Login form ──────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    公司信箱
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="vendor@example.com"
                    {...loginForm.register('email')}
                    className="mt-1.5 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <FieldError
                    message={loginForm.formState.errors.email?.message}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">
                      密碼
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setError(null)
                      }}
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      忘記密碼？
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...loginForm.register('password')}
                      className="block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-300"
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    message={loginForm.formState.errors.password?.message}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '登入'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── Forgot password ─────────────────────────────────────────────── */}
          {mode === 'forgot' && (
            <div>
              {forgotSent ? (
                <div className="rounded-lg border border-green-800 bg-green-900/30 p-4 text-sm text-green-400">
                  若該 Email 已開通，重設連結將在數分鐘內寄出。
                </div>
              ) : (
                <form onSubmit={forgotForm.handleSubmit(onForgot)} noValidate>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      公司信箱
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="vendor@example.com"
                      {...forgotForm.register('email')}
                      className="mt-1.5 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <FieldError
                      message={forgotForm.formState.errors.email?.message}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '發送重設連結'
                    )}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setForgotSent(false)
                  setError(null)
                }}
                className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-300"
              >
                ← 返回登入
              </button>
            </div>
          )}
        </div>

        {/* 分隔線 */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-gray-900 px-3 text-gray-500">尚未進駐？</span>
          </div>
        </div>

        <Link
          href="/vendor/auth/register"
          className="flex w-full items-center justify-center rounded-lg border border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
        >
          申請商家進駐
        </Link>
      </div>
    </main>
  )
}

export default function VendorAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <VendorAuthContent />
    </Suspense>
  )
}
