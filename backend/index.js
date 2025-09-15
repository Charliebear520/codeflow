import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ImageKit from "imagekit";
import {
  checkFlowchart,
  generateFlowchartQuestion,
  generateFlowchartHint,
  generatePseudoCode,
  checkPseudoCode,
  checkCode,
} from "./services/geminiService.js";
import { clerkMiddleware, requireAuth, getAuth, clerkClient } from "@clerk/express";
import { exec } from "child_process";

import mongoose from "mongoose";
import Question from "./models/Question.js"; // ← 後端才可以 import
import Student from "./models/Student.js";
import Submission from "./models/Submission.js";

// 加載環境變量
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
const fsSync = await import("fs");

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));// 讓 JSON 進來變成 req.body
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(clerkMiddleware());// 解析前端帶來的 Authorization: Bearer <token>

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

// 小工具：確保 Student 存在並同步 name/email
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

  const update = { $setOnInsert: { userId } };
  const toSet = {};
  if (fullName) toSet.name = fullName;
  if (email) toSet.email = email.toLowerCase();
  if (Object.keys(toSet).length) update.$set = toSet;

  return Student.findOneAndUpdate({ userId }, update, { new: true, upsert: true });
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
function exists(p) { try { return fsSync.existsSync(p); } catch { return false; } }

async function pickCCompiler() {
  // 1) 優先吃 .env
  if (process.env.CC && exists(process.env.CC)) return process.env.CC;
  // 2) PATH 上
  try { await execp("gcc --version"); return "gcc"; } catch { }
  try { await execp("clang --version"); return "clang"; } catch { }
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
  } catch { }

  return null;
}

// 取得當前登入學生基本資料（若無則自動建立）
app.get("/api/me", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;

    // 從 Clerk 取使用者資料
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

    // 只 $set 有值的欄位，避免把 name 設成 undefined
    const update = { $setOnInsert: { userId } };
    const toSet = {};
    if (fullName) toSet.name = fullName;
    if (email) toSet.email = email.toLowerCase();
    if (Object.keys(toSet).length) update.$set = toSet;

    // upsert + 回傳最新
    const student = await Student.findOneAndUpdate(
      { userId },
      update,
      { new: true, upsert: true }
    );

    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  const state = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    ok: state === 1,
    stateCode: state,
    stateText: states[state] || "unknown",
    host: mongoose.connection.host || null,
    dbName: mongoose.connection.name || null,
  });
});


