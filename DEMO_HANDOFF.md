# Codeflow 示範版交接（2026-10-30，台灣時間）

## 目前狀態與安全範圍

- 保留已完成的備份與快轉合併，基底提交為 `25d1aaf`；本次修改尚未提交、推送或部署。
- 原備份：`C:\Users\huihxuan\Desktop\codeflow-backup-20261030-022411-2b1fd227`。
- 備份分支：`backup/pre-update-20261030-022411-2b1fd227`。
- 依使用者同意，本機 `.env` 僅增加／設定 `MONGO_DB_NAME=codeflow_demo`，保留原連線憑證；原資料庫未寫入。
- 程式使用同一 MongoDB 叢集中的獨立 `codeflow_demo`。8 筆作答標示 `isDemo=true`、`demoBatch=codeflow-demo-v1`，使用固定 `_id`。
- 初始化不清空資料；依本輪要求，重跑會更新這 8 筆已標記示範作答的固定時間、四週事件與流程圖版本，不改其他紀錄。固定識別碼若碰到非本批示範資料即停止。
- 保持 Clerk 驗證與教師權限；初始化腳本不是公開 HTTP API，沒有提供登入繞過功能。
- 已唯讀取得原資料庫現有的 1 位教師角色，僅依相同 Clerk `userId` 保留到示範庫；原庫未變更，未將一般學生升權。後續其他教師帳號仍需既有 Organization／管理者設定。

## 本機啟動與重新初始化

目前服務可能仍在執行。先確認 5000、5173 的程序來源，不要重複啟動或停止不明程序。

```powershell
# 終端機一，專案根目錄
npm.cmd --prefix backend start

# 終端機二，專案根目錄
npm.cmd --prefix client run dev

# 檢視初始化計畫，不寫入
cd backend
npm.cmd run seed:demo

# 僅在 MONGO_DB_NAME=codeflow_demo 時可執行
npm.cmd run seed:demo -- --apply
```

前端：`http://localhost:5173`。後端：`http://localhost:5000`。Vite 的 `/api` 代理至 `127.0.0.1:5000`。前端本流程以相對路徑呼叫 API，未使用舊 `VITE_API_URL`。

## 真實帳號展示驗證

1. 教師帳號登入前端，開啟 `/dashboard`。已保留原庫既有的 1 位教師角色；若其他帳號被導向 `/no-access`，先選擇既有教師 Organization；或確認該帳號電子郵件已由管理者列入伺服器 `ADMIN_EMAILS`，再重新登入／重整。後續原庫角色變更不會自動同步；不可把一般學生升級為教師來避過問題。
2. 預期看到「示範學生01～08」共 8 筆作答，各有「示範資料」標記、三階段內容與分數。查看按鈕從真正 API 資料開啟作答；固定回饋明示是示範回饋，非即時 AI 評語。
3. 另一個瀏覽器／無痕視窗，以一般學生登入，開啟 `/stage3?questionId=Q001`。示範題為「判斷是否下雨並決定帶傘」；此次展示先不要產生另一道題。
4. 輸入以下 Python 程式，按編輯器「儲存」（「上傳」也使用同一個資料庫儲存流程）。必須看到「作答已儲存至資料庫」，不是只有網頁暫存。

```python
weather = input("今天會下雨嗎？")
if weather == "下雨":
    print("帶傘")
else:
    print("不帶傘")
```

5. 重整學生頁，程式與語言應由 `GET /api/submissions/mine?questionId=Q001` 還原。API 只依已驗證的登入身分讀取，不能以別人的 `studentId` 讀取／寫入。
6. 在右側助教區按「檢查」。這會呼叫 `POST /api/submissions/stage3/compare`，由伺服器計算分數並保存作答、分數、回饋、報告及檢查次數。寫入失敗必須顯示錯誤。AI 回饋的可用性與品質仍取決於 Gemini 憑證／配額，需用真實帳號驗證。
7. 教師頁按「重新整理」，應出現這位真實學生的作答，與 8 筆固定資料並存；查看第三階段，確認程式內容與分數。教師頁另在進入、切回視窗及每 15 秒更新，資料庫故障顯示錯誤，不顯示假資料。
8. 學生直接開啟 `/dashboard` 應無權限；對教師 API 的請求應回 `403`（未登入為 `401`）。用另一個學生登入，不能還原前一位學生的程式。
9. 第一階段可用「線上製作」儲存流程圖；第二階段可儲存虛擬碼。重整後仍由同一筆學生／題目紀錄還原。修改已評分答案會清除舊評分，須重新按檢查。

