export function buildPetCardUrl(baseUrl: string, uuid: string) {
  return new URL(`/pet/${uuid}`, baseUrl).toString()
}
