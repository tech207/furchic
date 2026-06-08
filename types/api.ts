export type ApiSuccess<T> = {
  data: T
  message?: string
}

export type ApiError = {
  error: string
  message: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type PaginationQuery = {
  page?: number
  limit?: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: PaginationMeta
}

// ── Member Dashboard ──────────────────────────────────────────────────────────

export type MemberLevel = {
  id: string
  name: string
  min_spent: number
  reward_rate: number
  discount_rate: number
  benefits: unknown
  sort_order: number
}

export type RewardTransaction = {
  id: string
  type: 'earned' | 'spent' | 'adjusted' | 'expired'
  points: number
  note: string | null
  order_id: string | null
  created_at: string
}

export type DashboardOrder = {
  id: string
  status: string
  total_amount: number
  created_at: string
  updated_at: string
  thumbnail: string | null
  item_count: number
  first_item_name: string | null
}

export type PetWithNfcStatus = {
  id: string
  name: string
  breed: string | null
  photo_url: string | null
  ai_photo_url: string | null
  card_status: 'none' | 'pending' | 'active' | 'disabled'
  nfc_active: boolean
  created_at: string
}

// ── Draft / Preview / Publish ─────────────────────────────────────────────────

export type DraftResourceType =
  | 'product_price'
  | 'banner'
  | 'faq'
  | 'policy'
  | 'promotion'

export type DraftPreview = {
  id: string
  resource_type: DraftResourceType
  resource_id: string | null
  draft_data: Record<string, unknown>
  preview_token: string
  created_by: string | null
  expires_at: string
  published_at: string | null
  created_at: string
}

/** Returned by POST /api/admin/drafts */
export type CreateDraftResponse = {
  draft_id: string
  preview_token: string
  preview_url: string
  expires_at: string
}

/** Returned by GET /api/preview/[token] */
export type PreviewResponse = {
  id: string
  resource_type: DraftResourceType
  resource_id: string | null
  draft_data: Record<string, unknown>
  expires_at: string
  published_at: string | null
  created_at: string
}

// ── Draft data shapes per resource type ──────────────────────────────────────

export type ProductPriceDraft = {
  variant_id: string
  original_price: number
  sale_price: number
  sale_starts_at?: string | null
  sale_ends_at?: string | null
}

export type FaqItem = {
  id?: string
  question: string
  answer: string
  category?: string
  sort_order?: number
  is_active?: boolean
}

export type FaqDraft = {
  faqs: FaqItem[]
}

export type PolicyDraft = {
  title?: string
  content: string
  meta_title?: string | null
  meta_description?: string | null
}

// ── Member Dashboard ──────────────────────────────────────────────────────────

export type MemberDashboard = {
  user: {
    id: string
    name: string
    phone: string | null
    email: string | null
    gender: 'male' | 'female' | 'other' | null
    birthday: string | null
    avatar_url: string | null
    auth_provider: string | null
  }
  level: MemberLevel | null
  reward_points: number
  total_spent: number
  next_level: MemberLevel | null
  level_progress: number // 0–100
  recent_transactions: RewardTransaction[]
  recent_orders: DashboardOrder[]
  pets: PetWithNfcStatus[]
  stats: {
    total_orders: number
    total_pets: number
    active_nfc_cards: number
  }
}
