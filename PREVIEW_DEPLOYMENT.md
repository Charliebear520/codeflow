# 自有 Vercel 新專案 Preview

本輪僅建立新專案與 Preview，不推送 GitHub、不修改原 Vercel 專案。Production 必須在 Preview 驗證後另行確認。

## 目前狀態

- 目標 Scope：`huixuanxus-projects`；已建立新專案 `codeflow-demo`，登入帳號 `huixuanxu`，Hobby 方案。
- 根目錄沒有 `.vercel` 綁定；未更動原專案。
- 本機資料庫仍是 localhost 的 `codeflow_demo`。獨立 Atlas Free 叢集已建立，雲端 `codeflow_demo` 初始化及重跑皆為 8 位示範學生／8 筆示範作答；未搬移真實資料。
- **已知問題：教師看不到真實學生新紀錄。完整學生儲存、重整、教師更新流程尚未通過本輪驗證。**
- 本機既有 build 與關鍵測試結果見 `DASHBOARD_REVIEW.md`，不代表線上通過。

## 部署來源

執行 `powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/prepare-preview.ps1`，將目前修改後的程式複製到 `.deployment-preview/source`，雜湊清單位於 `.deployment-preview/manifest.json`，都不提交 Git。

來源包含根目錄 `vercel.json`、前端原始碼與 Yarn 鎖定檔、後端 index/lib/models/services 與 npm 鎖定檔、版本管理中的前端公共素材。公共素材中的既有題目圖片保留；未追蹤的學生圖片不複製。

不包含 `.env`、`.git`、原專案綁定、node_modules、測試程式與截圖、資料庫、備份、操作紀錄。來源建立後若程式再修改，先檢查原 manifest 與專案綁定，再建立新版本來源，不能沿用過期副本。

Root Directory 使用此來源根目錄（不是 client）。`vercel.json` 同時建置 `client/package.json` 與 `backend/index.js`；`/api/*` 進後端，其他路徑進前端。保持既有套件版本與鎖定檔。

## 登入與綁定

### 最新複測：Atlas 規則套用後

- 使用者確認已設定 `0.0.0.0/0`，備註 Vercel demo，**1 週到期**、Active；保留原電腦 IP。此為使用者實際設定的期限，取代先前計畫的 1 天。展示結束後可提早移除此暫時規則。
- 已從新 Preview 的真實 Node Function 觸發連線，再讀取 `/api/status`：`mongodb.connected=true`、`database=codeflow_demo`、`lastError=null`，線上 MongoDB 連線通過。
- 部署 inspect：target=preview、Ready；未發布 Production。
- 擁有者授權請求 `/dashboard` 回 CodeFlow HTML，React root 存在；引用的 3 個 JavaScript、1 個 CSS 全數回 HTTP 200。
- `/api/admin/submissions` 未攜帶應用登入憑證時回 HTTP 401，權限檢查保留。
- 以上請求使用 Vercel 擁有者授權，不代表匿名訪客可存取；Vercel Authentication 保護仍啟用。
- 待使用者瀏覽器驗證：Clerk 教師登入、選原有教師 Organization、8 位示範學生、篩選、AI 總結與流程圖歷史。學生儲存→重整→教師更新仍未驗證，教師看不到真實新紀錄的已知問題保留。

CLI 固定 `vercel@65.8.0`，可用 `npx.cmd --yes --package vercel@65.8.0 vercel`。先執行 login、whoami、teams ls，確認本人與 Scope。帳號登入不等於已選對專案。

使用者確認新名稱後，先列出 Scope 專案，確認沒有同名舊專案，才建立新專案。僅在 `.deployment-preview/source` 綁定；檢查 `.vercel/project.json` 的新 projectId/orgId 與新名稱符合。若發現任何既有綁定，先保留副本再處理。

部署明確使用 `deploy --environment preview --scope huixuanxus-projects`，不用 `--prod` 或 `--temporary`。不連 GitHub、不開通付費服務。CLI 65.8.0 的舊 `--target=preview` 曾非預期建立 production target；已立即透過 API 取消該建置並核對 Canceled，後續只能使用現行 `--environment preview`。

## 2026-10-30 本輪部署結果（台灣時間）

