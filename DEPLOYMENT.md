# Vercel 部署指南

## 專案結構

- `client/` - React + Vite 前端應用程式
- `backend/` - Express.js 後端 API 伺服器
- AI 功能透過 Google Gemini API 實現



#### Vercel 環境設定：

在 Vercel Dashboard 中設定以下環境變數：

#### 必需的環境變數：

- `GEMINI_API_KEY` - Google Gemini AI API 金鑰
- `MONGO_URI` - MongoDB 連接字串（推薦使用 MongoDB Atlas）

#### Optional環境變數：

- `CLERK_SECRET_KEY` - Clerk 認證金鑰
- `CLERK_PUBLISHABLE_KEY` - Clerk 公開金鑰
- `IMAGEKIT_PUBLIC_KEY` - ImageKit 公開金鑰
- `IMAGEKIT_PRIVATE_KEY` - ImageKit 私有金鑰
- `IMAGEKIT_URL_ENDPOINT` - ImageKit URL 端點

### 2. 部署到 Vercel

#### 方法一：透過 Vercel CLI

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 登入 Vercel
vercel login

# 部署專案
vercel

# 設定環境變數
vercel env add GEMINI_API_KEY
vercel env add MONGO_URI
```

#### 方法二：透過 GitHub 整合

1. 將程式碼推送到 GitHub 倉庫
2. 在 Vercel Dashboard 中匯入專案
3. 選擇根目錄作為專案根目錄
4. 設定建置設定：
   - Build Command: `npm run build` (前端)
   - Output Directory: `client/dist`
   - Install Command: `npm install`

### 3. 設定說明

#### Vercel 設定 (`vercel.json`)

- 前端靜態檔案從 `client/dist` 目錄提供
- 後端 API 路由透過 `/api/*` 路徑存取
- 最大函數執行時間設定為 30 秒

#### 後端適配

- 使用 ES 模組語法 (`export default app`)
- 在生產環境中不啟動本地伺服器
- 支援 Vercel 無伺服器函數

### 4. 資料庫設定

推薦使用 MongoDB Atlas 雲端資料庫：

1. 註冊 MongoDB Atlas 帳戶
2. 建立叢集
3. 取得連接字串
4. 在 Vercel 中設定 `MONGO_URI` 環境變數

### 5. AI 功能設定

1. 取得 Google Gemini API 金鑰
2. 在 Vercel 中設定 `GEMINI_API_KEY` 環境變數
3. 確保 API 金鑰有足夠的配額

### 6. 測試部署

部署完成後，測試以下功能：

- 前端頁面載入
- API 端點回應
- AI 功能（流程圖生成、程式碼檢查等）
- 資料庫連接

## 故障排除

### 常見問題：

1. **API 路由 404 錯誤**

   - 檢查 `vercel.json` 中的路由設定
   - 確保後端檔案正確匯出

2. **環境變數未載入**

   - 在 Vercel Dashboard 中檢查環境變數設定
   - 確保變數名稱正確

3. **AI 功能無法使用**

   - 驗證 `GEMINI_API_KEY` 是否正確設定
   - 檢查 API 金鑰是否有足夠配額

4. **資料庫連接失敗**
   - 驗證 `MONGO_URI` 連接字串
   - 確保資料庫允許 Vercel IP 存取

## 效能優化建議

1. 啟用 Vercel 的 CDN 快取
2. 使用 Vercel 的圖片優化功能
3. 設定適當的快取標頭
4. 監控函數執行時間和記憶體使用

## 監控和維護

1. 使用 Vercel Analytics 監控效能
2. 設定錯誤日誌監控
3. 定期檢查 API 配額使用情況
4. 監控資料庫效能
