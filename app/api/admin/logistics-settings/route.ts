import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { getLogisticsSettings } from '@/lib/ecpay/logistics'

export const GET = withAdmin(async () => {
  try {
    const settings = await getLogisticsSettings()
    return apiSuccess({ settings })
  } catch {
    return apiError('無法載入物流設定', 500, 'FETCH_FAILED')
  }
})
