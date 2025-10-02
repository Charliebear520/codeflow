import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
import { explainError } from "./services/errorExplainer.js";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

import mongoose from "mongoose";
import Question from "./models/Question.js"; // ← 後端才可以 import
// import { clerkMiddleware, getAuth } from "@clerk/express"; // 暫時禁用以避免導入問題

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

// 加載環境變量（僅在非生產環境）
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const port = process.env.PORT || 5000;
const app = express();

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
  "https://codeflow-teal.vercel.app",
  "https://codeflow-charliebear520s-projects.vercel.app",
].filter(Boolean);
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // 例如 Postman 或同源
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
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
app.use(express.json({ limit: "50mb" })); // 讓 JSON 進來變成 req.body
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// app.use(clerkMiddleware()); // 暫時禁用

// const imagekit = new ImageKit({ // 暫時註解掉
//   urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
//   publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
//   privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
// });

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

// 教師角色
function requireTeacher(req, res, next) {
  try {
    const auth = getAuth(req) || {};
    const userId = auth.userId;
    const orgRole = auth.orgRole;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (orgRole === "teacher" || orgRole === "org:admin") {
      return next();
    }

    return res.status(403).json({ success: false, error: "Forbidden" });
  } catch (e) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
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
    const geminiServices = await loadGeminiServices();
    const hint = await geminiServices.generateFlowchartHint(
      question,
      hintLevel
    );

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
      question || defaultQuestion
    );
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
    const geminiServices = await loadGeminiServices();
    const result = await geminiServices.checkFlowchart(
      imageData,
      question || defaultQuestion
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
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "缺少題目參數",
      });
    }

    console.log("Generating pseudocode for question:", question);

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

    console.log("Calling Gemini API for pseudocode generation...");
    console.log("Prompt:", prompt);

    const geminiServices = await loadGeminiServices();
    console.log("Gemini services loaded successfully");

    try {
      const result = await geminiServices.generatePseudoCode(prompt);
      console.log("Pseudocode generation successful:", result);
      res.json(result);
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
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
      console.log("Using fallback result:", fallbackResult);
      res.json(fallbackResult);
    }
  } catch (err) {
    console.error("Pseudocode generation error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
      details: "Pseudocode generation failed",
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
      userPseudoCode
    );
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
      // 跨平台Python命令檢測
      const pythonCmd = await getPythonCommand();
      execCmd = `${pythonCmd} "${filepath}"`;
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
      {
        timeout: 3000,
        maxBuffer: 1024 * 100,
        encoding: "utf8", // 強制使用UTF-8編碼
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8", // 設定Python的I/O編碼
          LANG: "en_US.UTF-8", // 設定語言環境
          LC_ALL: "en_US.UTF-8", // 設定所有本地化設定
        },
      },
      async (error, stdout, stderr) => {
        // 刪除暫存檔案
        await Promise.all(
          cleanupFiles.map((f) => fs.unlink(f).catch(() => {}))
        );
        if (error) {
          // 使用AI錯誤解釋
          const errorExplanation = await explainError(
            stderr || error.message,
            language,
            code
          );

          return res.json({
            success: false,
            stdout: stdout || "",
            stderr: stderr || error.message,
            errorExplanation: errorExplanation.explanation,
            errorType: errorExplanation.errorType,
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
  const path = await import("path");
  const tmpDir = "/tmp";
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
          }
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
    const geminiServices = await loadGeminiServices();
    const feedback = await geminiServices.checkCode(question, code, language);
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

// 教師後台資料：僅教師可訪問
app.get("/api/admin/submissions", requireTeacher, async (req, res) => {
  try {
    // 範例：回傳最近題目（實際可換為作答紀錄）
    const latest = await Question.find({}).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, items: latest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      "Hello, this is a test. Please respond with 'API is working'."
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

// 啟動服務器 - 適配Vercel無服務器函數
if (process.env.NODE_ENV !== "production") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log("Environment check:");
    console.log("- PORT:", port);
    console.log("- GEMINI_API_KEY available:", !!process.env.GEMINI_API_KEY);
    console.log("- NODE_ENV:", process.env.NODE_ENV);
  });
}

// 導出app供Vercel使用
export default app;

// 資料表連接
// const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codeflow";

mongoose
  .connect(mongoUri)
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
    if (!doc)
      return res.status(404).json({ success: false, error: "Not found" });
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
