import { Skeleton } from '@/components/ui/skeleton'

export default function PetsLoading() {
  return (
    <main className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="space-y-2 px-4 py-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
