export type ImagineArtClientConfig = {
  apiKey: string
}

export function createImagineArtClient(config: ImagineArtClientConfig) {
  return {
    config,
  }
}
