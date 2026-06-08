import { withAuth, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'

export const DELETE = withAuth(async (_req, ctx, user) => {
  const variantId = ctx.params?.variantId as string | undefined
  if (!variantId) return apiError('缺少 variantId', 400, 'MISSING_ID')

  const admin = createAdminClient()

  const { error } = await admin
    .from('carts')
    .delete()
    .eq('user_id', user.id)
    .eq('variant_id', variantId)

  if (error) {
    console.error('[DELETE /api/cart/items/[variantId]]', error.message)
    return apiError('移除失敗', 500, 'DELETE_FAILED')
  }

  return apiSuccess({ success: true })
})
