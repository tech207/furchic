import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, type AppUser } from './session'

export type RouteHandlerContext = { params?: Record<string, string | string[]> }
export type RouteHandler = (req: NextRequest, ctx: RouteHandlerContext) => Promise<Response>
export type AuthedRouteHandler = (
  req: NextRequest,
  ctx: RouteHandlerContext,
  user: AppUser,
) => Promise<Response>

/**
 * Wraps a Route Handler with authentication.
 * Returns 401 if no valid session; passes the full AppUser as the third argument.
 *
 * Usage: export const GET = withAuth(async (req, ctx, user) => { ... })
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
 * Returns 401 if no session; 403 if authenticated but role !== 'admin'.
 * Role is read from the `users` table (DB), not JWT metadata.
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
 * Parses and validates the request body against a Zod schema.
 * Returns 400 on missing/malformed JSON or schema validation failure.
 *
 * Usage: export const POST = withBody(MySchema, async (req, ctx, body) => { ... })
 * Compose with auth:  withAuth(async (req, ctx, user) => withBody(schema, handler)(req, ctx))
 */
export function withBody<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, ctx: RouteHandlerContext, body: T) => Promise<Response>,
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
      return apiError('Validation failed', 400, 'VALIDATION_ERROR', result.error.errors)
    }
    return handler(req, ctx, result.data)
  }
}

export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status })
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
