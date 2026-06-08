'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, PawPrint, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  emailLoginSchema,
  emailRegisterSchema,
  forgotPasswordSchema,
  type EmailLoginInput,
  type EmailRegisterInput,
  type ForgotPasswordInput,
} from '@/lib/validations/user'

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function LineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 5.85 2 10.6c0 2.73 1.37 5.17 3.52 6.8L4.5 21l4.36-1.5c.98.28 2.03.44 3.14.44 5.52 0 10-3.85 10-8.6C22 5.85 17.52 2 12 2zm5.6 11.3l-1.4 1.4c-.3.3-.7.4-1.1.2-.7-.4-1.7-1.1-2.5-2s-1.4-1.9-1.7-2.6c-.1-.4.1-.8.4-1.1l1.3-1.3c.3-.3.8-.3 1.1 0l1.1 1.1c.3.3.3.8 0 1.1l-.4.4c.3.5.7 1 1.1 1.4.4.4.9.8 1.4 1.1l.4-.4c.3-.3.8-.3 1.1 0l1.1 1.1c.3.3.3.8.1 1.1z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

// ── Error alert ────────────────────────────────────────────────────────────────

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ── OAuth error messages ───────────────────────────────────────────────────────

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: '您取消了登入',
  line_failed: 'LINE 登入失敗，請稍後再試',
  line_signin_failed: 'LINE 登入失敗，請稍後再試',
  session_failed: '登入失敗，請稍後再試',
  oauth_failed: 'Google 登入失敗，請稍後再試',
  missing_code: '登入流程異常，請重新嘗試',
}

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-3 text-gray-400">{label}</span>
      </div>
    </div>
  )
}

// ── Field error ────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

// ── Main auth content ──────────────────────────────────────────────────────────

type Mode = 'login' | 'register' | 'forgot'

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const next = searchParams.get('next') ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(
    errorParam ? (OAUTH_ERRORS[errorParam] ?? '登入失敗，請稍後再試') : null,
  )
  const [forgotSent, setForgotSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()

  // ── Form: login ──────────────────────────────────────────────────────────────
  const loginForm = useForm<EmailLoginInput>({
    resolver: zodResolver(emailLoginSchema),
    mode: 'onBlur',
  })

  // ── Form: register ───────────────────────────────────────────────────────────
  const registerForm = useForm<EmailRegisterInput>({
    resolver: zodResolver(emailRegisterSchema),
    mode: 'onBlur',
  })

  // ── Form: forgot password ────────────────────────────────────────────────────
  const forgotForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleLineLine() {
    const safeNext =
      next.startsWith('/') && !next.startsWith('//') ? next : '/pets'
    router.push(`/api/auth/line?next=${encodeURIComponent(safeNext)}`)
  }

  async function handleGoogle() {
    setIsLoading(true)
    setGlobalError(null)
    const safeNext =
      next.startsWith('/') && !next.startsWith('//') ? next : '/pets'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })
    if (error) {
      setGlobalError('Google 登入失敗，請稍後再試')
      setIsLoading(false)
    }
  }

  async function handleLogin(data: EmailLoginInput) {
    setGlobalError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as {
        data?: { isNewUser: boolean; nextUrl: string }
        message?: string
      }
      if (!res.ok) {
        setGlobalError(json.message ?? '登入失敗，請稍後再試')
        return
      }
      router.push(json.data?.nextUrl ?? '/pets')
      router.refresh()
    } catch {
      setGlobalError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegister(data: EmailRegisterInput) {
    setGlobalError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/email/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        setGlobalError(json.message ?? '註冊失敗，請稍後再試')
        return
      }
      // After register, sign in and redirect
      await handleLogin({ email: data.email, password: data.password })
    } catch {
      setGlobalError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForgot(data: ForgotPasswordInput) {
    setGlobalError(null)
    setIsLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setForgotSent(true)
    } catch {
      setGlobalError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8820C] shadow-lg">
            <PawPrint className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Furchic
          </h1>
          <p className="text-sm text-gray-500">讓每隻寵物都有自己的身份</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-100">
          {/* Global error (OAuth) */}
          {globalError && <ErrorAlert message={globalError} />}
          {globalError && <div className="mt-4" />}

          {/* OAuth buttons */}
          {mode !== 'forgot' && (
            <>
              {/* LINE */}
              <button
                type="button"
                onClick={handleLineLine}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <LineIcon />
                使用 LINE 登入
              </button>

              <div className="mt-3" />

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                <GoogleIcon />
                使用 Google 登入
              </button>

              <Divider label="或使用 Email 登入" />
            </>
          )}

          {/* ── Login form ─────────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...loginForm.register('email')}
                    className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                  />
                  <FieldError
                    message={loginForm.formState.errors.email?.message}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      密碼
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-[#E8820C] hover:underline"
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
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
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
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-lg bg-[#E8820C] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '登入'
                  )}
                </button>
              </div>

              <p className="mt-5 text-center text-sm text-gray-500">
                還沒有帳號？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setGlobalError(null)
                  }}
                  className="font-medium text-[#E8820C] hover:underline"
                >
                  立即註冊
                </button>
              </p>
            </form>
          )}

          {/* ── Register form ──────────────────────────────────────────────────── */}
          {mode === 'register' && (
            <form
              onSubmit={registerForm.handleSubmit(handleRegister)}
              noValidate
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...registerForm.register('email')}
                    className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                  />
                  <FieldError
                    message={registerForm.formState.errors.email?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    密碼
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="至少 8 字元，含英數"
                      {...registerForm.register('password')}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    message={registerForm.formState.errors.password?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    確認密碼
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="再次輸入密碼"
                      {...registerForm.register('confirmPassword')}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    message={
                      registerForm.formState.errors.confirmPassword?.message
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center rounded-lg bg-[#E8820C] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '建立帳號'
                  )}
                </button>
              </div>

              <p className="mt-5 text-center text-sm text-gray-500">
                已有帳號？{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setGlobalError(null)
                  }}
                  className="font-medium text-[#E8820C] hover:underline"
                >
                  直接登入
                </button>
              </p>
            </form>
          )}

          {/* ── Forgot password ────────────────────────────────────────────────── */}
          {mode === 'forgot' && (
            <div>
              <h2 className="mb-1 text-base font-semibold text-gray-900">
                忘記密碼
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                輸入您的 Email，我們將寄送重設連結
              </p>

              {forgotSent ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  若該 Email 已註冊，重設連結將在數分鐘內送達您的信箱。
                </div>
              ) : (
                <form
                  onSubmit={forgotForm.handleSubmit(handleForgot)}
                  noValidate
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...forgotForm.register('email')}
                      className="mt-1.5 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-[#E8820C] focus:outline-none focus:ring-2 focus:ring-[#E8820C]/20"
                    />
                    <FieldError
                      message={forgotForm.formState.errors.email?.message}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#E8820C] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isLoading ? (
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
                }}
                className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                ← 返回登入
              </button>
            </div>
          )}
        </div>

        {/* Privacy notice */}
        <p className="mt-6 text-center text-xs text-gray-400">
          登入即代表您同意我們的
          <a href="/privacy" className="underline hover:text-gray-600">
            隱私政策
          </a>
          與
          <a href="/terms" className="underline hover:text-gray-600">
            使用條款
          </a>
        </p>
      </div>
    </main>
  )
}

// ── Page (wrap in Suspense for useSearchParams) ────────────────────────────────

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#E8820C]" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
