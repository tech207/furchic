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
