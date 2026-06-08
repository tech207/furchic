import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// ── ECPay client ──────────────────────────────────────────────────────────────

export type EcpayLogisticsConfig = {
  merchantId: string
  hashKey: string
  hashIv: string
}

export function createEcpayLogisticsClient(config: EcpayLogisticsConfig) {
  return { config }
}

// ── LogisticsSetting ──────────────────────────────────────────────────────────

export type LogisticsSetting = {
  id: string
  logistics_type: string
  display_name: string
  is_enabled: boolean
  shipping_fee: number
  free_shipping_threshold: number | null
  ecpay_logistics_id: string | null
  settings: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  'id, logistics_type, display_name, is_enabled, shipping_fee, free_shipping_threshold, ecpay_logistics_id, settings, sort_order, created_at, updated_at'

// ── Public: enabled methods (used by frontend checkout) ───────────────────────

export async function getEnabledLogisticsMethods(): Promise<
  LogisticsSetting[]
> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('logistics_settings')
    .select(SELECT_COLS)
    .eq('is_enabled', true)
    .order('sort_order', { ascending: true })
  return (data as unknown as LogisticsSetting[]) ?? []
}

// ── Admin: all methods ────────────────────────────────────────────────────────

export async function getLogisticsSettings(): Promise<LogisticsSetting[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('logistics_settings')
    .select(SELECT_COLS)
    .order('sort_order', { ascending: true })
  return (data as unknown as LogisticsSetting[]) ?? []
}

// ── Logistics status query ────────────────────────────────────────────────────

export type LogisticsStatusResult = {
  status: 'shipping' | 'delivered' | 'failed' | 'pending_pickup'
  status_label: string
  updated_at: string
}

// ECPay numeric → internal status
const ECPAY_STATUS_MAP: Record<string, LogisticsStatusResult['status']> = {
  '300': 'shipping', // 出貨完成（行進中）
  '309': 'delivered', // 宅配配達完成
  '310': 'failed', // 配達不到
  '312': 'shipping', // 改配中
  '2063': 'shipping', // CVS 配送中
  '2065': 'failed', // CVS 配達不到
  '2067': 'pending_pickup', // 到店通知（簡訊）
  '2068': 'pending_pickup', // 到店通知（email）
  '3018': 'pending_pickup', // 到店
  '3021': 'pending_pickup', // 存店完成
  '3022': 'delivered', // 取件完成
  '3024': 'failed', // 未取件退貨
}

const STATUS_LABELS: Record<LogisticsStatusResult['status'], string> = {
  shipping: '配送中',
  delivered: '已送達',
  failed: '異常',
  pending_pickup: '等待取件',
}

// ECPay CheckMacValue（HMAC-SHA256）
function computeCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const raw = `HashKey=${hashKey}&${sorted}&HashIV=${hashIv}`
  // ECPay-specific URL encoding rules
  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%20/g, '+')
    .replace(/%21/g, '!')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2a/g, '*')
    .replace(/%2d/g, '-')
    .replace(/%2e/g, '.')
    .replace(/%5f/g, '_')
  return createHmac('sha256', hashKey)
    .update(encoded)
    .digest('hex')
    .toUpperCase()
}

export async function getLogisticsStatus(
  allPayLogisticsId: string,
): Promise<LogisticsStatusResult> {
  const merchantId = process.env.ECPAY_MERCHANT_ID
  const hashKey = process.env.ECPAY_HASH_KEY
  const hashIv = process.env.ECPAY_HASH_IV

  if (!merchantId || !hashKey || !hashIv) {
    throw new Error(
      'ECPay 環境變數未設定（ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV）',
    )
  }

  const isProd = process.env.ECPAY_ENVIRONMENT === 'production'
  const endpoint = isProd
    ? 'https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V2'
    : 'https://logistics-stage.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V2'

  const queryParams: Record<string, string> = {
    MerchantID: merchantId,
    AllPayLogisticsID: allPayLogisticsId,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  }
  queryParams.CheckMacValue = computeCheckMacValue(queryParams, hashKey, hashIv)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(queryParams).toString(),
  })

  if (!res.ok) throw new Error(`ECPay API 連線失敗：HTTP ${res.status}`)

  const text = await res.text()
  const parsed = Object.fromEntries(new URLSearchParams(text))

  // ECPay returns RtnCode=1 on success
  if (parsed.RtnCode && parsed.RtnCode !== '1') {
    throw new Error(`ECPay 查詢失敗：${parsed.RtnMsg ?? parsed.RtnCode}`)
  }

  const rawStatus = parsed.LogisticsStatus ?? ''
  const status = ECPAY_STATUS_MAP[rawStatus] ?? 'shipping'
  const updatedAt = new Date().toISOString()

  return { status, status_label: STATUS_LABELS[status], updated_at: updatedAt }
}
