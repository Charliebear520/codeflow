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
import { exec } from "child_process";

import mongoose from "mongoose";
import Question from "./models/Question.js"; // ← 後端才可以 import

// 加載環境變量
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));// 讓 JSON 進來變成 req.body
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
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

// === 新增：線上執行 Python 程式碼 API ===
app.post("/api/run-code", async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({
      success: false,
      error: "缺少 code 或 language 參數",
    });
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const tmpDir = path.resolve("./temp");
  const id = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let filename,
    filepath,
    execCmd,
    cleanupFiles = [];
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    if (language === "python") {
      filename = `${id}.py`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");
      execCmd = `python3 "${filepath}"`;
      cleanupFiles = [filepath];
    } else if (language === "javascript") {
      filename = `${id}.js`;
      filepath = path.join(tmpDir, filename);
      await fs.writeFile(filepath, code, "utf-8");
      execCmd = `node --input-type=commonjs`;
      cleanupFiles = [filepath];
    } else if (language === "c") {
      filename = `${id}.c`;
      filepath = path.join(tmpDir, filename);
      const outputExe = path.join(tmpDir, `${id}_out`);
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
          }
        );
      });
      execCmd = `"${outputExe}"`;
      cleanupFiles = [filepath, outputExe];
    } else {
      return res.status(400).json({
        success: false,
        error: "不支援的語言，目前僅支援 Python、JavaScript、C",
      });
    }
    // 執行程式，3 秒 timeout
    exec(
      language === "javascript" ? `${execCmd} < "${filepath}"` : execCmd,
      { timeout: 3000, maxBuffer: 1024 * 100 },
      async (error, stdout, stderr) => {
        // 刪除暫存檔案
        await Promise.all(
          cleanupFiles.map((f) => fs.unlink(f).catch(() => {}))
        );
        if (error) {
          return res.json({
            success: false,
            stdout: stdout || "",
            stderr: stderr || error.message,
          });
        }
        res.json({
          success: true,
          stdout,
          stderr,
        });
      }
    );
  } catch (err) {
    // 嘗試清理暫存檔案
    if (cleanupFiles && cleanupFiles.length) {
      await Promise.all(cleanupFiles.map((f) => fs.unlink(f).catch(() => {})));
    }
    res.status(500).json({
      success: false,
      error: "執行程式時發生錯誤: " + err,
    });
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
    useNewUrlParser: true,
    useUnifiedTopology: true,
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
    const { questionId, stage1, stage2, stage3 } = req.body;
    const newQuestion = new Question({ questionId, stage1, stage2, stage3 });
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
            { questionId: new RegExp(q, "i") },
            { stage1: new RegExp(q, "i") },
            { stage2: new RegExp(q, "i") },
            { stage3: new RegExp(q, "i") },
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
app.get("/api/questions/:questionId", async (req, res) => {
  try {
    const doc = await Question.findOne({ questionId: req.params.questionId });
    if (!doc) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, item: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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