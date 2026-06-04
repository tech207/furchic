export type EcpayLogisticsConfig = {
  merchantId: string
  hashKey: string
  hashIv: string
}

export function createEcpayLogisticsClient(config: EcpayLogisticsConfig) {
  return {
    config,
  }
}
