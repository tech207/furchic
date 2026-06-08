'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function PetCardEditButton({ petId }: { petId: string }) {
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('pet_caregivers')
        .select('role')
        .eq('pet_id', petId)
        .eq('user_id', user.id)
        .single()

      if ((data as unknown as { role: string } | null)?.role === 'owner') {
        setIsOwner(true)
      }
    }
    void check()
  }, [petId])

  if (!isOwner) return null

  return (
    <Link
      href={`/pets/${petId}`}
      className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 active:scale-95"
    >
      <Pencil className="h-3.5 w-3.5" />
      編輯名片
    </Link>
  )
}
