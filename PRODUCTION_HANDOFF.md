# 自有正式展示版交付

使用者於 2026-10-30 更新授權：允許提交及正常推送有權限的 GitHub 儲存庫，並部署自己 `huixuanxus-projects/codeflow-demo` 至 Production。取代歷史文件中的不推送、不部署限制。不得更動別人的 Vercel 專案或開通付費服務。

## 版本與部署

GitHub 登入帳號 huixuanxu 對原 origin Charliebear520/codeflow 具有 push 權限，保留原 remote，正常推送；如 main 受保護則改工作分支／PR。最後以 git ls-remote 比對提交。

正式部署必須從已提交且同步的 HEAD 擷取來源，在隔離資料夾中部署；雜湊清單和 git SHA 存於未提交的 `.deployment-preview`，部署 metadata 記錄 codeflowCommitSha。不複製 .env、Git、資料庫、備份、憑證、測試截圖或未追蹤學生圖片。前後端皆由根 vercel.json 建置。

Production 需獨立設定 MONGO_URI、MONGO_DB_NAME=codeflow_demo、CLERK_SECRET_KEY、CLERK_PUBLISHABLE_KEY、VITE_CLERK_PUBLISHABLE_KEY、GEMINI_API_KEY、ADMIN_EMAILS 及實際正式 origin 的 CLIENT_URL；不能繼承 Preview 假設。可用 configure-vercel-preview.mjs 的 --production --origin 與 --apply 安全寫入此專案；變數值經 stdin 傳送，不記錄於 Git 或聊天。

目前可用 Clerk 為 development instance，沒有確認管理權限；它在 Vercel Production 不會自動變成 Clerk production instance。若登入、註冊、新網址或 OAuth 被 instance 設定阻擋，需擁有該 Clerk instance 權限的人處理；不得移除驗證或分享現有帳號密碼。

正式網址從實際部署 aliases 取得，不預先假設。僅調整本展示專案的 Vercel 訪問保護，保留 CodeFlow 的 Clerk 與教師／學生資料權限。匿名 HTTP 與隔離無登入瀏覽器分別檢查，不能把登入保護頁 HTTP 200 計為網站通過。

## 資料與權限

雲端 Atlas Free 叢集中的獨立 codeflow_demo 已有 8 位固定示範學生及 8 筆作答，重跑初始化仍為 8/8。未搬移本機真實學生、教師角色資料。示範學生是合成資料，沒有可供登入的示範密碼。

訪客可開啟網站，必須透過 CodeFlow 的 Clerk 登入／註冊才可使用學生功能；註冊是否開放仍取決於 Clerk instance。教師使用自己帳號，需既有 Organization 的 teacher/admin 身分，或由管理者核實後列入 ADMIN_EMAILS（/api/me 同步）。學生不能自行選擇教師權限。

Atlas 0.0.0.0/0 規則由使用者於 2026-10-30 設為 1 週到期且 Active，原電腦 IP 保留。預期到期日為台灣時間 2026-11-06，精確時刻以 Atlas IP Access List 為準。到期後 Vercel 可能無法連線；展示結束可提早移除，不自動續期或購買固定出口。

## 驗證口徑

已通過的既有 Preview 檢查：前端／後端雲端建置、MongoDB connected=true / codeflow_demo / lastError=null、未登入教師 API 回 401、Dashboard HTML 與引用靜態資源 HTTP 200。本機既有 37 項單元/API、18 項隔離 Mongo 測試及 build 通過，詳細見 DASHBOARD_REVIEW.md。

Production 必須重新驗證首頁、dashboard、靜態資源、API、MongoDB，以及匿名不可取得教師／學生資料。Clerk 登入、教師 8 筆資料、AI 總結與流程圖需真實帳號於新正式網址驗證；沒有操作證據前不得標示通過。

**已知限制：學生儲存後教師不同步，完整學生保存→重整→教師更新流程未通過本輪驗證。** 圖片上傳停用；Python 執行取決於雲端 runtime 是否具備 Python，儲存與展示成功不等於程式執行或 AI 評分成功。示範總結為已標記的規則分析，不能聲稱 Gemini 線上呼叫已通過。
