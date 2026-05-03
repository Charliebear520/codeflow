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
    mongodb: {
      connected: mongoose.connection.readyState === 1,
    },
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
    if (!isProd) return callback(null, true); // 開發：全放行，最少踩雷
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
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

// 全局錯誤處理中間件
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 啟用 Clerk 中間件以支援 getAuth()
app.use(clerkMiddleware());

// 資料表連接 - 移到前面
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codeflow";

mongoose
  .connect(mongoUri, {
    //讓 server 選擇逾時更快失敗，除錯友善
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    retryWrites: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // 在生產環境中，如果 MongoDB 連接失敗，不要讓整個應用crush
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "MongoDB connection failed, but continuing in production mode",
      );
    }
  });

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

async function ensureStudent(userId) {
  const u = await clerkClient.users.getUser(userId);
  const fullName =
    u.fullName ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    u.primaryEmailAddress?.emailAddress ||
    "";
  const email =
    u.primaryEmailAddress?.emailAddress ||
    u.emailAddresses?.[0]?.emailAddress ||
    null;

  //role：在白名單就是 teacher，否則 student
  const emailLower = email ? email.toLowerCase() : null;
  const role =
    emailLower && ADMIN_EMAILS_SET.has(emailLower) ? "teacher" : "student";

  // upsert：第一次寫入 userId；之後每次登入都同步 name/email/role（若有變）
  const setOnInsert = { userId };
  const set = {};
  if (fullName) set.name = fullName;
  if (emailLower) set.email = emailLower;
  set.role = role; // 總是以最新角色覆蓋（例如把某帳號升為 teacher）

  const doc = await Student.findOneAndUpdate(
    { userId },
    { $setOnInsert: setOnInsert, $set: set },
    { new: true, upsert: true },
  );

  return doc;
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
app.get("/api/me", requireAuth(), async (req, res) => {
  console.log("Auth header =", req.headers.authorization || "(none)");
  try {
    // 防御性檢查
    if (!clerkClient) {
      console.error("[/api/me] clerkClient 不可用!");
      throw new Error("clerkClient 未初始化。檢查 CLERK_SECRET_KEY 環境變量");
    }

    const { userId } = req.auth();

    // 1) 從 Clerk 拉使用者資料
    const u = await clerkClient.users.getUser(userId);

    const fullName =
      u.fullName ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.username ||
      u.primaryEmailAddress?.emailAddress ||
      "";

    const emailRaw =
      u.primaryEmailAddress?.emailAddress ||
      u.emailAddresses?.[0]?.emailAddress ||
      null;

    const email = emailRaw ? emailRaw.toLowerCase() : null;

    // 2) 角色判斷：在白名單就是 teacher，否則 student
    const role = email && ADMIN_EMAILS_SET.has(email) ? "teacher" : "student";

    // 3) upsert：第一次建立；之後每次同步 name/email/role
    const doc = await Student.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set: {
          ...(fullName ? { name: fullName } : {}),
          ...(email ? { email } : {}),
          role, // 總是以最新角色覆蓋（便於升級/降級）
        },
      },
      { new: true, upsert: true },
    );

    res.json({ success: true, me: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 教師角色 - Express 中間件包裝器處理 async
function requireTeacher(req, res, next) {
  (async () => {
    try {
      const auth = getAuth(req) || {};
      const userId = auth.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // 從資料庫查詢使用者角色
      const student = await Student.findOne({ userId }).lean();

      if (student && student.role === "teacher") {
        return next();
      }

      return res
        .status(403)
        .json({ success: false, error: "Forbidden - Teacher role required" });
    } catch (e) {
      console.error("requireTeacher error:", e);
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
  })();
}

app.get("/api/upload", (req, res) => {
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
    res.status(500).json({
      success: false,
      error: `生成題目時發生錯誤: ${error.message}`,
    });
  }
});

// 新增：生成流程圖提示的API端點
// 新增：生成提示 + 記錄求助次數
app.post("/api/generate-hint", requireAuth(), async (req, res) => {
  try {
    // ✅ 1. 從前端取得資料（一定要有 questionId）
    const { question, hintLevel, questionId } = req.body;

    // ✅ 2. 基本檢查
    if (!question) {
      return res.status(400).json({
        success: false,
        error: "未提供題目",
      });
    }

    if (!questionId) {
      return res.status(400).json({
        success: false,
        error: "缺少 questionId",
      });
    }

    if (!hintLevel || hintLevel < 1 || hintLevel > 7) {
      return res.status(400).json({
        success: false,
        error: "提示層級無效，應為1-7之間的數字",
      });
    }

    // ✅ 3. 取得登入學生資訊
    const { userId } = req.auth();
    const student = await ensureStudent(userId);

    // ✅ 4. ⭐ 關鍵：記錄「求助次數」
    await mongoose.model("Submission").findOneAndUpdate(
      { student: student._id, questionId }, // 找這個學生 + 這題
      {
        $inc: { helpCount: 1 }, // 每點一次提示就 +1
      },
      { upsert: true }, // 如果沒有這筆資料就自動建立
    );

    // ✅ 5. 呼叫 Gemini 生成提示
    console.log(`Generating hint for level ${hintLevel}...`);
    const geminiServices = await loadGeminiServices();
    const hint = await geminiServices.generateFlowchartHint(
      question,
      hintLevel,
    );

    // ✅ 6. 回傳提示給前端
    res.json({
      success: true,
      hint,
    });
  } catch (error) {
    console.error("Error generating hint:", error);

    res.status(500).json({
      success: false,
      error: `生成提示時發生錯誤: ${error.message}`,
    });
  }
});

// 修改：接收題目參數的流程圖檢查端點
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
      // questionId 可能是 ObjectId 或你們自訂字串，先以 ObjectId 嘗試，失敗再用 questionTitle 比對
      if (mongoose.isValidObjectId(questionId)) {
        const doc = await Question.findById(questionId).lean();
        qText = doc?.description || doc?.questionTitle || "";
      }
      if (!qText) {
        const docByTitle = await Question.findOne({
          questionTitle: questionId,
        }).lean();
        qText = docByTitle?.description || docByTitle?.questionTitle || "";
      }
    }
    if (!qText) {
      return res
        .status(400)
        .json({ success: false, error: "找不到題目內容，請提供 questionText" });
    }

    const flowSpec = await generateIdealFlowSpec(qText);
    const saved = await IdealAnswer.findOneAndUpdate(
      { questionId: String(questionId || "UNKNOWN") },
      {
        $set: {
          flowSpec,
          version: "v1",
          modelUsed: "Gemini 2.5 Flash",
          generatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    res.json({ success: true, data: saved });
  } catch (err) {
    console.error("ideal/flow/generate error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 取得理想答案
app.get("/api/ideal/flow/:questionId", async (req, res) => {
  try {
    const doc = await IdealAnswer.findOne({
      questionId: String(req.params.questionId),
    }).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, error: "ideal answer not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stage1 比對：解析 -> 比對 -> 產生回饋（需登入）
app.post("/api/submissions/stage1/compare", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const studentDoc = await ensureStudent(userId);

    const { questionId, imageBase64, graph } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });

    // 取得題目內容（給 Vision/回饋參考，沒抓到也不阻擋）
    let questionText = "";
    if (mongoose.isValidObjectId(questionId)) {
      const q = await Question.findById(questionId).lean();
      questionText = q?.description || q?.questionTitle || "";
    } else {
      const q = await Question.findOne({ questionTitle: questionId }).lean();
      questionText = q?.description || q?.questionTitle || "";
    }

    // 1) 取得或生成理想答案
    let ideal = await IdealAnswer.findOne({
      questionId: String(questionId),
    }).lean();
    if (!ideal) {
      const generated = await generateIdealFlowSpec(
        questionText || "請根據題意繪製流程圖",
      );
      ideal = await IdealAnswer.create({
        questionId: String(questionId),
        flowSpec: generated,
        version: "v1",
        modelUsed: "Gemini 2.5 Flash",
        generatedAt: new Date(),
      });
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

    // 4) 產生回饋
    const feedback = await generateFeedbackText(
      questionText || "",
      idealSpec,
      studentSpec,
      diffs,
      scores,
    );

    // 4.5) 產生檢查報告（用於「檢查」按鈕）
    const checkReport = await generateCheckReport(diffs);

    // 4.6) 計算百分制分數和完成狀態
    const percentScore = scores.overall || 0;
    const isCompleted = percentScore >= 70;

    // 5) 寫回 Submission（保留你現有 stage1 結構，擴充比對結果）
    const update = {
      $set: {
        "stages.stage1.flowSpec": studentSpec,
        "stages.stage1.score": percentScore,
        "stages.stage1.scores": scores,
        "stages.stage1.diffs": diffs,
        "stages.stage1.feedback": feedback,
        "stages.stage1.checkReport": checkReport,
        "stages.stage1.completed": isCompleted,
        "stages.stage1.feedbackLength": feedback.length,
        "stages.stage1.updatedAt": new Date(),
        idealVersion: ideal.version || "v1",
        studentName: studentDoc.name ?? null,
        studentEmail: studentDoc.email?.toLowerCase() ?? null,
      },
      $setOnInsert: {
        student: studentDoc._id,
        questionId,
        createdAt: new Date(),
      },
    };

    const doc = await Submission.findOneAndUpdate(
      { student: studentDoc._id, questionId },
      update,
      { new: true, upsert: true },
    );

    res.json({
      success: true,
      scores,
      diffs,
      feedback,
      checkReport,
      submissionId: doc._id,
    });
  } catch (err) {
    console.error("stage1/compare error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stage 2: 虛擬碼檢查端點
app.post("/api/submissions/stage2/compare", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const studentDoc = await ensureStudent(userId);

    const { questionId, pseudocode } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!pseudocode)
      return res.status(400).json({ success: false, error: "pseudocode 必填" });

    // 取得題目內容
    let questionText = "";
    console.log("🔍 [Stage2 DEBUG] questionId:", questionId);
    console.log(
      "🔍 [Stage2 DEBUG] 是否為 ObjectId:",
      mongoose.isValidObjectId(questionId),
    );

    if (mongoose.isValidObjectId(questionId)) {
      const q = await Question.findById(questionId).lean();
      questionText = q?.description || q?.questionTitle || "";
    } else {
      const q = await Question.findOne({ questionTitle: questionId }).lean();
      questionText = q?.description || q?.questionTitle || "";
    }

    // 1) 取得或生成理想虛擬碼
    let ideal = await IdealAnswer.findOne({
      questionId: String(questionId),
    });

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
      console.log(
        "原因:",
        !ideal
          ? "無理想答案"
          : !ideal.pseudocode
            ? "無虛擬碼"
            : "虛擬碼包含錯誤訊息",
      );

      // 確保有有效的題目文字
      if (!questionText || questionText === "請根據題意撰寫虛擬碼") {
        console.warn(
          "⚠️ questionText 無效或為 fallback 值，嘗試從 Question 資料表重新取得",
        );
        // 再次嘗試從資料庫取得題目
        if (mongoose.isValidObjectId(questionId)) {
          const q = await Question.findById(questionId).lean();
          questionText = q?.description || q?.questionTitle || "";
          console.log("從 Question (by ID) 取得 questionText:", questionText);
        } else {
          const q = await Question.findOne({
            questionTitle: questionId,
          }).lean();
          questionText = q?.description || q?.questionTitle || "";
          console.log(
            "從 Question (by Title) 取得 questionText:",
            questionText,
          );
        }
      }

      // 最後檢查：如果 questionText 仍然無效，記錄警告但仍嘗試生成
      if (!questionText || questionText === "請根據題意撰寫虛擬碼") {
        console.error("❌ 無法取得有效的題目文字，AI 可能無法生成正確答案");
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
        ideal = await IdealAnswer.findOneAndUpdate(
          { questionId: String(questionId) },
          {
            $set: {
              pseudocode: generated.pseudocode,
              pseudocodeStructure: generated.structure,
              modelUsed: "gemini-2.5-flash",
              generatedAt: new Date(),
            },
            $setOnInsert: {
              questionId: String(questionId),
              flowSpec: {},
              version: "v1",
            },
          },
          { upsert: true, new: true },
        );
        console.log("✅ 理想虛擬碼生成並儲存成功");
      } else {
        console.error("❌ AI 生成的虛擬碼包含錯誤訊息，使用基本結構繼續比對");
        // 使用基本的 fallback 結構，不中斷流程
        if (!ideal) {
          ideal = {
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
    const { diffs, scores } = comparePseudocode(
      ideal.pseudocodeStructure,
      pseudocode,
      questionText,
    );
    console.log("📈 Stage2 比對結果 scores:", scores);
    console.log("📋 Stage2 比對結果 diffs:", JSON.stringify(diffs, null, 2));

    // 3) 產生回饋
    const feedback = await generatePseudocodeFeedback(
      questionText || "",
      ideal,
      pseudocode,
      diffs,
      scores,
    );

    // 3.5) 產生檢查報告（用於「檢查」按鈕）
    const checkReport = await generatePseudocodeCheckReport(diffs);

    // 3.6) 計算完成狀態（scores.overall 已經是 0-100）
    const percentScore = scores.overall;
    const isCompleted = percentScore >= 70;

    // 4) 寫回 Submission
    const update = {
      $set: {
        "stages.stage2.pseudocode": pseudocode,
        "stages.stage2.score": percentScore,
        "stages.stage2.scores": scores,
        "stages.stage2.diffs": diffs,
        "stages.stage2.feedback": feedback,
        "stages.stage2.checkReport": checkReport,
        "stages.stage2.completed": isCompleted,
        "stages.stage2.feedbackLength": feedback.length,
        "stages.stage2.updatedAt": new Date(),
        studentName: studentDoc.name ?? null,
        studentEmail: studentDoc.email?.toLowerCase() ?? null,
      },
      $setOnInsert: {
        student: studentDoc._id,
        questionId,
        createdAt: new Date(),
      },
    };

    const doc = await Submission.findOneAndUpdate(
      { student: studentDoc._id, questionId },
      update,
      { new: true, upsert: true },
    );

    res.json({
      success: true,
      scores,
      diffs,
      feedback,
      checkReport,
      submissionId: doc._id,
    });
  } catch (err) {
    console.error("stage2/compare error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stage 3: 程式碼檢查端點
app.post("/api/submissions/stage3/compare", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const studentDoc = await ensureStudent(userId);

    const { questionId, code, language = "python" } = req.body || {};
    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!code)
      return res.status(400).json({ success: false, error: "code 必填" });

    // 取得題目內容
    let questionText = "";
    if (mongoose.isValidObjectId(questionId)) {
      const q = await Question.findById(questionId).lean();
      questionText = q?.description || q?.questionTitle || "";
    } else {
      const q = await Question.findOne({ questionTitle: questionId }).lean();
      questionText = q?.description || q?.questionTitle || "";
    }

    // 1) 取得或生成理想程式碼
    let ideal = await IdealAnswer.findOne({
      questionId: String(questionId),
    });

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
      console.log(
        "原因:",
        !ideal
          ? "無理想答案"
          : !ideal.code
            ? "無程式碼"
            : ideal.language !== language
              ? `語言不符(${ideal.language} vs ${language})`
              : "程式碼包含錯誤訊息",
      );

      // 確保有有效的題目文字
      if (!questionText || questionText === "請根據題意撰寫程式碼") {
        console.warn(
          "⚠️ questionText 無效或為 fallback 值，嘗試從 Question 資料表重新取得",
        );
        // 再次嘗試從資料庫取得題目
        if (mongoose.isValidObjectId(questionId)) {
          const q = await Question.findById(questionId).lean();
          questionText = q?.description || q?.questionTitle || "";
          console.log("從 Question (by ID) 取得 questionText:", questionText);
        } else {
          const q = await Question.findOne({
            questionTitle: questionId,
          }).lean();
          questionText = q?.description || q?.questionTitle || "";
          console.log(
            "從 Question (by Title) 取得 questionText:",
            questionText,
          );
        }
      }

      // 最後檢查：如果 questionText 仍然無效，記錄警告但仍嘗試生成
      if (!questionText || questionText === "請根據題意撰寫程式碼") {
        console.error("❌ 無法取得有效的題目文字，AI 可能無法生成正確答案");
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
        ideal = await IdealAnswer.findOneAndUpdate(
          { questionId: String(questionId) },
          {
            $set: {
              code: generated.code,
              language: language,
              codeStructure: generated.structure,
              modelUsed: "gemini-2.5-flash",
              generatedAt: new Date(),
            },
            $setOnInsert: {
              questionId: String(questionId),
              flowSpec: {},
              version: "v1",
            },
          },
          { upsert: true, new: true },
        );
        console.log(`✅ 理想 ${language} 程式碼生成並儲存成功`);
      } else {
        console.error("❌ AI 生成的程式碼包含錯誤訊息，使用基本結構繼續比對");
        // 使用基本的 fallback 結構，不中斷流程
        if (!ideal) {
          ideal = {
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
    const { diffs, scores } = compareCode(
      ideal.codeStructure,
      code,
      language,
      questionText,
    );
    console.log("📈 Stage3 比對結果 scores:", scores);
    console.log("📋 Stage3 比對結果 diffs:", JSON.stringify(diffs, null, 2));

    // 3) 產生回饋
    const feedback = await generateCodeFeedback(
      questionText || "",
      ideal,
      code,
      diffs,
      scores,
      language,
    );

    // 3.5) 產生檢查報告（用於「檢查」按鈕）
    const checkReport = await generateCodeCheckReport(diffs, language);

    // 3.6) 計算完成狀態（scores.overall 已經是 0-100）
    const percentScore = scores.overall;
    const isCompleted = percentScore >= 70;

    // 4) 寫回 Submission
    const update = {
      $set: {
        "stages.stage3.code": code,
        "stages.stage3.language": language,
        "stages.stage3.score": percentScore,
        "stages.stage3.scores": scores,
        "stages.stage3.diffs": diffs,
        "stages.stage3.feedback": feedback,
        "stages.stage3.checkReport": checkReport,
        "stages.stage3.completed": isCompleted,
        "stages.stage3.feedbackLength": feedback.length,
        "stages.stage3.updatedAt": new Date(),
        studentName: studentDoc.name ?? null,
        studentEmail: studentDoc.email?.toLowerCase() ?? null,
      },
      $setOnInsert: {
        student: studentDoc._id,
        questionId,
        createdAt: new Date(),
      },
    };

    const doc = await Submission.findOneAndUpdate(
      { student: studentDoc._id, questionId },
      update,
      { new: true, upsert: true },
    );

    res.json({
      success: true,
      scores,
      diffs,
      feedback,
      checkReport,
      submissionId: doc._id,
    });
  } catch (err) {
    console.error("stage3/compare error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增：學生整體作答結果統整
app.post(
  "/api/submissions/all-stages/summary",
  requireAuth(),
  async (req, res) => {
    try {
      const { userId } = req.auth();
      const studentDoc = await ensureStudent(userId);
      const { questionId, regenerate = false } = req.body || {};

      if (!questionId) {
        return res
          .status(400)
          .json({ success: false, error: "questionId 必填" });
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
  },
);

// 新增：查詢報告歷史版本
app.get(
  "/api/submissions/all-stages/summary/history",
  requireAuth(),
  async (req, res) => {
    try {
      const { userId } = req.auth();
      const studentDoc = await ensureStudent(userId);
      const { questionId } = req.query;

      if (!questionId) {
        return res
          .status(400)
          .json({ success: false, error: "questionId 必填" });
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
  },
);

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
  try {
    console.log("[generate-pseudocode] Request received");
    console.log("[generate-pseudocode] Request body:", req.body);

    const { question } = req.body;

    if (!question) {
      console.log("[generate-pseudocode] Missing question parameter");
      return res.status(400).json({
        success: false,
        error: "缺少題目參數",
      });
    }

    console.log(
      "[generate-pseudocode] Generating pseudocode for question:",
      question,
    );

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

題目：${question}`;

    const geminiServices = await loadGeminiServices();

    try {
      const result = await geminiServices.generatePseudoCode(prompt);
      res.json(result);
    } catch (geminiError) {
      // 返回一個默認的響應，避免完全失敗
      const fallbackResult = {
        pseudoCode: [
          "___ weather == '下雨':",
          "    ___('帶傘')",
          "___:",
          "    ___('不帶傘')",
        ],
        answers: ["if", "print", "else", "print"],
      };
      res.json(fallbackResult);
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.stack || "Pseudocode generation failed",
    });
  }
});

// 新增：檢查 pseudocode 的 API 端點
app.post("/api/check-pseudocode", async (req, res) => {
  try {
    const { question, userPseudoCode } = req.body;
    if (!question || !userPseudoCode) {
      return res.status(400).json({
        success: false,
        error: "缺少題目或學生虛擬碼內容",
      });
    }
    const geminiServices = await loadGeminiServices();
    const feedback = await geminiServices.checkPseudoCode(
      question,
      userPseudoCode,
    );
    res.json({ success: true, feedback });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
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

app.post("/api/check-code", requireAuth(), async (req, res) => {
  try {
    const { question, code, language, questionId } = req.body;

    if (!question || !code || !language || !questionId) {
      return res.status(400).json({
        success: false,
        error: "缺少必要參數",
      });
    }

    const { userId } = req.auth();
    const student = await ensureStudent(userId);

    // ✅ 記錄行為（先記再算 AI 也可以）
    await mongoose.model("Submission").findOneAndUpdate(
      { student: student._id, questionId },
      {
        $inc: {
          attemptCount: 1,
          // chatCount: 1
        },
      },
      { upsert: true },
    );

    const geminiServices = await loadGeminiServices();
    const feedback = await geminiServices.checkCode(question, code, language);

    res.json({ success: true, feedback });
  } catch (error) {
    console.error("check-code error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
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
app.get("/api/admin/submissions", requireTeacher, async (req, res) => {
  // try {
  //   // 範例：回傳最近題目（實際可換為作答紀錄）
  //   const latest = await Question.find({}).sort({ createdAt: -1 }).limit(10);
  //   res.json({ success: true, items: latest });
  //   console.log("latest:", latest);
  // } catch (err) {
  //   res.status(500).json({ success: false, error: err.message });
  // }
  const { studentId, questionId, stage, page = 1, pageSize = 20 } = req.query;
  const filter = {};
  if (studentId) filter.student = studentId;
  if (questionId && questionId !== "all") filter.questionId = questionId;
  if (stage && ["stage1", "stage2", "stage3"].includes(stage)) {
    filter[`stages.${stage}.completed`] = true;
  }
  const skip = (Number(page) - 1) * Number(pageSize);
  const items = await Submission.find(filter)
    .populate("student", "name email className") //從"mongoose.model("Student", studentSchema)"中，讀取學生的資料(姓名、信箱、班級)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(Number(pageSize))
    .lean();
  const total = await Submission.countDocuments(filter);
  res.json({
    success: true,
    items,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
  });
});

// AI錯誤解釋功能的API端点
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
console.log("MongoDB URI available:", !!process.env.MONGO_URI);

// 新增：基本測試端點
app.get("/api/test-basic", (req, res) => {
  res.json({ success: true, message: "Basic API is working" });
});

// 新增：測試環境變數的端點
app.get("/api/test-env", (req, res) => {
  res.json({
    success: true,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasMongoUri: !!process.env.MONGO_URI,
    nodeEnv: process.env.NODE_ENV,
    geminiKeyLength: process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY.length
      : 0,
    geminiKeyPrefix: process.env.GEMINI_API_KEY
      ? process.env.GEMINI_API_KEY.substring(0, 10)
      : "N/A",
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
app.post("/api/add-question", async (req, res) => {
  // try {
  //   const { questionId, stage1, stage2, stage3 } = req.body;
  //   res.json({ success: true });
  // } catch (error) {
  //   res.status(500).json({ success: false, error: error.message });
  // }

  try {
    const { questionTitle, description } = req.body;
    const newQuestion = new Question({ questionTitle, description });
    await newQuestion.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 列出題目（支援關鍵字、分頁）
app.get("/api/questions", async (req, res) => {
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
app.get("/api/questions/:id", async (req, res) => {
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
app.post("/api/submissions/stage1", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const {
      questionId,
      graph,
      imageBase64,
      completed = false,
      mode,
      durationDeltaSec = 0,
    } = req.body || {};
    console.log("收到 req.body：", req.body);

    const student = await ensureStudent(userId);

    if (!questionId)
      return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!graph && !imageBase64)
      return res
        .status(400)
        .json({ success: false, error: "需提供 graph 或 imageBase64 其一" });

    const delta = Number.isFinite(Number(durationDeltaSec))
      ? Math.max(0, Math.floor(Number(durationDeltaSec)))
      : 0;
    const setFields = {
      "stages.stage1.mode": mode || null,
      "stages.stage1.completed": !!completed,
      "stages.stage1.updatedAt": new Date(),
      studentName: student.name ?? null,
      studentEmail: student.email?.toLowerCase() ?? null,
    };

    // 只在有值時才帶入
    if (graph) setFields["stages.stage1.graph"] = graph;
    if (imageBase64) setFields["stages.stage1.imageBase64"] = imageBase64;

    console.log("儲存前 setFields：", setFields);

    const update = {
      $set: setFields,
      $setOnInsert: {
        student: student._id,
        questionId,
      },
      $inc: {
        "stages.stage1.durationSec": delta, // 原子累加
      },
    };

    console.log("儲存前 update：", JSON.stringify(update, null, 2));

    const doc = await Submission.findOneAndUpdate(
      { student: student._id, questionId },
      update,
      { new: true, upsert: true },
    );
    res.status(201).json({
      success: true,
      submissionId: doc._id,
      durationSec: doc?.stages?.stage1?.durationSec ?? 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/submissions/stage1", async (req, res) => {
  try {
    const submissions = await Submission.find({});
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.post("/api/submissions/stage2", requireAuth(), async (req, res) => {
  try {
    console.log("stage2 req.body:", req.body);

    const { userId } = req.auth();
    const student = await ensureStudent(userId);

    const {
      questionId,
      pseudocode,
      completed,
      durationDeltaSec = 0,

      // ⭐ 新增：從前端帶進來
      attemptDelta = 0,
      chatDelta = 0,
      helpDelta = 0,
    } = req.body;

    const delta = Number.isFinite(Number(durationDeltaSec))
      ? Math.max(0, Math.floor(Number(durationDeltaSec)))
      : 0;

    // ✅ 要寫入的欄位
    const setFields = {
      "stages.stage2.completed": !!completed,
      "stages.stage2.updatedAt": new Date(),

      studentName: student.name ?? null,
      studentEmail: student.email?.toLowerCase() ?? null,
    };

    if (typeof pseudocode === "string") {
      setFields["stages.stage2.pseudocode"] = pseudocode;
    }

    // ✅ 關鍵：所有統計都在這裡累加
    const updateObj = {
      $set: setFields,

      $setOnInsert: {
        student: student._id,
        questionId,
      },

      $inc: {
        "stages.stage2.durationSec": delta,

        // ⭐ 新增統計
        "stages.stage2.attempts": attemptDelta,
        "stages.stage2.chatCount": chatDelta,
        "stages.stage2.helpCount": helpDelta,
      },
    };

    console.log("stage2 updateObj:", updateObj);

    const newSubmission = await Submission.findOneAndUpdate(
      { student: student._id, questionId },
      updateObj,
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      data: newSubmission,
      durationSec: newSubmission?.stages?.stage2?.durationSec ?? 0,
    });
  } catch (err) {
    console.error("Error saving stage2:", err);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

app.get("/api/submissions/stage2", async (req, res) => {
  try {
    const submissions = await Submission.find({});
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.post("/api/submissions/stage3", requireAuth(), async (req, res) => {
  try {
    console.log("stage3 req.body:", req.body);

    const { userId } = req.auth();
    const student = await ensureStudent(userId);

    const {
      questionId,
      code,
      language,
      completed,
      durationDeltaSec = 0,

      // ⭐ 新增
      attemptDelta = 0,
      chatDelta = 0,
      helpDelta = 0,
    } = req.body;

    // ⏱️ 時間處理
    const delta = Number.isFinite(Number(durationDeltaSec))
      ? Math.max(0, Math.floor(Number(durationDeltaSec)))
      : 0;

    const setFields = {
      "stages.stage3.completed": !!completed,
      "stages.stage3.updatedAt": new Date(),

      studentName: student.name ?? null,
      studentEmail: student.email?.toLowerCase() ?? null,
    };

    if (typeof code === "string") {
      setFields["stages.stage3.code"] = code;
    }

    if (language) {
      setFields["stages.stage3.language"] = language;
    }

    const updateObj = {
      $set: setFields,

      $setOnInsert: {
        student: student._id,
        questionId,
      },

      $inc: {
        // ⏱️ 時間
        "stages.stage3.durationSec": delta,

        // ⭐⭐ 這三個才是 AI 分析關鍵 ⭐⭐
        "stages.stage3.attempts": attemptDelta,
        "stages.stage3.chatCount": chatDelta,
        "stages.stage3.helpCount": helpDelta,
      },
    };

    console.log("stage3 updateObj:", updateObj);

    const newSubmission = await Submission.findOneAndUpdate(
      { student: student._id, questionId },
      updateObj,
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      data: newSubmission,
      durationSec: newSubmission?.stages?.stage3?.durationSec ?? 0,
    });
  } catch (err) {
    console.error("Error saving stage3:", err);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

app.get("/api/submissions/stage3", async (req, res) => {
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
app.post("/api/chat", requireAuth(), async (req, res) => {
  const { prompt, stage, currentData, question, questionId } = req.body;
  const { userId } = req.auth();

  try {
    // 1. 取得已經封裝好的 Gemini 服務
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // 💡 修正模型名稱為官方標準格式，例如 gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. 設定 AI 的說話人格
    const systemInstruction = `
      你是一位親切的程式助教「沐芙」，正在引導學生學習程式邏輯。
      當前階段：${stage || "未提供"}
      題目內容：${question || "未提供"}
      之前的分析回饋：${currentData || "無"}

      請遵循以下原則：
      1. 使用繁體中文回答，語氣溫柔且多鼓勵。
      2. 不要直接給答案，要用提問或提示的方式引導學生。
      3. 回答時可以使用 Markdown 格式。
    `;

    // 2.5 ✅ 根據 Clerk userId 查詢 MongoDB 中的學生記錄
    const student = await mongoose.model("Student").findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "學生記錄未找到",
      });
    }

    // 3. 發送請求給 Gemini
    const result = await model.generateContent([systemInstruction, prompt]);
    const response = await result.response;
    const text = response.text();

    // 4. ✅ 關鍵修正：依照階段動態存入資料庫
    // 假設前端傳來的 stage 是 "stage1", "stage2" 或 "stage3"
    const stageKey = stage || "stage1";

    await mongoose.model("Submission").findOneAndUpdate(
      { student: student._id, questionId },
      {
        $inc: {
          [`stages.${stageKey}.chatCount`]: 1, // 增加對應階段的對話次數
        },
        $push: {
          [`stages.${stageKey}.chatHistory`]: {
            // 存入對話紀錄，次數才會正確計算
            role: "user",
            message: prompt,
            answer: text,
            timestamp: new Date(),
          },
        },
      },
      { upsert: true },
    );

    // 5. 回傳給前端
    res.json({ success: true, result: text });
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    const isQuotaError =
      error?.status === 429 ||
      /quota|rate limit|too many requests/i.test(error?.message || "");

    if (isQuotaError) {
      const fallbackReply =
        stage === "stage1" || /流程圖/.test(question || "")
          ? "先確認流程圖是否有開始、判斷、處理與結束，並把分支箭頭標示清楚。"
          : "先補齊開始、判斷與結束，再檢查每個分支是否都有對應步驟。";

      return res.json({
        success: true,
        result: fallbackReply,
        fallback: true,
      });
    }

    res.status(500).json({
      success: false,
      error: "AI 助教目前忙線中",
      details: error.message,
    });
  }
});

// 新增：取得學生提交紀錄總結的 API 端點
app.get("/api/submissions/summary/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ 修正 1：用正確欄位 student
    const submission = await mongoose
      .model("Submission")
      .findOne({ student: new mongoose.Types.ObjectId(studentId) })
      .sort({ updatedAt: -1 });

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "找不到該學生的提交紀錄" });
    }

    /*
      ✅ 修正 2：後端直接計算總秒數
    */
    const stage1Sec = submission.stages?.stage1?.durationSec || 0;
    const stage2Sec = submission.stages?.stage2?.durationSec || 0;
    const stage3Sec = submission.stages?.stage3?.durationSec || 0;

    const totalDurationSec = stage1Sec + stage2Sec + stage3Sec;

    let aiSummaryText = submission.aiSummary;

    /*
      ✅ 修正 3：安全包裝 Gemini
    */
    if (!aiSummaryText) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

        const prompt = `
        請根據以下學生的解題數據，寫一段 50 字以內的老師觀點分析：
        - 第一階段耗時：${stage1Sec} 秒
        - 第二階段耗時：${stage2Sec} 秒
        - 第三階段耗時：${stage3Sec} 秒
        - 總嘗試次數：${submission.attemptCount || 0} 次
        - 最後的錯誤訊息：${submission.lastError || "無"}
        `;

        const result = await model.generateContent(prompt);
        aiSummaryText = result.response.text();

        submission.aiSummary = aiSummaryText;
        await submission.save();
      } catch (aiError) {
        console.error("Gemini Error:", aiError);
        aiSummaryText = "AI 分析暫時無法產生";
      }
    }

    /*
      ✅ 整合回傳資料
    */
    const summaryData = {
      stages: submission.stages,
      totalDurationSec, // ← 現在是真的算出來
      chatCount: submission.chatCount || 0,
      attemptCount: submission.attemptCount || 0,
      helpCount: submission.helpCount || 0,
      aiSummary: aiSummaryText,
      lastError: submission.lastError || "目前無語法錯誤紀錄",
      status: totalDurationSec < 3600 ? "表現優異" : "需多加練習",
    };

    res.json({ success: true, data: summaryData });
  } catch (error) {
    console.error("Summary API Error:", error);
    res.status(500).json({ success: false, error: "伺服器處理總結資料時出錯" });
  }
});

// 新增：測試資料插入的端點
app.get("/api/test-insert", async (req, res) => {
  const Submission = mongoose.model("Submission");

  const newData = await Submission.create({
    student: new mongoose.Types.ObjectId(),
    stages: {
      stage1: { durationSec: 120 },
      stage2: { durationSec: 300 },
      stage3: { durationSec: 600 },
    },
    attemptCount: 2,
    chatCount: 5,
    helpCount: 1,
  });

  res.json(newData);
});

// 新增：列出所有提交紀錄的端點（僅供測試使用，實際應加上認證與分頁）
app.get("/api/debug-submissions", async (req, res) => {
  const data = await mongoose.model("Submission").find();
  res.json({
    count: data.length,
    data,
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

// 導出app供Vercel使用 (僅在作為模塊導入時)
// export default app;
