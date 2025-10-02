import express from "express";
import cors from "cors";
import dotenv from "dotenv";

const app = express();

// 加載環境變數（僅在非生產環境）
if (process.env.NODE_ENV !== 'production') {
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
        error: "GEMINI_API_KEY not set" 
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
      error: error.message 
    });
  }
});

export default app;
