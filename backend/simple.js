import express from "express";
import cors from "cors";
import dotenv from "dotenv";

const app = express();

// 加載環境變數（僅在非生產環境）
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// 基本中間件
app.use(cors());
app.use(express.json());

// 測試端點
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Simple API is working" });
});

// 環境變數測試
app.get("/api/test-env", (req, res) => {
  res.json({
    success: true,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasMongoUri: !!process.env.MONGO_URI,
    nodeEnv: process.env.NODE_ENV,
  });
});

// 簡化的Gemini測試
app.get("/api/test-gemini", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY not set",
      });
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent("Say 'Hello World'");
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      message: "Gemini API is working",
      response: text,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 生成PseudoCode端點
app.post("/api/generate-pseudocode", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "缺少題目參數",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY not set",
      });
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `你是一位專業的 Python 程式設計助教。請根據下方題目，產生一份 Python PseudoCode，並依據以下規則進行策略性挖空（用 ___ 代表每個空格）：

【挖空規則】
1. 針對流程圖的主要符號內容進行挖空，包括：
   - "開始/結束"（如程式進入點、結束語句）
   - "輸入/輸出"（如 input、print、讀取/顯示資料）
   - "處理"（如變數運算、邏輯處理步驟）
   - "判斷"（如 if/else/elif/while/for 等語法結構本身）

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
${question}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // 去除 markdown code block
    text = text.replace(/^```json\s*|^```\s*|```$/gm, "").trim();

    try {
      const parsedResult = JSON.parse(text);
      res.json(parsedResult);
    } catch (e) {
      console.error("JSON parsing error:", text);
      res.status(500).json({
        success: false,
        error: "Gemini 回傳內容不是合法 JSON",
      });
    }
  } catch (error) {
    console.error("Pseudocode generation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default app;
