export function generateCode(prefix: string, length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const body = Array.from({ length }, () => {
    return alphabet[Math.floor(Math.random() * alphabet.length)]
  }).join('')

  return `${prefix}${body}`
}
