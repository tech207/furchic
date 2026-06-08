import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PetFormWizard } from '@/components/pets/PetFormWizard'
import type { PetFormInitialData } from '@/components/pets/PetFormWizard'

export default async function EditPetPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Owner only
  const { data: entryRaw } = await supabase
    .from('pet_caregivers')
    .select('role')
    .eq('pet_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!entryRaw) notFound()
  if ((entryRaw as unknown as { role: string }).role !== 'owner') notFound()

  const { data: petRaw, error } = await supabase
    .from('pets')
    .select(
      'id, name, breed, gender, birthday, is_neutered, chip_id, vet_hospital, special_care, special_care_note, photo_url',
    )
    .eq('id', params.id)
    .single()

  if (error || !petRaw) notFound()

  const p = petRaw as unknown as Record<string, unknown>
  const initialData: PetFormInitialData = {
    name: p.name as string,
    breed: p.breed as string | null,
    gender: p.gender as 'male' | 'female' | null,
    birthday: p.birthday as string | null,
    is_neutered: p.is_neutered as boolean,
    chip_id: p.chip_id as string | null,
    vet_hospital: p.vet_hospital as string,
    special_care: p.special_care as boolean,
    special_care_note: p.special_care_note as string | null,
    photo_url: p.photo_url as string | null,
  }

  return (
    <main>
      <div className="border-b bg-background px-4 py-4">
        <h1 className="text-center text-base font-semibold">編輯寵物資料</h1>
      </div>
      <PetFormWizard
        mode="edit"
        petId={params.id}
        userId={user.id}
        initialData={initialData}
      />
    </main>
  )
}
