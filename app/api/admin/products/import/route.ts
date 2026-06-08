import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { withAdmin, apiSuccess, apiError } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSheetRows, type ParsedProduct } from '@/lib/utils/excel'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export const POST = withAdmin(async (req: NextRequest, _ctx, user) => {
  // ── Parse multipart ──────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError('請以 multipart/form-data 上傳', 400, 'INVALID_FORM')
  }

  const file = formData.get('file') as File | null
  if (!file)
    return apiError('請上傳 Excel 檔案（欄位名 file）', 400, 'MISSING_FILE')

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx' && ext !== 'xls') {
    return apiError('只接受 .xlsx 或 .xls 檔案', 400, 'INVALID_FILE_TYPE')
  }
  if (file.size > MAX_FILE_SIZE) {
    return apiError('檔案不可超過 5 MB', 400, 'FILE_TOO_LARGE')
  }

  // ── Parse Excel ──────────────────────────────────────────────────────────────
  const buffer = await file.arrayBuffer()
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch {
    return apiError('Excel 解析失敗，請確認檔案格式正確', 400, 'PARSE_ERROR')
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return apiError('Excel 工作表是空的', 400, 'EMPTY_SHEET')

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
  const { products, errors: parseErrors, skuRows } = parseSheetRows(rawRows)

  if (products.length === 0 && parseErrors.length === 0) {
    return apiError('Excel 沒有任何資料（第 2 列起請填入商品）', 400, 'NO_DATA')
  }

  // ── DB SKU duplicate check ───────────────────────────────────────────────────
  const allSkus = products.flatMap((p) => p.variants.map((v) => v.sku))

  const admin = createAdminClient()
  const { data: existingRaw } = await admin
    .from('product_variants')
    .select('sku')
    .in('sku', allSkus)

  const dbDupSkus = new Set(
    (existingRaw as Array<{ sku: string }> | null)?.map((r) => r.sku) ?? [],
  )

  const dbErrors = [...dbDupSkus].map((sku) => ({
    row: skuRows.get(sku) ?? 0,
    message: `SKU「${sku}」在資料庫中已存在`,
  }))

  const allErrors = [...parseErrors, ...dbErrors]

  // Reject entirely when there are validation errors to avoid partial imports
  if (allErrors.length > 0) {
    return Response.json(
      {
        error: 'VALIDATION_FAILED',
        message: '驗證失敗，請修正後重新匯入',
        errors: allErrors,
      },
      { status: 422 },
    )
  }

  // ── Bulk INSERT ──────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  let successCount = 0
  let variantCount = 0
  const importErrors: Array<{ row: number; message: string }> = []

  for (const product of products) {
    const inserted = await insertProduct(admin, product, user.id, now)
    if (!inserted.ok) {
      importErrors.push({ row: 0, message: `商品「${product.name}」建立失敗` })
      continue
    }
    variantCount += inserted.variantCount
    successCount++
  }

  return apiSuccess({
    success: successCount,
    variants: variantCount,
    errors: importErrors,
  })
})

// ── DB helper ─────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<
  typeof import('@/lib/supabase/admin').createAdminClient
>

async function insertProduct(
  admin: AdminClient,
  product: ParsedProduct,
  userId: string,
  now: string,
): Promise<{ ok: boolean; variantCount: number }> {
  const { data: newProduct, error: productErr } = await admin
    .from('products')
    .insert({
      name: product.name,
      description: product.description ?? null,
      base_price: product.base_price,
      images: [],
      is_active: true,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    } as never)
    .select('id')
    .single()

  if (productErr || !newProduct) {
    console.error('[import] product insert', productErr?.message)
    return { ok: false, variantCount: 0 }
  }

  const productId = (newProduct as { id: string }).id
  let variantCount = 0

  for (let i = 0; i < product.variants.length; i++) {
    const v = product.variants[i]

    const { data: newVariant, error: variantErr } = await admin
      .from('product_variants')
      .insert({
        product_id: productId,
        name: v.name,
        sku: v.sku,
        price: v.price ?? null,
        stock: v.stock,
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
        sort_order: i,
        created_at: now,
        updated_at: now,
      } as never)
      .select('id, stock')
      .single()

    if (variantErr || !newVariant) {
      console.error('[import] variant insert', variantErr?.message, v.sku)
      continue
    }

    const vRow = newVariant as { id: string; stock: number }
    variantCount++

    if (vRow.stock > 0) {
      await admin.from('stock_logs').insert({
        variant_id: vRow.id,
        change: vRow.stock,
        stock_after: vRow.stock,
        reason: 'manual',
        note: 'Excel 批次匯入',
        created_by: userId,
        created_at: now,
      } as never)
    }
  }

  return { ok: true, variantCount }
}
