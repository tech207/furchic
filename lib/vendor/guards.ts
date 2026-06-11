import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCurrentVendorAccount, type VendorAccount } from './session'

type RouteHandlerContext = { params?: Record<string, string | string[]> }
type RouteHandler = (
  req: NextRequest,
  ctx: RouteHandlerContext,
) => Promise<Response>

export type VendorAuthedHandler = (
  req: NextRequest,
  ctx: RouteHandlerContext,
  account: VendorAccount,
) => Promise<Response>

function unauthorized(message: string, code: string): Response {
  return NextResponse.json({ error: code, message }, { status: 401 })
}

function forbidden(message: string, code: string): Response {
  return NextResponse.json({ error: code, message }, { status: 403 })
}

/**
 * Wraps a Route Handler with vendor authentication.
 * Checks: session → vendor_account.is_active → vendor.status = 'approved'
 * Passes the resolved VendorAccount as the third argument.
 */
export function withVendorAuth(handler: VendorAuthedHandler): RouteHandler {
  return async (req, ctx) => {
    const account = await getCurrentVendorAccount()

    if (!account) {
      return unauthorized('請先登入廠商帳號', 'UNAUTHORIZED')
    }
    if (account.vendor.status === 'pending') {
      return forbidden('廠商帳號審核中，請等待通知', 'PENDING_APPROVAL')
    }
    if (account.vendor.status !== 'approved') {
      return forbidden('廠商帳號已停用，請聯絡平台', 'VENDOR_NOT_APPROVED')
    }

    return handler(req, ctx, account)
  }
}

/**
 * Wraps a Route Handler requiring a specific permission.
 * Inherits all checks from withVendorAuth.
 */
export function withVendorPermission(
  permission: string,
  handler: VendorAuthedHandler,
): RouteHandler {
  return withVendorAuth(async (req, ctx, account) => {
    const perms: string[] = Array.isArray(account.permissions)
      ? account.permissions
      : []
    if (!perms.includes(permission)) {
      return forbidden(`需要 ${permission} 權限`, 'PERMISSION_DENIED')
    }
    return handler(req, ctx, account)
  })
}
