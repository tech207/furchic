import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/auth/guards'
import { vendorApplySchema } from '@/lib/validations/vendor'
import {
  authRateLimit,
  hashIp,
  rateLimitResponse,
} from '@/lib/security/rate-limit'

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(hashIp(request))
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400, 'INVALID_JSON')
  }

  const result = vendorApplySchema.safeParse(body)
  if (!result.success) {
    return apiError('驗證失敗', 400, 'VALIDATION_ERROR', result.error.errors)
  }

  const {
    company_name,
    brand_name,
    contact_name,
    contact_email,
    contact_phone,
    company_phone,
    tax_id,
    category,
    website_url,
    description,
  } = result.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1. 檢查 Email 是否已申請過
  const { data: existing } = await admin
    .from('vendors')
    .select('id, status')
    .eq('contact_email', contact_email)
    .maybeSingle()

  if (existing) {
    const statusMsgs: Record<string, string> = {
      pending: '此 Email 已提交申請，審核中請耐心等候',
      approved: '此 Email 已是進駐廠商，請直接登入',
      suspended: '此帳號已停用，請聯絡平台客服',
      rejected: '此 Email 的申請已被拒絕，如有疑問請聯絡平台',
    }
    const msg = statusMsgs[existing.status as string] ?? '此 Email 已存在於系統'
    return apiError(msg, 409, 'EMAIL_ALREADY_EXISTS')
  }

  // 2. 建立廠商申請
  const { data: vendor, error: insertError } = await admin
    .from('vendors')
    .insert({
      company_name,
      brand_name,
      vendor_type: 'permanent',
      contact_name,
      contact_email,
      contact_phone,
      company_phone: company_phone || null,
      tax_id: tax_id || null,
      category,
      website_url: website_url || null,
      description: description || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !vendor) {
    console.error('[POST /api/vendor/auth/apply]', insertError?.message)
    return apiError('申請失敗，請稍後再試', 500, 'INSERT_FAILED')
  }

  // 3. 讀取 Admin 通知 Email
  const { data: settingRow } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'notify_admin_email')
    .maybeSingle()

  const adminEmail = settingRow?.value as string | null
  if (adminEmail && adminEmail !== '""' && adminEmail !== '') {
    // TODO: 當 Resend 設定完成後，寄送以下兩封 Email：
    //   1. 申請確認信 → contact_email（通知廠商申請已收到）
    //   2. 新申請通知 → adminEmail（通知平台審核）
    console.info(
      '[vendor/apply] pending email to:',
      contact_email,
      '/ admin:',
      adminEmail,
    )
  }

  return apiSuccess({ message: '申請已送出，審核通過後將以 Email 通知您' }, 201)
}
