import type { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import type { RouteHandlerContext } from '@/lib/auth/guards'

// Maps public_fields names → pets table column names
const FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  breed: 'breed',
  gender: 'gender',
  birthday: 'birthday',
  is_neutered: 'is_neutered',
  chip_id: 'chip_id',
  photo: 'photo_url',
  vet_hospital: 'vet_hospital',
  special_care: 'special_care',
  special_care_note: 'special_care_note',
}

type NfcCardRow = { id: string; pet_id: string | null; status: string }
type PetRow = Record<string, unknown> & {
  card_status: string
  public_fields: string[]
}
type CaregiverPublicRow = {
  id: string
  display_name: string | null
  contact_methods: Array<{ is_public: boolean; [key: string]: unknown }>
  sort_order: number
  users: { id: string; name: string; avatar_url: string | null } | null
}

export async function GET(_req: NextRequest, ctx: RouteHandlerContext) {
  const uuid = ctx.params?.uuid as string | undefined
  if (!uuid) return apiError('缺少 UUID', 400, 'MISSING_UUID')

  const supabase = createClient()

  const { data: nfcCardRaw, error: nfcError } = await supabase
    .from('nfc_cards')
    .select('id, pet_id, status')
    .eq('id', uuid)
    .single()

  if (nfcError || !nfcCardRaw)
    return apiError('找不到此 NFC 卡', 404, 'NOT_FOUND')

  const nfcCard = nfcCardRaw as unknown as NfcCardRow

  if (!nfcCard.pet_id) return apiError('此 NFC 卡尚未綁定寵物', 404, 'UNBOUND')

  const { data: petRaw, error: petError } = await supabase
    .from('pets')
    .select(
      'id, name, breed, gender, birthday, is_neutered, chip_id, photo_url, public_fields, card_status, vet_hospital, special_care, special_care_note',
    )
    .eq('id', nfcCard.pet_id)
    .single()

  if (petError || !petRaw) return apiError('找不到寵物資料', 404, 'NOT_FOUND')

  const pet = petRaw as unknown as PetRow

  if (pet.card_status === 'disabled') {
    return apiSuccess({ disabled: true })
  }

  // Build filtered pet object from public_fields
  const publicFields = Array.isArray(pet.public_fields) ? pet.public_fields : []
  const publicPet: Record<string, unknown> = { id: pet.id }

  for (const field of publicFields) {
    const col = FIELD_TO_COLUMN[field]
    if (col !== undefined && pet[col] !== undefined) {
      const outKey = field === 'photo' ? 'photo_url' : col
      publicPet[outKey] = pet[col]
    }
  }

  // Get visible caregivers with public contact methods only
  const { data: caregiversRaw } = await supabase
    .from('pet_caregivers')
    .select(
      `id, display_name, contact_methods, sort_order,
      users ( id, name, avatar_url )`,
    )
    .eq('pet_id', nfcCard.pet_id)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  const caregivers = (caregiversRaw as unknown as CaregiverPublicRow[]) ?? []
  const publicCaregivers = caregivers.map((c) => ({
    id: c.id,
    display_name: c.display_name,
    contact_methods: (c.contact_methods ?? []).filter((m) => m.is_public),
    user: c.users,
  }))

  return apiSuccess({ pet: publicPet, caregivers: publicCaregivers })
}
