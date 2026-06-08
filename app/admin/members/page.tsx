'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = { id: string; name: string }

type Member = {
  id: string
  name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  auth_provider: string | null
  member_level_id: string | null
  reward_points: number
  total_spent: number
  created_at: string
  pet_count: number
  order_count: number
  member_levels: { id: string; name: string } | null
}

// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: Member }) {
  const initials = member.name.slice(0, 2)
  return member.avatar_url ? (
    <Image
      src={member.avatar_url}
      alt={member.name}
      width={36}
      height={36}
      className="h-9 w-9 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
      {initials}
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function MemberDrawer({
  member,
  onClose,
}: {
  member: Member | null
  onClose: () => void
}) {
  return (
    <Sheet
      open={!!member}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="w-[360px] overflow-y-auto">
        {member && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>會員詳情</SheetTitle>
            </SheetHeader>

            {/* Profile */}
            <div className="mb-5 flex items-center gap-3">
              <Avatar member={member} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{member.name}</span>
                  {member.role === 'admin' && (
                    <Badge className="border-red-200 bg-red-100 text-xs text-red-700">
                      Admin
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {member.email ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {member.phone ?? '—'}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                { label: '等級', value: member.member_levels?.name ?? '—' },
                { label: '回饋金', value: `${member.reward_points} 點` },
                {
                  label: '累計消費',
                  value: `NT$${member.total_spent.toLocaleString()}`,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-muted/30 p-3 text-center"
                >
                  <p className="text-sm font-semibold">{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              {[
                { label: '寵物數', value: member.pet_count },
                { label: '訂單數', value: member.order_count },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-muted/30 p-3 text-center"
                >
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mb-5 text-xs text-muted-foreground">
              <p>
                加入日期：
                {new Date(member.created_at).toLocaleDateString('zh-TW')}
              </p>
              <p>登入方式：{member.auth_provider ?? 'email'}</p>
            </div>

            <Link href={`/admin/members/${member.id}`}>
              <Button className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                查看完整資料
              </Button>
            </Link>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [provFilter, setProvFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchMembers = useCallback(
    async (
      p: number,
      s: string,
      lv: string,
      prov: string,
      sd: string,
      ed: string,
    ) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p) })
        if (s) params.set('search', s)
        if (lv) params.set('level', lv)
        if (prov) params.set('provider', prov)
        if (sd) params.set('start_date', sd)
        if (ed) params.set('end_date', ed)
        const res = await fetch(`/api/admin/members?${params}`)
        const json = await res.json()
        setMembers(json.data?.members ?? [])
        setTotal(json.data?.total ?? 0)
      } catch {
        toast({ variant: 'destructive', title: '載入失敗' })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchMembers(page, search, levelFilter, provFilter, startDate, endDate)
  }, [fetchMembers, page, search, levelFilter, provFilter, startDate, endDate])

  // Load levels for filter
  useEffect(() => {
    fetch('/api/admin/member-levels')
      .then((r) => r.json())
      .then((j) => setLevels(j.data?.levels ?? []))
  }, [])

  function handleSearch(v: string) {
    setDraftSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setSearch(v)
      setPage(1)
    }, 400)
  }

  function handleExport() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (levelFilter) params.set('level', levelFilter)
    window.open(`/api/admin/members/export?${params}`, '_blank')
  }

  const PROVIDER_LABELS: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
    email: 'Email',
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">會員管理</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            匯出 CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              fetchMembers(
                page,
                search,
                levelFilter,
                provFilter,
                startDate,
                endDate,
              )
            }
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            重整
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            placeholder="姓名、Email、電話…"
            value={draftSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {draftSearch && (
            <button
              className="absolute right-3 top-2.5 text-muted-foreground"
              onClick={() => {
                setDraftSearch('')
                setSearch('')
                setPage(1)
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={levelFilter || 'all'}
          onValueChange={(v) => {
            setLevelFilter(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="等級" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有等級</SelectItem>
            {levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={provFilter || 'all'}
          onValueChange={(v) => {
            setProvFilter(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="登入方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有方式</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-36"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value)
            setPage(1)
          }}
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          className="w-36"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value)
            setPage(1)
          }}
        />

        <span className="ml-auto text-sm text-muted-foreground">
          共 {total} 人
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {[
                '會員',
                'Email',
                '電話',
                '等級',
                '寵物',
                '訂單數',
                '累計消費',
                '加入日期',
                '',
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="py-16 text-center text-muted-foreground"
                >
                  無會員資料
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    'cursor-pointer border-b transition-colors hover:bg-gray-50',
                    selected?.id === m.id && 'bg-orange-50',
                  )}
                  onClick={() => setSelected(m)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar member={m} />
                      <div>
                        <div className="flex items-center gap-1.5 font-medium">
                          {m.name}
                          {m.role === 'admin' && (
                            <Badge className="border-red-200 bg-red-100 py-0 text-xs text-red-700">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {PROVIDER_LABELS[m.auth_provider ?? 'email'] ??
                            m.auth_provider}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {m.member_levels ? (
                      <Badge
                        variant="outline"
                        className="flex w-fit items-center gap-1 text-xs"
                      >
                        <Crown className="h-3 w-3 text-orange-400" />
                        {m.member_levels.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {m.pet_count}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {m.order_count}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    NT${m.total_spent.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/admin/members/${m.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        詳情
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          第 {page} / {totalPages} 頁
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Side drawer */}
      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
