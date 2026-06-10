import Link from 'next/link'
import { Plus, PawPrint, ShoppingBag } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CARD_STATUS_MAP = {
  none: { label: '尚未申請', class: 'bg-gray-100 text-gray-500' },
  pending: { label: '製作中', class: 'bg-orange-100 text-orange-600' },
  active: { label: '已啟用', class: 'bg-green-100 text-green-700' },
  disabled: { label: '已停用', class: 'bg-red-100 text-red-600' },
}

function calcAge(birthday: string | null): string | null {
  if (!birthday) return null
  const diff = Date.now() - new Date(birthday).getTime()
  const totalMonths = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000))
  if (totalMonths < 1) return '幼崽'
  if (totalMonths < 12) return `${totalMonths} 個月`
  return `${Math.floor(totalMonths / 12)} 歲`
}

type PetCardData = {
  id: string
  name: string
  breed: string | null
  birthday: string | null
  photo_url: string | null
  ai_photo_url: string | null
  card_status: string
}

export default async function PetsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Query own pets directly + caregiver pets separately, then merge
  const [{ data: ownPetsRaw }, { data: caregiverRows }] = await Promise.all([
    supabase
      .from('pets')
      .select('id, name, breed, birthday, photo_url, ai_photo_url, card_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('pet_caregivers')
      .select(
        'pet_id, role, pets (id, name, breed, birthday, photo_url, ai_photo_url, card_status)',
      )
      .eq('user_id', user.id)
      .neq('role', 'owner')
      .order('created_at', { ascending: false }),
  ])

  type CaregiverRow = { pet_id: string; role: string; pets: PetCardData | null }

  const ownPets = ((ownPetsRaw as unknown as PetCardData[]) ?? []).map((p) => ({
    ...p,
    my_role: 'owner' as const,
  }))

  const caregiverPets = ((caregiverRows as unknown as CaregiverRow[]) ?? [])
    .filter((r) => r.pets !== null)
    .filter((r) => !ownPets.some((p) => p.id === r.pet_id))
    .map((r) => ({ ...r.pets!, my_role: r.role }))

  const pets = [...ownPets, ...caregiverPets]

  return (
    <main className="container py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">我的寵物</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/pets/new">
            <Plus className="h-4 w-4" />
            新增寵物
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {pets.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed bg-muted/20 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <PawPrint className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">還沒有寵物</p>
            <p className="text-sm text-muted-foreground">
              新增第一隻毛孩，建立專屬 NFC 名片
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="gap-1.5">
              <Link href="/pets/new">
                <Plus className="h-4 w-4" />
                新增第一隻寵物
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/shop">
                <ShoppingBag className="h-4 w-4" />
                先去逛逛
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {pets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pets.map((pet) => {
            const photoSrc = pet.ai_photo_url ?? pet.photo_url
            const status =
              CARD_STATUS_MAP[
                pet.card_status as keyof typeof CARD_STATUS_MAP
              ] ?? CARD_STATUS_MAP.none
            const age = calcAge(pet.birthday)

            return (
              <Link
                key={pet.id}
                href={`/pets/${pet.id}`}
                className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Photo */}
                <div className="relative h-44 w-full overflow-hidden bg-muted/40">
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt={pet.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PawPrint className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* NFC badge */}
                  <span
                    className={cn(
                      'absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm',
                      status.class,
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Info */}
                <div className="px-4 py-3">
                  <p className="font-semibold">{pet.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                    {pet.breed && <span>{pet.breed}</span>}
                    {pet.breed && age && <span>·</span>}
                    {age && <span>{age}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
