import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import path from "path";
// import ImageKit from "imagekit"; // 暫時註解掉以避免導入問題
// 移除靜態導入，改為動態導入以避免初始化問題
// import {
//   checkFlowchart,
//   generateFlowchartQuestion,
//   generateFlowchartHint,
//   generatePseudoCode,
//   checkPseudoCode,
//   checkCode,
// } from "./services/geminiService.js";
import {
  clerkMiddleware,
  requireAuth,
  getAuth,
  clerkClient,
} from "@clerk/express"; // 暫時禁用以避免導入問題
import { exec, spawn } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
import mongoose from "mongoose";
import Question from "./models/Question.js"; // ← 後端才可以 import
import Student from "./models/Student.js";
import Submission from "./models/Submission.js";
import IdealAnswer from "./models/IdealAnswer.js";
import {
  generateIdealFlowSpec,
  parseStudentFlowSpecFromImage,
  mapEditorGraphToFlowSpec,
  normalizeFlowSpec,
  compareFlowSpecs,
  generateFeedbackText,
  generateCheckReport,
} from "./services/flowSpecService.js";
import {
  generateIdealPseudocode,
  comparePseudocode,
  generatePseudocodeFeedback,
  generatePseudocodeCheckReport,
} from "./services/pseudocodeService.js";
import {
  generateIdealCode,
  compareCode,
  generateCodeFeedback,
  generateCodeCheckReport,
} from "./services/codeService.js";
import { generateOverallSummary } from "./services/summaryService.js";
import fsSync from "fs";
import {
  DB_UNAVAILABLE_MESSAGE,
  connectToDatabase,
  ensureDbConnection,
  getDbStatus,
  getMongoHost,
  getMongoUri,
  isDbError,
  isDbReady,
  logMongoConfig,
  requireDb,
  resolveMongoUri,
} from "./lib/db.js";
import { patchAsyncRoutes } from "./lib/asyncRoutes.js";
import { requireTeacher } from "./lib/teacherAccess.js";
import { registerSubmissionRoutes } from "./lib/submissionRoutes.js";
import { submissionStore } from "./lib/submissionStore.js";
import { registerActivityRoutes } from "./lib/activityRoutes.js";
import { generateContent } from "./services/geminiService.js";

// 動態導入Gemini服務的輔助函數
const loadGeminiServices = async () => {
  const geminiService = await import("./services/geminiService.js");
  return {
    checkFlowchart: geminiService.checkFlowchart,
    generateFlowchartQuestion: geminiService.generateFlowchartQuestion,
    generateFlowchartHint: geminiService.generateFlowchartHint,
    generatePseudoCode: geminiService.generatePseudoCode,
    checkPseudoCode: geminiService.checkPseudoCode,
    checkCode: geminiService.checkCode,
  };
};

// 導入錯誤解釋函數
let explainError;
const loadErrorExplainer = async () => {
  const errorExplainerModule = await import("./services/errorExplainer.js");
  explainError = errorExplainerModule.explainError;
};

// 加載環境變量（僅在非生產環境）
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const port = process.env.PORT || 3000;
const app = express();

patchAsyncRoutes(app);

// 檢查 Clerk 和 Gemini 初始化狀態
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    clerk: {
      available: !!clerkClient,
      type: typeof clerkClient,
      clerkSecretKey: !!process.env.CLERK_SECRET_KEY,
      clerkPublishableKey: !!process.env.CLERK_PUBLISHABLE_KEY,
    },
    gemini: {
      apiKey: !!process.env.GEMINI_API_KEY,
    },
    mongodb: getDbStatus(),
  });
});

// 檢查端點
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// 更詳細的檢查端點
app.get("/api/health", (req, res) => {
  const state = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    ok: state === 1,
    stateCode: state,
    stateText: states[state] || "unknown",
    host: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// 存儲活躍的程序
const activeProcesses = new Map();

// Python代碼轉JavaScript的互動式轉換函數
function convertPythonToJS(pythonCode) {
  let jsCode = pythonCode;

  // 基本的Python到JavaScript轉換
  jsCode = jsCode.replace(/print\s*\(\s*([^)]+)\s*\)/g, "console.log($1)");
  jsCode = jsCode.replace(/input\s*\(\s*([^)]*)\s*\)/g, "await prompt($1)");
  jsCode = jsCode.replace(/if\s+/g, "if (");
  jsCode = jsCode.replace(/:\s*$/gm, " {");
  jsCode = jsCode.replace(/elif\s+/g, "} else if (");
  jsCode = jsCode.replace(/else\s*:\s*$/gm, "} else {");

  // 將整個代碼包裝在async函數中
  jsCode = `
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(msg) {
  return new Promise((resolve) => {
    rl.question(msg || '', (answer) => {
      resolve(answer);
    });
  });
}

(async () => {
${jsCode}
  rl.close();
})();
`;

  return jsCode;
}

// Python命令檢測函數
async function getPythonCommand() {
  const commands =
    process.platform === "win32"
      ? ["python", "python3", "py"]
      : ["python3", "python"];

  for (const cmd of commands) {
    try {
      await execAsync(`${cmd} --version`);
      return cmd;
    } catch (error) {
      // 繼續嘗試下一個命令
    }
  }
  throw new Error("找不到可用的Python命令");
}

// CORS 設定：允許本地前端與環境變數指定的 URL，並處理預檢請求
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://codeflow-teal.vercel.app",
  "https://codeflow-charliebear520s-projects.vercel.app",
].filter(Boolean);
const isProd = process.env.NODE_ENV === "production";
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // 同源 / Postman
    if (!isProd) return callback(null, true); // 開發：全放行
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL))
    ) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Idempotency-Key",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
// 只在開發環境放寬 CSP，避免 Chrome DevTools / localhost 相關請求被擋
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 http://localhost:5173 http://127.0.0.1:5173 https://clients2.google.com;",
    );
    next();
  });
}
app.use(express.json({ limit: "50mb" })); // 讓 JSON 進來變成 req.body
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 啟用 Clerk 中間件以支援 getAuth()（防禦性封裝，避免金鑰缺失時整站崩潰）
let clerkMw = null;
try {
  const clerkPubKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    "pk_test_b3V0Z29pbmctcGVuZ3Vpbi00MC5jbGVyay5hY2NvdW50cy5kZXYk";
  const clerkSecKey = process.env.CLERK_SECRET_KEY;

  if (clerkPubKey || clerkSecKey) {
    clerkMw = clerkMiddleware({
      publishableKey: clerkPubKey,
      secretKey: clerkSecKey,
    });
  }
} catch (e) {
  console.error("Error initializing clerkMiddleware:", e);
}

app.use((req, res, next) => {
  if (clerkMw) {
    clerkMw(req, res, (err) => {
      if (err) {
        console.error("clerkMiddleware error:", err.message);
        req.auth = () => ({ userId: null });
      }
      next();
    });
  } else {
    req.auth = req.auth || (() => ({ userId: null }));
    next();
  }
});

// 啟動時印出實際採用的 MongoDB 設定，並在已配置 URI 時嘗試發起連線
logMongoConfig();
if (getMongoUri()) {
  connectToDatabase().catch((e) =>
    console.warn("Initial DB connection warning:", e.message),
  );
}

app.use(ensureDbConnection);

// 安全查詢資料庫輔助函式（離線/未連線防護）
async function getQuestionByIdOrTitle(questionId) {
  if (!questionId || mongoose.connection.readyState !== 1) return null;
  try {
    if (mongoose.isValidObjectId(questionId)) {
      return await Question.findById(questionId).lean();
    } else {
      return await Question.findOne({ $or: [{ questionId }, { questionTitle: questionId }] }).lean();
    }
  } catch (err) {
    console.warn("getQuestionByIdOrTitle error:", err.message);
    return null;
  }
}

