'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  Users2,
  Banknote,
  Loader2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type BankAccount = {
  bank_name?: string
  branch?: string
  account_no?: string
  account_name?: string
}

type VendorInfo = {
  brand_name: string
  company_name: string
  description: string | null
  logo_url: string | null
  contact_email: string
  contact_phone: string
  contact_name: string
  bank_account: BankAccount
  default_commission_rate: number
  status: string
}

// ── Read-only field ───────────────────────────────────────────────────────────

function ReadField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        {value || <span className="text-muted-foreground/50">未設定</span>}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<VendorInfo | null>(null)

  // Bank account form state
  const [bank, setBank] = useState<BankAccount>({})
  const [savingBank, setSavingBank] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/vendor/auth/me')
        const json = await res.json()
        if (res.ok) {
          const v = json.data.vendor as VendorInfo
          setVendor(v)
          setBank(v.bank_account ?? {})
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  async function handleSaveBank() {
    setSavingBank(true)
    try {
      const res = await fetch('/api/vendor/settings/bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_account: bank }),
      })
      if (res.ok) {
        toast({ title: '收款資訊已儲存' })
      } else {
        const json = await res.json()
        toast({ variant: 'destructive', title: json.message ?? '儲存失敗' })
      }
    } finally {
      setSavingBank(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">商家設定</h1>
        <p className="text-sm text-muted-foreground">
          管理品牌資訊、員工帳號與收款設定
        </p>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="info">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            商家資訊
          </TabsTrigger>
          <TabsTrigger value="staff">
            <Users2 className="mr-1.5 h-3.5 w-3.5" />
            員工帳號
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Banknote className="mr-1.5 h-3.5 w-3.5" />
            收款資訊
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1：商家資訊（唯讀） ─────────────────────────────────────── */}
        <TabsContent value="info">
          <div className="max-w-xl space-y-6 rounded-xl border p-6">
            <div>
              <h2 className="font-semibold">品牌資訊</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                如需修改，請聯絡平台管理員
              </p>
            </div>

            <Separator />

            {/* Logo */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">品牌 Logo</Label>
              {vendor?.logo_url ? (
                <img
                  src={vendor.logo_url}
                  alt="logo"
                  className="h-16 w-16 rounded-lg border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted text-2xl font-bold text-muted-foreground">
                  {vendor?.brand_name?.[0] ?? '?'}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ReadField label="品牌名稱" value={vendor?.brand_name} />
              <ReadField label="公司名稱" value={vendor?.company_name} />
            </div>

            <ReadField label="品牌描述" value={vendor?.description} />

            <Separator />

            <div>
              <h2 className="font-semibold">聯絡資訊</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ReadField label="聯絡人" value={vendor?.contact_name} />
              <ReadField label="聯絡電話" value={vendor?.contact_phone} />
              <ReadField label="聯絡 Email" value={vendor?.contact_email} />
              <ReadField
                label="預設抽成比例"
                value={vendor ? `${vendor.default_commission_rate}%` : null}
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2：員工帳號 ──────────────────────────────────────────────── */}
        <TabsContent value="staff">
          <div className="max-w-xl space-y-4 rounded-xl border p-6">
            <div>
              <h2 className="font-semibold">員工帳號管理</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                邀請員工使用後台，可個別設定商品、訂單、報表的存取權限。
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <Users2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">員工帳號列表</p>
                  <p className="text-xs text-muted-foreground">
                    查看、邀請和管理所有後台帳號
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/vendor/settings/staff">
                  前往管理
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              <ExternalLink className="mr-1 inline h-3 w-3" />
              只有主帳號可以邀請員工和修改權限。
            </p>
          </div>
        </TabsContent>

        {/* ── Tab 3：收款資訊 ──────────────────────────────────────────────── */}
        <TabsContent value="bank">
          <div className="max-w-xl space-y-6 rounded-xl border p-6">
            <div>
              <h2 className="font-semibold">銀行帳號設定</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                平台月結時將匯款至此帳號，請確認資訊正確。
              </p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank-name">銀行名稱</Label>
                <Input
                  id="bank-name"
                  placeholder="例：台灣銀行"
                  value={bank.bank_name ?? ''}
                  onChange={(e) =>
                    setBank((b) => ({ ...b, bank_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-branch">分行名稱</Label>
                <Input
                  id="bank-branch"
                  placeholder="例：信義分行"
                  value={bank.branch ?? ''}
                  onChange={(e) =>
                    setBank((b) => ({ ...b, branch: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-account-no">帳號</Label>
                <Input
                  id="bank-account-no"
                  placeholder="輸入帳號"
                  value={bank.account_no ?? ''}
                  onChange={(e) =>
                    setBank((b) => ({ ...b, account_no: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-account-name">戶名</Label>
                <Input
                  id="bank-account-name"
                  placeholder="與存摺相同的戶名"
                  value={bank.account_name ?? ''}
                  onChange={(e) =>
                    setBank((b) => ({ ...b, account_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveBank} disabled={savingBank}>
                {savingBank && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                儲存收款資訊
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
