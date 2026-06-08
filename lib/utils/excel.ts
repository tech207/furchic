import * as XLSX from 'xlsx'

// ── Shared types ───────────────────────────────────────────────────────────────

export type ExcelRow = Record<string, string | number | boolean | null>

export type ParsedVariant = {
  name: string
  sku: string
  price?: number
  stock: number
  low_stock_threshold: number
  is_active: boolean
}

export type ParsedProduct = {
  name: string
  description?: string
  base_price: number
  variants: ParsedVariant[]
}

export type ImportError = {
  row: number // 1-indexed Excel row (2 = first data row)
  message: string
}

export type ParseResult = {
  products: ParsedProduct[]
  errors: ImportError[]
  /** SKU → Excel row number (for DB duplicate reporting) */
  skuRows: Map<string, number>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toPositiveInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function parseIsActive(val: unknown): boolean {
  if (typeof val === 'string') return val.trim().toUpperCase() !== 'N'
  if (typeof val === 'number') return val !== 0
  if (typeof val === 'boolean') return val
  return true // default Y
}

const SKU_RE = /^[A-Za-z0-9_-]+$/

// ── Core row parser (Node.js + browser) ───────────────────────────────────────

/**
 * Parse raw 2-D array from XLSX.utils.sheet_to_json({ header:1 }).
 * Row 0 = header, rows 1.. = data.
 */
export function parseSheetRows(rows: unknown[][]): ParseResult {
  const dataRows = rows.slice(1) // skip header
  const products = new Map<string, ParsedProduct>()
  const errors: ImportError[] = []
  const skuRows = new Map<string, number>()
  const seenSkus = new Set<string>()

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2 // 1-indexed + header offset

    // Skip completely empty rows
    const hasContent = row.some(
      (c) => c !== null && c !== undefined && c !== '',
    )
    if (!hasContent) continue

    const rawName = String(row[0] ?? '').trim()
    const rawDesc = String(row[1] ?? '').trim()
    const rawBasePrice = row[2]
    const rawVariantName = String(row[3] ?? '').trim()
    const rawSku = String(row[4] ?? '').trim()
    const rawVariantPrice = row[5]
    const rawStock = row[6]
    const rawLowStock = row[7]
    const rawIsActive = row[8]

    // Required: name
    if (!rawName) {
      errors.push({ row: rowNum, message: 'A 欄「商品名稱」不可空白' })
      continue
    }

    // Required: SKU
    if (!rawSku) {
      errors.push({ row: rowNum, message: 'E 欄「SKU 編號」不可空白' })
      continue
    }
    if (!SKU_RE.test(rawSku)) {
      errors.push({
        row: rowNum,
        message: `SKU「${rawSku}」格式錯誤（只允許英文、數字、- 和 _）`,
      })
      continue
    }

    // Required: base_price (integer >= 0)
    const basePrice = toPositiveInt(rawBasePrice)
    if (basePrice === null) {
      errors.push({
        row: rowNum,
        message: `C 欄「基礎售價」必須是非負整數（值：${rawBasePrice ?? '空白'}）`,
      })
      continue
    }
    if (basePrice <= 0 && !products.has(rawName)) {
      errors.push({
        row: rowNum,
        message: `C 欄「基礎售價」必須大於 0（值：${basePrice}）`,
      })
      continue
    }

    // Required: stock (integer >= 0)
    const stock = toPositiveInt(rawStock)
    if (stock === null) {
      errors.push({
        row: rowNum,
        message: `G 欄「庫存數量」必須是非負整數（值：${rawStock ?? '空白'}）`,
      })
      continue
    }

    // Optional: variant price
    let variantPrice: number | undefined
    if (
      rawVariantPrice !== null &&
      rawVariantPrice !== undefined &&
      rawVariantPrice !== ''
    ) {
      const vp = toPositiveInt(rawVariantPrice)
      if (vp === null) {
        errors.push({
          row: rowNum,
          message: `F 欄「規格售價」必須是非負整數（值：${rawVariantPrice}）`,
        })
        continue
      }
      variantPrice = vp
    }

    // Optional: low_stock_threshold
    const lst =
      rawLowStock !== null && rawLowStock !== undefined && rawLowStock !== ''
        ? toPositiveInt(rawLowStock)
        : 5
    if (lst === null) {
      errors.push({
        row: rowNum,
        message: `H 欄「低庫存警示」必須是非負整數（值：${rawLowStock}）`,
      })
      continue
    }

    // SKU duplicate check within this file
    if (seenSkus.has(rawSku)) {
      errors.push({ row: rowNum, message: `SKU「${rawSku}」在此 Excel 中重複` })
      continue
    }
    seenSkus.add(rawSku)
    skuRows.set(rawSku, rowNum)

    const variant: ParsedVariant = {
      name: rawVariantName || rawName,
      sku: rawSku,
      stock,
      low_stock_threshold: lst,
      is_active: parseIsActive(rawIsActive),
      ...(variantPrice !== undefined && { price: variantPrice }),
    }

    if (products.has(rawName)) {
      products.get(rawName)!.variants.push(variant)
    } else {
      products.set(rawName, {
        name: rawName,
        ...(rawDesc ? { description: rawDesc } : {}),
        base_price: basePrice,
        variants: [variant],
      })
    }
  }

  return { products: Array.from(products.values()), errors, skuRows }
}

// ── Browser: parse File ────────────────────────────────────────────────────────

export async function parseProductExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) {
    return {
      products: [],
      errors: [{ row: 0, message: 'Excel 工作表是空的' }],
      skuRows: new Map(),
    }
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  return parseSheetRows(rows)
}

// ── Browser: generate template ─────────────────────────────────────────────────

export function generateProductTemplate(): Blob {
  const header = [
    '商品名稱',
    '商品描述',
    '基礎售價',
    '規格名稱',
    'SKU 編號',
    '規格售價',
    '庫存數量',
    '低庫存警示',
    '是否上架(Y/N)',
  ]
  const examples: unknown[][] = [
    [
      'Furchic NFC 寵物卡',
      '寵物緊急聯絡 NFC 卡',
      399,
      '標準款',
      'NFC-001-STD',
      '',
      50,
      5,
      'Y',
    ],
    ['Furchic NFC 寵物卡', '', 399, '豪華款', 'NFC-001-DLX', 499, 30, 5, 'Y'],
    ['寵物皮革項圈', '柔軟牛皮項圈', 299, 'S 號', 'COLLAR-S', '', 20, 3, 'Y'],
    ['寵物皮革項圈', '', 299, 'M 號', 'COLLAR-M', '', 15, 3, 'Y'],
    ['寵物皮革項圈', '', 299, 'L 號', 'COLLAR-L', '', 10, 3, 'N'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([header, ...examples])
  ws['!cols'] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '商品資料')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
