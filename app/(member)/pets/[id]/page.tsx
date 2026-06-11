import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PetDetailClient } from '@/components/pets/PetDetailClient'
import type { PetDetailData } from '@/components/pets/PetDetailClient'
import type { Caregiver } from '@/components/pets/CaregiversSection'

export default async function PetDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Verify access via pet_caregivers
  const { data: myEntryRaw, error: accessError } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (accessError) {
    console.error(
      '[pet detail] pet_caregivers access check failed:',
      accessError.message,
      'pet_id:',
      params.id,
    )
  }
  if (!myEntryRaw) notFound()
  const myRole = (myEntryRaw as unknown as { role: 'owner' | 'caregiver' }).role

  // Fetch pet + nfc card
  const { data: petRaw, error: petErr } = await supabase
    .from('pets')
    .select('*, nfc_cards ( id, status, bound_at, qr_url )')
    .eq('id', params.id)
    .single()

  if (petErr) {
    console.error(
      '[pet detail] pets query failed:',
      petErr.message,
      'pet_id:',
      params.id,
    )
  }
  if (petErr || !petRaw) notFound()

  const petData = petRaw as unknown as Record<string, unknown>
  const nfcRaw = petData.nfc_cards
  const nfc_card = Array.isArray(nfcRaw)
    ? (nfcRaw[0] ?? null)
    : (nfcRaw ?? null)

  const pet: PetDetailData = {
    id: petData.id as string,
    name: petData.name as string,
    breed: petData.breed as string | null,
    gender: petData.gender as string | null,
    birthday: petData.birthday as string | null,
    is_neutered: petData.is_neutered as boolean,
    chip_id: petData.chip_id as string | null,
    photo_url: petData.photo_url as string | null,
    ai_photo_url: petData.ai_photo_url as string | null,
    public_fields: (petData.public_fields as string[]) ?? [],
    card_status: petData.card_status as string,
    vet_hospital: petData.vet_hospital as string,
    special_care: petData.special_care as boolean,
    special_care_note: petData.special_care_note as string | null,
    nfc_card: nfc_card as PetDetailData['nfc_card'],
  }

  // Fetch caregivers
  const { data: caregiversRaw } = await supabase
    .from('pet_caregivers')
    .select(
      `id, role, display_name, contact_methods, is_visible,
      sort_order, invited_at, accepted_at, created_at,
      users ( id, name, avatar_url )`,
    )
    .eq('pet_id', params.id)
    .order('sort_order', { ascending: true })

  const caregivers = (caregiversRaw as unknown as Caregiver[]) ?? []

  return (
    <PetDetailClient
      pet={pet}
      caregivers={caregivers}
      myRole={myRole}
      currentUserId={user.id}
    />
  )
}
