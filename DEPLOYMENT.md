# Furchic 部署指南

> 本文件涵蓋從零開始將 Furchic 部署至正式環境所需的所有步驟。

---

## 目錄

1. [Supabase 設定](#1-supabase-設定)
2. [LINE Developers 設定](#2-line-developers-設定)
3. [Google Cloud OAuth 設定](#3-google-cloud-oauth-設定)
4. [綠界（ECPay）設定](#4-綠界-ecpay-設定)
5. [Vercel 部署](#5-vercel-部署)
6. [Railway Python API 部署](#6-railway-python-api-部署)
7. [Sentry 監控設定](#7-sentry-監控設定)
8. [GitHub Actions CI/CD](#8-github-actions-cicd)
9. [上線前 30 項 Checklist](#9-上線前-30-項-checklist)

---

## 1. Supabase 設定

### 1.1 建立專案

1. 登入 [https://supabase.com](https://supabase.com)
2. 點選 **New project**，選擇最近用戶所在區域（建議 `ap-northeast-1` Tokyo）
3. 記下 **Project URL** 和 **Project Ref**

### 1.2 執行 Migration

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 登入
supabase login

# 連結至你的專案
supabase link --project-ref <your-project-ref>

# 推送所有 migration
supabase db push

# （選用）執行 seed 資料
supabase db reset --db-url <your-db-url>
```

### 1.3 建立 Storage Buckets

在 Supabase Dashboard → Storage，建立以下 buckets：

| Bucket 名稱      | 存取類型 | 用途          |
| ---------------- | -------- | ------------- |
| `pet-photos`     | Public   | 寵物照片      |
| `card-prints`    | Public   | NFC 卡面圖片  |
| `company-assets` | Public   | Banner / Logo |
| `ai-images`      | Public   | AI 生成圖片   |

### 1.4 設定 RLS Policies

確認以下 SQL 已執行（詳見 `supabase/migrations/`）：

```sql
-- 確認 is_admin() function 存在
SELECT proname FROM pg_proc WHERE proname = 'is_admin';

-- 確認 users 表有 is_admin 欄位
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'is_admin';
```

### 1.5 取得 API Keys

Supabase Dashboard → Settings → API：

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key（勿公開）

### 1.6 設定 Auth Providers

Dashboard → Authentication → Providers：

- **Email** → 啟用，Confirm email = 依需求
- **Google** → 見第 3 節
- **LINE** → 見第 2 節

---

## 2. LINE Developers 設定

### 2.1 建立 Channel

1. 登入 [https://developers.line.biz](https://developers.line.biz)
2. 建立 Provider（若無）
3. 新增 **LINE Login** Channel

### 2.2 設定 Callback URL

在 LINE Login Channel → Callback URL：

```
https://your-project-ref.supabase.co/auth/v1/callback
```

### 2.3 取得憑證

- `LINE_CLIENT_ID` — Channel ID
- `LINE_CLIENT_SECRET` — Channel Secret

### 2.4 在 Supabase 設定

Dashboard → Authentication → Providers → LINE：

- Client ID: `LINE_CLIENT_ID`
- Client Secret: `LINE_CLIENT_SECRET`

---

## 3. Google Cloud OAuth 設定

### 3.1 建立 OAuth 2.0 用戶端

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client
3. Application type: **Web application**

### 3.2 設定 Redirect URI

```
https://your-project-ref.supabase.co/auth/v1/callback
```

### 3.3 取得憑證

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 3.4 在 Supabase 設定

Dashboard → Authentication → Providers → Google：

- Client ID / Secret 填入對應值

---

## 4. 綠界（ECPay）設定

### 4.1 申請商店帳號

前往 [https://www.ecpay.com.tw](https://www.ecpay.com.tw) 申請特約商店。

### 4.2 測試環境設定

測試環境使用以下固定值：

```
ECPAY_MERCHANT_ID=2000132
ECPAY_HASH_KEY=5294y06JbISpM5x9
ECPAY_HASH_IV=v77hoKGq4kWxNNIS
ECPAY_API_URL=https://payment-stage.ecpay.com.tw/Paymentgateway/aioCheckOut
```

### 4.3 Webhook 設定

在綠界後台 → 廠商管理 → 廠商基本資料，設定：

- **付款完成通知網址**：`https://your-domain.com/api/webhooks/ecpay`
- **取號完成通知網址**：`https://your-domain.com/api/webhooks/ecpay`

### 4.4 正式環境

正式環境需替換：

```
ECPAY_MERCHANT_ID=<your-merchant-id>
ECPAY_HASH_KEY=<prod-hash-key>
ECPAY_HASH_IV=<prod-hash-iv>
ECPAY_API_URL=https://payment.ecpay.com.tw/Paymentgateway/aioCheckOut
```

---

## 5. Vercel 部署

### 5.1 連結 GitHub

1. 登入 [https://vercel.com](https://vercel.com)
2. New Project → Import Git Repository → 選擇 `Furchic` repo
3. Framework Preset: **Next.js**（自動偵測）

### 5.2 設定環境變數

在 Vercel Dashboard → Settings → Environment Variables，新增：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App URLs
NEXT_PUBLIC_SITE_URL=https://furchic.com
NEXT_PUBLIC_APP_URL=https://furchic.com

# Auth
NEXTAUTH_SECRET=<random-32-char-string>

# LINE OAuth
LINE_CLIENT_ID=<your-line-channel-id>
LINE_CLIENT_SECRET=<your-line-channel-secret>

# ECPay
ECPAY_MERCHANT_ID=<merchant-id>
ECPAY_HASH_KEY=<hash-key>
ECPAY_HASH_IV=<hash-iv>
ECPAY_API_URL=https://payment.ecpay.com.tw/Paymentgateway/aioCheckOut

# Python API
PYTHON_API_URL=https://furchic-card-api.railway.app
PYTHON_API_KEY=<shared-secret>

# ImagineArt
IMAGINE_ART_API_KEY=<api-key>

# Sentry（選用）
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=<sentry-auth-token>

# Rate limiting
RATE_LIMIT_SALT=<random-string>
```

### 5.3 自訂網域

Settings → Domains → Add `furchic.com`，依 DNS 設定說明設定 A Record / CNAME。

### 5.4 取得 CI/CD Token

用於 GitHub Actions：

```bash
# 登入 Vercel CLI
npx vercel login

# 取得 VERCEL_ORG_ID 和 VERCEL_PROJECT_ID
npx vercel link
cat .vercel/project.json
```

---

## 6. Railway Python API 部署

### 6.1 建立 Railway 專案

1. 登入 [https://railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. 選擇 Furchic repo，**Root Directory** 設定為 `python-api`

### 6.2 設定環境變數

在 Railway → Variables：

```env
PYTHON_API_KEY=<shared-secret-same-as-vercel>
SUPABASE_URL=https://your-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ALLOWED_ORIGINS=https://furchic.com,https://www.furchic.com
DOMAIN=furchic.com
APP_URL=https://furchic.com
CARD_STORAGE_BUCKET=card-prints
```

### 6.3 確認 Health Check

部署完成後確認：

```bash
curl https://furchic-card-api.railway.app/health
# Expected: {"status": "ok"}
```

### 6.4 更新 vercel.json

將 `vercel.json` 中的 Railway URL 替換為實際值：

```json
{
  "rewrites": [
    {
      "source": "/python-api/:path*",
      "destination": "https://furchic-card-api.railway.app/:path*"
    }
  ]
}
```

---

## 7. Sentry 監控設定

### 7.1 安裝

```bash
npm install @sentry/nextjs
```

### 7.2 在 Sentry 建立專案

1. 登入 [https://sentry.io](https://sentry.io)
2. New Project → Next.js
3. 取得 **DSN**

### 7.3 更新 next.config.mjs

安裝後，在 `next.config.mjs` 中加入 Sentry wrapper：

```javascript
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig = {
  /* 現有設定 */
}

export default withSentryConfig(nextConfig, {
  org: 'your-sentry-org',
  project: 'furchic',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
})
```

### 7.4 設定 Source Maps

在 Vercel 環境變數加入：

```env
SENTRY_AUTH_TOKEN=<from-sentry-settings>
```

---

## 8. GitHub Actions CI/CD

### 8.1 設定 GitHub Secrets

在 GitHub → Repository Settings → Secrets → Actions：

| Secret                          | 說明                                         |
| ------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Project URL                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key                    |
| `VERCEL_TOKEN`                  | Vercel personal access token                 |
| `VERCEL_ORG_ID`                 | Vercel org ID（見 .vercel/project.json）     |
| `VERCEL_PROJECT_ID`             | Vercel project ID（見 .vercel/project.json） |

### 8.2 取得 Vercel Token

[Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens) → Create Token

### 8.3 CI 流程說明

| Job         | 觸發條件                | 說明                   |
| ----------- | ----------------------- | ---------------------- |
| `typecheck` | 所有 push/PR            | `tsc --noEmit`         |
| `lint`      | 所有 push/PR            | ESLint + Prettier      |
| `build`     | typecheck + lint 通過後 | `next build`           |
| `e2e`       | PR only                 | Playwright smoke tests |
| `deploy`    | push to main only       | `vercel --prod`        |

---

## 9. 上線前 30 項 Checklist

### 安全性

- [ ] 1. `SUPABASE_SERVICE_ROLE_KEY` 只存於後端，未 expose 至前端
- [ ] 2. RLS policies 已對所有表啟用並測試
- [ ] 3. Admin routes 均有 `withAdmin` guard
- [ ] 4. ECPay webhook CheckMacValue 驗證正常
- [ ] 5. Rate limiting 運作（測試 auth endpoint 連打）
- [ ] 6. CSP header 已設定（驗證 `curl -I https://furchic.com`）
- [ ] 7. 所有 API routes 輸入均有 Zod 驗證
- [ ] 8. 圖片 URL 僅接受 Supabase Storage 域名

### 功能測試

- [ ] 9. Email 註冊 / 登入 正常
- [ ] 10. LINE OAuth 登入正常
- [ ] 11. 新增寵物 → 建立 NFC 卡申請流程正常
- [ ] 12. NFC 卡公開頁（`/pet/[uuid]`）顯示正確
- [ ] 13. 購物車 → 結帳 → ECPay 付款頁正常跳轉
- [ ] 14. ECPay 付款完成 → webhook → 訂單狀態更新為 `paid`
- [ ] 15. 管理員後台所有列表頁可正常載入
- [ ] 16. 管理員 NFC 列印功能正常呼叫 Railway API
- [ ] 17. AI 圖片生成功能正常（Imagine Art API）
- [ ] 18. 點數系統：消費給點、扣點兌換正常

### 效能

- [ ] 19. Lighthouse Score > 80（首頁 Mobile）
- [ ] 20. 首屏 LCP < 2.5s（PageSpeed Insights）
- [ ] 21. API `/api/products` 回應有 Cache-Control header
- [ ] 22. 圖片均使用 `next/image`，有 `sizes` 屬性
- [ ] 23. Recharts 以 dynamic import 載入，不影響首頁 bundle

### 基礎設施

- [ ] 24. Vercel domain 已設定，SSL 憑證生效
- [ ] 25. Railway Python API health check 回應 200
- [ ] 26. Supabase Storage bucket 設定為 public（必要的 buckets）
- [ ] 27. 所有 Supabase buckets 有正確的 RLS policies
- [ ] 28. GitHub Actions CI pipeline 全綠
- [ ] 29. Sentry DSN 已設定，測試 error 可被捕捉

### 上線後

- [ ] 30. 設定 Uptime Monitor（UptimeRobot 或 Vercel Monitoring）監控首頁、`/health`、`/api/settings/public`
