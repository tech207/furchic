import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, type AppUser } from './session'

export type RouteHandlerContext = { params?: Record<string, string | string[]> }
export type RouteHandler = (
  req: NextRequest,
  ctx: RouteHandlerContext,
) => Promise<Response>
export type AuthedRouteHandler = (
  req: NextRequest,
  ctx: RouteHandlerContext,
  user: AppUser,
) => Promise<Response>

// Extended type for new admin columns (returned by select('*') after migration 008)
type AdminUser = AppUser & {
  admin_role_id: string | null
  is_active_admin: boolean
}

type AdminRoleRow = {
  name: string
  permissions: string[]
}

/**
 * Wraps a Route Handler with authentication.
 * Returns 401 if no valid session; passes the full AppUser as the third argument.
 */
export function withAuth(handler: AuthedRouteHandler): RouteHandler {
  return async (req, ctx) => {
    const user = await getCurrentUser()
    if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    return handler(req, ctx, user)
  }
}

/**
 * Wraps a Route Handler with admin-only access.
 * Returns 401 if no session; 403 if role !== 'admin'.
 * Backward-compatible: does not check admin_role_id or is_active_admin.
 */
export function withAdmin(handler: AuthedRouteHandler): RouteHandler {
  return async (req, ctx) => {
    const user = await getCurrentUser()
    if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    if (user.role !== 'admin') return apiError('Forbidden', 403, 'FORBIDDEN')
    return handler(req, ctx, user)
  }
}

/**
 * Wraps a Route Handler requiring a specific permission string.
 * Checks: role='admin' → is_active_admin=true → role.permissions includes `permission`.
 * super_admin role bypasses the permission check (has all permissions).
 * Admins with no admin_role_id assigned are treated as having full access (backward compat).
 */
export function withPermission(permission: string) {
  return function (handler: AuthedRouteHandler): RouteHandler {
    return async (req, ctx) => {
      const user = await getCurrentUser()
      if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')
      if (user.role !== 'admin') return apiError('Forbidden', 403, 'FORBIDDEN')

      const adminUser = user as unknown as AdminUser
      if (adminUser.is_active_admin === false) {
        return apiError('帳號已停用，請聯繫超級管理員', 403, 'ACCOUNT_DISABLED')
      }

      // No role assigned → backward-compat full access
      if (!adminUser.admin_role_id) return handler(req, ctx, user)

      const supabase = createAdminClient()
      const { data: roleRaw, error } = await supabase
        .from('admin_roles')
        .select('name, permissions')
        .eq('id', adminUser.admin_role_id)
        .maybeSingle()

      if (error || !roleRaw)
        return apiError('角色資料錯誤', 403, 'INVALID_ROLE')

      const role = roleRaw as unknown as AdminRoleRow

      // super_admin bypasses all permission checks
      if (role.name === 'super_admin') return handler(req, ctx, user)

      const perms: string[] = Array.isArray(role.permissions)
        ? role.permissions
        : []
      if (!perms.includes(permission)) {
        return apiError(`需要 ${permission} 權限`, 403, 'PERMISSION_DENIED')
      }

      return handler(req, ctx, user)
    }
  }
}

/**
 * Wraps a Route Handler requiring the super_admin role specifically.
 * Used for staff management and system configuration routes.
 */
export function withSuperAdmin(handler: AuthedRouteHandler): RouteHandler {
  return async (req, ctx) => {
    const user = await getCurrentUser()
    if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    if (user.role !== 'admin') return apiError('Forbidden', 403, 'FORBIDDEN')

    const adminUser = user as unknown as AdminUser
    if (adminUser.is_active_admin === false) {
      return apiError('帳號已停用', 403, 'ACCOUNT_DISABLED')
    }
    if (!adminUser.admin_role_id) {
      return apiError('需要超級管理員角色', 403, 'FORBIDDEN')
    }

    const supabase = createAdminClient()
    const { data: roleRaw } = await supabase
      .from('admin_roles')
      .select('name')
      .eq('id', adminUser.admin_role_id)
      .maybeSingle()

    const roleName = (roleRaw as { name: string } | null)?.name
    if (roleName !== 'super_admin') {
      return apiError('需要超級管理員角色', 403, 'FORBIDDEN')
    }

    return handler(req, ctx, user)
  }
}

/**
 * Parses and validates the request body against a Zod schema.
 * Returns 400 on missing/malformed JSON or schema validation failure.
 */
export function withBody<T>(
  schema: z.ZodSchema<T>,
  handler: (
    req: NextRequest,
    ctx: RouteHandlerContext,
    body: T,
  ) => Promise<Response>,
): RouteHandler {
  return async (req, ctx) => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return apiError('Invalid request body', 400, 'INVALID_JSON')
    }
    const result = schema.safeParse(raw)
    if (!result.success) {
      return apiError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        result.error.errors,
      )
    }
    return handler(req, ctx, result.data)
  }
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return Response.json({ data }, { status, headers })
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: unknown,
): Response {
  return Response.json(
    {
      error: code ?? 'ERROR',
      message,
      ...(details !== undefined && { details }),
    },
    { status },
  )
}
