import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  MemberDashboard,
  MemberLevel,
  RewardTransaction,
  DashboardOrder,
  PetWithNfcStatus,
} from '@/types/api'

// ── Raw DB row types ──────────────────────────────────────────────────────────

type UserRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  gender: 'male' | 'female' | 'other' | null
  birthday: string | null
  avatar_url: string | null
  auth_provider: string | null
  member_level_id: string | null
  reward_points: number
  total_spent: number
}

type LevelRow = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: unknown
  sort_order: number
}

type TxRow = {
  id: string
  type: 'earned' | 'spent' | 'adjusted' | 'expired'
  points: number
  note: string | null
  order_id: string | null
  created_at: string
}

type OrderItemRow = {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  products: { images: unknown } | null
}

type OrderRow = {
  id: string
  status: string
  total_amount: number
  created_at: string
  updated_at: string
  order_items: OrderItemRow[]
}

type PetRow = {
  id: string
  name: string
  breed: string | null
  photo_url: string | null
  ai_photo_url: string | null
  card_status: 'none' | 'pending' | 'active' | 'disabled'
  created_at: string
  nfc_cards: { id: string; status: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeLevelProgress(
  totalSpent: number,
  current: LevelRow | null,
  next: LevelRow | null,
): number {
  if (!next) return 100
  const base = current?.min_spent ?? 0
  const span = next.min_spent - base
  if (span <= 0) return 100
  return Math.min(
    100,
    Math.max(0, Math.round(((totalSpent - base) / span) * 100)),
  )
}

function extractThumbnail(items: OrderItemRow[]): string | null {
  for (const item of items) {
    const images = item.products?.images
    if (Array.isArray(images) && typeof images[0] === 'string') return images[0]
  }
  return null
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, _ctx, user) => {
  const admin = createAdminClient()
  const userId = user.id

  const [userRes, levelsRes, txRes, ordersRes, petsRes, totalOrdersRes] =
    await Promise.all([
      // 1. User profile
      admin
        .from('users')
        .select(
          'id, name, phone, email, gender, birthday, avatar_url, auth_provider, member_level_id, reward_points, total_spent',
        )
        .eq('id', userId)
        .single(),

      // 2. All member levels (for progress calculation)
      admin
        .from('member_levels')
        .select(
          'id, name, min_spent, reward_rate, discount_rate, benefits, sort_order',
        )
        .order('sort_order', { ascending: true }),

      // 3. Recent reward transactions (last 5)
      admin
        .from('reward_transactions')
        .select('id, type, points, note, order_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 4. Recent orders with first item thumbnail (last 5)
      admin
        .from('orders')
        .select(
          'id, status, total_amount, created_at, updated_at, order_items(product_id, product_name, quantity, unit_price, products(images))',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 5. All pets with NFC card status
      admin
        .from('pets')
        .select(
          'id, name, breed, photo_url, ai_photo_url, card_status, created_at, nfc_cards(id, status)',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // 6. Total orders count (for stats)
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '(cancelled,refunded)'),
    ])

  if (userRes.error || !userRes.data) {
    return apiError('找不到使用者', 404, 'NOT_FOUND')
  }

  const u = userRes.data as unknown as UserRow
  const levels = (levelsRes.data as unknown as LevelRow[]) ?? []
  const txs = (txRes.data as unknown as TxRow[]) ?? []
  const orders = (ordersRes.data as unknown as OrderRow[]) ?? []
  const pets = (petsRes.data as unknown as PetRow[]) ?? []

  // ── Level resolution ────────────────────────────────────────────────────────

  const currentLevel: MemberLevel | null =
    levels.find((l) => l.id === u.member_level_id) ?? null

  const nextLevel: MemberLevel | null =
    levels.find((l) => l.min_spent > u.total_spent) ?? null

  const levelProgress = computeLevelProgress(
    u.total_spent,
    currentLevel,
    nextLevel,
  )

  // ── Shape recent transactions ────────────────────────────────────────────────

  const recentTransactions: RewardTransaction[] = txs.map((tx) => ({
    id: tx.id,
    type: tx.type,
    points: tx.points,
    note: tx.note,
    order_id: tx.order_id,
    created_at: tx.created_at,
  }))

  // ── Shape recent orders ──────────────────────────────────────────────────────

  const recentOrders: DashboardOrder[] = orders.map((order) => ({
    id: order.id,
    status: order.status,
    total_amount: order.total_amount,
    created_at: order.created_at,
    updated_at: order.updated_at,
    thumbnail: extractThumbnail(order.order_items),
    item_count: order.order_items.length,
    first_item_name: order.order_items[0]?.product_name ?? null,
  }))

  // ── Shape pets ───────────────────────────────────────────────────────────────

  const petsWithNfc: PetWithNfcStatus[] = pets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    photo_url: pet.photo_url,
    ai_photo_url: pet.ai_photo_url,
    card_status: pet.card_status,
    nfc_active: pet.nfc_cards.some((c) => c.status === 'active'),
    created_at: pet.created_at,
  }))

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = {
    total_orders: totalOrdersRes.count ?? 0,
    total_pets: pets.length,
    active_nfc_cards: pets.reduce(
      (sum, p) => sum + p.nfc_cards.filter((c) => c.status === 'active').length,
      0,
    ),
  }

  // ── Response ─────────────────────────────────────────────────────────────────

  const dashboard: MemberDashboard = {
    user: {
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      gender: u.gender,
      birthday: u.birthday,
      avatar_url: u.avatar_url,
      auth_provider: u.auth_provider,
    },
    level: currentLevel,
    reward_points: u.reward_points,
    total_spent: u.total_spent,
    next_level: nextLevel,
    level_progress: levelProgress,
    recent_transactions: recentTransactions,
    recent_orders: recentOrders,
    pets: petsWithNfc,
    stats,
  }

  return apiSuccess(dashboard)
})
