# PET.CHIC WebApp — 技術規格文件

> **版本：** v1.0 ｜ **更新：** 2026-06 ｜ **維護者：** Leon

---

## 目錄

1. [技術架構總覽](#1-技術架構總覽)
2. [專案結構](#2-專案結構)
3. [資料庫設計](#3-資料庫設計)
4. [API 規範](#4-api-規範)
5. [認證與安全](#5-認證與安全)
6. [購物車與金流](#6-購物車與金流)
7. [NFC 卡片系統](#7-nfc-卡片系統)
8. [AI 圖片服務](#8-ai-圖片服務)
9. [會員等級與回饋金](#9-會員等級與回饋金)
10. [優惠系統](#10-優惠系統)
11. [環境變數](#11-環境變數)
12. [部署架構](#12-部署架構)
13. [效能指標](#13-效能指標)
14. [第三方服務](#14-第三方服務)

---

## 1. 技術架構總覽

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│         Next.js 14 App Router + React + Tailwind CSS         │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│                    Vercel Edge Network                        │
│              Next.js API Routes (JWT Auth)                    │
│         Middleware: Auth Guard + Rate Limit + CSRF            │
└────┬──────────────────┬──────────────────┬───────────────────┘
     │                  │                  │
┌────▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
│Supabase │      │Railway      │    │Third Party  │
│DB + Auth│      │Python API   │    │LINE / Google│
│Storage  │      │卡面生成      │    │ECPay / NFC  │
│RLS      │      │imagine art  │    │             │
└─────────┘      └─────────────┘    └─────────────┘
```

### Tech Stack 一覽

| 層級 | 技術 | 版本 | 用途 |
|------|------|------|------|
| Framework | Next.js | 14.x | App Router, SSR/CSR |
| Language | TypeScript | 5.x | strict mode |
| Styling | Tailwind CSS | 3.x | utility-first |
| UI Library | shadcn/ui | latest | 元件庫 |
| State | Zustand | 4.x | 購物車、UI 狀態 |
| Form | React Hook Form + Zod | latest | 表單驗證 |
| Database | Supabase (PostgreSQL 15) | latest | 主資料庫 |
| Auth | Supabase Auth | latest | JWT + OAuth |
| Storage | Supabase Storage | latest | 圖片儲存 |
| Python API | FastAPI + Uvicorn | latest | 卡面生成 |
| Image | Pillow | latest | PNG 合成 |
| QR Code | qrcode[pil] | latest | QR Code 生成 |
| Animation | Framer Motion | latest | 頁面動畫 |
| Carousel | Embla Carousel | latest | Banner 輪播 |
| Table | TanStack Table | v8 | Admin 表格 |
| DnD | dnd-kit | latest | 拖拽排序 |
| Chart | Recharts | latest | 數據圖表 |
| Excel | SheetJS (xlsx) | latest | Excel 匯入 |
| E2E Test | Playwright | latest | 端到端測試 |
| CI/CD | GitHub Actions | - | 自動部署 |

---

## 2. 專案結構

```
petcard-webapp/
├── app/
│   ├── (public)/                    # 不需登入的頁面
│   │   ├── page.tsx                 # 首頁
│   │   ├── about/page.tsx
│   │   ├── shop/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── pet/[uuid]/page.tsx      # NFC 公開名片
│   │   └── auth/
│   │       ├── page.tsx
│   │       └── callback/route.ts
│   ├── (member)/                    # 需要登入
│   │   ├── layout.tsx               # Auth Guard
│   │   ├── profile/page.tsx
│   │   ├── profile/setup/page.tsx
│   │   ├── pets/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/page.tsx
│   │   │       └── card/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── rewards/page.tsx
│   ├── admin/                       # 需要 admin role
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # 儀表板
│   │   ├── print/page.tsx
│   │   ├── nfc/page.tsx
│   │   ├── banners/page.tsx
│   │   ├── members/
│   │   ├── pets/page.tsx
│   │   ├── products/
│   │   ├── orders/
│   │   ├── coupons/page.tsx
│   │   ├── promotions/page.tsx
│   │   ├── rewards/page.tsx
│   │   ├── redemption-codes/page.tsx
│   │   ├── settings/page.tsx
│   │   └── about/page.tsx
│   └── api/
│       ├── auth/callback/route.ts
│       ├── pets/[...]/route.ts
│       ├── nfc/[uuid]/route.ts
│       ├── products/[...]/route.ts
│       ├── cart/[...]/route.ts
│       ├── orders/[...]/route.ts
│       ├── checkout/[...]/route.ts
│       ├── cards/[...]/route.ts
│       ├── ai/[...]/route.ts
│       ├── admin/[...]/route.ts
│       ├── analytics/track/route.ts
│       └── webhooks/
│           ├── ecpay/route.ts
│           └── ecpay-logistics/route.ts
├── components/
│   ├── ui/                          # shadcn/ui 元件
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── AdminSidebar.tsx
│   │   └── MobileNav.tsx
│   ├── common/
│   │   ├── ImageUploader.tsx
│   │   ├── DataTable.tsx
│   │   ├── Pagination.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── EmptyState.tsx
│   ├── pets/
│   │   ├── PetCard.tsx
│   │   ├── CaregiversSection.tsx
│   │   └── AiPhotoSection.tsx
│   ├── shop/
│   │   ├── ProductCard.tsx
│   │   └── VariantSelector.tsx
│   ├── cart/
│   │   └── CartSummary.tsx
│   ├── admin/
│   │   └── charts/
│   └── rewards/
│       └── LevelProgress.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser client
│   │   ├── server.ts                # Server client
│   │   └── admin.ts                 # Service role
│   ├── auth/
│   │   ├── session.ts
│   │   └── guards.ts
│   ├── ecpay/
│   │   ├── client.ts
│   │   └── logistics.ts
│   ├── imagine-art/
│   │   └── client.ts
│   ├── security/
│   │   ├── rate-limit.ts
│   │   ├── sanitize.ts
│   │   └── csrf.ts
│   ├── validations/
│   │   ├── user.ts
│   │   ├── pet.ts
│   │   ├── product.ts
│   │   ├── order.ts
│   │   └── coupon.ts
│   └── utils/
│       ├── format.ts
│       ├── image.ts
│       ├── nfc.ts
│       ├── excel.ts
│       └── code-generator.ts
├── store/
│   ├── cartStore.ts
│   └── uiStore.ts
├── types/
│   ├── database.ts
│   ├── api.ts
│   └── global.ts
├── middleware.ts
├── python-api/
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── models/
│   ├── fonts/
│   ├── requirements.txt
│   └── Dockerfile
└── e2e/
    └── smoke.spec.ts
```

---

## 3. 資料庫設計

### 資料表關係圖

```
auth.users ──────────────────► users
                                 │
                    ┌────────────┼────────────────────┐
                    │            │                     │
                   pets        orders            reward_transactions
                    │            │
          ┌─────────┤           order_items
          │         │
   pet_caregivers  nfc_cards
          │
   pet_caregiver_invitations

products ──► product_variants ──► product_variant_options
                                        │
                                   stock_logs

member_levels ◄── users

coupons ─────────────► orders
promotions ──────────► orders
redemption_codes ────► card_print_requests

banners
company_info
system_settings
analytics_events
```

### 核心資料表欄位

#### users
```sql
id              UUID PRIMARY KEY  -- 對應 auth.users.id
name            VARCHAR(50) NOT NULL
phone           VARCHAR(20)
email           VARCHAR(100)
gender          VARCHAR(10) CHECK IN ('male','female','other')
birthday        DATE
auth_provider   VARCHAR(20)       -- line | google | email
avatar_url      TEXT
role            VARCHAR(20) DEFAULT 'user'  -- user | admin
member_level_id UUID FK → member_levels
reward_points   INTEGER DEFAULT 0
total_spent     INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

#### pets
```sql
id                UUID PRIMARY KEY
user_id           UUID FK → users
name              VARCHAR(50) NOT NULL
breed             VARCHAR(100)
gender            VARCHAR(10)
birthday          DATE
is_neutered       BOOLEAN DEFAULT FALSE
chip_id           VARCHAR(50)             -- NULL = 無晶片
photo_url         TEXT
ai_photo_url      TEXT                    -- imagine art 去背後
public_fields     JSONB DEFAULT '["name","breed","emergency"]'
card_status       VARCHAR CHECK IN ('none','pending','active','disabled') DEFAULT 'none'
vet_hospital      VARCHAR NOT NULL        -- 必填
special_care      BOOLEAN DEFAULT FALSE
special_care_note TEXT
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

#### pet_caregivers
```sql
id              UUID PRIMARY KEY
pet_id          UUID FK → pets
user_id         UUID FK → users
role            VARCHAR CHECK IN ('owner','caregiver')
display_name    VARCHAR                -- 飼主可選姓名或暱稱
contact_methods JSONB DEFAULT '[]'
-- [{id, type:'phone'|'line'|'instagram'|'facebook'|'other',
--   label, value, is_public: boolean}]
is_visible      BOOLEAN DEFAULT TRUE   -- 整體公開開關
sort_order      INTEGER DEFAULT 0
invited_at      TIMESTAMPTZ
accepted_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(pet_id, user_id)
```

#### nfc_cards
```sql
id           UUID PRIMARY KEY          -- 燒入 NFC 晶片的 UUID
pet_id       UUID FK → pets UNIQUE
qr_url       TEXT                      -- 與 NFC 相同 URL
status       VARCHAR CHECK IN ('unbound','active') DEFAULT 'unbound'
bound_at     TIMESTAMPTZ
bound_by     UUID FK → users           -- admin user
card_serial  VARCHAR
```

#### product_variants (SKU)
```sql
id                   UUID PRIMARY KEY
product_id           UUID FK → products
name                 VARCHAR            -- 例如「紅色 / L」
sku                  VARCHAR UNIQUE NOT NULL
price                INTEGER            -- 若 NULL 使用 product.base_price
stock                INTEGER DEFAULT 0
low_stock_threshold  INTEGER DEFAULT 5
is_active            BOOLEAN DEFAULT TRUE
sort_order           INTEGER DEFAULT 0
```

#### orders
```sql
id                  UUID PRIMARY KEY
user_id             UUID FK → users
items               JSONB NOT NULL
-- [{product_id, variant_id, name, variant_name, sku,
--   unit_price, quantity, subtotal, image_url}]
subtotal            INTEGER
shipping_fee        INTEGER DEFAULT 60
discount_amount     INTEGER DEFAULT 0
total_amount        INTEGER
coupon_code         VARCHAR
promotion_ids       JSONB DEFAULT '[]'
reward_points_used  INTEGER DEFAULT 0
reward_points_earned INTEGER DEFAULT 0
status              VARCHAR CHECK IN ('pending','paid','processing','shipped','done','cancelled')
shipping_method     VARCHAR             -- ecpay logistics type
shipping_info       JSONB
-- 宅配: {name, phone, city, district, address, zip}
-- 超商: {name, phone, cvs_type, store_id, store_name, store_address}
tracking_number     VARCHAR
logistics_id        VARCHAR
payment_method      VARCHAR
ecpay_trade_no      VARCHAR
note                TEXT
admin_note          TEXT
shipped_at          TIMESTAMPTZ
completed_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

#### member_levels
```sql
id           UUID PRIMARY KEY
name         VARCHAR            -- 例如「一般會員」「銀卡」「金卡」
min_spent    INTEGER            -- 升等門檻（累積消費）
reward_rate  DECIMAL(4,2)       -- 回饋金比率 0.03 = 3%
discount_rate DECIMAL(4,2)      -- 購物折扣 0.95 = 95折
benefits     JSONB DEFAULT '{}'  -- 其他效益說明
sort_order   INTEGER DEFAULT 0
```

#### system_settings (key-value 設定表)
```sql
key         VARCHAR PRIMARY KEY
value       JSONB NOT NULL
description TEXT
updated_at  TIMESTAMPTZ
updated_by  UUID FK → users
```

**預設設定 key 清單：**

| Key | 預設值 | 說明 |
|-----|--------|------|
| `free_shipping_amount` | `1500` | 免運門檻（元） |
| `gift_nfc_amount` | `2500` | NFC 卡贈品門檻（元） |
| `gift_nfc_enabled` | `false` | 贈品活動是否開啟 |
| `gift_nfc_start_at` | `null` | 贈品活動開始時間 |
| `gift_nfc_end_at` | `null` | 贈品活動結束時間 |
| `reward_max_usage_rate` | `0.5` | 回饋金最大折抵比率 |
| `card_request_enabled` | `true` | 是否開放申請製卡 |
| `max_pets_per_user` | `10` | 每用戶最多寵物數 |
| `max_caregivers_per_pet` | `5` | 每隻寵物最多照護者數（含飼主） |

---

## 4. API 規範

### 統一回應格式

```typescript
// 成功
interface ApiSuccess<T> {
  data: T
  message?: string
}

// 錯誤
interface ApiError {
  error: string        // 錯誤代碼，例如 'NOT_FOUND'
  message: string      // 人類可讀訊息
  details?: unknown    // Zod 驗證錯誤詳情
}
```

### HTTP 狀態碼規範

| 狀態碼 | 使用時機 |
|--------|----------|
| 200 | 成功（GET、PUT） |
| 201 | 建立成功（POST） |
| 204 | 成功但無回傳（DELETE） |
| 400 | 請求格式錯誤、Zod 驗證失敗 |
| 401 | 未登入 |
| 403 | 無權限（非 admin） |
| 404 | 資源不存在 |
| 409 | 衝突（例如已綁定 NFC） |
| 422 | 業務邏輯驗證失敗 |
| 429 | Rate limit 超過 |
| 500 | 伺服器錯誤 |

### 分頁規範

```typescript
// Request query params
interface PaginationQuery {
  page?: number    // 預設 1
  limit?: number   // 預設 20，最大 100
}

// Response
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

### 完整 API 端點清單

#### Auth
```
POST   /api/auth/email/register
POST   /api/auth/email/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
GET    /api/auth/callback              # OAuth callback
GET    /api/auth/me
```

#### Users
```
PUT    /api/users/me
GET    /api/admin/members
GET    /api/admin/members/[id]
PUT    /api/admin/members/[id]
GET    /api/admin/members/export       # CSV
```

#### Pets
```
GET    /api/pets
POST   /api/pets
GET    /api/pets/[id]
PUT    /api/pets/[id]
DELETE /api/pets/[id]
PUT    /api/pets/[id]/privacy
PUT    /api/pets/[id]/card-status
POST   /api/pets/[id]/caregivers/invite
GET    /api/pets/[id]/caregivers
PUT    /api/pets/[id]/caregivers/[cId]
DELETE /api/pets/[id]/caregivers/[cId]
GET    /api/caregivers/invite/[token]
POST   /api/caregivers/invite/[token]/accept
```

#### NFC
```
GET    /api/nfc/[uuid]                 # 公開，不需登入
POST   /api/admin/nfc/bind
POST   /api/admin/nfc/pre-generate
GET    /api/admin/nfc/search
```

#### Cards (印製)
```
POST   /api/cards/preview
POST   /api/cards/request
GET    /api/cards/my
GET    /api/admin/cards
PUT    /api/admin/cards/[id]/status
GET    /api/admin/cards/[id]/images
```

#### Products
```
GET    /api/products
GET    /api/products/[id]
POST   /api/admin/products
PUT    /api/admin/products/[id]
DELETE /api/admin/products/[id]
POST   /api/admin/products/[id]/variants
PUT    /api/admin/products/[id]/variants/[vId]
PUT    /api/admin/products/reorder
POST   /api/admin/products/import      # Excel 匯入
GET    /api/admin/products/low-stock
GET    /api/admin/products/[id]/stock-logs
PUT    /api/admin/products/[id]/stock
```

#### Cart & Checkout
```
GET    /api/cart
PUT    /api/cart
DELETE /api/cart/items/[variantId]
GET    /api/settings/cart
POST   /api/checkout/validate-coupon
POST   /api/checkout/calculate
POST   /api/orders
GET    /api/orders
GET    /api/orders/[id]
GET    /api/orders/[id]/payment-check
GET    /api/admin/orders
PUT    /api/admin/orders/[id]
PUT    /api/admin/orders/bulk-ship
GET    /api/admin/orders/export
```

#### Promotions & Coupons
```
GET    /api/admin/coupons
POST   /api/admin/coupons
PUT    /api/admin/coupons/[id]
DELETE /api/admin/coupons/[id]
GET    /api/admin/promotions
POST   /api/admin/promotions
PUT    /api/admin/promotions/[id]
DELETE /api/admin/promotions/[id]
```

#### Redemption Codes
```
POST   /api/admin/redemption-codes/generate
GET    /api/admin/redemption-codes
GET    /api/admin/redemption-codes/export
DELETE /api/admin/redemption-codes/[id]
POST   /api/redemption-codes/validate   # 前台驗證
```

#### Rewards & Levels
```
GET    /api/members/me/rewards
GET    /api/members/me/level-progress
GET    /api/admin/member-levels
POST   /api/admin/member-levels
PUT    /api/admin/member-levels/[id]
DELETE /api/admin/member-levels/[id]
GET    /api/admin/rewards
POST   /api/admin/rewards/adjust
```

#### AI
```
POST   /api/ai/remove-bg
POST   /api/ai/generate-image
GET    /api/ai/status/[jobId]
```

#### Banners & Content
```
GET    /api/banners
GET    /api/admin/banners
POST   /api/admin/banners
PUT    /api/admin/banners/[id]
DELETE /api/admin/banners/[id]
PUT    /api/admin/banners/reorder
GET    /api/about
PUT    /api/admin/about
GET    /api/admin/settings
PUT    /api/admin/settings/[key]
GET    /api/settings/public
```

#### Analytics
```
POST   /api/analytics/track            # 不需登入
GET    /api/admin/analytics/kpi
GET    /api/admin/analytics/orders-trend
GET    /api/admin/analytics/funnel
GET    /api/admin/analytics/product-ranking
```

#### Webhooks
```
POST   /api/webhooks/ecpay             # 綠界付款通知
POST   /api/webhooks/ecpay-logistics   # 綠界物流通知
```

---

## 5. 認證與安全

### JWT 流程

```
Client → POST /api/auth/email/login
       ← { access_token, refresh_token, user }

Client → GET /api/... (Authorization: Bearer {token})
Middleware → Supabase verifyJWT() → 通過 → handler
           → 失敗 → 401

Token Refresh：
Middleware 自動偵測 token 即將過期 → 呼叫 Supabase refresh
```

### Auth Guard 實作

```typescript
// 保護 API Route 的 wrapper
export function withAuth(handler) {
  return async (req, ctx) => {
    const user = await getCurrentUser()
    if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')
    return handler(req, ctx, user)
  }
}

export function withAdmin(handler) {
  return async (req, ctx) => {
    const user = await getCurrentUser()
    if (!user) return apiError('Unauthorized', 401)
    if (user.role !== 'admin') return apiError('Forbidden', 403, 'FORBIDDEN')
    return handler(req, ctx, user)
  }
}
```

### Rate Limit 規則

| 端點 | 限制 | 視窗 | Key |
|------|------|------|-----|
| `/api/auth/*` | 20 次 | 15 分鐘 | IP hash |
| `/api/ai/*` | 10 次 | 24 小時 | user_id |
| `/api/admin/*/export` | 5 次 | 1 分鐘 | user_id |
| `/api/analytics/track` | 60 次 | 1 分鐘 | session_id |
| 其他 `/api/*` | 100 次 | 1 分鐘 | user_id |

### Security Headers

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob: https://*.supabase.co
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### 圖片安全驗證（Magic Bytes）

```typescript
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46],  // + offset 8: WEBP
}
// 上傳前讀取 buffer 前 12 bytes 驗證
```

---

## 6. 購物車與金流

### 購物車同步策略

```
未登入狀態：
  Zustand store → localStorage (persist middleware)

登入後 mergeWithDb()：
  1. GET /api/cart → 取 DB 購物車
  2. 合併：同 variant_id → quantity 取較大值
  3. 驗證每個 item 的當前庫存
  4. 若 stock < quantity → 降至 stock，顯示 warning
  5. PUT /api/cart → 同步回 DB

庫存驗證時機：
  - 加入購物車時
  - 進入結帳頁時（re-validate）
  - 提交訂單前（server side SELECT FOR UPDATE）
```

### 金額計算順序

```
1. subtotal = Σ (variant.price × quantity)
2. promotions_discount = calculatePromotions(subtotal, items, user.level)
3. coupon_discount = applyCoupon(coupon, subtotal - promotions_discount)
4. pre_shipping_total = subtotal - promotions_discount - coupon_discount
5. shipping_fee = pre_shipping_total >= free_shipping_amount ? 0 : 60
   (若 promotion 含免運 → shipping_fee = 0)
6. reward_discount = min(reward_points_used, total × reward_max_usage_rate)
7. total = pre_shipping_total + shipping_fee - reward_discount
8. reward_points_earned = floor(total × user.level.reward_rate)
```

### 綠界金流整合

```
結帳流程：
POST /api/orders
  → 計算金額（server side）
  → INSERT order (status='pending')
  → 扣庫存（SELECT FOR UPDATE in transaction）
  → 產生 ECPay 參數 + CheckMacValue
  → 回傳 form HTML

前端 submit form → 跳轉綠界付款頁

綠界回調（POST /api/webhooks/ecpay）：
  → 驗證 CheckMacValue
  → RtnCode === '1' → status='paid'
  → 否則 → status='cancelled' + 退庫存
  → 回傳 "1|OK"
```

### 綠界物流方式

| 物流類型 | 代碼 | 說明 |
|----------|------|------|
| 宅配 | `HOME` | 黑貓/新竹 |
| 7-11 超取 | `UNIMART` | 7-ELEVEN |
| 全家超取 | `FAMI` | 全家 FamilyMart |
| 萊爾富超取 | `HILIFE` | 萊爾富 |
| OK 超取 | `OKMARTB2C` | OK 超商 |

---

## 7. NFC 卡片系統

### UUID 生命週期

```
1. Admin pre-generate
   → INSERT nfc_cards (id=UUID, status='unbound')

2. 印製卡片（UUID 對應到實體卡）

3. POS 機感應 + 綁定
   → Web NFC API 讀取卡片 UUID
   → POST /api/admin/nfc/bind
   → UPDATE nfc_cards (status='active', pet_id, bound_at, bound_by)
   → UPDATE pets (card_status='active')
   → 鎖定，不可更改

4. 用戶掃描 NFC / QR Code
   → GET /api/nfc/{uuid}
   → 若 card_status='active' → 回傳公開資料
   → 若 card_status='disabled' → 回傳 { disabled: true }
```

### NFC 公開頁權限

| 訪問者 | 可見內容 |
|--------|----------|
| 任何人（未登入） | public_fields 設定的欄位 + 照護者中 is_visible=true 且各聯絡方式 is_public=true |
| 飼主（已登入） | 所有資料 + 編輯按鈕 |
| 照護者（已登入） | 所有資料（無編輯按鈕） |

### 卡面規格

```
實體尺寸：85.6 × 54mm（CR-80 標準）
像素尺寸：1012 × 638px（300 DPI）
格式：PNG，RGB

正面元素：
  - 品牌漸層背景（#E8820C → #F59E0B）
  - 品牌 Logo（左上）
  - 標語大字（白色）
  - 寵物 AI 去背照（合成，透明背景疊加）
  - QR Code（右下，白色底，指向 /pet/{uuid}）

背面元素（零個資）：
  - 白色背景
  - 橘色四角裝飾
  - 品牌標題
  - 裝飾性欄位線條
  - PET.CHIC Logo
  - QR Code（左下）
  - 網域文字
```

### Web NFC API 流程

```javascript
// 讀取 NFC 卡
const reader = new NDEFReader()
await reader.scan()
reader.onreading = ({ message }) => {
  const record = message.records[0]
  const uuid = new TextDecoder().decode(record.data)
  // 取得 UUID 後呼叫 bind API
}

// 寫入 NFC 卡
const writer = new NDEFReader()
await writer.write({
  records: [{
    recordType: 'url',
    data: `https://yourapp.com/pet/${uuid}`
  }]
})
```

### 兌換碼規則

```
格式：Admin 自設（prefix + 隨機碼）
範例：PET-A1B2-C3D4

驗證規則：
  ✓ 存在於 redemption_codes 表
  ✓ status = 'unused'
  ✓ used_count < max_uses（通常 max_uses = 1）
  ✓ expires_at > NOW()

使用後：
  UPDATE redemption_codes SET used_by, used_at, used_count = used_count + 1
```

---

## 8. AI 圖片服務

### imagine art API 整合

```
去背流程：
  POST /api/ai/remove-bg
    → 驗證 image_url 是 Supabase Storage URL
    → 呼叫 imagine art remove_background tool
    → 回傳 job_id

  前端 polling：
    GET /api/ai/status/{job_id}（每 2 秒）
    → status: queued → processing → done → result_url

  完成後：
    result_url 自動上傳到 pet-photos bucket
    回傳 Supabase Storage URL

AI 生成流程：
  POST /api/ai/generate-image
    → body: { prompt, aspect_ratio, model? }
    → 同上 polling 流程

Rate Limit：
  去背：每用戶每天 20 次
  生成：每用戶每天 10 次
```

### 圖片上傳規格

```
允許格式：JPEG、PNG、WebP
最大大小：上傳前 5MB（client 壓縮後）
最大尺寸：1200px（長邊，client 壓縮）
Magic Bytes 驗證：必須在 server side 執行

Storage Buckets：
  pet-photos    → public read，owner write
  card-images   → admin only（下載卡面用）
  product-images → public read，admin write
  company-assets → public read，admin write
```

---

## 9. 會員等級與回饋金

### 等級制度

```
升等邏輯（Trigger on order status='done'）：
  1. UPDATE users SET total_spent = total_spent + order.total_amount
  2. SELECT member_levels WHERE min_spent <= users.total_spent ORDER BY min_spent DESC LIMIT 1
  3. 若 level 改變 → UPDATE users SET member_level_id
  4. 不降等（只升不降）

預設等級範例（Admin 可自行調整）：
  一般會員：0 元起，回饋 1%
  銀卡會員：5,000 元起，回饋 2%
  金卡會員：20,000 元起，回饋 3%
```

### 回饋金計算

```
獲得（每筆完成訂單）：
  earned = floor(order.total_amount × user.level.reward_rate)
  INSERT reward_transactions (type='earned', points=earned, order_id)
  UPDATE users SET reward_points = reward_points + earned

使用（結帳時折抵）：
  max_usable = floor(order.total × system_settings.reward_max_usage_rate)
  actual_used = min(requested, max_usable, user.reward_points)
  INSERT reward_transactions (type='used', points=-actual_used, order_id)
  UPDATE users SET reward_points = reward_points - actual_used
```

---

## 10. 優惠系統

### 折扣疊加邏輯

```
優先計算順序：
  1. Promotions（自動套用，依條件判斷）
  2. Coupon（用戶輸入折扣碼）
  3. Reward Points（用戶選擇折抵）

Promotion 類型：
  percentage → subtotal × (1 - value/100)
  fixed      → subtotal - value
  free_shipping → shipping_fee = 0
  gift       → 加入贈品 item（NFC 卡）

疊加規則：
  - 所有 is_stackable=true 的 promotions 都套用
  - Coupon 在 promotions 之後計算（以折扣後金額為基礎）
  - 回饋金在最後計算
  - 最終金額最低為 1 元（不可為負）
```

---

## 11. 環境變數

```bash
# ── Supabase ─────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # Server only，絕不暴露前端

# ── LINE Login ───────────────────────────────────────────────
LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=xxxxxxxx
NEXT_PUBLIC_LINE_CALLBACK_URL=https://yourapp.com/api/auth/callback

# ── ECPay 金流 ───────────────────────────────────────────────
ECPAY_MERCHANT_ID=2000132
ECPAY_HASH_KEY=5294y06JbISpM5x9
ECPAY_HASH_IV=v77hoKGq4kWxNNIS
ECPAY_API_URL=https://payment.ecpay.com.tw    # 正式
# ECPAY_API_URL=https://payment-stage.ecpay.com.tw  # 測試

# ── ECPay 物流 ───────────────────────────────────────────────
ECPAY_LOGISTICS_MERCHANT_ID=2000132
ECPAY_LOGISTICS_HASH_KEY=XBERn1YOvpM9nfZc
ECPAY_LOGISTICS_HASH_IV=h1ONHk4P4yqbl5LK

# ── imagine art ──────────────────────────────────────────────
IMAGINE_ART_API_KEY=ia_...               # Server only

# ── Python API ───────────────────────────────────────────────
PYTHON_API_URL=https://xxx.railway.app
PYTHON_API_KEY=pk_...                    # Server only

# ── App ──────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourapp.com
NEXTAUTH_SECRET=randomstring32chars      # openssl rand -base64 32

# ── Sentry（選用）───────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 12. 部署架構

### Vercel（Next.js）

```
Production Branch：main
Preview Branch：任何 PR

Function Timeout：
  AI 相關：60 秒
  Webhooks：30 秒
  一般 API：15 秒

Edge Config：
  system_settings 快取（5 分鐘 TTL）

rewrites：
  /python-api/* → Railway Python API
```

### Railway（Python FastAPI）

```
Service：petcard-python-api
Build：Dockerfile
Port：8000
Health Check：GET /health

資源：
  Memory：512MB
  CPU：0.5 vCPU

環境變數：
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  API_KEY（與 Next.js 的 PYTHON_API_KEY 一致）
```

### GitHub Actions CI/CD

```yaml
Triggers：
  push: main     → build + deploy production
  pull_request   → typecheck + lint + build + e2e

Jobs：
  1. typecheck（tsc --noEmit）
  2. lint（eslint + prettier）
  3. build（next build）
  4. e2e（playwright，PR only）
  5. deploy（vercel --prod，main only）
```

---

## 13. 效能指標

### Core Web Vitals 目標

| 指標 | 目標值 | 說明 |
|------|--------|------|
| LCP | < 2.5s | 最大內容渲染 |
| FID/INP | < 100ms | 互動延遲 |
| CLS | < 0.1 | 版面位移 |
| TTFB | < 800ms | 首字節時間 |

### API 快取策略

| 端點 | Cache-Control | 說明 |
|------|---------------|------|
| GET /api/banners | max-age=300 | 5 分鐘 |
| GET /api/products | max-age=60, stale-while-revalidate=300 | 1 分鐘 |
| GET /api/about | max-age=300 | 5 分鐘 |
| GET /api/settings/public | max-age=60 | 1 分鐘 |
| GET /api/auth/me | no-store | 不快取 |
| GET /api/cart | no-store | 不快取 |

---

## 14. 第三方服務

| 服務 | 用途 | 文件連結 |
|------|------|----------|
| Supabase | DB + Auth + Storage | docs.supabase.com |
| Vercel | Next.js 部署 | vercel.com/docs |
| Railway | Python API 部署 | docs.railway.app |
| LINE Developers | LINE Login + Messaging API | developers.line.biz |
| Google Cloud | Google OAuth | console.cloud.google.com |
| 綠界科技 | 金流 + 物流 | developers.ecpay.com.tw |
| imagine art | AI 去背 + 生成 | mcp.imagine.art |
| Sentry | 錯誤監控 | sentry.io/docs |
| Playwright | E2E 測試 | playwright.dev |

---

*© 2026 PET.CHIC · 技術規格文件 · 請勿對外流通*
