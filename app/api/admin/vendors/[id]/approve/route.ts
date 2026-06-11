import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://furchic.com'

export const POST = withAdmin(async (_req, ctx, user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少廠商 ID', 400, 'MISSING_ID')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // 1. 讀取廠商資料
  const { data: vendor, error: fetchError } = await admin
    .from('vendors')
    .select('id, status, contact_email, contact_name, brand_name')
    .eq('id', id)
    .single()

  if (fetchError || !vendor) {
    return apiError('找不到廠商', 404, 'NOT_FOUND')
  }

  if (vendor.status === 'approved') {
    return apiError('此廠商已審核通過', 409, 'ALREADY_APPROVED')
  }

  // 2. 更新 vendors 狀態
  const { error: updateError } = await admin
    .from('vendors')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', id)

  if (updateError) {
    console.error('[admin/vendors/approve] update:', updateError.message)
    return apiError('更新廠商狀態失敗', 500, 'UPDATE_FAILED')
  }

  // 3. 建立 Supabase Auth 用戶（inviteUserByEmail 同時寄送開通通知 Email）
  const supabaseAdmin = createAdminClient()
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(
      vendor.contact_email as string,
      {
        redirectTo: `${SITE_URL}/vendor/auth/setup`,
        data: {
          vendor_id: id,
          brand_name: vendor.brand_name,
          is_vendor: true,
        },
      },
    )

  if (inviteError || !inviteData?.user) {
    console.error('[admin/vendors/approve] invite:', inviteError?.message)
    // 不回滾 vendors 狀態更新，只回報 Email 寄送失敗
    return apiError(
      '廠商狀態已更新，但 Email 邀請寄送失敗，請手動重試',
      500,
      'INVITE_FAILED',
    )
  }

  const newUserId = inviteData.user.id

  // 4. 新增 vendor_accounts（owner 主帳號）
  // 若已有 owner 記錄（重審場景），做 upsert
  const { error: accountError } = await admin.from('vendor_accounts').upsert(
    {
      vendor_id: id,
      user_id: newUserId,
      email: vendor.contact_email,
      phone: '', // 審核時尚未取得，廠商設定密碼後補完
      role: 'owner',
      permissions: ['products', 'orders', 'reports'],
      is_active: true,
    },
    { onConflict: 'vendor_id,user_id' },
  )

  if (accountError) {
    console.error(
      '[admin/vendors/approve] vendor_accounts:',
      accountError.message,
    )
    return apiError(
      '廠商帳號建立失敗，請手動檢查 vendor_accounts',
      500,
      'ACCOUNT_CREATE_FAILED',
    )
  }

  return apiSuccess({
    success: true,
    message: `已核准 ${vendor.brand_name as string}，開通通知已寄出`,
  })
})