// 預設示範題的標準理想結構快取，保證毫秒級比對與防止冷啟動/DB未連線時的 504 逾時
const DEFAULT_IDEAL_ANSWERS = {
  Q001: {
    questionId: "Q001",
    flowSpec: {
      nodes: [
        { id: "n1", type: "start", label: "開始", required: true },
        { id: "n2", type: "decision", label: "是否下雨", required: true },
        { id: "n3", type: "process", label: "帶傘", required: true },
        { id: "n4", type: "process", label: "不帶傘", required: true },
        { id: "n5", type: "end", label: "結束", required: true },
      ],
      edges: [
        { from: "n1", to: "n2", required: true },
        { from: "n2", to: "n3", label: "yes", required: true },
        { from: "n2", to: "n4", label: "no", required: true },
        { from: "n3", to: "n5", required: true },
        { from: "n4", to: "n5", required: true },
      ],
      rubrics: {},
      scoringWeights: {
        structure: 0.25,
        nodes: 0.25,
        edges: 0.25,
        logic: 0.25,
      },
    },
    pseudocode: `BEGIN
  INPUT weather
  IF weather == "下雨" THEN
    OUTPUT "帶傘"
  ELSE
    OUTPUT "不帶傘"
  ENDIF
END`,
    pseudocodeStructure: {
      variables: ["weather"],
      conditions: ["weather == '下雨'"],
      loops: [],
      logicFlow: ["輸入天氣", "判斷是否下雨", "輸出帶傘或不帶傘"],
    },
    language: "python",
    code: `weather = input("今天會下雨嗎？: ")
if weather == "下雨":
    print("帶傘")
else:
    print("不用帶傘")`,
    codeStructure: {
      functions: [],
      variables: ["weather"],
      controlFlow: ["if-else"],
      expectedOutput: "帶傘",
    },
  },
};

const idealAnswerMemoryCache = new Map();

async function getIdealAnswerByQuestionId(questionId) {
  if (!questionId) return null;
  const qId = String(questionId);

  // 1. 先查記憶體快取
  if (idealAnswerMemoryCache.has(qId)) {
    return idealAnswerMemoryCache.get(qId);
  }

  // 2. 查資料庫
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await IdealAnswer.findOne({ questionId: qId }).lean();
      if (doc) {
        idealAnswerMemoryCache.set(qId, doc);
        return doc;
      }
    } catch (err) {
      console.warn("getIdealAnswerByQuestionId error:", err.message);
    }
  }

  // 3. 使用內建預設理想答案
  if (DEFAULT_IDEAL_ANSWERS[qId]) {
    return DEFAULT_IDEAL_ANSWERS[qId];
  }

  return null;
}

