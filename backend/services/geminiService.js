import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import axios from "axios";

// 確保環境變量被加載（僅在本地開發環境）
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// 延遲初始化Gemini AI，避免在模組載入時就檢查環境變數
let genAI = null;

const getGenAI = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY in environment variables");
      throw new Error("Missing GEMINI_API_KEY in environment variables");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

// 第一階段：生成流程圖題目
export const generateFlowchartQuestion = async () => {
  try {
    console.log("Generating flowchart question...");

    // 使用 gemini模型
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `你是一位專業的中文教育題目生成器，請**嚴格遵守**以下要求。

    **核心任務：**生成一個流程圖練習題目。
    **語言要求：**必須且只能使用**繁體中文**。
    
    題目內容：應該要求學生為簡單的日常決策過程創建一個流程圖。
    格式：**只返回題目文本**，格式為：「請根據下方敘述繪製流程圖。[情境描述]」
    
    **重要要求清單 (必須全部滿足)：**
    1. 適合初學者學習流程圖
    2. 包含3-5個決策點
    3. 情境要生活化且具體
    4. 確保需要用到菱形判斷符號
    5. 內容長度必須控制在50-100字之間
    6. **再次強調：所有輸出文字必須是繁體中文。**
    
    只返回題目文本，不包含任何額外的說明、註解或標題。`;

    console.log("Sending question generation request to Gemini API...");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating flowchart question:", error);
    throw new Error(`Gemini API question generation error: ${error.message}`);
  }
};

// 第一階段：生成流程圖提示
export const generateFlowchartHint = async (question, hintLevel) => {
  try {
    console.log(`Generating flowchart hint... Level: ${hintLevel}`);

    // 使用 gemini-2.0-flash 模型
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

    // 根據不同層級生成不同的提示
    const promptBase = `基於以下流程圖題目：「${question}」

    請生成第${hintLevel}層的繪圖提示，符合下列標準：`;

    let promptDetails = "";
    switch (hintLevel) {
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
        promptDetails = `第六層提示：判斷輸入/輸出符號的連接。
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

// 第一階段：檢查流程圖
export const checkFlowchart = async (imageData, question) => {
  try {
    console.log("Starting flowchart check...");
    console.log("API Key available:", !!process.env.GEMINI_API_KEY); // 檢查 API key 是否存在

    if (!imageData) {
      throw new Error("No image data provided");
    }

    // 使用新的模型名稱 gemini-2.0-flash
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

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

// 第二階段：生成PseudoCode
export const generatePseudoCode = async (prompt) => {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // 去除 markdown code block（如 ```json ... ``` 或 ``` ... ```）
  text = text.replace(/^```json\s*|^```\s*|```$/gm, "").trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini 回傳內容不是合法 JSON：", text);
    throw new Error(
      "Gemini 回傳內容不是合法 JSON，請檢查 prompt 或 API 回應格式"
    );
  }
};

// 第二階段：檢查PseudoCode
export const checkPseudoCode = async (question, userPseudoCode) => {
  try {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `你是一位程式教學助教。請根據下方題目，檢查學生撰寫的虛擬碼（pseudocode）是否正確，並用繁體中文給予回饋：
---
題目：${question}
---
學生虛擬碼：
${userPseudoCode}
---
請依下列格式回覆：
1. 邏輯正確性：[簡要評語]
2. 語意完整性：[簡要評語]
3. 改進建議：[具體建議]

請勿直接給出完整答案，請以引導為主。`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error checking pseudocode:", error);
    throw new Error(`Gemini API pseudocode check error: ${error.message}`);
  }
};

// 第三階段：檢查Code
export const checkCode = async (question, code, language) => {
  try {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `你是一位專業的程式教學助教。請根據下方題目與學生撰寫的程式碼，檢查其語法、邏輯與結構，並用繁體中文給予詳細回饋：
---
題目：${question}
---
學生程式碼（語言：${language}）：
${code}
---
請依下列格式回覆：
1. 語法正確性：[簡要評語]
2. 邏輯完整性：[簡要評語]
3. 改進建議：[具體建議]

請勿直接給出完整答案，請以引導為主。`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error checking code:", error);
    throw new Error(`Gemini API code check error: ${error.message}`);
  }
};
