import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PetFormWizard } from '@/components/pets/PetFormWizard'

export default async function NewPetPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <main>
      <div className="border-b bg-background px-4 py-4">
        <h1 className="text-center text-base font-semibold">新增寵物</h1>
      </div>
      <PetFormWizard mode="create" userId={user.id} />
    </main>
  )
}