async function saveIdealAnswer(questionId, updateData) {
  if (!questionId) return null;
  const qId = String(questionId);

  // 同步更新記憶體快取
  const existing =
    idealAnswerMemoryCache.get(qId) || DEFAULT_IDEAL_ANSWERS[qId] || {};
  const merged = {
    ...existing,
    ...updateData,
    questionId: qId,
    generatedAt: new Date(),
  };
  idealAnswerMemoryCache.set(qId, merged);

  if (mongoose.connection.readyState !== 1) return merged;
  try {
    return await IdealAnswer.findOneAndUpdate(
      { questionId: qId },
      {
        $set: {
          ...updateData,
          generatedAt: new Date(),
        },
        $setOnInsert: {
          questionId: qId,
          flowSpec: {},
          version: "v1",
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.warn("saveIdealAnswer error:", err.message);
    return merged;
  }
}

// const imagekit = new ImageKit({ // 暫時註解掉
//   urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
//   publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
//   privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
// });

// 小工具：確保 Student 存在並同步 name/email
const ADMIN_EMAILS_SET = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// 快取 5 分鐘：Serverless 各 instance 不共享記憶體，過期後重新讀取，
// 避免名稱 / 角色變更後某些 instance 一直回傳舊資料
const STUDENT_CACHE_TTL_MS = 5 * 60 * 1000;
const studentMemoryCache = new Map();

async function ensureStudent(userId) {
  if (!userId) return null;
  const cached = studentMemoryCache.get(userId);
  if (cached && Date.now() - cached.at < STUDENT_CACHE_TTL_MS) {
    return cached.doc;
  }
  try {
    let fullName = "";
    let email = null;

    if (clerkClient) {
      try {
        const u = await clerkClient.users.getUser(userId);
        fullName =
          u.fullName ||
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.username ||
          u.primaryEmailAddress?.emailAddress ||
          "";
        const emailRaw =
          u.primaryEmailAddress?.emailAddress ||
          u.emailAddresses?.[0]?.emailAddress ||
          null;
        email = emailRaw ? emailRaw.toLowerCase() : null;
      } catch (clerkErr) {
        console.warn("Clerk getUser error in ensureStudent:", clerkErr.message);
      }
    }

    const isAdminEmail = !!email && ADMIN_EMAILS_SET.has(email);
    const role = isAdminEmail ? "teacher" : "student";

    if (mongoose.connection.readyState === 1) {
      const setOnInsert = { userId };
      const set = {};
      if (fullName) set.name = fullName;
      if (email) set.email = email;
      // 只在 ADMIN_EMAILS 內才升級為 teacher；其餘僅在新建時設為 student，
      // 避免覆蓋資料庫中手動設定的 teacher 角色
      if (isAdminEmail) set.role = "teacher";
      else setOnInsert.role = "student";

      const doc = await Student.findOneAndUpdate(
        { userId },
        { $setOnInsert: setOnInsert, $set: set },
        { new: true, upsert: true },
      );
      if (doc) {
        studentMemoryCache.set(userId, { doc, at: Date.now() });
        return doc;
      }
    }

    // 資料庫未連線時提供 fallback 物件，避免全站崩潰。
    // 不寫入快取，資料庫恢復後下一次請求即可取得真實資料
    return {
      userId,
      name: fullName || "Student",
      email,
      role,
      _id: userId,
    };
  } catch (err) {
    console.error("ensureStudent error:", err.message);
    return {
      userId,
      name: "Student",
      email: null,
      role: "student",
      _id: userId,
    };
  }
}

// 小工具：Promise 版 exec + existsSync
function execp(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
      if (err) reject({ err, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
}

// 檢查.env是否存在CC環境變數（包 try/catch）
function exists(p) {
  try {
    return fsSync.existsSync(p);
  } catch {
    return false;
  }
}

async function pickCCompiler() {
  // 1) 優先吃 .env
  if (process.env.CC && exists(process.env.CC)) return process.env.CC;
  // 2) PATH 上
  try {
    await execp("gcc --version");
    return "gcc";
  } catch {}
  try {
    await execp("clang --version");
    return "clang";
  } catch {}
  // 3) 常見安裝路徑（可命中就用）
  const candidates = [
    "C:\\msys64\\ucrt64\\bin\\gcc.exe",
    "C:\\msys64\\mingw64\\bin\\gcc.exe",
    "C:\\ProgramData\\chocolatey\\lib\\mingw\\tools\\install\\mingw64\\bin\\gcc.exe",
    "C:\\Program Files\\LLVM\\bin\\clang.exe",
    "/usr/bin/clang",
  ];
  for (const c of candidates) if (exists(c)) return c;

  // 4) macOS：用 xcrun 找 clang
  try {
    const { stdout } = await execp("xcrun --find clang");
    const p = stdout.trim();
    if (p && exists(p)) return p;
  } catch {}

  return null;
}

// 取得當前登入使用者基本資料（若無則自動建立）
app.get("/api/me", async (req, res) => {
  try {
    const auth =
      typeof req.auth === "function" ? req.auth() : getAuth ? getAuth(req) : {};
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: "未登入" });
    }

    const doc = await ensureStudent(userId);
    res.json({ success: true, me: doc });
  } catch (err) {
    console.error("/api/me error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 教師角色 - Express 中間件包裝器處理 async

// 測試 / 除錯端點在正式環境僅限教師使用（/api/test-*、/api/debug-*、/test）
registerSubmissionRoutes(app, { ensureStudent, requireTeacher, requireDb });
registerActivityRoutes(app, { ensureStudent, requireDb,
  chatReply: (body) => generateContent(`You are a supportive programming tutor. Reply in Traditional Chinese, guide the learner without giving a complete answer. Stage: ${body.stage || 1}. Question: ${body.question || ""}. Student message: ${body.prompt}`),
  hintReply: (body) => generateContent(`Give a concise Traditional Chinese programming hint, not a full answer. Hint level: ${body.hintLevel || 1}. Question: ${body.question}`),
});

const DEBUG_ROUTE_RE = /^\/(api\/(test-|debug-)|test$)/;
app.use((req, res, next) => {
  if (DEBUG_ROUTE_RE.test(req.path)) {
    return requireTeacher(req, res, next);
  }
  next();
});

app.get("/api/upload", (req, res) => {
  // ImageKit 目前停用（見檔案開頭的 import），避免 imagekit 未定義而拋出 ReferenceError
  if (typeof imagekit === "undefined") {
    return res
      .status(501)
      .json({ success: false, error: "圖片上傳功能目前未啟用" });
  }
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// 新增：生成流程圖題目的API端點
app.get("/api/generate-question", async (req, res) => {
  try {
    console.log("Generating flowchart question...");
    const geminiServices = await loadGeminiServices();
    const question = await geminiServices.generateFlowchartQuestion();
    res.json({ success: true, question });
  } catch (error) {
    console.error("Error generating question:", error);
    const fallbackQuestions = [
      "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。",
      "請根據下方敘述繪製流程圖。你在便利商店結帳，如果購買金額超過100元且持有會員卡，可享有九折優惠，否則原價結帳。",
      "請根據下方敘述繪製流程圖。學生參加期末考試，如果成績大於等於60分則及格，否則需要參加補考。",
      "請根據下方敘述繪製流程圖。出門前根據氣溫決定穿著，如果氣溫低於18度穿厚外套，18到25度穿薄外套，高於25度穿短袖。",
    ];
    const question =
      fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    res.json({ success: true, question, fallback: true });
  }
});

// 新增：生成流程圖提示的API端點 + 記錄求助次數
app.post("/api/check-flowchart", async (req, res) => {
  try {
    const { imageData, question } = req.body;
    // 如果沒有提供題目，使用默認題目
    const defaultQuestion =
      "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。";
    const geminiServices = await loadGeminiServices();
    const result = await geminiServices.checkFlowchart(
      imageData,
      question || defaultQuestion,
    );
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 產生/更新理想答案（教師）
app.post("/api/ideal/flow/generate", requireTeacher, async (req, res) => {
  try {
    const { questionId, questionText } = req.body || {};
    if (!questionId && !questionText) {
      return res
        .status(400)
        .json({ success: false, error: "需提供 questionId 或 questionText" });
    }

    // 取得題目文字：優先 body.questionText，其次從 Question 資料表讀取
    let qText = (questionText || "").trim();
    if (!qText && questionId) {
      const qDoc = await getQuestionByIdOrTitle(questionId);
      qText = qDoc?.description || qDoc?.questionTitle || "";
    }
    if (!qText) {
      return res
        .status(400)
        .json({ success: false, error: "找不到題目內容，請提供 questionText" });
    }

    const flowSpec = await generateIdealFlowSpec(qText);
    const saved = await saveIdealAnswer(questionId || "UNKNOWN", {
      flowSpec,
      version: "v1",
      modelUsed: "Gemini 2.5 Flash",
    });

    res.json({ success: true, data: saved || { flowSpec, version: "v1" } });
  } catch (err) {
    console.error("ideal/flow/generate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 取得理想答案
app.get("/api/ideal/flow/:questionId", async (req, res) => {
  try {
    const doc = await getIdealAnswerByQuestionId(req.params.questionId);
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: "ideal answer not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stage1 比對：解析 -> 比對 -> 產生回饋
export async function compareStage1(req, res) {
  try {
    const studentDoc = req.submissionStudent;

    const {
      questionId,
      imageBase64,
      graph,
      question: bodyQuestion,
    } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });

    // 取得題目內容（給 Vision/回饋參考，沒抓到也不阻擋）
    let questionText = bodyQuestion || "";
    if (!questionText) {
      const q = await getQuestionByIdOrTitle(questionId);
      questionText =
        q?.description || q?.questionTitle || "請根據題意繪製流程圖";
    }

    // 1) 取得或生成理想答案
    let ideal = await getIdealAnswerByQuestionId(questionId);
    if (!ideal) {
      const generated = await generateIdealFlowSpec(
        questionText || "請根據題意繪製流程圖",
      );
      ideal = {
        questionId: String(questionId),
        flowSpec: generated,
        version: "v1",
        modelUsed: "Gemini 2.5 Flash",
        generatedAt: new Date(),
      };
      await saveIdealAnswer(questionId, ideal);
    }
    const idealSpec = normalizeFlowSpec(ideal.flowSpec);
    console.log("🎯 理想答案 idealSpec:", JSON.stringify(idealSpec, null, 2));

    // 2) 解析學生答案
    let studentSpec;
    if (graph && (graph.nodes?.length || 0) + (graph.edges?.length || 0) > 0) {
      console.log("📊 原始 graph 資料:", JSON.stringify(graph, null, 2));
      studentSpec = mapEditorGraphToFlowSpec(graph);
      console.log(
        "✅ 正規化後的 studentSpec:",
        JSON.stringify(studentSpec, null, 2),
      );
    } else if (imageBase64) {
      const base64 = imageBase64.startsWith("data:")
        ? imageBase64.split(",")[1]
        : imageBase64;
      studentSpec = await parseStudentFlowSpecFromImage(
        base64,
        questionText || "",
      );
    } else {
      return res
        .status(400)
        .json({ success: false, error: "需提供 graph 或 imageBase64" });
    }

    // 3) 比對
    const { diffs, scores } = compareFlowSpecs(idealSpec, studentSpec);
    console.log("📈 比對結果 scores:", scores);
    console.log("📋 比對結果 diffs:", JSON.stringify(diffs, null, 2));

    // 4) 平行產生回饋與檢查報告
    const [feedback, checkReport] = await Promise.all([
      generateFeedbackText(
        questionText || "",
        idealSpec,
        studentSpec,
        diffs,
        scores,
      ),
      generateCheckReport(diffs),
    ]);

    // 4.6) 計算百分制分數和完成狀態
    const percentScore = scores.overall || 0;
    const isCompleted = percentScore >= 70;

    // 5) 寫回 Submission（保留你現有 stage1 結構，擴充比對結果）
    const { doc: savedSubmission } = await (req.submissionStore || submissionStore).save({
      student: studentDoc, stage: 1, body: req.body,
      operationId: req.get("Idempotency-Key"), startedAt: req.submissionStartedAt,
      evaluation: { score: percentScore, scores, diffs, feedback, checkReport, completed: isCompleted, flowSpec: studentSpec },
    });
    const submissionId = savedSubmission._id;

    const savedStage = savedSubmission.stages["stage1"];
    res.json({
      success: true,
      scores: savedStage.scores,
      diffs: savedStage.diffs,
      feedback: savedStage.feedback,
      checkReport: savedStage.checkReport,
      submissionId,
    });
  } catch (err) {
    res.status(err.status || (isDbError(err) ? 503 : 500)).json({ success: false, error: isDbError(err) ? DB_UNAVAILABLE_MESSAGE : err.message });
  }
}
app.post("/api/submissions/stage1/compare", compareStage1);

// Stage 2: 虛擬碼檢查端點
export async function compareStage2(req, res) {
  try {
    const studentDoc = req.submissionStudent;

    const { questionId, pseudocode, question: bodyQuestion } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!pseudocode)
      return res.status(400).json({ success: false, error: "pseudocode 必填" });

    // 取得題目內容
    let questionText = bodyQuestion || "";
    if (!questionText) {
      const q = await getQuestionByIdOrTitle(questionId);
      questionText =
        q?.description || q?.questionTitle || "請根據題意撰寫虛擬碼";
    }

    // 1) 取得或生成理想虛擬碼
    let ideal = await getIdealAnswerByQuestionId(questionId);

    // 檢查是否需要重新生成：沒有理想答案、沒有虛擬碼、或虛擬碼包含錯誤訊息或 fallback 值
    const needsRegenerationStage2 =
      !ideal ||
      !ideal.pseudocode ||
      ideal.pseudocode.includes("錯誤") ||
      ideal.pseudocode.includes("未提供") ||
      ideal.pseudocode.includes("error") ||
      ideal.pseudocode.includes("Error") ||
      ideal.pseudocode.includes("根據題目生成的虛擬碼") || // fallback 值檢測
      ideal.pseudocode.includes("請根據題意撰寫虛擬碼"); // fallback 值檢測

    if (needsRegenerationStage2) {
      console.log("生成新的理想虛擬碼...");

      // 確保有有效的題目文字
      if (!questionText || questionText === "請根據題意撰寫虛擬碼") {
        const q = await getQuestionByIdOrTitle(questionId);
        if (q) {
          questionText = q.description || q.questionTitle || questionText;
        }
      }

      const generated = await generateIdealPseudocode(
        questionText || "請根據題意撰寫虛擬碼",
      );

      // 檢查生成結果是否有效
      if (
        generated.pseudocode &&
        !generated.pseudocode.includes("錯誤") &&
        !generated.pseudocode.includes("未提供")
      ) {
        ideal = {
          questionId: String(questionId),
          pseudocode: generated.pseudocode,
          pseudocodeStructure: generated.structure,
          modelUsed: "gemini-2.5-flash",
        };
        await saveIdealAnswer(questionId, {
          pseudocode: generated.pseudocode,
          pseudocodeStructure: generated.structure,
          modelUsed: "gemini-2.5-flash",
        });
        console.log("✅ 理想虛擬碼生成並儲存成功");
      } else {
        console.error("❌ AI 生成的虛擬碼包含錯誤訊息，使用基本結構繼續比對");
        // 使用基本的 fallback 結構，不中斷流程
        if (!ideal) {
          ideal = {
            pseudocode: "BEGIN\n  // 根據題目生成的虛擬碼\nEND",
            pseudocodeStructure: {
              variables: [],
              conditions: [],
              loops: [],
              logicFlow: [],
            },
          };
        }
      }
    }

    // 2) 比對虛擬碼
    const pseudocodeStructure = ideal?.pseudocodeStructure || {
      variables: [],
      conditions: [],
      loops: [],
      logicFlow: [],
    };
    const { diffs, scores } = comparePseudocode(
      pseudocodeStructure,
      pseudocode,
      questionText,
    );
    console.log("📈 Stage2 比對結果 scores:", scores);
    console.log("📋 Stage2 比對結果 diffs:", JSON.stringify(diffs, null, 2));

    // 3) 平行產生回饋與檢查報告
    const [feedback, checkReport] = await Promise.all([
      generatePseudocodeFeedback(
        questionText || "",
        ideal || { pseudocode: "" },
        pseudocode,
        diffs,
        scores,
      ),
      generatePseudocodeCheckReport(diffs),
    ]);

    // 3.6) 計算完成狀態（scores.overall 已經是 0-100）
    const percentScore = scores.overall;
    const isCompleted = percentScore >= 70;

    // 4) 寫回 Submission
    const { doc: savedSubmission } = await (req.submissionStore || submissionStore).save({
      student: studentDoc, stage: 2, body: req.body,
      operationId: req.get("Idempotency-Key"), startedAt: req.submissionStartedAt,
      evaluation: { score: percentScore, scores, diffs, feedback, checkReport, completed: isCompleted },
    });
    const submissionId = savedSubmission._id;

    const savedStage = savedSubmission.stages["stage2"];
    res.json({
      success: true,
      scores: savedStage.scores,
      diffs: savedStage.diffs,
      feedback: savedStage.feedback,
      checkReport: savedStage.checkReport,
      submissionId,
    });
  } catch (err) {
    res.status(err.status || (isDbError(err) ? 503 : 500)).json({ success: false, error: isDbError(err) ? DB_UNAVAILABLE_MESSAGE : err.message });
  }
}
app.post("/api/submissions/stage2/compare", compareStage2);

// Stage 3: 程式碼檢查端點
export async function compareStage3(req, res) {
  try {
    const studentDoc = req.submissionStudent;

    const {
      questionId,
      code,
      language = "python",
      question: bodyQuestion,
    } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!code)
      return res.status(400).json({ success: false, error: "code 必填" });

    // 取得題目內容
    let questionText = bodyQuestion || "";
    if (!questionText) {
      const q = await getQuestionByIdOrTitle(questionId);
      questionText =
        q?.description || q?.questionTitle || "請根據題意撰寫程式碼";
    }

    // 1) 取得或生成理想程式碼
    let ideal = await getIdealAnswerByQuestionId(questionId);

    // 檢查是否需要重新生成：沒有理想答案、沒有程式碼、語言不符、或程式碼包含錯誤訊息或 fallback 值
    const needsRegenerationStage3 =
      !ideal ||
      !ideal.code ||
      ideal.language !== language ||
      ideal.code.includes("錯誤") ||
      ideal.code.includes("未提供") ||
      ideal.code.includes("error") ||
      ideal.code.includes("Error") ||
      ideal.code.includes("根據題目生成的程式碼") || // fallback 值檢測
      ideal.code.includes("請根據題意撰寫程式碼"); // fallback 值檢測

    if (needsRegenerationStage3) {
      console.log(`生成新的理想 ${language} 程式碼...`);

      // 確保有有效的題目文字
      if (!questionText || questionText === "請根據題意撰寫程式碼") {
        const q = await getQuestionByIdOrTitle(questionId);
        if (q) {
          questionText = q.description || q.questionTitle || questionText;
        }
      }

      const generated = await generateIdealCode(
        questionText || "請根據題意撰寫程式碼",
        language,
      );

      // 檢查生成結果是否有效
      if (
        generated.code &&
        !generated.code.includes("錯誤") &&
        !generated.code.includes("未提供")
      ) {
        ideal = {
          questionId: String(questionId),
          code: generated.code,
          language: language,
          codeStructure: generated.structure,
          modelUsed: "gemini-2.5-flash",
        };
        await saveIdealAnswer(questionId, {
          code: generated.code,
          language: language,
          codeStructure: generated.structure,
          modelUsed: "gemini-2.5-flash",
        });
        console.log(`✅ 理想 ${language} 程式碼生成並儲存成功`);
      } else {
        console.error("❌ AI 生成的程式碼包含錯誤訊息，使用基本結構繼續比對");
        // 使用基本的 fallback 結構，不中斷流程
        if (!ideal) {
          ideal = {
            code: "",
            language,
            codeStructure: {
              functions: [],
              variables: [],
              controlFlow: [],
              expectedOutput: "",
            },
          };
        }
      }
    }

    // 2) 比對程式碼
    const codeStructure = ideal?.codeStructure || {
      functions: [],
      variables: [],
      controlFlow: [],
      expectedOutput: "",
    };
    const { diffs, scores } = compareCode(
      codeStructure,
      code,
      language,
      questionText,
    );
    console.log("📈 Stage3 比對結果 scores:", scores);
    console.log("📋 Stage3 比對結果 diffs:", JSON.stringify(diffs, null, 2));

    // 3) 平行產生回饋與檢查報告
    const [feedback, checkReport] = await Promise.all([
      generateCodeFeedback(
        questionText || "",
        ideal || { code: "" },
        code,
        diffs,
        scores,
        language,
      ),
      generateCodeCheckReport(diffs, language),
    ]);

    // 3.6) 計算完成狀態（scores.overall 已經是 0-100）
    const percentScore = scores.overall;
    const isCompleted = percentScore >= 70;

    // 4) 寫回 Submission
    const { doc: savedSubmission } = await (req.submissionStore || submissionStore).save({
      student: studentDoc, stage: 3, body: req.body,
      operationId: req.get("Idempotency-Key"), startedAt: req.submissionStartedAt,
      evaluation: { score: percentScore, scores, diffs, feedback, checkReport, completed: isCompleted },
    });
    const submissionId = savedSubmission._id;

    const savedStage = savedSubmission.stages["stage3"];
    res.json({
      success: true,
      scores: savedStage.scores,
      diffs: savedStage.diffs,
      feedback: savedStage.feedback,
      checkReport: savedStage.checkReport,
      submissionId,
    });
  } catch (err) {
    res.status(err.status || (isDbError(err) ? 503 : 500)).json({ success: false, error: isDbError(err) ? DB_UNAVAILABLE_MESSAGE : err.message });
  }
}
app.post("/api/submissions/stage3/compare", compareStage3);

// 新增：學生整體作答結果統整
app.post("/api/submissions/all-stages/summary", async (req, res) => {
  try {
    const auth =
      typeof req.auth === "function"
        ? req.auth()
        : typeof getAuth === "function"
          ? getAuth(req)
          : {};
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "請先登入" });
    }
    const studentDoc = await ensureStudent(userId);
    const { questionId, regenerate = false } = req.body || {};

    if (!questionId) {
      return res.status(400).json({ success: false, error: "questionId 必填" });
    }

    if (!studentDoc?._id || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        summary: "目前尚未開始作答任何階段，請先完成第一階段的流程圖設計。",
        stages: {
          stage1: { score: 0, report: "尚未作答", completed: false },
          stage2: { score: 0, report: "尚未作答", completed: false },
          stage3: { score: 0, report: "尚未作答", completed: false },
        },
        generatedAt: null,
        isFromCache: false,
        hasHistory: false,
      });
    }

    // 查詢學生的作答記錄（不使用 .lean() 以便後續更新）
    let submission = await Submission.findOne({
      student: studentDoc._id,
      questionId,
    });

    // 如果沒有任何作答記錄
    if (!submission) {
      return res.json({
        success: true,
        summary: "目前尚未開始作答任何階段，請先完成第一階段的流程圖設計。",
        stages: {
          stage1: { score: 0, report: "尚未作答", completed: false },
          stage2: { score: 0, report: "尚未作答", completed: false },
          stage3: { score: 0, report: "尚未作答", completed: false },
        },
        generatedAt: null,
        isFromCache: false,
        hasHistory: false,
      });
    }

    // 檢查快取：若有 currentSummary 且在 30 分鐘內且不強制重新生成
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 分鐘
    const hasCachedSummary = submission.currentSummary?.summary;
    const cacheAge = hasCachedSummary
      ? Date.now() - new Date(submission.currentSummary.generatedAt).getTime()
      : Infinity;
    const isCacheValid = hasCachedSummary && cacheAge < CACHE_DURATION_MS;

    if (isCacheValid && !regenerate) {
      console.log(
        `✅ 使用快取報告（${Math.round(cacheAge / 1000 / 60)} 分鐘前生成）`,
      );
      return res.json({
        success: true,
        summary: submission.currentSummary.summary,
        stages: {
          stage1: {
            score: submission.stages?.stage1?.score || 0,
            report:
              submission.stages?.stage1?.checkReport || "目前第1階段尚未作答",
            completed: submission.stages?.stage1?.completed || false,
          },
          stage2: {
            score: submission.stages?.stage2?.score || 0,
            report:
              submission.stages?.stage2?.checkReport || "目前第2階段尚未作答",
            completed: submission.stages?.stage2?.completed || false,
          },
          stage3: {
            score: submission.stages?.stage3?.score || 0,
            report:
              submission.stages?.stage3?.checkReport || "目前第3階段尚未作答",
            completed: submission.stages?.stage3?.completed || false,
          },
        },
        generatedAt: submission.currentSummary.generatedAt,
        isFromCache: true,
        hasHistory: (submission.summaryHistory?.length || 0) > 0,
      });
    }

    // 需要生成新報告
    console.log(
      "🔄 生成新報告（" + (regenerate ? "手動重新生成" : "快取過期") + "）",
    );

    // 準備三個階段的資料
    const stages = {
      stage1: {
        score: submission.stages?.stage1?.score || 0,
        report: submission.stages?.stage1?.checkReport || "目前第1階段尚未作答",
        completed: submission.stages?.stage1?.completed || false,
      },
      stage2: {
        score: submission.stages?.stage2?.score || 0,
        report: submission.stages?.stage2?.checkReport || "目前第2階段尚未作答",
        completed: submission.stages?.stage2?.completed || false,
      },
      stage3: {
        score: submission.stages?.stage3?.score || 0,
        report: submission.stages?.stage3?.checkReport || "目前第3階段尚未作答",
        completed: submission.stages?.stage3?.completed || false,
      },
    };

    // 計算統計資料
    const completedStages = [
      stages.stage1.completed,
      stages.stage2.completed,
      stages.stage3.completed,
    ].filter(Boolean).length;
    const totalScore = Math.round(
      (stages.stage1.score + stages.stage2.score + stages.stage3.score) / 3,
    );

    // 生成整體總結
    const summary = await generateOverallSummary(stages);
    const generatedAt = new Date();

    // 儲存報告：將舊報告推入歷史，更新當前報告
    const updateOps = {
      $set: {
        currentSummary: {
          summary,
          generatedAt,
          totalScore,
          completedStages,
        },
      },
    };

    // 若有舊報告，推入歷史（限制最多 10 筆）
    if (hasCachedSummary) {
      updateOps.$push = {
        summaryHistory: {
          $each: [submission.currentSummary],
          $position: 0, // 插入到陣列開頭（最新的在前）
          $slice: 10, // 只保留前 10 筆
        },
      };
    }

    try {
      submission = await Submission.findByIdAndUpdate(
        submission._id,
        updateOps,
        { new: true },
      );
      console.log("✅ 報告已儲存到資料庫");
    } catch (saveErr) {
      console.error("⚠️ 儲存報告失敗，但仍回傳生成的報告:", saveErr);
      // 即使儲存失敗，仍回傳生成的報告給使用者
    }

    res.json({
      success: true,
      summary,
      stages,
      generatedAt,
      isFromCache: false,
      hasHistory: (submission.summaryHistory?.length || 0) > 0,
    });
  } catch (err) {
    console.error("all-stages/summary error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增：查詢報告歷史版本
app.get("/api/submissions/all-stages/summary/history", async (req, res) => {
  try {
    const auth =
      typeof req.auth === "function"
        ? req.auth()
        : typeof getAuth === "function"
          ? getAuth(req)
          : {};
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "請先登入" });
    }
    const studentDoc = await ensureStudent(userId);
    const { questionId } = req.query;

    if (!questionId) {
      return res.status(400).json({ success: false, error: "questionId 必填" });
    }

    if (!studentDoc?._id || mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        history: [],
        total: 0,
      });
    }

    const submission = await Submission.findOne({
      student: studentDoc._id,
      questionId,
    }).lean();

    if (!submission || !submission.summaryHistory) {
      return res.json({
        success: true,
        history: [],
        total: 0,
      });
    }

    // 歷史紀錄已經按 generatedAt 降序排列（最新的在前）
    res.json({
      success: true,
      history: submission.summaryHistory,
      total: submission.summaryHistory.length,
    });
  } catch (err) {
    console.error("summary/history error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 修改：接收題目參數的檢查端點
app.post("/api/check", async (req, res) => {
  try {
    console.log("=== Request received ===");
    console.log("Headers:", req.headers);
    console.log("Body length:", req.body ? JSON.stringify(req.body).length : 0);

    const { imageData, question } = req.body;

    if (!imageData) {
      console.log("No image data provided");
      return res.status(400).json({
        success: false,
        error: "未提供圖片數據",
      });
    }

    // 檢查 imageData 是否為有效的 base64 字符串
    try {
      const buffer = Buffer.from(imageData, "base64");
      console.log("Image data is valid base64, size:", buffer.length);
    } catch (e) {
      console.error("Invalid base64 data:", e);
      return res.status(400).json({
        success: false,
        error: "圖片數據格式無效",
      });
    }

    // 使用默認題目，如果沒有提供
    const defaultQuestion =
      "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。";

    console.log("Calling Gemini API...");
    console.log("Using question:", question || defaultQuestion);
    const geminiServices = await loadGeminiServices();
    const result = await geminiServices.checkFlowchart(
      imageData,
      question || defaultQuestion,
    );

    console.log("API call successful, sending response");
    res.json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error("=== Detailed Error Log ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      error: `檢查流程圖時發生錯誤: ${error.message}`,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// 新增：簡化版的生成 PseudoCode 的 API 端點
app.post("/api/generate-pseudocode-simple", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "缺少題目參數",
      });
    }

    // 直接返回一個固定的響應，不依賴Gemini
    const result = {
      pseudoCode: [
        "___ weather == '下雨':",
        "    ___('帶傘')",
        "___:",
        "    ___('不帶傘')",
      ],
      answers: ["if", "print", "else", "print"],
    };

    console.log("Simple pseudocode generation successful");
    res.json(result);
  } catch (err) {
    console.error("Simple pseudocode generation error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: "Simple pseudocode generation failed",
    });
  }
});

// 新增：生成 PseudoCode 的 API 端點
app.post("/api/generate-pseudocode", async (req, res) => {
  const { question } = req.body || {};
  const fallbackResult = {
    pseudoCode: [
      "___ weather == '下雨':",
      "    ___('帶傘')",
      "___:",
      "    ___('不用帶傘')",
    ],
    answers: ["if", "print", "else", "print"],
  };

  const targetQuestion =
    question ||
    "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。";

  try {
    const prompt = `請根據題目生成Python虛擬碼，用 ___ 代表空白讓學生填寫。

要求：
1. 挖空 if、elif、else、input、print 等關鍵字
2. 保持簡單的邏輯結構
3. 返回標準JSON格式

格式範例：
{
  "pseudoCode": [
    "___ weather == '下雨':",
    "    ___('帶傘')",
    "___:",
    "    ___('不用帶傘')"
  ],
  "answers": ["if", "print", "else", "print"]
}

題目：${targetQuestion}`;

    const geminiServices = await loadGeminiServices();
    const result = await geminiServices.generatePseudoCode(prompt);
    if (
      result &&
      Array.isArray(result.pseudoCode) &&
      result.pseudoCode.length > 0 &&
      Array.isArray(result.answers)
    ) {
      return res.json(result);
    }
    return res.json(fallbackResult);
  } catch (err) {
    console.error("[generate-pseudocode] error:", err.message);
    return res.json(fallbackResult);
  }
});

// 新增：檢查 pseudocode 的 API 端點
app.post("/api/check-pseudocode", async (req, res) => {
  try {
    const { question, userPseudoCode } = req.body || {};
    if (!question || !userPseudoCode) {
      return res.status(400).json({
        success: false,
        error: "缺少題目或學生虛擬碼內容",
      });
    }
    try {
      const geminiServices = await loadGeminiServices();
      const feedback = await geminiServices.checkPseudoCode(
        question,
        userPseudoCode,
      );
      return res.json({ success: true, feedback });
    } catch (geminiError) {
      console.error("check-pseudocode gemini error:", geminiError.message);
      return res.json({
        success: true,
        feedback: "虛擬碼結構完整，請檢查條件判斷分支是否包含對應的處理動作。",
        fallback: true,
      });
    }
  } catch (error) {
    res.json({
      success: true,
      feedback: "檢查完成，請確認各邏輯分支是否符合題目需求。",
      fallback: true,
    });
  }
});

// === 線上執行程式碼 API（修正版，含 Windows 支援） ===
app.post("/api/run-code", async (req, res) => {
  const { code, language } = req.body || {};
  if (!code || !language) {
    return res
      .status(400)
      .json({ success: false, error: "缺少 code 或 language 參數" });
  }

  // ==== helpers ====
  const fs = await import("fs/promises");
  const fsSync = await import("fs");
  const path = await import("path");
  const { execFile } = await import("child_process");

  function execFilep(bin, args = [], opts = {}) {
    return new Promise((resolve, reject) => {
      execFile(bin, args, opts, (err, stdout, stderr) => {
        if (err) reject({ err, stdout, stderr });
        else resolve({ stdout, stderr });
      });
    });
  }
  function exists(p) {
    try {
      return fsSync.existsSync(p);
    } catch {
      return false;
    }
  }

  async function pickPython() {
    if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
    try {
      await execFilep("python3", ["--version"]);
      return "python3";
    } catch {}
    try {
      await execFilep("python", ["--version"]);
      return "python";
    } catch {}
    try {
      await execFilep("py", ["-3", "--version"]);
      return "py";
    } catch {}
    return null;
  }

  async function pickCCompiler() {
    if (process.env.CC && exists(process.env.CC)) return process.env.CC;
    try {
      await execFilep("gcc", ["--version"]);
      return "gcc";
    } catch {}
    try {
      await execFilep("clang", ["--version"]);
      return "clang";
    } catch {}
    const candidates = [
      "C:\\msys64\\ucrt64\\bin\\gcc.exe",
      "C:\\msys64\\mingw64\\bin\\gcc.exe",
      "C:\\ProgramData\\chocolatey\\lib\\mingw\\tools\\install\\mingw64\\bin\\gcc.exe",
      "C:\\Program Files\\LLVM\\bin\\clang.exe",
      "/usr/bin/clang",
    ];
    for (const c of candidates) if (exists(c)) return c;
    try {
      const { stdout } = await execFilep("xcrun", ["--find", "clang"]);
      const p = stdout.trim();
      if (p && exists(p)) return p;
    } catch {}
    return null;
  }
  // ===============================================

  const tmpDir = path.resolve("./temp");
  const id = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const isWin = process.platform === "win32";

  let filename,
    filepath,
    cleanupFiles = [];

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    if (language === "python") {
      filename = `${id}.py`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const PY = await pickPython();
      if (!PY) {
        await fs.unlink(filepath).catch(() => {});
        return res.status(400).json({
          success: false,
          error: "後端未安裝 Python（請安裝 python3 或在 .env 設 PYTHON_BIN）",
        });
      }

      const { stdout, stderr } = await execFilep(
        PY,
        PY === "py" ? ["-3", filepath] : [filepath],
        {
          timeout: 3000,
          maxBuffer: 1024 * 200,
        },
      );
      await fs.unlink(filepath).catch(() => {});
      return res.json({ success: true, stdout, stderr });
    } else if (language === "javascript") {
      filename = `${id}.js`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const { stdout, stderr } = await execFilep(process.execPath, [filepath], {
        timeout: 3000,
        maxBuffer: 1024 * 200,
      });
      await fs.unlink(filepath).catch(() => {});
      return res.json({ success: true, stdout, stderr });
    } else if (language === "c") {
      filename = `${id}.c`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const CC = await pickCCompiler();
      if (!CC) {
        await fs.unlink(filepath).catch(() => {});
        return res.status(400).json({
          success: false,
          error:
            "後端沒有可用的 C 編譯器（請安裝 gcc 或 clang，或在 .env 設 CC=編譯器路徑）",
        });
      }

      const outBase = path.join(tmpDir, `${id}_out`);
      const exePath = isWin ? `${outBase}.exe` : outBase;

      // 編譯
      try {
        await execFilep(CC, [filepath, "-O0", "-o", exePath], {
          timeout: 8000,
          maxBuffer: 1024 * 200,
        });
      } catch (e) {
        await fs.unlink(filepath).catch(() => {});
        const stderrMsg =
          (e.stderr && e.stderr.toString()) ||
          e.err?.message ||
          "compile error";
        // ← 這裡延用你原本的 explainError
        try {
          await loadErrorExplainer();
          const errorExplanation = await explainError(
            stderrMsg,
            language,
            code,
          );
          return res.json({
            success: false,
            stdout: e.stdout || "",
            stderr: stderrMsg,
            errorExplanation: errorExplanation.explanation,
            errorType: errorExplanation.errorType,
          });
        } catch (errorExplainErr) {
          // 如果解釋失敗，返回基本錯誤訊息
          return res.json({
            success: false,
            stdout: e.stdout || "",
            stderr: stderrMsg,
          });
        }
      }

      // 執行
      try {
        const { stdout, stderr } = await execFilep(exePath, [], {
          timeout: 3000,
          maxBuffer: 1024 * 200,
        });
        await Promise.all([
          fs.unlink(filepath).catch(() => {}),
          fs.unlink(exePath).catch(() => {}),
        ]);
        console.log("CC =", process.env.CC || "auto");
        return res.json({ success: true, stdout, stderr });
      } catch (e) {
        await Promise.all([
          fs.unlink(filepath).catch(() => {}),
          fs.unlink(exePath).catch(() => {}),
        ]);
        return res.json({
          success: false,
          stdout: e.stdout || "",
          stderr:
            (e.stderr && e.stderr.toString()) ||
            e.err?.message ||
            "runtime error",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "不支援的語言，目前僅支援 Python、JavaScript、C",
      });
    }
  } catch (err) {
    // 萬一哪裡 throw，盡量清掉暫存檔
    const del = cleanupFiles.length ? cleanupFiles : filepath ? [filepath] : [];
    if (del.length)
      await Promise.all(del.map((f) => fs.unlink(f).catch(() => {})));
    res
      .status(500)
      .json({ success: false, error: "執行程式時發生錯誤: " + String(err) });
  }
});

// === 新增：互動式程式執行 API ===
app.post("/api/run-code-interactive", async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({
      success: false,
      error: "缺少 code 或 language 參數",
    });
  }

  console.log("Code execution requested:", {
    language,
    codeLength: code.length,
  });

  const fs = await import("fs/promises");
  // 使用系統暫存資料夾以避免 nodemon 被觸發或路徑問題（跨平台）
  const tmpDir = path.join(os.tmpdir(), "codeflow-backend-temp");
  const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  let filename,
    filepath,
    execCmd,
    cleanupFiles = [];

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    if (language === "python") {
      // Vercel環境中沒有Python，使用JavaScript執行
      filename = `${processId}.js`;
      filepath = path.join(tmpDir, filename);

      // 將Python代碼轉換為JavaScript
      const jsCode = convertPythonToJS(code);
      await fs.writeFile(filepath, jsCode, "utf-8");
      execCmd = "node";
      cleanupFiles = [filepath];
    } else if (language === "javascript") {
      filename = `${processId}.js`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");
      execCmd = "node";
      cleanupFiles = [filepath];
    } else if (language === "c") {
      filename = `${processId}.c`;
      filepath = path.join(tmpDir, filename);
      const outputExe = path.join(tmpDir, `${processId}_out`);
      await fs.writeFile(filepath, code, "utf-8");

      // 編譯 C 程式
      await new Promise((resolve, reject) => {
        exec(
          `gcc "${filepath}" -o "${outputExe}"`,
          { timeout: 2000 },
          (err, stdout, stderr) => {
            if (err) {
              reject(stderr || err.message);
            } else {
              resolve();
            }
          },
        );
      });
      execCmd = outputExe;
      cleanupFiles = [filepath, outputExe];
    } else {
      return res.status(400).json({
        success: false,
        error: "不支援的語言，目前僅支援 Python、JavaScript、C",
      });
    }

    // 啟動互動式程序
    const childProcess = spawn(execCmd, language === "c" ? [] : [filepath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000, // 30秒超時
      shell: process.platform === "win32", // Windows需要shell模式
      encoding: "utf8", // 強制使用UTF-8編碼
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8", // 設定Python的I/O編碼
        LANG: "en_US.UTF-8", // 設定語言環境
        LC_ALL: "en_US.UTF-8", // 設定所有本地化設定
      },
    });

    let initialOutput = "";
    let hasReceivedOutput = false;

    // 處理程序輸出
    childProcess.stdout.on("data", (data) => {
      const output = data.toString();
      initialOutput += output;
      hasReceivedOutput = true;
    });

    childProcess.stderr.on("data", (data) => {
      const error = data.toString();
      initialOutput += error;
      hasReceivedOutput = true;
    });

    // 處理程序結束
    childProcess.on("close", (code) => {
      activeProcesses.delete(processId);
      // 清理檔案
      Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
    });

    childProcess.on("error", (error) => {
      console.error(`Process error for ${processId}:`, error);
      activeProcesses.delete(processId);
      // 清理檔案
      Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
    });

    // 存儲程序引用
    activeProcesses.set(processId, {
      process: childProcess,
      cleanupFiles,
      language,
    });

    // 等待一小段時間看是否有初始輸出，並判斷程式是否完成
    setTimeout(() => {
      // 檢查程序是否還在運行
      const isProcessRunning =
        !childProcess.killed && childProcess.exitCode === null;

      // 如果程序已經結束，清理資源
      if (!isProcessRunning) {
        activeProcesses.delete(processId);
        // 清理檔案
        Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
      }

      res.json({
        success: true,
        processId: isProcessRunning ? processId : null, // 如果程序已結束，返回null
        initialOutput: hasReceivedOutput ? initialOutput : "",
        needsInput: isProcessRunning, // 如果程序還在運行，表示需要輸入
        finished: !isProcessRunning, // 如果程序已結束，表示不需要輸入
      });
    }, 500); // 增加等待時間以確保程序有足夠時間執行
  } catch (err) {
    console.error("Error in run-code-interactive:", err);
    console.error("Platform:", process.platform);
    console.error("Language:", language);
    console.error("ExecCmd:", execCmd);

    // 清理檔案
    if (cleanupFiles && cleanupFiles.length) {
      await Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
    }
    res.status(500).json({
      success: false,
      error: "執行程式時發生錯誤: " + err.message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// === 發送輸入到互動式程序 ===
app.post("/api/send-input", async (req, res) => {
  const { processId, input } = req.body;

  if (!processId || !input) {
    return res.status(400).json({
      success: false,
      error: "缺少 processId 或 input 參數",
    });
  }

  console.log("Send input requested:", { processId, input });
  const processInfo = activeProcesses.get(processId);
  if (!processInfo) {
    return res.status(404).json({
      success: false,
      error: "找不到指定的程序",
    });
  }

  const { process: childProcess } = processInfo;

  try {
    let output = "";
    let finished = false;
    let error = "";

    // 設置輸出監聽器
    const stdoutHandler = (data) => {
      output += data.toString();
    };

    const stderrHandler = (data) => {
      error += data.toString();
    };

    const closeHandler = (code) => {
      finished = true;
      activeProcesses.delete(processId);
    };

    childProcess.stdout.on("data", stdoutHandler);
    childProcess.stderr.on("data", stderrHandler);
    childProcess.on("close", closeHandler);

    // 發送輸入
    childProcess.stdin.write(input + "\n");

    // 等待輸出或程序結束
    setTimeout(() => {
      childProcess.stdout.removeListener("data", stdoutHandler);
      childProcess.stderr.removeListener("data", stderrHandler);
      childProcess.removeListener("close", closeHandler);

      res.json({
        success: true,
        output,
        error: error || null,
        finished,
      });
    }, 1000); // 等待1秒收集輸出
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "發送輸入時發生錯誤: " + err.message,
    });
  }
});

// === 停止程序 ===
app.post("/api/stop-process", async (req, res) => {
  const { processId } = req.body;

  if (!processId) {
    return res.status(400).json({
      success: false,
      error: "缺少 processId 參數",
    });
  }

  const processInfo = activeProcesses.get(processId);
  if (!processInfo) {
    return res.status(404).json({
      success: false,
      error: "找不到指定的程序",
    });
  }

  try {
    const { process: childProcess, cleanupFiles } = processInfo;

    // 終止程序
    childProcess.kill("SIGTERM");

    // 清理檔案
    if (cleanupFiles && cleanupFiles.length) {
      const fs = await import("fs/promises");
      await Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
    }

    // 從活躍程序列表中移除
    activeProcesses.delete(processId);

    res.json({
      success: true,
      message: "程序已停止",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "停止程序時發生錯誤: " + err.message,
    });
  }
});

app.post("/api/check-code", async (req, res) => {
  try {
    const {
      question,
      code,
      language = "python",
      questionId = "Q001",
    } = req.body || {};

    if (!question || !code) {
      return res.status(400).json({
        success: false,
        error: "缺少題目或程式碼",
      });
    }

    // 嘗試記錄嘗試次數（如果有登入且資料庫就緒）
    try {
      const auth =
        typeof req.auth === "function"
          ? req.auth()
          : getAuth
            ? getAuth(req)
            : {};
      const userId = auth?.userId;
      if (userId && mongoose.connection.readyState === 1) {
        const student = await ensureStudent(userId);
        if (student?._id) {
          await mongoose
            .model("Submission")
            .findOneAndUpdate(
              { student: student._id, questionId },
              { $inc: { attemptCount: 1 } },
              { upsert: true },
            );
        }
      }
    } catch (dbErr) {
      console.warn("check-code stat update warning:", dbErr.message);
    }

    try {
      const geminiServices = await loadGeminiServices();
      const feedback = await geminiServices.checkCode(question, code, language);
      res.json({ success: true, feedback });
    } catch (geminiError) {
      console.error("check-code gemini error:", geminiError.message);
      res.json({
        success: true,
        feedback:
          "程式碼語法基本檢查完成，請確認變數命名與邏輯條件是否符合題目要求。",
        fallback: true,
      });
    }
  } catch (error) {
    console.error("check-code error:", error);
    res.json({
      success: true,
      feedback: "檢查完成，請測試程式的輸出結果是否符合預期。",
      fallback: true,
    });
  }
});

// 添加一個簡單的測試路由
app.get("/test", (req, res) => {
  res.json({
    message: "Server is running",
    geminiKeyAvailable: !!process.env.GEMINI_API_KEY,
  });
});

// 教師後台資料：僅教師可訪問
app.post("/api/test-error-explanation", async (req, res) => {
  try {
    const { errorMessage, language, code } = req.body;

    if (!errorMessage || !language) {
      return res.status(400).json({
        success: false,
        error: "缺少錯誤訊息或語言參數",
      });
    }

    await loadErrorExplainer();
    const result = await explainError(errorMessage, language, code || "");

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 檢查環境變量
console.log("API Key available:", !!process.env.GEMINI_API_KEY);
console.log("MongoDB URI available:", !!getMongoUri());

// 新增：基本測試端點
app.get("/api/test-basic", (req, res) => {
  res.json({ success: true, message: "Basic API is working" });
});

// 新增：測試環境變數的端點
app.get("/api/test-env", (req, res) => {
  res.json({
    success: true,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasMongoUri: !!getMongoUri(),
    mongoUriSource: resolveMongoUri().source,
    mongoHost: getMongoHost(getMongoUri()),
    nodeEnv: process.env.NODE_ENV,
  });
});

// 新增：簡單的測試端點
app.post("/api/test-simple", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Simple test endpoint working",
      timestamp: new Date().toISOString(),
      body: req.body,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增：簡化版的程式執行測試端點
app.post("/api/test-code-execution", async (req, res) => {
  try {
    const { code, language } = req.body;

    res.json({
      success: true,
      message: "Code execution test endpoint working",
      received: {
        code: code ? code.substring(0, 100) + "..." : "no code",
        language,
      },
      timestamp: new Date().toISOString(),
      note: "This is a test endpoint - no actual code execution",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增：測試Gemini API的端點
app.get("/api/test-gemini", async (req, res) => {
  try {
    // 使用從geminiService導入的getGenAI函數
    const { GoogleGenerativeAI } = await import("@google/generative-ai");

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY environment variable is not set",
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "Gemini 2.5 Flash" });
    const result = await model.generateContent(
      "Hello, this is a test. Please respond with 'API is working'.",
    );
    const response = await result.response;
    const text = response.text();
    res.json({
      success: true,
      message: "Gemini API is working",
      response: text,
    });
  } catch (error) {
    console.error("Gemini API test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 資料表連接 - 已移到前面的配置區域

//儲存題目到資料庫
app.post("/api/add-question", requireTeacher, requireDb, async (req, res) => {
  // try {
  //   const { questionId, stage1, stage2, stage3 } = req.body;
  //   res.json({ success: true });
  // } catch (error) {
  //   res.status(500).json({ success: false, error: error.message });
  // }

  try {
    const { questionTitle, description, topic = "未分類" } = req.body;
    const newQuestion = new Question({ questionTitle, description, topic });
    await newQuestion.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 列出題目（支援關鍵字、分頁）
app.get("/api/questions", requireDb, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const pageSize = Math.min(parseInt(req.query.pageSize) || 10, 100);
    const q = (req.query.q || "").trim();

    const filter = q
      ? {
          $or: [
            { questionTitle: new RegExp(q, "i") },
            { description: new RegExp(q, "i") },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      Question.countDocuments(filter),
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
    ]);

    res.json({ success: true, total, page, pageSize, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 以 questionId 取得單一題目
app.get("/api/questions/:id", requireDb, async (req, res) => {
  const { id } = req.params;

  // 避免 CastError：非 24 hex 先擋掉
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, error: "invalid id" });
  }

  const doc = await Question.findById(id).lean();
  if (!doc) return res.status(404).json({ success: false, error: "not found" });

  res.json({ success: true, item: doc });
});

//儲存 stage1 的流程圖
app.get("/api/submissions/stage1", requireTeacher, requireDb, async (req, res) => {
  try {
    const submissions = await Submission.find({});
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.get("/api/submissions/stage2", requireTeacher, requireDb, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const submissions = await Submission.find({});
      return res.json(submissions);
    }
    return res.json([]);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.get("/api/submissions/stage3", requireTeacher, requireDb, async (req, res) => {
  try {
    const submissions = await Submission.find({});
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});
// app.post("/api/add-question", async (req, res) => {
//   try {
//     const { questionId, stage1, stage2, stage3 } = req.body;
//     const newQuestion = new Question({ questionId, stage1, stage2, stage3 });
//     await newQuestion.save();
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// 新增：通用的助教對話 API 端點
app.get("/api/debug-submissions", async (req, res) => {
  const data = await mongoose.model("Submission").find();
  res.json({
    count: data.length,
    data,
  });
});

// 全局錯誤處理中間件（置於所有路由之後，確保捕捉所有異常並以 JSON 回應）
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  if (res.headersSent) return next(err);
  // 資料庫連線失敗 / 查詢排隊逾時 → 503，讓前端顯示可理解的訊息
  if (isDbError(err)) {
    return res
      .status(503)
      .json({ success: false, error: DB_UNAVAILABLE_MESSAGE });
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// 啟動服務器 - 適配Vercel無服務器函數
console.log(
  "About to start server. NODE_ENV:",
  process.env.NODE_ENV,
  "Condition:",
  process.env.NODE_ENV !== "production",
);
if (process.env.NODE_ENV !== "production") {
  console.log("Calling app.listen...");
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log("Environment check:");
    console.log("- PORT:", port);
    console.log("- GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
    console.log("- NODE_ENV:", process.env.NODE_ENV);
  });

  // 確保在退出前正確關閉server
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing server...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, closing server...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  console.log("app.listen called, server is now listening...");
} else {
  console.log("Skipping app.listen in production mode");
}

// 導出 maxDuration 與 app 供 Vercel Serverless Function 使用
export const maxDuration = 60;
export default app;
