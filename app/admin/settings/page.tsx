'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Check,
  CreditCard,
  Gift,
  Loader2,
  Settings2,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type Settings = {
  // Tab 1 購物車 & 促銷（使用 DB 實際 key 名稱）
  free_shipping_amount: number
  gift_nfc_amount: number
  gift_nfc_enabled: boolean
  gift_nfc_start_at: string | null
  gift_nfc_end_at: string | null
  // Tab 2 製卡申請
  card_request_enabled: boolean
  card_request_description: string
  max_pets_per_user: number
  // Tab 5 回饋金
  reward_max_rate: number
  // Tab 6 通知設定
  notify_order_created: boolean
  notify_order_paid: boolean
  notify_low_stock: boolean
  notify_admin_email: string
  notify_low_stock_threshold: number
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function saveSetting(key: string, value: unknown) {
  const res = await fetch(`/api/admin/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`儲存 ${key} 失敗`)
}

function SaveIndicator({
  saving,
  saved,
}: {
  saving?: boolean
  saved?: boolean
}) {
  if (saving)
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        儲存中…
      </span>
    )
  if (saved)
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" />
        已儲存
      </span>
    )
  return null
}

function SectionHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
        <Icon className="h-5 w-5 text-orange-500" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

// ── Redirect Card (Tab 3 & 4) ─────────────────────────────────────────────────

function RedirectCard({
  icon: Icon,
  title,
  description,
  href,
  label,
}: {
  icon: React.ElementType
  title: string
  description: string
  href: string
  label: string
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <SectionHeader icon={Icon} title={title} desc={description} />
      <Separator className="mb-5" />
      <div className="flex items-center gap-4 rounded-lg border bg-muted/40 px-4 py-4">
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {description}請前往「{label}」頁面進行設定。
        </p>
        <Button asChild size="sm" className="shrink-0 gap-1.5">
          <Link href={href}>
            前往{label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((j) => setSettings(j.data?.settings as Settings))
      .catch(() => toast({ variant: 'destructive', title: '載入失敗' }))
      .finally(() => setLoading(false))
  }, [])

  const autoSave = useCallback(async (key: keyof Settings, value: unknown) => {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key])
    debounceRefs.current[key] = setTimeout(async () => {
      setSaving((s) => ({ ...s, [key]: true }))
      try {
        await saveSetting(key, value)
        setSaved((s) => ({ ...s, [key]: true }))
        setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
      } catch {
        toast({ variant: 'destructive', title: `儲存失敗：${key}` })
      } finally {
        setSaving((s) => ({ ...s, [key]: false }))
      }
    }, 800)
  }, [])

  const immediateSave = useCallback(
    async (key: keyof Settings, value: unknown) => {
      setSaving((s) => ({ ...s, [key]: true }))
      try {
        await saveSetting(key, value)
        setSaved((s) => ({ ...s, [key]: true }))
        setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
      } catch {
        toast({ variant: 'destructive', title: `儲存失敗：${key}` })
      } finally {
        setSaving((s) => ({ ...s, [key]: false }))
      }
    },
    [],
  )

  function update<K extends keyof Settings>(
    key: K,
    value: Settings[K],
    immediate = false,
  ) {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    if (immediate) immediateSave(key, value)
    else autoSave(key, value)
  }

  if (loading || !settings) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Settings2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">系統設定</h1>
      </div>

      <Tabs defaultValue="cart">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl p-1">
          <TabsTrigger value="cart" className="text-xs">
            購物車 & 促銷
          </TabsTrigger>
          <TabsTrigger value="card" className="text-xs">
            製卡申請
          </TabsTrigger>
          <TabsTrigger value="payment" className="text-xs">
            金流設定
          </TabsTrigger>
          <TabsTrigger value="shipping" className="text-xs">
            物流設定
          </TabsTrigger>
          <TabsTrigger value="reward" className="text-xs">
            回饋金規則
          </TabsTrigger>
          <TabsTrigger value="notify" className="text-xs">
            通知設定
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1：購物車 & 促銷 ────────────────────────────────────────── */}
        <TabsContent value="cart" className="mt-4">
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <SectionHeader
              icon={ShoppingCart}
              title="購物車與促銷"
              desc="控制免運門檻與贈品活動設定"
            />
            <Separator />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>免運門檻（NT$）</Label>
                  <SaveIndicator
                    saving={saving.free_shipping_amount}
                    saved={saved.free_shipping_amount}
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={settings.free_shipping_amount}
                  onChange={(e) =>
                    update('free_shipping_amount', Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  訂單金額滿此金額享免運費
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>NFC 卡贈品門檻（NT$）</Label>
                  <SaveIndicator
                    saving={saving.gift_nfc_amount}
                    saved={saved.gift_nfc_amount}
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={settings.gift_nfc_amount}
                  onChange={(e) =>
                    update('gift_nfc_amount', Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  訂單金額滿此金額贈送 NFC 卡
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-orange-400" />
                    <span className="text-sm font-medium">贈品活動</span>
                    <SaveIndicator
                      saving={saving.gift_nfc_enabled}
                      saved={saved.gift_nfc_enabled}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    開啟後於指定期間提供贈品優惠
                  </p>
                </div>
                <Switch
                  checked={settings.gift_nfc_enabled}
                  onCheckedChange={(v) => update('gift_nfc_enabled', v, true)}
                />
              </div>

              {settings.gift_nfc_enabled && (
                <div className="grid grid-cols-2 gap-4 border-l-2 border-orange-200 pl-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs">活動開始日期</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={settings.gift_nfc_start_at ?? ''}
                        onChange={(e) =>
                          update('gift_nfc_start_at', e.target.value || null)
                        }
                      />
                      <SaveIndicator
                        saving={saving.gift_nfc_start_at}
                        saved={saved.gift_nfc_start_at}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">活動結束日期</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={settings.gift_nfc_end_at ?? ''}
                        onChange={(e) =>
                          update('gift_nfc_end_at', e.target.value || null)
                        }
                      />
                      <SaveIndicator
                        saving={saving.gift_nfc_end_at}
                        saved={saved.gift_nfc_end_at}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2：製卡申請 ──────────────────────────────────────────────── */}
        <TabsContent value="card" className="mt-4">
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <SectionHeader
              icon={CreditCard}
              title="製卡申請"
              desc="管理會員製卡申請的開放狀態與限制"
            />
            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">開放申請</span>
                  <SaveIndicator
                    saving={saving.card_request_enabled}
                    saved={saved.card_request_enabled}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  關閉後，前台將顯示暫停申請提示
                </p>
              </div>
              <Switch
                checked={settings.card_request_enabled}
                onCheckedChange={(v) => update('card_request_enabled', v, true)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>每人最多寵物數</Label>
                <SaveIndicator
                  saving={saving.max_pets_per_user}
                  saved={saved.max_pets_per_user}
                />
              </div>
              <Input
                type="number"
                min={1}
                max={50}
                step={1}
                value={settings.max_pets_per_user ?? 5}
                onChange={(e) =>
                  update('max_pets_per_user', Number(e.target.value))
                }
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                每位會員可建立的寵物檔案上限
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>申請說明文字</Label>
                <SaveIndicator
                  saving={saving.card_request_description}
                  saved={saved.card_request_description}
                />
              </div>
              <Textarea
                rows={4}
                value={settings.card_request_description ?? ''}
                onChange={(e) =>
                  update('card_request_description', e.target.value)
                }
                placeholder="填寫製卡申請的說明文字，會顯示在前台"
                className="resize-none"
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 3：金流設定（導向） ─────────────────────────────────────── */}
        <TabsContent value="payment" className="mt-4">
          <RedirectCard
            icon={CreditCard}
            title="金流設定"
            description="金流方式的開通與設定"
            href="/admin/payments"
            label="金流管理"
          />
        </TabsContent>

        {/* ── Tab 4：物流設定（導向） ─────────────────────────────────────── */}
        <TabsContent value="shipping" className="mt-4">
          <RedirectCard
            icon={Truck}
            title="物流設定"
            description="物流方式的開通與設定"
            href="/admin/logistics"
            label="物流管理"
          />
        </TabsContent>

        {/* ── Tab 5：回饋金規則 ──────────────────────────────────────────── */}
        <TabsContent value="reward" className="mt-4">
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <SectionHeader
              icon={Wallet}
              title="回饋金規則"
              desc="設定回饋金折抵上限與計算方式"
            />
            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>最大折抵比率</Label>
                <div className="flex items-center gap-3">
                  <SaveIndicator
                    saving={saving.reward_max_rate}
                    saved={saved.reward_max_rate}
                  />
                  <span className="w-16 text-right text-2xl font-bold tabular-nums text-orange-600">
                    {settings.reward_max_rate}%
                  </span>
                </div>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[settings.reward_max_rate]}
                onValueChange={([v]) => update('reward_max_rate', v)}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                單筆訂單最多可用回饋金折抵的比率（目前：
                {settings.reward_max_rate}%）
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 6：通知設定 ────────────────────────────────────────────── */}
        <TabsContent value="notify" className="mt-4">
          <div className="space-y-5 rounded-xl border bg-card p-6">
            <SectionHeader
              icon={Bell}
              title="通知設定"
              desc="設定後台 Email 通知的觸發條件與收件人"
            />
            <Separator />

            {/* Admin email */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>通知收件人 Email</Label>
                <SaveIndicator
                  saving={saving.notify_admin_email}
                  saved={saved.notify_admin_email}
                />
              </div>
              <Input
                type="email"
                value={settings.notify_admin_email ?? ''}
                onChange={(e) => update('notify_admin_email', e.target.value)}
                placeholder="admin@furchic.com"
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                所有後台通知 Email 將發送至此地址
              </p>
            </div>

            <Separator />

            {/* 訂單成立 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">訂單成立通知</span>
                    <SaveIndicator
                      saving={saving.notify_order_created}
                      saved={saved.notify_order_created}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    有新訂單時，發送 Email 通知管理員
                  </p>
                </div>
                <Switch
                  checked={Boolean(settings.notify_order_created)}
                  onCheckedChange={(v) =>
                    update('notify_order_created', v, true)
                  }
                />
              </div>

              {/* 訂單付款 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      訂單付款完成通知
                    </span>
                    <SaveIndicator
                      saving={saving.notify_order_paid}
                      saved={saved.notify_order_paid}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    綠界金流確認付款後，發送 Email 通知
                  </p>
                </div>
                <Switch
                  checked={Boolean(settings.notify_order_paid)}
                  onCheckedChange={(v) => update('notify_order_paid', v, true)}
                />
              </div>
            </div>

            <Separator />

            {/* 低庫存 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">低庫存通知</span>
                    <SaveIndicator
                      saving={saving.notify_low_stock}
                      saved={saved.notify_low_stock}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    商品庫存低於閾值時發送警示通知
                  </p>
                </div>
                <Switch
                  checked={Boolean(settings.notify_low_stock)}
                  onCheckedChange={(v) => update('notify_low_stock', v, true)}
                />
              </div>

              {settings.notify_low_stock && (
                <div className="space-y-2 border-l-2 border-orange-200 pl-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">通知閾值（件數）</Label>
                    <SaveIndicator
                      saving={saving.notify_low_stock_threshold}
                      saved={saved.notify_low_stock_threshold}
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={settings.notify_low_stock_threshold ?? 5}
                    onChange={(e) =>
                      update(
                        'notify_low_stock_threshold',
                        Number(e.target.value),
                      )
                    }
                    className="w-28"
                  />
                  <p className="text-xs text-muted-foreground">
                    庫存低於此數量時觸發通知
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
