import mongoose from "mongoose";

// MongoDB 連線管理。
// 注意：本模組在 index.js 執行 dotenv.config() 之前就會被載入，
// 所以所有 process.env 都必須在函式內讀取，不能在模組頂層讀取。

// 資料表連接 - 僅從環境變數讀取，嚴禁在程式碼中硬編碼連線帳密
// 依序讀取，第一個有值的變數會被採用（MONGO 優先，與 acf0cac 之前的行為一致）。
// 正式環境會跳過指向 localhost 的值：Vercel 上設有 MONGO_URI=mongodb://127.0.0.1...，
// 若直接採用會造成 ECONNREFUSED
export const MONGO_URI_ENV_KEYS = ["MONGO", "MONGODB_URI", "MONGO_URI", "MONGO_URL"];

const LOCAL_FALLBACK_URI = "mongodb://127.0.0.1:27017/codeflow";

export const DB_UNAVAILABLE_MESSAGE = "資料庫暫時無法連線，請稍後再試";

const isProduction = () => process.env.NODE_ENV === "production";

export const isLocalMongoUri = (uri) =>
  /:\/\/([^/@]*@)?(localhost|127\.0\.0\.1)\b/.test(uri);

export const resolveMongoUri = () => {
  for (const key of MONGO_URI_ENV_KEYS) {
    const uri = process.env[key];
    if (!uri || typeof uri !== "string" || !uri.trim()) continue;
    if (isProduction() && isLocalMongoUri(uri.trim())) continue;
    return { uri: uri.trim(), source: key };
  }

  // 僅在非生產環境（本地開發）下允許 fallback 到本地 MongoDB
  if (!isProduction()) {
    return { uri: LOCAL_FALLBACK_URI, source: "local-fallback" };
  }

  return { uri: "", source: null };
};

export const getMongoUri = () => resolveMongoUri().uri;

// 正式環境中因指向 localhost 而被略過的變數
const getSkippedLocalKeys = () =>
  isProduction()
    ? MONGO_URI_ENV_KEYS.filter(
        (key) => process.env[key] && isLocalMongoUri(process.env[key]),
      )
    : [];

// 只取出主機名稱供 log 使用，不輸出帳密
export const getMongoHost = (uri) =>
  uri
    ? uri
        .replace(/^mongodb(\+srv)?:\/\//, "")
        .split("/")[0]
        .split("@")
        .pop()
    : null;

// 本機位址照實顯示（用來判斷是否誤設成 localhost），其餘只保留網域尾段
const maskMongoHost = (host) => {
  if (!host) return null;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return host;
  return host
    .split(",")
    .map((h) => "*." + h.split(".").slice(-2).join("."))
    .join(",");
};

const maskMongoText = (text = "") =>
  text.replace(/[\w-]+(\.[\w-]+)*\.mongodb\.net/g, "*.mongodb.net");

// 連線未就緒時，查詢最多只排隊 3 秒（預設 10 秒），避免超過 Vercel 的 10 秒上限。
// 不使用 bufferCommands=false，以免冷啟動連線中的查詢直接失敗。
mongoose.set("bufferTimeoutMS", 3000);

export const isDbReady = () => mongoose.connection.readyState === 1;

// 需要資料庫的路由使用：未連線時立即回 503，不讓查詢卡住
export function requireDb(req, res, next) {
  if (isDbReady()) return next();
  return res.status(503).json({ success: false, error: DB_UNAVAILABLE_MESSAGE });
}

// 判斷錯誤是否為資料庫連線失敗 / 查詢排隊逾時
export const isDbError = (err) =>
  /Mongo(ose)?ServerSelectionError|MongoNetworkError/.test(err?.name || "") ||
  /buffering timed out/.test(err?.message || "");

// 最近一次連線失敗的訊息，供 /api/status 診斷
let lastDbError = null;
let dbConnectionPromise = null;
let lastDbFailTime = 0;

export async function connectToDatabase() {
  if (isDbReady()) {
    return mongoose.connection;
  }
  const uri = getMongoUri();
  if (!uri) {
    return null;
  }
  // 若近期連線失敗，冷卻 30 秒以內不重複嘗試連線，避免請求阻塞
  if (Date.now() - lastDbFailTime < 30000) {
    return null;
  }
  if (!dbConnectionPromise) {
    console.log("Connecting to MongoDB...");
    dbConnectionPromise = mongoose
      .connect(uri, {
        ...(process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {}),
        serverSelectionTimeoutMS: 2000,
        socketTimeoutMS: 10000,
        connectTimeoutMS: 2000,
        maxPoolSize: 5,
        retryWrites: true,
      })
      .then((conn) => {
        console.log("MongoDB connected successfully");
        lastDbError = null;
        return conn;
      })
      .catch((err) => {
        lastDbFailTime = Date.now();
        lastDbError = {
          name: err.name,
          message: maskMongoText(err.message),
          at: new Date().toISOString(),
        };
        dbConnectionPromise = null;
        console.error("MongoDB connection error:", err.message);
        return null;
      });
  }
  return dbConnectionPromise;
}

// 針對 Serverless Function：在處理 API 前確保連線就緒
export async function ensureDbConnection(req, res, next) {
  try {
    if (getMongoUri() && !isDbReady()) {
      await connectToDatabase();
    }
  } catch (err) {
    console.error("Database connection wait error:", err.message);
  }
  next();
}

// 診斷用：沒有 Vercel log 權限時也能從瀏覽器判斷連線問題（不含帳密，主機已遮罩）
export const getDbStatus = () => ({
  connected: isDbReady(),
  database: mongoose.connection.name || process.env.MONGO_DB_NAME || null,
  uriSource: resolveMongoUri().source,
  skippedLocal: getSkippedLocalKeys(),
  host: maskMongoHost(getMongoHost(getMongoUri())),
  lastError: lastDbError,
});

// 啟動時印出實際採用的變數名稱與主機（不含帳密），方便在 Vercel log 排查
export function logMongoConfig() {
  const { uri, source } = resolveMongoUri();
  const host = getMongoHost(uri);
  console.log(`MongoDB URI source: ${source || "none"} (host: ${host || "-"})`);
  const skippedLocal = getSkippedLocalKeys();
  if (skippedLocal.length) {
    console.warn(
      `已略過指向本機的 MongoDB 變數：${skippedLocal.join(", ")}（Vercel 上無法連線）`,
    );
  }
  if (isProduction() && !source) {
    console.error(
      `找不到可用的 MongoDB 連線字串，請在 Vercel 設定 ${MONGO_URI_ENV_KEYS.join(" / ")} 其中之一為 Atlas 連線字串`,
    );
  }
}
