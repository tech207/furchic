'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  Truck,
  ShoppingBag,
  Tag,
  Coins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useCartStore } from '@/store/cartStore'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type LogisticsMethod = {
  id: string
  logistics_type: string
  display_name: string
  shipping_fee: number
  free_shipping_threshold: number | null
}

type CalcResult = {
  subtotal: number
  promotions_discount: number
  coupon: { name: string; discount_amount: number } | null
  coupon_discount: number
  reward_points_used: number
  reward_points_discount: number
  shipping_fee: number
  total: number
  reward_points_to_earn: number
  warnings: string[]
}

type UserProfile = {
  id: string
  full_name: string | null
  phone: string | null
  reward_points: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={
          highlight ? 'font-semibold text-orange-600' : 'text-gray-800'
        }
      >
        {value}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { items, subtotal, clearCart } = useCartStore()

  // Auth / profile
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Logistics
  const [methods, setMethods] = useState<LogisticsMethod[]>([])
  const [shippingMethod, setShippingMethod] = useState('')

  // Form fields
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [note, setNote] = useState('')

  // Coupon
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)

  // Points
  const [pointsToUse, setPointsToUse] = useState(0)

  // Calculation
  const [calc, setCalc] = useState<CalcResult | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)

  // Cart summary toggle (mobile)
  const [cartOpen, setCartOpen] = useState(false)

  // ── Load auth + profile ───────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth?next=/checkout`)
        return
      }
      const { data } = await supabase
        .from('users')
        .select('id, name, phone, reward_points')
        .eq('id', user.id)
        .single()
      if (data) {
        const p = data as unknown as {
          id: string
          name: string | null
          phone: string | null
          reward_points: number
        }
        setProfile({
          id: p.id,
          full_name: p.name,
          phone: p.phone,
          reward_points: p.reward_points,
        })
        setRecipientName(p.name ?? '')
        setRecipientPhone(p.phone ?? '')
      }
      setAuthLoading(false)
    }
    void load()
  }, [router])

  // ── Load logistics methods ─────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/logistics')
      .then((r) => r.json())
      .then((json) => {
        const ms = (json.data?.methods as LogisticsMethod[]) ?? []
        setMethods(ms)
        if (ms.length > 0) setShippingMethod(ms[0].logistics_type)
      })
      .catch(() => {})
  }, [])

  // ── Calculate total ────────────────────────────────────────────────────────

  const calculate = useCallback(async () => {
    if (!shippingMethod) return
    setCalcLoading(true)
    try {
      const res = await fetch('/api/checkout/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_code: appliedCoupon || undefined,
          reward_points_used: pointsToUse,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setCalc(json.data as CalcResult)
      }
    } finally {
      setCalcLoading(false)
    }
  }, [shippingMethod, appliedCoupon, pointsToUse])

  useEffect(() => {
    if (items.length > 0 && shippingMethod) {
      void calculate()
    }
  }, [items, shippingMethod, appliedCoupon, pointsToUse, calculate])

  // ── Apply coupon ───────────────────────────────────────────────────────────

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return
    setCouponLoading(true)
    try {
      const res = await fetch('/api/checkout/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_code: couponInput.trim(), subtotal }),
      })
      const json = await res.json()
      if (res.ok && json.data?.valid) {
        setAppliedCoupon(couponInput.trim().toUpperCase())
        toast({
          title: `優惠碼「${couponInput.trim().toUpperCase()}」套用成功`,
        })
      } else {
        toast({ variant: 'destructive', title: json.message ?? '優惠碼無效' })
      }
    } finally {
      setCouponLoading(false)
    }
  }

  // ── Submit order ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!recipientName.trim()) {
      toast({ variant: 'destructive', title: '請填寫收件人姓名' })
      return
    }
    if (!recipientPhone.trim()) {
      toast({ variant: 'destructive', title: '請填寫收件人電話' })
      return
    }
    if (!shippingMethod) {
      toast({ variant: 'destructive', title: '請選擇物流方式' })
      return
    }
    const isHomeDelivery = shippingMethod === 'home_delivery'
    if (isHomeDelivery && !recipientAddress.trim()) {
      toast({ variant: 'destructive', title: '宅配請填寫收件地址' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_method: shippingMethod,
          recipient_name: recipientName.trim(),
          recipient_phone: recipientPhone.trim(),
          recipient_address: isHomeDelivery
            ? recipientAddress.trim()
            : undefined,
          coupon_code: appliedCoupon || undefined,
          reward_points_used: pointsToUse,
          note: note.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: json.message ?? '下單失敗，請稍後再試',
        })
        return
      }
      clearCart()
      const orderId = (json.data as { order_id: string }).order_id
      toast({ title: '訂單已建立！' })
      router.push(`/orders/${orderId}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p className="text-lg font-semibold text-gray-500">購物車是空的</p>
        <Button asChild className="mt-6">
          <Link href="/shop">去逛逛</Link>
        </Button>
      </main>
    )
  }

  const selectedMethod = methods.find(
    (m) => m.logistics_type === shippingMethod,
  )
  const isHomeDelivery = shippingMethod === 'home_delivery'
  const maxPoints = Math.min(profile?.reward_points ?? 0, Math.floor(subtotal))
  const displayTotal = calc?.total ?? subtotal
  const displayShipping =
    calc?.shipping_fee ?? selectedMethod?.shipping_fee ?? 0

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 space-y-1">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-orange-500"
        >
          <ChevronLeft className="h-4 w-4" />
          返回購物車
        </Link>
        <h1 className="text-xl font-bold">確認訂單</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Cart summary (collapsible) */}
          <div className="overflow-hidden rounded-xl border bg-white">
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3.5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingBag className="h-4 w-4 text-orange-500" />
                商品明細（{items.length} 件）
              </div>
              {cartOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {cartOpen && (
              <div className="divide-y border-t">
                {items.map((item) => (
                  <div
                    key={item.variant_id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.variant_name} × {item.quantity}
                      </p>
                      {item.is_preorder && (
                        <span className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                          預購
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      NT$ {(item.unit_price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logistics selection */}
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Truck className="h-4 w-4 text-orange-500" />
              選擇物流方式
            </p>
            {methods.length === 0 ? (
              <p className="text-xs text-gray-400">載入中…</p>
            ) : (
              <div className="grid gap-2">
                {methods.map((m) => (
                  <label
                    key={m.logistics_type}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      shippingMethod === m.logistics_type
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={m.logistics_type}
                      checked={shippingMethod === m.logistics_type}
                      onChange={() => setShippingMethod(m.logistics_type)}
                      className="accent-orange-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {m.display_name}
                      </p>
                      {m.free_shipping_threshold && (
                        <p className="text-xs text-gray-400">
                          滿 NT$ {m.free_shipping_threshold.toLocaleString()}{' '}
                          免運
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      {m.shipping_fee === 0 ? '免費' : `NT$ ${m.shipping_fee}`}
                    </p>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Recipient info */}
          <div className="space-y-4 rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-gray-700">收件人資料</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-name">姓名 *</Label>
                <Input
                  id="r-name"
                  placeholder="收件人姓名"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-phone">電話 *</Label>
                <Input
                  id="r-phone"
                  placeholder="09XX-XXX-XXX"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </div>
            </div>

            {isHomeDelivery && (
              <div className="space-y-1.5">
                <Label htmlFor="r-addr">收件地址 *</Label>
                <Input
                  id="r-addr"
                  placeholder="縣市 + 鄉鎮區 + 詳細地址"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="note">備註（選填）</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="如有特殊配送需求請填寫"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className="resize-none"
              />
            </div>
          </div>

          {/* Coupon */}
          <div className="space-y-3 rounded-xl border bg-white p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Tag className="h-4 w-4 text-orange-500" />
              優惠碼
            </p>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>已套用：{appliedCoupon}</span>
                  {calc?.coupon && (
                    <span className="font-semibold">
                      (折 NT$ {calc.coupon.discount_amount.toLocaleString()})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon('')
                    setCouponInput('')
                  }}
                  className="text-xs text-gray-400 hover:text-rose-500"
                >
                  移除
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="輸入優惠碼"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleApplyCoupon()
                  }}
                  className="uppercase"
                />
                <Button
                  variant="outline"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                >
                  {couponLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    '套用'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Reward points */}
          {(profile?.reward_points ?? 0) > 0 && (
            <div className="space-y-3 rounded-xl border bg-white p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Coins className="h-4 w-4 text-yellow-500" />
                使用回饋金（您有{' '}
                {(profile?.reward_points ?? 0).toLocaleString()} 點）
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={maxPoints}
                  value={pointsToUse}
                  onChange={(e) => setPointsToUse(Number(e.target.value))}
                  className="flex-1 accent-orange-500"
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={maxPoints}
                    value={pointsToUse}
                    onChange={(e) =>
                      setPointsToUse(
                        Math.min(
                          maxPoints,
                          Math.max(0, Number(e.target.value)),
                        ),
                      )
                    }
                    className="w-20 text-center"
                  />
                  <span className="text-xs text-gray-400">點</span>
                </div>
              </div>
              {pointsToUse > 0 && (
                <p className="text-xs text-orange-600">
                  折扣 NT$ {pointsToUse.toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right column: order summary ──────────────────────────────────── */}
        <div className="space-y-4">
          <div className="sticky top-24 space-y-1 rounded-xl border bg-white p-4">
            <p className="mb-3 text-sm font-bold text-gray-800">訂單金額</p>

            <Row label="商品小計" value={`NT$ ${subtotal.toLocaleString()}`} />

            {(calc?.promotions_discount ?? 0) > 0 && (
              <Row
                label="優惠折扣"
                value={`-NT$ ${calc!.promotions_discount.toLocaleString()}`}
              />
            )}
            {(calc?.coupon_discount ?? 0) > 0 && (
              <Row
                label={`優惠碼（${appliedCoupon}）`}
                value={`-NT$ ${calc!.coupon_discount.toLocaleString()}`}
              />
            )}
            {(calc?.reward_points_discount ?? 0) > 0 && (
              <Row
                label="回饋金折抵"
                value={`-NT$ ${calc!.reward_points_discount.toLocaleString()}`}
              />
            )}

            <Row
              label={`運費${selectedMethod ? `（${selectedMethod.display_name}）` : ''}`}
              value={
                displayShipping === 0
                  ? '免費'
                  : `NT$ ${displayShipping.toLocaleString()}`
              }
            />

            <div className="my-2 border-t" />

            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-gray-800">應付金額</span>
              <span className="text-xl font-bold text-orange-600">
                {calcLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `NT$ ${displayTotal.toLocaleString()}`
                )}
              </span>
            </div>

            {(calc?.reward_points_to_earn ?? 0) > 0 && (
              <p className="mt-1 text-xs text-yellow-600">
                本次消費可獲得 {calc!.reward_points_to_earn} 點回饋金
              </p>
            )}

            {calc?.warnings && calc.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {calc.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-rose-500">
                    {w}
                  </p>
                ))}
              </div>
            )}

            <Button
              size="lg"
              className="mt-4 w-full bg-orange-500 hover:bg-orange-600"
              onClick={handleSubmit}
              disabled={submitting || !shippingMethod}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {submitting ? '處理中…' : '確認下單'}
            </Button>

            <p className="mt-2 text-center text-xs text-gray-400">
              下單後將跳轉至付款頁面
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
