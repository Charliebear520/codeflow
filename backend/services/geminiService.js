import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// 確保環境變量被加載
dotenv.config();

// 使用新的環境變量名稱
if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 新增：生成流程圖題目的函數
export const generateFlowchartQuestion = async () => {
  try {
    console.log("Generating flowchart question...");
    
    // 使用 gemini-1.5-pro 模型
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `生成一個流程圖練習題目，使用繁體中文。
    題目應該要求學生為簡單的日常決策過程創建一個流程圖。
    格式：「請根據下方敘述繪製流程圖。[情境描述]」
    要求：
    1. 適合初學者學習流程圖
    2. 包含3-5個決策點
    3. 情境要生活化且具體
    4. 確保需要用到判斷符號
    5. 長度控制在50-100字之間
    
    只返回題目文本，不要包含任何其他說明或格式。`;

    console.log("Sending question generation request to Gemini API...");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating flowchart question:", error);
    throw new Error(`Gemini API question generation error: ${error.message}`);
  }
};

export const checkFlowchart = async (imageData, question) => {
  try {
    console.log("Starting flowchart check...");
    console.log("API Key available:", !!process.env.GEMINI_API_KEY); // 檢查 API key 是否存在

    if (!imageData) {
      throw new Error("No image data provided");
    }

    // 使用新的模型名稱 gemini-1.5-pro
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // 修改：根據傳入的題目動態生成 prompt
    const prompt = `題目：${question}
    
    請分析這個針對上述題目繪製的流程圖並提供詳細的回饋：
    1. 流程圖的基本結構是否完整？（包含開始、結束節點）
    2. 判斷節點的邏輯是否清晰？是否正確使用了判斷符號？
    3. 流程的連接是否正確？
    4. 流程圖是否正確解決了題目所述問題？
    5. 如果有任何問題，請提供具體的改進建議。

    請用以下格式回答：
    題目理解準確性：[評估]
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
