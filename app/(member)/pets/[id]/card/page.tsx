import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  CardRequestFlow,
  type CardPageState,
  type CardPet,
  type ExistingRequest,
  type IneligibleReason,
  type QualifyingOrder,
} from '@/components/pets/CardRequestFlow'

export default async function CardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Verify access
  const { data: myEntryRaw } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!myEntryRaw) notFound()
  const isOwner = (myEntryRaw as unknown as { role: string }).role === 'owner'

  // Fetch pet
  const { data: petRaw, error: petErr } = await supabase
    .from('pets')
    .select(
      'id, name, breed, ai_photo_url, photo_url, vet_hospital, card_status',
    )
    .eq('id', params.id)
    .single()

  if (petErr || !petRaw) notFound()
  const pet = petRaw as unknown as CardPet

  // System setting
  const { data: settingRaw } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'card_request_enabled')
    .single()
  const requestsEnabled =
    (settingRaw as unknown as { value: boolean } | null)?.value ?? false

  // Existing request
  const { data: existingRaw } = await supabase
    .from('card_print_requests')
    .select('id, status, source, created_at')
    .eq('pet_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const existingRequest =
    (existingRaw as unknown as ExistingRequest | null) ?? null

  // Qualifying online orders (paid and not used for a card request yet)
  let qualifyingOrders: QualifyingOrder[] = []
  if (isOwner && !existingRequest && pet.card_status === 'none') {
    const { data: ordersRaw } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status')
      .eq('user_id', user.id)
      .in('status', ['paid', 'processing', 'shipped', 'done'])
      .order('created_at', { ascending: false })

    if (ordersRaw) {
      const usedOrderIds = new Set<string>()
      const { data: usedRaw } = await supabase
        .from('card_print_requests')
        .select('order_id')
        .eq('user_id', user.id)
        .not('order_id', 'is', null)

      for (const r of (usedRaw as unknown as Array<{
        order_id: string | null
      }>) ?? []) {
        if (r.order_id) usedOrderIds.add(r.order_id)
      }

      qualifyingOrders = (
        ordersRaw as unknown as Array<{
          id: string
          created_at: string
          total_amount: number
          status: string
        }>
      ).filter((o) => !usedOrderIds.has(o.id))
    }
  }

  // Determine page state
  let pageState: CardPageState = 'ineligible'
  let ineligibleReason: IneligibleReason | null = null

  if (!isOwner) {
    ineligibleReason = 'not_owner'
  } else if (pet.card_status === 'active' || pet.card_status === 'disabled') {
    pageState = 'has_card'
  } else if (pet.card_status === 'pending' || existingRequest) {
    pageState = 'applied'
  } else if (!requestsEnabled) {
    ineligibleReason = 'requests_disabled'
  } else if (!pet.ai_photo_url) {
    ineligibleReason = 'no_ai_photo'
  } else if (!pet.vet_hospital) {
    ineligibleReason = 'no_vet_hospital'
  } else {
    pageState = 'eligible'
  }

  return (
    <main>
      <div className="border-b bg-background px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Link
            href={`/pets/${params.id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {pet.name}
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">申請製卡</span>
        </div>
      </div>

      <CardRequestFlow
        petId={params.id}
        pet={pet}
        pageState={pageState}
        ineligibleReason={ineligibleReason}
        existingRequest={existingRequest}
        qualifyingOrders={qualifyingOrders}
      />
    </main>
  )
}
