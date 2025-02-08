import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// 確保環境變量被加載
dotenv.config();

// 使用新的環境變量名稱
if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const checkFlowchart = async (imageData) => {
  try {
    console.log("Starting flowchart check...");
    console.log("API Key available:", !!process.env.GEMINI_API_KEY); // 檢查 API key 是否存在

    if (!imageData) {
      throw new Error("No image data provided");
    }

    // 使用新的模型名稱 gemini-1.5-pro
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `請分析這個流程圖並提供詳細的回饋：
    1. 流程圖的基本結構是否完整？（包含開始、結束節點）
    2. 判斷節點的邏輯是否清晰？
    3. 流程的連接是否正確？
    4. 如果有任何問題，請提供具體的改進建議。

    請用以下格式回答：
    結構完整性：[評估]
    邏輯清晰度：[評估]
    連接正確性：[評估]
    改進建議：[具體建議]`;

    console.log("Sending request to Gemini API...");

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: "image/png",
        },
      },
    ]);

    console.log("Received response from Gemini API");
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Detailed Gemini API error:", error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};