app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// 新增：生成流程圖題目的API端點
app.get("/api/generate-question", async (req, res) => {
  try {
    console.log("Generating flowchart question...");
    const question = await generateFlowchartQuestion();
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
app.post("/api/generate-hint", async (req, res) => {
  try {
    const { question, hintLevel } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "未提供題目",
      });
    }

    if (!hintLevel || hintLevel < 1 || hintLevel > 7) {
      return res.status(400).json({
        success: false,
        error: "提示層級無效，應為1-7之間的數字",
      });
    }

    console.log(`Generating hint for level ${hintLevel}...`);
    const hint = await generateFlowchartHint(question, hintLevel);

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
    const result = await checkFlowchart(imageData, question || defaultQuestion);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const result = await checkFlowchart(imageData, question || defaultQuestion);

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

// 新增：生成 PseudoCode 的 API 端點
app.post("/api/generate-pseudocode", async (req, res) => {
  const { question } = req.body;
  const prompt = `你是一位專業的 Python 程式設計助教。請根據下方題目，產生一份 Python PseudoCode，並依據以下規則進行策略性挖空（用 ___ 代表每個空格）：

【挖空規則】
1. 針對流程圖的主要符號內容進行挖空，包括：
   - "開始/結束"（如程式進入點、結束語句）
   - "輸入/輸出"（如 input、print、讀取/顯示資料）
   - "處理"（如變數運算、邏輯處理步驟）
   - "判斷"（如 if/else/elif/while/for 等語法結構本身，必須挖空這些語法關鍵字，而不只是條件內容，讓學生練習流程圖符號與程式語法的對應）
2. 必須讓學生練習組合條件判斷與分支結構（如 if-elif-else、巢狀判斷、複合條件），而不只是填寫 >、<、== 等簡單符號。
3. 優先挖空流程圖中對應的符號內容與邏輯組合，讓學生能練習如何將流程圖的結構轉換為 pseudocode。
4. 挖空內容需能幫助學生理解程式邏輯、流程控制與符號意義，並為第三階段的完整程式撰寫做準備。
5. 不要挖空無意義的細節（如縮排、括號、無關變數名等）。

【特別說明】
- 請務必將 if、elif、else、while、for、input、print 等語法結構本身設為挖空重點，讓學生必須自己寫出這些流程控制語法。
- 例如：
  "___ weather == '下雨':" 讓學生填入 if
  "    ___('準備雨具')" 讓學生填入 print
  "___ temperature < 15:" 讓學生填入 if 或 elif
  "    ___ = ___('請輸入天氣')" 讓學生填入 weather = input

【回傳格式】
請用 JSON 格式回覆，例如：
{
  "pseudoCode": [
    "___ weather == '下雨':",
    "    ___('準備雨具')",
    "___ temperature < 15:",
    "    ___('穿長袖和外套')"
  ],
  "answers": ["if", "print", "elif", "print"]
}

題目如下：
${question}
`;
  try {
    const result = await generatePseudoCode(prompt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const feedback = await checkPseudoCode(question, userPseudoCode);
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
    return res.status(400).json({ success: false, error: "缺少 code 或 language 參數" });
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
  function exists(p) { try { return fsSync.existsSync(p); } catch { return false; } }

  async function pickPython() {
    if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
    try { await execFilep("python3", ["--version"]); return "python3"; } catch {}
    try { await execFilep("python",  ["--version"]); return "python";  } catch {}
    try { await execFilep("py",      ["-3", "--version"]); return "py"; } catch {}
    return null;
  }

  async function pickCCompiler() {
    if (process.env.CC && exists(process.env.CC)) return process.env.CC;
    try { await execFilep("gcc",   ["--version"]); return "gcc";   } catch {}
    try { await execFilep("clang", ["--version"]); return "clang"; } catch {}
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

  let filename, filepath, cleanupFiles = [];

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    if (language === "python") {
      filename = `${id}.py`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const PY = await pickPython();
      if (!PY) {
        await fs.unlink(filepath).catch(()=>{});
        return res.status(400).json({ success: false, error: "後端未安裝 Python（請安裝 python3 或在 .env 設 PYTHON_BIN）" });
      }

      const { stdout, stderr } = await execFilep(PY, PY === "py" ? ["-3", filepath] : [filepath], {
        timeout: 3000, maxBuffer: 1024 * 200,
      });
      await fs.unlink(filepath).catch(()=>{});
      return res.json({ success: true, stdout, stderr });

    } else if (language === "javascript") {
      filename = `${id}.js`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const { stdout, stderr } = await execFilep(process.execPath, [filepath], {
        timeout: 3000, maxBuffer: 1024 * 200,
      });
      await fs.unlink(filepath).catch(()=>{});
      return res.json({ success: true, stdout, stderr });

    } else if (language === "c") {
      filename = `${id}.c`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");

      const CC = await pickCCompiler();
      if (!CC) {
        await fs.unlink(filepath).catch(()=>{});
        return res.status(400).json({
          success: false,
          error: "後端沒有可用的 C 編譯器（請安裝 gcc 或 clang，或在 .env 設 CC=編譯器路徑）",
        });
      }

      const outBase = path.join(tmpDir, `${id}_out`);
      const exePath = isWin ? `${outBase}.exe` : outBase;

      // 編譯
      try {
        await execFilep(CC, [filepath, "-O0", "-o", exePath], { timeout: 8000, maxBuffer: 1024*200 });
      } catch (e) {
        await fs.unlink(filepath).catch(()=>{});
        const stderrMsg = (e.stderr && e.stderr.toString()) || e.err?.message || "compile error";
        // ← 這裡延用你原本的 explainError
        const errorExplanation = await explainError(stderrMsg, language, code);
        return res.json({
          success: false,
          stdout: e.stdout || "",
          stderr: stderrMsg,
          errorExplanation: errorExplanation.explanation,
          errorType: errorExplanation.errorType,
        });
      }

      // 執行
      try {
        const { stdout, stderr } = await execFilep(exePath, [], {
          timeout: 3000, maxBuffer: 1024 * 200,
        });
        await Promise.all([fs.unlink(filepath).catch(()=>{}), fs.unlink(exePath).catch(()=>{})]);
        console.log("CC =", process.env.CC || "auto");
        return res.json({ success: true, stdout, stderr });
      } catch (e) {
        await Promise.all([fs.unlink(filepath).catch(()=>{}), fs.unlink(exePath).catch(()=>{})]);
        return res.json({
          success: false,
          stdout: e.stdout || "",
          stderr: (e.stderr && e.stderr.toString()) || e.err?.message || "runtime error",
        });
      }

    } else {
      return res.status(400).json({ success: false, error: "不支援的語言，目前僅支援 Python、JavaScript、C" });
    }

  } catch (err) {
    // 萬一哪裡 throw，盡量清掉暫存檔
    const del = cleanupFiles.length ? cleanupFiles : (filepath ? [filepath] : []);
    if (del.length) await Promise.all(del.map(f => fs.unlink(f).catch(()=>{})));
    res.status(500).json({ success: false, error: "執行程式時發生錯誤: " + String(err) });
  }
});

// 新增：檢查第三階段程式碼的 API 端點
app.post("/api/check-code", async (req, res) => {
  try {
    const { question, code, language } = req.body;
    if (!question || !code || !language) {
      return res.status(400).json({
        success: false,
        error: "缺少題目、程式碼或語言參數",
      });
    }
    const feedback = await checkCode(question, code, language);
    res.json({ success: true, feedback });
  } catch (error) {
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

// 檢查環境變量
console.log("API Key available:", !!process.env.GEMINI_API_KEY);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log("Environment check:");
  console.log("- PORT:", port);
  console.log("- GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
  console.log("- NODE_ENV:", process.env.NODE_ENV);
});

// 資料表連接
// const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codeflow";

mongoose
  .connect(mongoUri, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,

    //讓 server 選擇逾時更快失敗，除錯友善
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

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
    const { userId } = req.auth; // Clerk 的 user_xxx
    const { questionId, graph, imageBase64, completed = false } = req.body || {};

    if (!questionId) return res.status(400).json({ success: false, error: "questionId 必填" });
    if (!graph && !imageBase64)
      return res.status(400).json({ success: false, error: "需提供 graph 或 imageBase64 其一" });

    const student = await ensureStudent(userId);
    console.log("Student:", student);

    const stage1 = {
      ...(graph ? { graph } : {}),
      ...(imageBase64 ? { imageBase64 } : {}),
      completed,
      updatedAt: new Date(),
    };
    const update = {
      $set: {
        "stages.stage1": stage1,
        studentName: student.name ?? null,               // ✅ 快照
        studentEmail: student.email?.toLowerCase() ?? null,
      },
      $setOnInsert: {
        student: student._id,
        questionId,
      },
    };

    const doc = await Submission.findOneAndUpdate(
      { student: student._id, questionId },  // 只用這兩個當唯一條件
      update,                                // 用我們組好的 update
      { new: true, upsert: true }
    );

    res.status(201).json({ success: true, submissionId: doc._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/get_answer/stage1", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;
    const { questionId } = req.query;
    if (!questionId) return res.status(400).json({ success: false, error: "questionId 必填" });

    const student = await Student.findOne({ userId });
    if (!student) return res.status(404).json({ success: false, error: "學生不存在" });

    const sub = await Submission.findOne({ student: student._id, questionId });
    if (!sub?.stages?.stage1) return res.status(404).json({ success: false, error: "尚無作答" });

    res.json({ success: true, stage1: sub.stages.stage1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});