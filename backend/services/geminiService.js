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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

// 新增：生成流程圖提示的函數
export const generateFlowchartHint = async (question, hintLevel) => {
  try {
    console.log(`Generating flowchart hint... Level: ${hintLevel}`);
    
    // 使用 gemini-1.5-pro 模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 根據不同層級生成不同的提示
    const promptBase = `基於以下流程圖題目：「${question}」

    請生成第${hintLevel}層的繪圖提示，符合下列標準：`;
    
    let promptDetails = "";
    switch(hintLevel) {
      case 1:
        promptDetails = `第一層提示：判斷版面是否空白，學生是否完全不明白該如何開始。
        提供關於題目理解與流程圖基本格式的指導。
        從理解題目開始，解釋如何開始繪製流程圖的第一步。`;
        break;
      case 2:
        promptDetails = `第二層提示：判斷起止符號的使用。
        提供關於如何正確放置起始和結束符號的指導。
        解釋這些符號在流程圖中的重要性和位置。`;
        break;
      case 3:
        promptDetails = `第三層提示：判斷輸入符號的使用。
        提供關於如何識別和放置輸入符號的指導。
        根據題目內容，指出哪些是輸入條件或資訊。`;
        break;
      case 4:
        promptDetails = `第四層提示：判斷步驟/處理符號的使用。
        提供關於如何使用處理符號表示各個步驟的指導。
        根據題目，指出需要哪些處理步驟。`;
        break;
      case 5:
        promptDetails = `第五層提示：判斷決策符號的使用。
        重點提供關於如何使用菱形決策符號表示判斷點的指導。
        指出題目中需要做出哪些決策，以及如何正確表示"是"和"否"的路徑。`;
        break;
      case 6:
        promptDetails = `第六層提示：判斷流程符號的連接。
        提供關於如何用箭頭正確連接各個符號的指導。
        解釋如何確保流程的邏輯順序和完整性。`;
        break;
      case 7:
        promptDetails = `第七層提示：整體診斷與完善。
        提供關於如何檢查整個流程圖的完整性和邏輯性的指導。
        指出常見的錯誤和如何修正它們。`;
        break;
      default:
        promptDetails = `提供一般性的流程圖繪製指導。`;
    }

    const prompt = `${promptBase}
    
    ${promptDetails}
    
    要求：
    1. 使用友善、引導式的語氣
    2. 針對題目內容提供具體的例子和建議
    3. 提示應該循序漸進，不要一次揭露所有答案
    4. 使用繁體中文回答
    5. 回答控制在200字以內，直接切入重點
    
    只提供提示內容，不要包含標題或其他格式。`;

    console.log("Sending hint generation request to Gemini API...");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating flowchart hint:", error);
    throw new Error(`Gemini API hint generation error: ${error.message}`);
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
