# PET.CHIC WebApp — 設計規劃文件

> **版本：** v1.0 ｜ **更新：** 2026-06 ｜ **設計方向：** 現代寵物品牌 × 溫暖橘色系

---

## 目錄

1. [設計原則](#1-設計原則)
2. [色彩系統](#2-色彩系統)
3. [字體系統](#3-字體系統)
4. [間距與網格](#4-間距與網格)
5. [元件規範](#5-元件規範)
6. [頁面設計規格](#6-頁面設計規格)
7. [Admin 後台設計](#7-admin-後台設計)
8. [NFC 公開名片頁](#8-nfc-公開名片頁)
9. [RWD 斷點](#9-rwd-斷點)
10. [動畫規範](#10-動畫規範)
11. [圖示規範](#11-圖示規範)
12. [卡面設計規格](#12-卡面設計規格)

---

## 1. 設計原則

### 核心設計價值

```
溫暖 Warm         → 橘色主色調，讓飼主感受到關懷與溫度
信任 Trustworthy  → 清晰的資訊層級，讓緊急情況下能快速讀取
簡潔 Clean        → 減少視覺噪音，聚焦在寵物和重要資訊
行動友善 Mobile First → 活動現場以手機為主要裝置
```

### 設計參考

- **整體風格**：參考 hundur.co（寵物身份識別）、寵物品牌電商
- **NFC 名片頁**：護照感、身份證感，資訊清晰可讀
- **Admin 後台**：功能優先，參考 Shopify Admin、Cyberbiz 後台風格

---

## 2. 色彩系統

### 主色板（Tailwind Config）

```javascript
// tailwind.config.ts
colors: {
  primary: {
    50:  '#FFF7ED',  // 極淡橘，hover 背景
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',
    700: '#E8820C',  // ★ 品牌主色
    800: '#9A3412',
    900: '#7C2D12',
  },
  // 以下沿用 Tailwind 預設
  gray, slate, zinc, red, green, blue, yellow
}
```

### 語意色彩

| Token | 色碼 | 使用場景 |
|-------|------|----------|
| `brand-primary` | `#E8820C` | 主按鈕、Logo、重要標題 |
| `brand-primary-light` | `#FFF7ED` | 背景 tint、hover 狀態 |
| `brand-secondary` | `#F59E0B` | 漸層終點、輔助強調 |
| `success` | `#16A34A` | 成功狀態、NFC 已綁定 |
| `warning` | `#D97706` | 警告、低庫存 |
| `error` | `#DC2626` | 錯誤、停用狀態 |
| `info` | `#2563EB` | 資訊提示 |
| `text-primary` | `#111827` | 主要文字 |
| `text-secondary` | `#6B7280` | 次要文字 |
| `text-disabled` | `#D1D5DB` | 禁用文字 |
| `bg-base` | `#FFFFFF` | 頁面底色 |
| `bg-subtle` | `#F9FAFB` | 卡片背景、輕微分區 |
| `bg-muted` | `#F3F4F6` | 輸入框底色 |
| `border-default` | `#E5E7EB` | 一般邊框 |
| `border-strong` | `#D1D5DB` | 強調邊框 |

### NFC 狀態色彩

| 狀態 | Badge 底色 | Badge 文字 | 說明 |
|------|-----------|-----------|------|
| none | `#F3F4F6` | `#6B7280` | 未申請 |
| pending | `#FFF7ED` | `#C2410C` | 申請中 |
| active | `#F0FDF4` | `#166534` | 已啟用 |
| disabled | `#FEF2F2` | `#991B1B` | 已停用 |

---

## 3. 字體系統

### 字體選擇

```css
/* 主要字體（中英文混排） */
font-family: 'Noto Sans TC', 'Inter', -apple-system, sans-serif;

/* 數字與金額（等寬感） */
font-family: 'Inter', -apple-system, sans-serif;
font-variant-numeric: tabular-nums;

/* 程式碼（Admin 後台） */
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

### 字體尺寸階層

| Token | px | rem | 用途 |
|-------|-----|-----|------|
| `text-xs` | 12 | 0.75 | 標籤、說明文字 |
| `text-sm` | 14 | 0.875 | 次要文字、表格內容 |
| `text-base` | 16 | 1 | 正文、按鈕 |
| `text-lg` | 18 | 1.125 | 小標題 |
| `text-xl` | 20 | 1.25 | 卡片標題 |
| `text-2xl` | 24 | 1.5 | Section 標題 |
| `text-3xl` | 30 | 1.875 | 頁面標題 |
| `text-4xl` | 36 | 2.25 | Hero 標題 |
| `text-5xl` | 48 | 3 | NFC 名片寵物名 |

### 字重規範

| 用途 | weight | class |
|------|--------|-------|
| 正文 | 400 | `font-normal` |
| 強調正文 | 500 | `font-medium` |
| 小標題 | 600 | `font-semibold` |
| 標題 | 700 | `font-bold` |
| 超大標題 | 800 | `font-extrabold` |

---

## 4. 間距與網格

### 間距系統（Tailwind 預設）

```
4px  → p-1   # 最小間距，icon 內邊距
8px  → p-2   # 緊湊元素
12px → p-3   # 小型元件
16px → p-4   # 標準間距
20px → p-5
24px → p-6   # 卡片內邊距
32px → p-8   # Section 間距
48px → p-12  # 大 Section
64px → p-16  # 頁面頂部留白
```

### 容器寬度

```
最大容器：max-w-7xl（1280px）
內容容器：max-w-5xl（1024px）
窄容器：max-w-2xl（672px）—— 用於表單頁
Padding：px-4（mobile）/ px-6（tablet）/ px-8（desktop）
```

### 網格系統

```
商品列表：grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
寵物列表：grid-cols-1 md:grid-cols-2
Admin 表格：全寬
KPI 卡片：grid-cols-2 lg:grid-cols-4
圖表區：grid-cols-1 lg:grid-cols-2
```

---

## 5. 元件規範

### Button（按鈕）

```
Primary（主要按鈕）：
  背景：brand-primary（#E8820C）
  文字：白色
  Hover：bg-orange-600
  Border radius：rounded-lg（8px）
  Height：h-10（40px）標準 / h-9（36px）小型
  Padding：px-6
  Font：font-medium text-sm

Secondary（次要按鈕）：
  背景：白色
  邊框：border border-gray-300
  文字：gray-700
  Hover：bg-gray-50

Destructive（危險按鈕）：
  背景：red-600
  使用場景：刪除、停用

Ghost（幽靈按鈕）：
  背景：transparent
  Hover：bg-gray-100
  使用場景：次要操作、關閉

Loading 狀態：
  加入 spinner icon + 文字「處理中...」
  disabled + opacity-70
```

### Card（卡片）

```
標準卡片：
  背景：白色
  Border：border border-gray-200
  Shadow：shadow-sm
  Border radius：rounded-xl（12px）
  Padding：p-5 或 p-6

寵物卡片（特殊）：
  圖片：頂部圓角，aspect-ratio 1:1
  Hover：shadow-md + translateY(-2px)
  transition：150ms ease

商品卡片（特殊）：
  圖片：aspect-ratio 4:3
  Hover：image scale(1.05)
```

### Input（輸入框）

```
標準：
  Border：border-gray-300
  Border radius：rounded-md（6px）
  Height：h-10（40px）
  Padding：px-3
  Focus：ring-2 ring-orange-500 border-orange-500
  Error：border-red-500 + error message（text-red-600 text-sm）
  Placeholder：text-gray-400

Label：
  font-medium text-sm text-gray-700
  mb-1.5

Helper Text：
  text-xs text-gray-500 mt-1
```

### Badge（狀態標籤）

```
圓角：rounded-full
Padding：px-2.5 py-0.5
Font：text-xs font-medium

使用 StatusBadge 元件，傳入 status string 自動對應色彩
```

### Table（表格）

```
Header：bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider
Row：bg-white hover:bg-gray-50 border-b border-gray-200
Cell：px-6 py-4 text-sm
最後一欄：操作按鈕（icon buttons）
```

### Form Layout（表單）

```
單欄表單（窄容器 max-w-2xl）：
  Label 在上，Input 在下
  欄位間距：space-y-5
  Section 標題：text-lg font-semibold border-b pb-3 mb-5

雙欄表單（桌面）：
  grid-cols-2 gap-5
  電話、生日、性別等較短欄位用雙欄
```

### Modal / Dialog

```
Backdrop：bg-black/50
Container：bg-white rounded-2xl shadow-xl
Width：max-w-md（普通）/ max-w-2xl（大型表單）
Padding：p-6
Header：text-lg font-semibold
Footer：flex justify-end gap-3
動畫：fade in + scale from 95% to 100%
```

### Toast / Notification

```
位置：右下角（bottom-4 right-4）
Duration：3 秒自動消失
類型：
  success → 綠色左邊框 + check icon
  error → 紅色左邊框 + x icon
  warning → 橘色左邊框 + ! icon
  info → 藍色左邊框 + i icon
```

---

## 6. 頁面設計規格

### 首頁（/）

```
Header：
  固定在頂部，scroll 後加底部陰影
  Logo 左、導航中、登入/用戶 右
  Mobile：Logo 左、漢堡選單 右

區塊 1 - Hero Banner：
  全寬、高 500px（desktop）/ 300px（mobile）
  圖片 cover 填滿
  可選文字覆蓋（白色陰影文字）
  自動輪播 + 手動控制

區塊 2 - 三步驟說明：
  淡米色背景（bg-orange-50）
  三個卡片橫排（desktop）/ 縱列（mobile）
  每個卡片：emoji/icon + 數字 + 標題 + 說明
  Framer Motion：滾動進入時淡入上移

區塊 3 - 廠商 Logo 跑馬燈：
  白色背景
  Logo 灰階，hover 轉彩色
  無限循環，速度：30 秒一圈

區塊 4 - 精選商品：
  標題 + 「查看全部」連結
  4 件商品橫排（desktop）/ 2 件（mobile）

區塊 5 - NFC 卡介紹：
  左右分欄（desktop）/ 上下（mobile）
  左：卡面 mockup 圖（3D 傾斜效果）
  右：功能 list（icon + 標題 + 說明）

區塊 6 - CTA：
  深橘漸層背景
  大白色標題
  雙按鈕（白色主 + 透明次）

Footer：
  深灰背景（gray-900）
  白色文字
  四欄（desktop）/ 兩欄（tablet）/ 單欄（mobile）
```

### 登入頁（/auth）

```
整體：
  背景：淡橘漸層（from-orange-50 to-white）
  中央白色卡片，最大寬度 400px
  上方：PET.CHIC Logo + 品牌名

卡片內容（上到下）：
  標題「歡迎回來」/ 「立即加入」
  LINE 按鈕（全寬，綠底白字）
  Google 按鈕（全寬，白底灰框）
  分隔線「或」
  Email 表單（可切換登入/註冊）
  底部：隱私政策說明（灰色小字）
```

### 寵物列表（/pets）

```
頁面頂部：
  標題「我的寵物」
  右上角「＋ 新增寵物」（Primary Button）

寵物卡片：
  圖片：正方形，圓角 16px，填滿
  若無照片：橘色漸層背景 + 爪印 icon
  卡片底部：名字（font-semibold）、品種（text-gray-500 text-sm）
  右上角：NFC 狀態 badge
  操作：hover 顯示「編輯」「查看」按鈕

空狀態：
  插圖（貓狗插圖 SVG）
  「還沒有寵物」
  「新增第一隻寵物」按鈕
```

### 新增寵物（/pets/new）

```
步驟條（Stepper）：
  三個步驟：基本資料 / 照片 / 確認
  橘色線條連接，已完成步驟打勾

Step 1 - 基本資料：
  雙欄表單（桌面）
  品種：autocomplete 下拉（常見品種）
  性別：Radio Group（公/母，icon）
  生日：Date Picker
  絕育：Toggle Switch
  晶片：Input + 說明文字「如無晶片請填「無」」
  固定醫院：必填標示（紅色 *）

Step 2 - 照片：
  大型拖拽區域（dashed border，虛線橘色）
  「拖拽圖片至此」或「點擊選擇」
  支援格式說明
  上傳後：預覽 + AI 去背按鈕（橘色 outline）
  AI 去背結果：左右對比 slider 或並排

Step 3 - 確認：
  Summary 卡片（所有資料一覽）
  「確認新增」按鈕（Primary）
  「返回修改」連結
```

### 寵物詳情（/pets/[id]）

```
頂部 Hero：
  大照片（AI 去背照，圓形裁切，白色底）
  寵物名（text-3xl font-bold）
  品種、年齡（text-gray-500）
  NFC 卡狀態大 Badge

Tab 導航：
  寵物資訊 / 照護者 / 公開設定

Tab 1 - 寵物資訊：
  資訊列表（Icon + Label + Value）
  NFC 卡狀態卡片：
    已啟用：綠色卡片，顯示 QR Code
    申請中：橘色卡片，等待處理
    未申請：灰色卡片，「申請製卡」按鈕
    已停用：紅色卡片，「重新啟用」按鈕

Tab 2 - 照護者：
  照護者卡片列表（最多 5 個）
  每個：頭像圓形 + 名稱 + 角色 badge + 聯絡方式
  「邀請照護者」按鈕 + 複製連結

Tab 3 - 公開設定：
  每個欄位 Toggle（帶標籤和說明）
  固定公開的欄位：鎖定圖示 + 灰色 Toggle（無法關閉）
  即時儲存動畫
```

### 購物車（/cart）

```
雙欄佈局（桌面）/ 單欄（mobile，摘要在下）

左欄 - 商品列表：
  每個 item：
    圖片（正方形 64px）
    商品名 + 規格
    單價
    數量 +/- 按鈕（圓形，禁用時灰色）
    刪除（x icon，hover 變紅）
  商品間：細分隔線

右欄 - 訂單摘要（Sticky top-6）：
  卡片底色：bg-gray-50
  小計（金額右對齊）
  免運進度條：
    橘色底色進度條
    百分比動態計算
    「再買 NT$XXX 免運！」文字
  運費（若免運：「免運費 🎉」綠色）
  贈品提示（若滿額）：橘色 banner with gift icon
  分隔線
  總計（大字、粗體）
  「前往結帳」（全寬 Primary Button）
```

### 結帳（/checkout）

```
步驟式表單（Step Indicator 在頂部）：
  商品確認 / 配送資訊 / 付款方式 / 確認送出

左欄（桌面）- 表單區：
  配送方式 Tab：宅配 / 各超商
  宅配表單：收件人、電話、縣市（Select）、鄉鎮市區、地址
  超商：選擇超商品牌 → 跳出門市選擇（綠界 widget）

右欄（桌面）- 訂單摘要：
  Condensed 商品列表
  金額摘要（各折扣明細）
  優惠碼輸入（Accordion）
  回饋金折抵（Toggle + Slider）
  總計
  送出按鈕
```

---

## 7. Admin 後台設計

### 整體佈局

```
Sidebar（左側，寬 240px，深色主題）：
  頂部：Logo + 品牌名
  導航：分組顯示
    ─ 總覽
      儀表板
    ─ 寵物 & 卡片
      印製待辦、NFC 綁定、寵物管理
    ─ 商城
      商品管理、訂單管理
    ─ 會員
      會員管理、等級 & 回饋金
    ─ 行銷
      優惠折扣、促銷活動、兌換碼
    ─ 內容
      首頁 Banner、關於我們
    ─ 系統
      系統設定
  底部：用戶頭像 + 名稱 + 登出

Header（頂部）：
  搜尋框（快速搜尋訂單/會員）
  通知圖示（待印製 badge）
  用戶資訊

主內容區：
  bg-gray-50
  p-6（padding）
  最大寬度 full
```

### 儀表板

```
頁面標題 + 日期選擇器

KPI 卡片（4 個，2×2 grid → 4 欄 desktop）：
  每個卡片：
    Icon（帶色彩背景）
    數字（大字）
    Label（小字）
    趨勢（↑/↓ + 百分比，綠/紅）

圖表區（2×2 grid）：
  折線圖：白底卡片，圓角，shadow-sm
  標題在圖表上方
  Tooltip：白底，邊框，陰影
  Legend：底部或右側
  空資料：友善插圖 + 說明

轉換漏斗（全寬）：
  水平漏斗圖（SVG）
  每個步驟：寬度遞減
  顏色：橘色漸層（深 → 淡）
  步驟名 + 數量 + 轉換率

快速待辦（3 欄）：
  每個卡片：標題 + 列表 + 「查看全部」連結
  列表 item：hover 底色 + 連結
```

### Admin 表格規範

```
工具列（Table 上方）：
  左：搜尋 Input（寬 240px）
  中：篩選 Select（視需求）
  右：匯出 CSV、新增按鈕

Table：
  全寬
  Header：bg-gray-50，sticky top
  Row hover：bg-gray-50
  操作欄（最右）：icon buttons（edit, delete, view）
  Checkbox 欄（最左，若支援批次）

分頁：
  底部居中
  顯示「共 N 筆」
  頁碼 buttons

空狀態：
  table 中央顯示插圖 + 說明 + 新增按鈕
```

### 印製待辦頁

```
Tab：待印製（N）/ 印製中 / 已完成
搜尋列

卡片式列表（不用 table，方便查看圖片）：
  每張卡片（水平排列）：
    左：寵物圓形縮圖（60px）
    中：
      寵物名（font-semibold）
      品種 + 飼主名
      申請時間（灰色小字）
      來源 badge（現場兌換 / 線上訂單）
    右：操作按鈕組
      「預覽卡面」（Secondary）
      「下載正面」（icon）
      「下載背面」（icon）
      狀態按鈕（Primary）

預覽 Dialog：
  正面 / 背面 Tab
  圖片全寬顯示（帶圓角）
  「下載」按鈕
```

### NFC 綁定頁

```
三欄佈局（桌面）/ 步驟式（mobile）

左欄 - 搜尋寵物：
  大型搜尋框（placeholder「搜尋飼主名、寵物名...」）
  即時結果卡片列表
  已選中 → 藍色邊框高亮

中欄 - NFC 感應：
  圓形大按鈕（動畫 ring）
  感應狀態文字
  若不支援：手動 UUID 輸入

右欄 - 確認綁定：
  已選寵物資訊
  已感應卡片 UUID
  警告框（橘色，圖示 ⚠️）
  確認按鈕（需輸入名稱才啟用）
  成功狀態：全欄綠色動畫
```

---

## 8. NFC 公開名片頁

### 設計概念

```
風格：護照 / 身份證 × 現代寵物品牌
核心要求：
  - 緊急情況下 3 秒內找到聯絡電話
  - 手機優先，單手可操作
  - 視覺溫暖但資訊清晰
```

### 頁面結構

```
頁面背景：淡橘漸層（from-orange-50 to-white）

頂部 Header（小）：
  PET.CHIC Logo 居中（小型）

Hero 區：
  大圓形寵物照片（120px，白色邊框 + shadow-lg）
  寵物名（text-4xl font-bold，居中）
  品種（text-gray-500，居中）
  公開欄位（小 badge 列）

分隔線（橘色漸層，1px）

照護者區（最重要！）：
  Section 標題「緊急聯絡」（配紅色電話 icon）
  每個照護者卡片：
    白色卡片，shadow-sm，圓角 12px
    左：頭像（40px 圓形）
    右上：顯示名稱（font-semibold）
    右下：聯絡方式按鈕
      電話：🟢 大型撥打按鈕（綠色，非常明顯）
      LINE：💬 淡藍按鈕
      IG/FB：各自 icon 按鈕
  照護者之間：8px 間距

寵物詳情（可折疊）：
  「查看更多資訊」展開箭頭
  詳細欄位（依 public_fields 顯示）

底部 Footer：
  PET.CHIC Logo（小）
  「了解更多」連結

停用狀態：
  整體灰色濾鏡
  中央「此卡片已停用」文字（紅色）
  小字說明
```

### 關鍵 UI 決策

```
電話按鈕：
  一定要非常大（height 48px）
  綠色背景（#16A34A）
  白色電話 icon + 電話號碼文字
  直接是 <a href="tel:..."> 連結

照護者排序：
  飼主永遠第一
  其他照護者依 sort_order
  每個人的聯絡方式依加入順序

卡片停用提示：
  掃描到停用卡片 → 頁面保留基本框架
  但所有個資替換為「已停用」
  避免讓找到遺失卡片的人困惑
```

---

## 9. RWD 斷點

```javascript
// Tailwind 預設斷點
screens: {
  'sm': '640px',   // 大手機 / 小平板
  'md': '768px',   // 平板
  'lg': '1024px',  // 小筆電
  'xl': '1280px',  // 桌機
  '2xl': '1536px', // 大螢幕
}
```

### 各頁面 RWD 行為

| 頁面 | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| 首頁 Banner | 高 300px | 高 400px | 高 500px |
| 商品列表 | 1 欄 | 2 欄 | 3 欄 |
| 寵物列表 | 1 欄 | 2 欄 | 2 欄 |
| 購物車 | 單欄（摘要下） | 單欄 | 雙欄（摘要右 sticky） |
| 結帳 | 單欄 | 單欄 | 雙欄 |
| Admin Sidebar | 底部 Tab bar | 收合 Drawer | 固定側邊 |
| Admin Table | 水平滾動 | 全欄 | 全欄 |
| NFC 名片 | 全寬單欄 | 最大 440px 居中 | 最大 480px 居中 |

### Mobile Header

```
手機版 Header：
  高 56px
  Logo 居中
  漢堡選單（右側）
  購物車 icon（右側，若已登入）

Mobile Bottom Nav（首頁/商城/寵物/個人）：
  固定底部
  4 個 icon + label
  選中：橘色 icon
```

---

## 10. 動畫規範

### 使用原則

```
不要過度動畫，功能優先
動畫目的：
  1. 提供操作回饋
  2. 引導注意力
  3. 過場順滑感

避免：
  - 純裝飾且耗效能的動畫
  - 阻礙操作的長動畫
  - 手機上的複雜動畫
```

### 時長規範

| 類型 | 時長 | easing |
|------|------|--------|
| 按鈕 hover | 100ms | ease |
| 元件 hover | 150ms | ease |
| 展開/收合 | 200ms | ease-out |
| Modal 開啟 | 200ms | ease-out |
| Toast 進入 | 300ms | spring |
| 頁面過場 | 300ms | ease-in-out |
| 首頁滾動觸發 | 600ms | ease-out |

### Framer Motion 使用位置

```javascript
// 首頁三步驟卡片（Intersection Observer）
variants={{
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}}

// 廠商 Logo 跑馬燈（純 CSS）
@keyframes marquee {
  0% { transform: translateX(0) }
  100% { transform: translateX(-50%) }
}
animation: marquee 30s linear infinite;

// Modal 開啟
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ duration: 0.2 }}

// NFC 感應動畫（Pulse ring）
animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
transition={{ duration: 2, repeat: Infinity }}
```

---

## 11. 圖示規範

### 圖示庫

```
使用 lucide-react（shadcn/ui 預設）

安裝：npm install lucide-react
使用：import { ShoppingCart } from 'lucide-react'
```

### 常用圖示對應

| 功能 | Icon | 說明 |
|------|------|------|
| 寵物 | `PawPrint` | 主要寵物識別 |
| NFC 卡 | `CreditCard` | 卡片相關 |
| QR Code | `QrCode` | 掃描 |
| 購物車 | `ShoppingCart` | 購物 |
| 訂單 | `Package` | 訂單管理 |
| 出貨 | `Truck` | 物流 |
| 會員 | `User` | 個人 |
| 等級 | `Star` | 等級 |
| 回饋金 | `Coins` | 點數 |
| 折扣 | `Tag` | 優惠 |
| 設定 | `Settings` | 系統 |
| 圖片上傳 | `ImagePlus` | 上傳 |
| AI 生成 | `Sparkles` | AI 功能 |
| 電話 | `Phone` | 撥打 |
| 警告 | `AlertTriangle` | 警告 |
| 成功 | `CheckCircle` | 完成 |
| 印製 | `Printer` | 印製 |
| 匯出 | `Download` | 下載 |
| 匯入 | `Upload` | 上傳 |

### Icon 尺寸規範

```
inline（正文內）：size={16}（h-4 w-4）
按鈕旁：size={16}（h-4 w-4）
獨立按鈕：size={20}（h-5 w-5）
KPI 卡片：size={24}（h-6 w-6）
空狀態插圖：size={48}（h-12 w-12）
```

---

## 12. 卡面設計規格

### 實體尺寸

```
標準：CR-80（信用卡標準）
  寬：85.6mm
  高：54mm

圓角：半徑 3mm

輸出：
  解析度：300 DPI
  像素尺寸：1012 × 638px
  色彩模式：RGB（螢幕預覽）
  格式：PNG（無損）
```

### 正面設計元素

```
背景：
  品牌橘色漸層（#E8820C → #F59E0B，左上到右下）

Logo 區（左上）：
  PET.CHIC Logo（白色）
  尺寸：約 120px 寬

文字區（上半）：
  主標：「我的寵物 獨自在家」
  字體：Noto Sans TC Bold
  顏色：白色
  字號：約 60px

  副標（三行）：
  「如本人發生意外或需緊急送醫」
  「請聯絡背面緊急聯絡人」
  「協助安排寵物照護事宜」
  字號：約 28px，行距 1.4

寵物照片區（下方）：
  AI 去背寵物照合成
  置中、下對齊到出血線
  自然融入漸層背景

QR Code（右下角）：
  白色正方形底（含 8px padding）
  QR Code 本體：約 80×80px
  總尺寸：約 96×96px
  距邊緣：12px
```

### 背面設計元素

```
背景：白色

四角裝飾：
  橘色（#E8820C）圓角矩形
  尺寸：約 40×40px
  位置：四角各一

頂部標題：
  「寵物 緊急 聯絡 卡」（字距稍寬）
  顏色：#E8820C
  字號：約 32px

英文副標：
  「ICE EMERGENCY CARD」
  白色文字，橘色矩形底
  類似膠帶標籤樣式

中央裝飾線條：
  水平分隔線（點線，橘色）
  視覺引導區域，但無實際個資

底部：
  PET.CHIC Logo（彩色小版）
  QR Code（右下，尺寸同正面）
  網址文字（超小，灰色）
```

### 卡面生成流程

```
1. 飼主完成寵物 AI 去背照
2. 申請製卡
3. Python API 接收：
   - uuid（QR Code URL 的識別碼）
   - pet_ai_photo_url（去背照）
4. Pillow 合成：
   - 載入背景素材（由 Leon 提供）
   - 下載並貼上寵物去背照
   - 生成 QR Code
   - 合成正面 PNG
   - 合成背面 PNG
5. 上傳到 Supabase Storage card-images/
6. 回傳 URL 給 Next.js
7. Admin 後台可下載
```

---

## 附錄：shadcn/ui 元件清單

安裝的元件及主要用途：

| 元件 | 用途 |
|------|------|
| Button | 全站按鈕 |
| Card | 寵物卡片、商品卡片、資訊卡片 |
| Input | 表單輸入 |
| Label | 表單標籤 |
| Select | 下拉選單（縣市、品種） |
| Badge | 狀態標籤 |
| Dialog | Modal 對話框 |
| DropdownMenu | 操作選單 |
| Sheet | 側邊 Drawer（Mobile 選單、詳情） |
| Table | Admin 表格（配合 TanStack Table） |
| Tabs | 分頁（寵物詳情、結帳步驟） |
| Toast | 通知提示 |
| Avatar | 用戶頭像 |
| Separator | 分隔線 |
| Skeleton | 載入骨架 |
| Switch | Toggle（公開設定、上下架） |
| Progress | 免運進度條、升等進度 |
| Popover | 日期選擇器、提示浮層 |
| Command | 品種搜尋 autocomplete |
| Form | React Hook Form 整合 |

---

*© 2026 PET.CHIC · 設計規劃文件 · 請勿對外流通*
