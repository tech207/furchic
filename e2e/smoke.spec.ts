import { test, expect } from '@playwright/test'

// ── 1. 首頁載入正常 ────────────────────────────────────────────────────────────

test('首頁載入正常', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Pet\.chic Weekend/)
  // Hero section visible
  await expect(page.locator('section').first()).toBeVisible()
  // No console errors that would indicate a crash
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.waitForLoadState('networkidle')
  // Filter out known benign errors
  const criticalErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('net::ERR_'),
  )
  expect(criticalErrors).toHaveLength(0)
})

// ── 2. 商城頁載入正常 ──────────────────────────────────────────────────────────

test('商城頁載入正常', async ({ page }) => {
  await page.goto('/shop')
  await expect(page).toHaveTitle(/商城|Shop|Pet\.chic Weekend/)
  // Page renders without blank screen
  await expect(page.locator('main, body')).toBeVisible()
  // No fatal JS error boundary
  await expect(page.locator('text=應用程式錯誤')).not.toBeVisible()
  await expect(page.locator('text=Application error')).not.toBeVisible()
})

// ── 3. 未登入訪問 /pets → redirect 到 /auth ────────────────────────────────────

test('未登入訪問 /pets 會 redirect 到 /auth', async ({ page }) => {
  // Ensure no session cookie
  await page.context().clearCookies()
  const response = await page.goto('/pets')
  // Should end up at /auth (or a sub-path)
  await expect(page).toHaveURL(/\/auth/)
  // Or a 401/403 redirect — either is fine
  if (response) {
    expect([200, 301, 302, 307, 308]).toContain(response.status())
  }
})

// ── 4. Admin 頁面保護（未登入 → redirect） ────────────────────────────────────

test('未登入訪問 /admin 會 redirect', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/admin')
  // Should NOT show admin dashboard
  await expect(page.locator('text=Dashboard')).not.toBeVisible()
  // Should redirect somewhere (auth page or home)
  const url = page.url()
  expect(url).not.toMatch(/\/admin$/)
})

// ── 5. NFC 頁面 — 無效 UUID 顯示 404 ─────────────────────────────────────────

test('NFC 頁面無效 UUID 顯示 404', async ({ page }) => {
  const response = await page.goto('/pet/invalid-uuid-that-does-not-exist')
  // Either a 404 status or a 404 page rendered
  const is404Status = response?.status() === 404
  const has404Text = await page
    .locator('text=404')
    .isVisible()
    .catch(() => false)
  const hasNotFound = await page
    .locator('text=找不到')
    .isVisible()
    .catch(() => false)
  const hasNotFoundEn = await page
    .locator('text=Not Found')
    .isVisible()
    .catch(() => false)

  expect(is404Status || has404Text || hasNotFound || hasNotFoundEn).toBe(true)
})
