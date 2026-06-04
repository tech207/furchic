export type EcpayClientConfig = {
  merchantId: string
  hashKey: string
  hashIv: string
  apiUrl: string
}

export function createEcpayClient(config: EcpayClientConfig) {
  return {
    config,
  }
}
