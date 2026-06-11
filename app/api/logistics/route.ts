import { apiSuccess, apiError } from '@/lib/auth/guards'
import { getEnabledLogisticsMethods } from '@/lib/ecpay/logistics'

export const revalidate = 300

export async function GET() {
  try {
    const methods = await getEnabledLogisticsMethods()
    return apiSuccess({ methods })
  } catch {
    return apiError('無法載入物流方式', 500, 'FETCH_FAILED')
  }
}
