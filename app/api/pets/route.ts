import type { NextRequest } from 'next/server'
import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPetSchema } from '@/lib/validations/pet'

type CaregiverWithPet = {
  role: 'owner' | 'caregiver'
  pets: {
    id: string
    name: string
    breed: string | null
    gender: string | null
    birthday: string | null
    is_neutered: boolean
    chip_id: string | null
    photo_url: string | null
    ai_photo_url: string | null
    public_fields: unknown
    card_status: string
    vet_hospital: string
    special_care: boolean
    special_care_note: string | null
    created_at: string
    updated_at: string
    nfc_cards: { id: string; status: string; bound_at: string | null }[] | null
  } | null
}

export const GET = withAuth(async (_req, _ctx, user) => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pet_caregivers')
    .select(
      `role,
      pets (
        id, name, breed, gender, birthday, is_neutered, chip_id,
        photo_url, ai_photo_url, public_fields, card_status,
        vet_hospital, special_care, special_care_note,
        created_at, updated_at,
        nfc_cards ( id, status, bound_at )
      )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/pets]', error.message)
    return apiError('載入失敗', 500, 'FETCH_FAILED')
  }

  const rows = (data ?? []) as unknown as CaregiverWithPet[]
  const pets = rows
    .filter((row) => row.pets !== null)
    .map((row) => {
      const pet = row.pets!
      const nfcArr = pet.nfc_cards
      const nfc_card = Array.isArray(nfcArr) ? (nfcArr[0] ?? null) : null
      return { ...pet, nfc_cards: undefined, nfc_card, my_role: row.role }
    })

  return apiSuccess({ pets })
})

export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = createPetSchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const supabase = createClient()

  // Check per-user pet limit from system_settings
  const { data: limitSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'max_pets_per_user')
    .single()
  const settingValue = (limitSetting as unknown as { value: unknown } | null)
    ?.value
  const maxPets = typeof settingValue === 'number' ? settingValue : 5

  const { count } = await supabase
    .from('pet_caregivers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'owner')

  if ((count ?? 0) >= maxPets) {
    return apiError(
      `每位用戶最多可建立 ${maxPets} 隻寵物`,
      422,
      'PET_LIMIT_EXCEEDED',
    )
  }

  const admin = createAdminClient()

  const { data: pet, error: petError } = await admin
    .from('pets')
    .insert({ ...result.data, user_id: user.id })
    .select()
    .single()

  if (petError || !pet) {
    console.error('[POST /api/pets] insert pet', petError?.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  const petId = (pet as unknown as { id: string }).id

  const { error: caregiverError } = await admin.from('pet_caregivers').insert({
    pet_id: petId,
    user_id: user.id,
    role: 'owner',
    accepted_at: new Date().toISOString(),
  })

  if (caregiverError) {
    // Compensate: remove orphaned pet
    await admin.from('pets').delete().eq('id', petId)
    console.error('[POST /api/pets] insert caregiver', caregiverError.message)
    return apiError('建立失敗', 500, 'CREATE_FAILED')
  }

  return apiSuccess({ pet: pet as unknown as Record<string, unknown> }, 201)
})
