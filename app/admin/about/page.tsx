'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  Building2,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Loader2,
  MessageCircle,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUploader } from '@/components/common/ImageUploader'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

type AboutData = {
  company_name: string
  company_description: string
  company_logo_url: string
  company_email: string
  company_phone: string
  company_address: string
  company_website: string
  social_instagram: string
  social_facebook: string
  social_line: string
}

const DEFAULTS: AboutData = {
  company_name: 'Furchic',
  company_description: '',
  company_logo_url: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  company_website: '',
  social_instagram: '',
  social_facebook: '',
  social_line: '',
}

function SocialPreviewRow({
  icon: Icon,
  label,
  url,
  color,
}: {
  icon: React.ElementType
  label: string
  url: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          color,
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{url || '尚未設定'}</p>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-orange-500"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}

export default function AdminAboutPage() {
  const [data, setData] = useState<AboutData>(DEFAULTS)
  const [initial, setInitial] = useState<AboutData>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isDirty = JSON.stringify(data) !== JSON.stringify(initial)

  useEffect(() => {
    fetch('/api/admin/about')
      .then((r) => r.json())
      .then((j) => {
        const merged = { ...DEFAULTS, ...j.data }
        setData(merged)
        setInitial(merged)
      })
      .catch(() => toast({ variant: 'destructive', title: '載入失敗' }))
      .finally(() => setLoading(false))
  }, [])

  // Warn before leaving if dirty
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/about', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('儲存失敗')
      setInitial(data)
      toast({ title: '已儲存所有變更' })
    } catch {
      toast({ variant: 'destructive', title: '儲存失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof AboutData>(key: K, value: string) {
    setData((d) => ({ ...d, [key]: value }))
  }

  if (loading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-24">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">關於我們</h1>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="mb-5">
          <TabsTrigger value="basic">基本資訊</TabsTrigger>
          <TabsTrigger value="social">社群連結</TabsTrigger>
          <TabsTrigger value="preview">預覽</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Basic Info ──────────────────────────────────────────── */}
        <TabsContent value="basic" className="space-y-5">
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">品牌識別</h2>
            <Separator />
            <div className="space-y-2">
              <Label>公司名稱</Label>
              <Input
                value={data.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Furchic"
              />
            </div>
            <div className="space-y-2">
              <Label>品牌描述</Label>
              <Textarea
                rows={4}
                value={data.company_description}
                onChange={(e) => set('company_description', e.target.value)}
                placeholder="品牌核心理念與介紹…"
              />
            </div>
            <div className="space-y-2">
              <Label>品牌 Logo</Label>
              <p className="text-xs text-muted-foreground">
                建議尺寸：400×120px，PNG 透明底
              </p>
              <ImageUploader
                bucketName="company-assets"
                filePath={`logo/brand-logo-${Date.now()}.jpg`}
                onUpload={(url) => set('company_logo_url', url)}
                currentImageUrl={data.company_logo_url || undefined}
                aspectRatio="16:9"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">聯絡資訊</h2>
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={data.company_email}
                  onChange={(e) => set('company_email', e.target.value)}
                  placeholder="hello@furchic.com"
                />
              </div>
              <div className="space-y-2">
                <Label>電話</Label>
                <Input
                  type="tel"
                  value={data.company_phone}
                  onChange={(e) => set('company_phone', e.target.value)}
                  placeholder="+886-2-1234-5678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>地址</Label>
              <Input
                value={data.company_address}
                onChange={(e) => set('company_address', e.target.value)}
                placeholder="台北市信義區信義路五段 7 號"
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Social Links ────────────────────────────────────────── */}
        <TabsContent value="social" className="space-y-5">
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">社群媒體連結</h2>
            <Separator />
            {[
              {
                key: 'social_instagram' as const,
                label: 'Instagram',
                icon: Instagram,
                color: 'bg-pink-500',
                placeholder: 'https://instagram.com/furchic',
              },
              {
                key: 'social_facebook' as const,
                label: 'Facebook',
                icon: Facebook,
                color: 'bg-blue-600',
                placeholder: 'https://facebook.com/furchic',
              },
              {
                key: 'social_line' as const,
                label: 'LINE',
                icon: MessageCircle,
                color: 'bg-green-500',
                placeholder: 'https://line.me/ti/p/@furchic',
              },
              {
                key: 'company_website' as const,
                label: '官方網站',
                icon: Globe,
                color: 'bg-gray-600',
                placeholder: 'https://furchic.com',
              },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.key} className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded',
                        s.color,
                      )}
                    >
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    {s.label}
                  </Label>
                  <Input
                    value={data[s.key]}
                    onChange={(e) => set(s.key, e.target.value)}
                    placeholder={s.placeholder}
                  />
                </div>
              )
            })}
          </div>

          {/* Live preview */}
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground">
              即時預覽
            </h3>
            <SocialPreviewRow
              icon={Instagram}
              label="Instagram"
              url={data.social_instagram}
              color="bg-pink-500"
            />
            <SocialPreviewRow
              icon={Facebook}
              label="Facebook"
              url={data.social_facebook}
              color="bg-blue-600"
            />
            <SocialPreviewRow
              icon={MessageCircle}
              label="LINE"
              url={data.social_line}
              color="bg-green-500"
            />
            <SocialPreviewRow
              icon={Globe}
              label="官方網站"
              url={data.company_website}
              color="bg-gray-600"
            />
          </div>
        </TabsContent>

        {/* ── Tab 3: Preview ─────────────────────────────────────────────── */}
        <TabsContent value="preview">
          <div className="overflow-hidden rounded-xl border">
            {/* Simulated public header */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 px-4 py-12 text-center text-white">
              {data.company_logo_url && (
                <Image
                  src={data.company_logo_url}
                  alt="logo"
                  width={200}
                  height={48}
                  className="mx-auto mb-4 h-12 w-auto object-contain"
                />
              )}
              <h1 className="text-3xl font-extrabold">
                {data.company_name || 'Furchic'}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
                讓每一個毛孩，都被世界溫柔記得
              </p>
            </div>

            <div className="space-y-4 bg-white p-6">
              <div>
                <h3 className="mb-1 font-bold">品牌描述</h3>
                <p className="whitespace-pre-line text-sm text-gray-600">
                  {data.company_description || '（尚未填寫）'}
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                {data.company_email && (
                  <div>
                    <span className="text-xs text-gray-400">Email</span>
                    <p>{data.company_email}</p>
                  </div>
                )}
                {data.company_phone && (
                  <div>
                    <span className="text-xs text-gray-400">電話</span>
                    <p>{data.company_phone}</p>
                  </div>
                )}
                {data.company_address && (
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400">地址</span>
                    <p>{data.company_address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Sticky Save Bar ────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t bg-background/95 px-6 py-3 backdrop-blur-sm transition-all duration-300',
          isDirty ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <p className="text-sm font-medium text-orange-600">⚠️ 有未儲存的變更</p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setData(initial)
              toast({ title: '已還原變更' })
            }}
          >
            還原
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            儲存所有變更
          </Button>
        </div>
      </div>
    </div>
  )
}