同次網路重試沿用 `Idempotency-Key` 與原始內容，後端以原子更新去重，時間與檢查次數只計算一次。同一學生同一題持續更新同一筆作答。不同操作重用相同識別碼會回 `409`。

## 已執行測試及界線

最終紀錄：前端 build 通過；單元／API 測試 37/37 通過；真實 MongoDB 整合測試 18/18 通過（含父測試），涵蓋三個階段正式 HTTP 評分處理器、篩選、統計、操作事件、提交版本、初始化及 AI 建議安全 fallback。`git diff --check` 通過。lint 未通過，245 個錯誤、12 個警告；包含既有問題及元件 props 驗證等規則，未為展示進行全面規則清理。前一輪 Gemini 小量連通測試成功；本輪摘要將紀錄事實與即時 AI 建議分開標示，不把規則分析冒充模型生成。使用者已回報前版「學生儲存→重整→教師更新」都成功；本輪事件／歷史及新版畫面仍須真實帳號再跑一次回歸。Vercel 新版未部署、未驗收。

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix backend run test:demo
npm.cmd --prefix client run build
npm.cmd --prefix client run lint
```

- API／單元測試包含未登入保護、資料庫離線、輸入驗證、固定資料、前端遺失回應後重試與帳號隔離。
- `test:demo` 只在 `codeflow_demo` 建立本次隨機命名的兩個臨時集合，驗證真正 MongoDB 寫入、重跑初始化、並行重試、還原、評分保存、教師查詢及越權拒絕；完成後只清除這兩個集合。
- 整合測試的 HTTP 身分由測試程式模擬，使用正式程式共用的權限／持久化邏輯；不能替代真實 Clerk 登入、瀏覽器呈現與 Gemini 呼叫驗證。沒有在正式 app 增加測試身分標頭。
- 整合測試已直接使用三個階段正式 HTTP 評分處理器，測試程序內不呼叫外部 Gemini；比對、寫入與教師讀取使用實際程式及真實 MongoDB。它另驗證回傳的分數／報告就是資料庫保存的結果，評分寫入失敗回 `503`。
- 本機 build 與 API／MongoDB 測試成功，不代表 Vercel 線上成功。
- 既有 lint 問題不在本次全面修復；建置仍有大 bundle 警告。未升級 Node 或套件、未更動鎖定檔。
- ImageKit 圖片上傳 API 保留 `501` 停用；此展示以流程圖編輯器／程式碼儲存為主。
- Vercel 的短生命週期函數不能保證既有互動式 Python／C 子程序跨請求存活；本次線上展示以作答保存與評分為驗收，不以互動終端機執行作為已驗證能力。

## 本次修改檔案

| 檔案 | 原因 |
| --- | --- |
| `backend/lib/db.js`、本機忽略的 `backend/.env` | 明確以 `MONGO_DB_NAME` 指定獨立測試庫，狀態 API 顯示所選資料庫；原憑證保持原值 |
| `backend/models/Student.js`、`backend/models/Submission.js` | 示範標記、操作去重欄位、保存流程圖評分結構 |
| `backend/index.js`、`backend/lib/submissionRoutes.js`、`backend/lib/submissionStore.js`、`backend/lib/teacherAccess.js` | 統一真實寫入、登入與教師檢查、個人讀取、教師分頁、原子去重、拒絕偽造身分／客戶端分數、防止慢評分覆蓋新答案，移除成功略過儲存的分支 |
| `backend/lib/demoData.js`、`backend/scripts/seed-demo.js`、`backend/package.json` | 固定 8 筆與安全初始化／測試命令 |
| `backend/test/api.test.js`、`backend/test/submissions.test.js`、`backend/test/client-retry.test.js`、`backend/test/demo.integration.js` | 權限、資料庫、重試、評分保存、初始化與跨學生隔離測試；移除強制 exit(0) 避免掩蓋測試失敗 |
| `client/src/lib/submissions.js`、`client/src/components/Answer/index.jsx`、`client/src/components/Check/index.jsx`、`client/src/components/OnlineCoding/index.jsx` | 同一題目識別、儲存與評分請求去重、失敗回報、伺服器還原流程圖／虛擬碼／程式碼 |
| `client/src/components/StudentsRecords/index.jsx`、`client/src/components/StudentsRecordsCard/index.jsx` 及各自 CSS | 真 API 顯示、移除重複卡片、示範標記與分數、更新／錯誤／分頁呈現，調整卡片避免新內容溢出 |
| `client/src/components/TopicStage2/index.jsx` | 移除無驗證且沒有答案內容的離頁 beacon 寫入，時間統一隨有效儲存提交 |
| `client/src/lib/roles.js` | 教師角色快取依使用者隔離，避免切換帳號沿用前一人的角色 |
| `client/src/components/StudentAnswerModal/index.jsx` | 教師查看作答時顯示已保存的分數、時間、回饋與報告 |
| `DEMO_HANDOFF.md` | 本機與線上展示驗收、部署設定及限制 |

## 使用者離席期間的補強

- Q001 內建程式標準答案補上 `language=python`，避免展示 Python 題時不必要地重新生成標準答案。
- 評分重試直接回傳已保存的結果，不再次呼叫 AI；若原答案已被編輯，舊操作回 `409`，不回傳過期成功結果。
- 評分 HTTP 回應改由已保存的 Submission 取分數／回饋／報告，避免回應與資料庫不一致。
- 前端收到 HTTP 200 但無可確認的 JSON／submissionId 時保留重試識別碼，避免代理錯誤頁造成重複計算。
- 切換學生載入作答時先清除上一次編輯器內容，避免新帳號讀取失敗時仍看到前一帳號的答案。
- 以上補強未增加套件、未重做備份／合併，也未調整線上環境。

## 給 Vercel 專案管理者

實際指定展示網址為 `https://codeflow-teal.vercel.app/dashboard`。目前無法取得原專案管理者協助；可用自己有權限的 Vercel 帳號另建專案，使用新的網址。Vercel 支援從本機 CLI 部署未連結 Git 的專案，因此不一定要先推 GitHub，但原 `codeflow-teal.vercel.app` 的設定／部署仍屬原專案權限範圍。本次未執行發布。若只從 GitHub 匯入現有遠端提交，會缺少本機尚未推送的修改。

