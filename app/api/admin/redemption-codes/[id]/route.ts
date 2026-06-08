import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const DELETE = withAdmin(async (_req, ctx, _user) => {
  const id = ctx.params?.id as string | undefined
  if (!id) return apiError('缺少 ID', 400, 'MISSING_ID')

  const admin = createAdminClient()

  // Only allow deleting unused codes
  const { data: code } = await admin
    .from('redemption_codes')
    .select('id, used_by')
    .eq('id', id)
    .single()

  if (!code) return apiError('找不到此兌換碼', 404, 'NOT_FOUND')

  const c = code as unknown as { id: string; used_by: string | null }
  if (c.used_by) return apiError('此兌換碼已被使用，無法刪除', 409, 'CODE_USED')

  const { error } = await admin.from('redemption_codes').delete().eq('id', id)
  if (error) return apiError('刪除失敗', 500, 'DELETE_FAILED')

  return apiSuccess({ success: true })
})
