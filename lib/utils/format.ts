export function formatCurrency(value: number, locale = 'zh-TW') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value)
}