另建專案時仍要自行設定下表環境變數、確認 Atlas 存取與 Clerk 網域。已新增 `.vercelignore` 排除本機 `.env`、隔離預覽與測試檔；不要將 `.env` 內容貼到聊天或提交 Git。手動發布可依[官方 CLI 部署流程](https://vercel.com/docs/deployments)，先確認連結的是自己的新專案，再處理 Preview／Production 環境，不能只上傳 `client/dist` 而遺漏 API。

使用者目前沒有專案後台權限，本次沒有推送或部署。要在網路上展示新功能，必須由管理者取得本次本地變更後部署，或先授予使用者對應權限。只重新部署 GitHub 現有 `25d1aaf` 不會包含這些尚未推送的修改。

請管理者確認以下事項，勿透過聊天分享金鑰或連線字串：

| 設定 | 本版需求 |
| --- | --- |
| Root Directory | 儲存庫根目錄，包含 `vercel.json`、`client`、`backend`；不可只部署 `client` 而遺漏 API |
| 路由 | 保留既有 `vercel.json`：`/api/*` 到 `backend/index.js`、前端靜態資源及 SPA 回退 |
| 前端 build | `client` 使用既有 Yarn v1 鎖定檔，`yarn install --frozen-lockfile`；build 為 `npm run build`，輸出 `client/dist` |
| 後端依賴 | 依 `backend/package-lock.json` 安裝；確認 build log 有安裝 mongoose、Express、Clerk 等依賴 |
| Node | 本機驗證版本 `22.19.0`；不要只因 README 的 23.1.0 描述升級 |
| 環境 | 在預定展示的 Preview／Production 環境各自設定，變更後需重新部署 |

現有配置採用 `builds` 的兩個 builder；以實際 build log 確認 builder 的工作目錄、安裝命令與產物，不要同時套用一份只建置前端的覆寫設定。本次沒有 Vercel 帳號權限，因此尚未對該專案執行雲端 build 驗證。

| 環境變數名稱 | 用途／設定方式 |
| --- | --- |
| `MONGO_URI` | 伺服器端可用的 Atlas 連線憑證，不可指向 localhost。建議只保留一個 Mongo URI 變數；現有解析優先序為 `MONGO`、`MONGODB_URI`、`MONGO_URI`、`MONGO_URL`，舊的高優先序設定可能蓋過新值 |
| `MONGO_DB_NAME` | 本展示設為 `codeflow_demo`；由管理者確認資料庫使用者對它有適當讀寫權限 |
| `CLERK_SECRET_KEY` | 只放後端；須與前端公鑰屬同一 Clerk instance |
| `CLERK_PUBLISHABLE_KEY` | 後端 Clerk instance 公鑰 |
| `VITE_CLERK_PUBLISHABLE_KEY` | 前端建置時需要；更改後要重建前端 |
| `GEMINI_API_KEY` | 只放後端；檢查 Gemini 配額與模型權限，不要加 `VITE_` 前綴 |
| `CLIENT_URL` | 實際線上前端的完整 HTTPS origin |
| `ADMIN_EMAILS` | 由管理者確認的教師電子郵件清單，以逗號分隔；或使用既有 Clerk 教師／管理員 Organization 角色 |
| `NODE_ENV` | 既有 `vercel.json` 設為 `production`，後端 export app，由 Vercel 處理請求 |

不要把 `.env` 上傳 GitHub。`PORT=5000` 是本機啟動設定，不應讓瀏覽器去存取使用者電腦的 localhost；線上使用同源 `/api`，不依賴 Vite dev proxy。

Atlas 須允許 Vercel 對外連線來源，且 database user 有 `codeflow_demo` 讀寫權限；本機網路能連到 Atlas 不代表雲端網路也能連。Clerk 須允許實際展示網域，前後端金鑰與 instance 必須一致，並確認教師帳號的 Organization／伺服器角色。

## 線上驗收與需提供的日誌

已唯讀檢查程式內既有的 `https://codeflow-teal.vercel.app` 與 `https://codeflow-charliebear520s-projects.vercel.app`：兩者 `/api/status` 皆為 HTTP 200 JSON，但 `mongodb.connected=false`、`uriSource=null`，且尚無本次新增的 database 欄位。這不是線上驗收通過；需由管理者確認實際展示網址、可用的 Mongo URI 設定及重新部署。沒有可用 URI 可能是變數缺漏、空值，或正式環境排除了 localhost 設定，尚不能單憑此結果判定是哪一種。

由管理者部署包含本次修改的版本後：

1. 開啟實際 HTTPS 網址，測試前端首頁與 `/stage3` 深連結，確認 `/assets/*` 正常載入。
2. 檢查 `/api/status`：`mongodb.connected=true`、`mongodb.database=codeflow_demo`、URI 來源為預期變數；`/api/health` 應顯示已連線。健康檢查 HTTP 200 本身不足以代表 DB 連線成功。
3. 教師登入後呼叫 `/api/admin/submissions?questionId=Q001`，確認 HTTP 200 JSON 含 8 筆示範資料；匿名應 `401`、一般學生應 `403`。
4. 以真實學生完成上述「儲存 → 重整 → 檢查 → 教師更新」流程，核對 Network 中的狀態碼、submissionId、分數與畫面。
5. 若失敗，提供：線上 URL、deployment ID／對應提交、失敗請求路徑／HTTP 狀態碼、台灣時間、Build Logs，以及同時段 `backend/index.js` Function Logs。不要分享 Cookie、Authorization、Token、金鑰、完整 URI 或學生個資。
6. `503` 先看 DB 診斷與 Atlas 網路／使用者權限；`401` 看 Clerk instance 與登入狀態；`403` 看教師角色；`404` 或非 JSON 看 `/api` 路由與是否部署到舊版；`504` 看 Function Logs、Gemini 耗時與函數時間上限。

參考官方文件：[Vercel 專案設定](https://vercel.com/docs/project-configuration)、[環境變數](https://vercel.com/docs/environment-variables)、[Atlas 網路存取](https://www.mongodb.com/docs/atlas/security/ip-access-list/)、[資料庫使用者](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)、[Clerk 上線設定](https://clerk.com/docs/guides/development/deployment/production)。