- Preview：`https://codeflow-demo-7cgoibji0-huixuanxus-projects.vercel.app/dashboard`
- Deployment ID：`dpl_V6G5qAiA3bQX8xd4zvhrxuaD9dYf`，實際 target=preview、Ready；前端 Yarn/Vite 與後端 Node Function 建置成功。
- 專案綁定僅在 `.deployment-preview/source/.vercel/project.json`；根目錄沒有綁定。CLI 建立的 `.env.local` 含登入憑證，仍由 `.vercelignore` 排除，不得分享或上傳。
- Preview 環境已設定 MONGO_URI、MONGO_DB_NAME、CLERK_SECRET_KEY、CLERK_PUBLISHABLE_KEY、VITE_CLERK_PUBLISHABLE_KEY、GEMINI_API_KEY、ADMIN_EMAILS；CLIENT_URL 已設定為上述 Preview origin（在首次建置後新增，下次 Preview 建置會套用）。
- 開發 Clerk instance 的前後端公開 key 已比對一致，但真實登入與教師權限仍待使用者瀏覽器驗證。使用者目前不確定 Clerk 管理權限。
- `/api/status` 正常回 JSON；`/api/admin/submissions` 未登入回 401。Atlas 連線尚未通過：線上錯誤為 IP 白名單連線失敗。
- 使用者已同意暫時開放 `0.0.0.0/0` 並設 1 天到期，待使用者在 Atlas IP Access List 實際完成；目前尚未確認套用。
- Vercel Authentication 保護保留。匿名開啟會轉到 Vercel 登入頁，該頁的 HTTP 200 不能計為應用成功；擁有者 CLI 授權檢查只證明後端可回應，不證明觀眾可公開開啟。
- 未完成：線上 Atlas 連線、教師登入、8 筆資料實際 Dashboard、AI 總結與流程圖、學生儲存與教師同步。Production 未成功發布；非預期 production 建置 `dpl_4JGBERfpR5TCbUmHY6gqB3JVnomJ` 已取消。

## Atlas

使用者在自己的 Atlas 專案確認是否有 Free/M0 叢集；若無，只選免費方案，不載入範例或真實學生資料。另建資料庫使用者，只授予 `codeflow_demo` 的 readWrite。Network Access 先允許本機目前 IP，供初始化；Vercel 動態出口的連線規則需另行確認，不擅自開放所有來源或購買固定出口。

把 Atlas Drivers 的完整 URI 只存於本機根目錄 `.env.preview.local`，不要貼入聊天、文件或命令列參數。此檔已被 Git、上傳清單排除：

```dotenv
MONGO_URI=
MONGO_DB_NAME=codeflow_demo
```

填好後先執行：

```powershell
node backend/scripts/seed-preview-demo.js --config .env.preview.local
node backend/scripts/seed-preview-demo.js --config .env.preview.local --apply
```

第一個命令只檢查設定，不連線或寫入。第二個命令只建立／更新固定識別碼、明確標記的 8 個示範學生及 8 筆示範作答，不搬移本機真實紀錄或教師帳號。腳本限制 Atlas SRV URI 與 codeflow_demo，遇到非示範識別碼衝突會停止；不輸出連線字串與原始驅動錯誤。重跑後仍應為 8/8。

## 新專案 Preview 環境變數

在自己新專案 Settings → Environment Variables 安全輸入，先只勾 Preview：

| 名稱 | 設定 |
| --- | --- |
| MONGO_URI | Atlas URI；不要另設 MONGO/MONGODB_URI/MONGO_URL 造成優先序混淆 |
| MONGO_DB_NAME | codeflow_demo |
| CLERK_SECRET_KEY | 與前端相同 Clerk instance 的 secret key，僅後端 |
| CLERK_PUBLISHABLE_KEY | 同 instance 公開 key，後端使用 |
| VITE_CLERK_PUBLISHABLE_KEY | 同 instance 公開 key，前端建置時使用 |
| GEMINI_API_KEY | Gemini key，僅後端；示範分析仍明確標記為示範 |
| CLIENT_URL | 此新 Preview 的 HTTPS origin |
| ADMIN_EMAILS | 必要時指定已登入教師的允許信箱；或使用既有 Clerk 教師 Organization 權限 |

NODE_ENV=production 已由 vercel.json 設定。不要將 secret key 或 Mongo URI 設成 VITE_*。本機權限記錄不搬上雲端，雲端教師登入需獨立確認權限。

確認自己有 Clerk instance 設定權限、前後端 keys 配對。取得新網址後，在 Clerk 對應開發或正式 instance 的 Domains／允許來源、登入與登出返回網址、OAuth callback 設定新網址；不要移除舊網址。正式 instance 的網域限制需依實際設定確認，不能保證更換 CLIENT_URL 即可登入。環境變數變更後重新建立 Preview，尤其 VITE_* 必須重建。

## 線上驗證與日誌

逐項記錄成功、失敗、未驗證：

1. 新 Preview `/dashboard` 能載入靜態資源，`/api/status` 真正進後端，不是 index.html。
2. 觸發需 DB 的 API 後，status 的 connected=true、database=codeflow_demo；status 本身不代表已執行連線。
3. 未登入的教師 API 回 401；學生不能取得教師資料；教師登入後才能讀 8 筆示範紀錄。
4. 示範01～08、篩選、耗時、AI總結三條操作折線、流程圖歷次提交，在實際登入頁面驗證。
5. 使用測試學生儲存、重整、教師重新整理，另列完整流程結果；不可用示範資料代替此驗證。

遇到問題查看新專案 Build Logs、Runtime/Function Logs、瀏覽器 Network 的 URL／狀態碼、Clerk instance 與 Organization 角色。分享日誌前移除 Authorization、Cookie、Token、URI、密碼與個資。Python 執行需伺服器具備 python3，Vercel Node Function 不保證提供；不得將儲存成功宣稱為執行／評分成功。圖片上傳仍停用。

Preview 受 Vercel Deployment Protection 保護時，觀眾可能需額外授權；先核對可分享方式，不擅自取消保護。所有必要項目通過後，再請使用者確認 Production。
