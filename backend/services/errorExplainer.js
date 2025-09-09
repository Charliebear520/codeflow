import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 錯誤類型
const ERROR_TYPES = {
  // JavaScript 錯誤
  ReferenceError: "RE", // Runtime Error
  TypeError: "RE",
  SyntaxError: "CE", // Compilation Error
  RangeError: "RE",
  URIError: "RE",
  EvalError: "RE",

  // Python 錯誤
  NameError: "RE",
  TypeError: "RE",
  SyntaxError: "CE",
  IndentationError: "CE",
  AttributeError: "RE",
  IndexError: "RE",
  KeyError: "RE",
  ZeroDivisionError: "RE",
  FileNotFoundError: "RE",
  ImportError: "CE",
  ModuleNotFoundError: "CE",

  // C 錯誤
  "segmentation fault": "RE",
  "floating point exception": "RE",
  "bus error": "RE",
  abort: "RE",
};

// 獲取錯誤類型和具體分析
function analyzeError(errorMessage, language) {
  const message = errorMessage.toLowerCase();

  // JavaScript 特定錯誤分析
  if (language === "javascript") {
    if (message.includes("referenceerror")) {
      if (message.includes("is not defined")) {
        return {
          type: "RE",
          specificError: "未定義的變數或函數",
          suggestion: "檢查變數名或函數名是否拼寫正確，確保在使用前已經定義",
        };
      }
    }
    if (message.includes("syntaxerror")) {
      if (message.includes("unexpected token")) {
        return {
          type: "CE",
          specificError: "語法錯誤",
          suggestion: "檢查括號、引號、分號等語法符號是否配對正確",
        };
      }
    }
    if (message.includes("typeerror")) {
      return {
        type: "RE",
        specificError: "類型錯誤",
        suggestion: "檢查變數類型是否正確，確保函數參數類型匹配",
      };
    }
  }

  // Python 特定錯誤分析
  if (language === "python") {
    if (message.includes("indentationerror")) {
      return {
        type: "CE",
        specificError: "縮進錯誤",
        suggestion:
          "檢查程式碼縮進是否正確，確保使用一致的縮進方式（空格或制表符）",
      };
    }
    if (message.includes("nameerror")) {
      if (message.includes("is not defined")) {
        return {
          type: "RE",
          specificError: "未定義的變數",
          suggestion: "檢查變數名是否拼寫正確，確保在使用前已經定義",
        };
      }
    }
    if (message.includes("syntaxerror")) {
      return {
        type: "CE",
        specificError: "語法錯誤",
        suggestion: "檢查語法是否正確，如冒號、括號等",
      };
    }
    if (message.includes("zerodivisionerror")) {
      return {
        type: "RE",
        specificError: "除零錯誤",
        suggestion: "檢查除數是否為零，添加條件判斷避免除零",
      };
    }
  }

  // C 特定錯誤分析
  if (language === "c") {
    if (message.includes("segmentation fault")) {
      return {
        type: "RE",
        specificError: "段錯誤",
        suggestion: "檢查指針使用是否正確，避免訪問無效記憶體地址",
      };
    }
    if (message.includes("floating point exception")) {
      return {
        type: "RE",
        specificError: "浮點異常",
        suggestion: "檢查浮點運算，避免除零或無效運算",
      };
    }
  }

  // 通用錯誤分析
  if (
    message.includes("syntax error") ||
    message.includes("compilation failed") ||
    (message.includes("expected") && message.includes("but found")) ||
    (message.includes("missing") && message.includes("semicolon")) ||
    message.includes("unexpected token") ||
    message.includes("indentation error") ||
    message.includes("invalid syntax")
  ) {
    return {
      type: "CE",
      specificError: "編譯錯誤",
      suggestion: "檢查程式碼語法，確保所有語法符號正確",
    };
  }

  if (message.includes("timeout") || message.includes("time limit exceeded")) {
    return {
      type: "TL",
      specificError: "執行超時",
      suggestion: "檢查是否有無限迴圈，優化演算法效率",
    };
  }

  // 默認運行時的錯誤
  return {
    type: "RE",
    specificError: "運行時錯誤",
    suggestion: "檢查程式邏輯，確保所有變數和函數都正確定義",
  };
}

// 使用LLM解释錯誤
async function explainErrorWithLLM(errorMessage, language, code) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `你是一位友善的程式設計助教，專門幫助初學者理解程式錯誤。

請根據以下資訊，用簡單易懂的中文解釋這個程式錯誤：

**程式語言**: ${language}
**錯誤訊息**: ${errorMessage}
**程式碼**: 
\`\`\`${language}
${code}
\`\`\`

請提供以下格式的回應：

錯誤類型: [CE/RE/TL/WA/AC]
- CE = Compilation Error (編譯錯誤)
- RE = Runtime Error (執行時錯誤)  
- TL = Time Limit Exceeded (執行時間超限)
- WA = Wrong Answer (答案錯誤)
- AC = Accepted (正確)

白話解釋: 用簡單的中文解釋這個錯誤是什麼意思

常見原因: 列出2-3個可能造成這個錯誤的常見原因

解決建議: 提供具體的解決方法或建議

範例修正: 如果可能的話，提供一個簡單的修正範例

請用友善、鼓勵的語氣，避免使用太多技術術語，讓初學者能夠理解。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("LLM error explanation failed:", error);
    return null;
  }
}

// 主要錯誤解释函数
export async function explainError(errorMessage, language, code = "") {
  try {
    // 首先嘗試使用LLM解释
    const llmExplanation = await explainErrorWithLLM(
      errorMessage,
      language,
      code
    );

    if (llmExplanation) {
      const analysis = analyzeError(errorMessage, language);
      return {
        success: true,
        explanation: llmExplanation,
        errorType: analysis.type,
        specificError: analysis.specificError,
        suggestion: analysis.suggestion,
      };
    }

    // 如果LLM失敗，使用預設的錯誤解释
    return getFallbackExplanation(errorMessage, language);
  } catch (error) {
    console.error("Error explanation failed:", error);
    return getFallbackExplanation(errorMessage, language);
  }
}

// 備用錯誤解释
function getFallbackExplanation(errorMessage, language) {
  const analysis = analyzeError(errorMessage, language);

  const explanations = {
    CE: {
      title: "編譯錯誤 (Compilation Error)",
      explanation: "程式碼有語法錯誤，無法編譯執行。",
      commonCauses: [
        "缺少分號、括號或其他語法符號",
        "變數名稱拼寫錯誤",
        "縮排不正確（Python）",
        "使用了未定義的函數或變數",
      ],
      suggestions: [
        "仔細檢查程式碼的語法",
        "確認所有括號、引號都正確配對",
        "檢查變數名稱是否正確拼寫",
        "使用程式編輯器的語法檢查功能",
      ],
    },
    RE: {
      title: "執行時錯誤 (Runtime Error)",
      explanation: "程式可以編譯，但在執行時發生錯誤。",
      commonCauses: [
        "除以零",
        "存取不存在的陣列元素",
        "呼叫不存在的函數",
        "檔案不存在",
      ],
      suggestions: [
        "檢查變數的值是否正確",
        "確認陣列索引是否在有效範圍內",
        "檢查函數名稱是否正確",
        "加入除錯訊息來找出問題",
      ],
    },
    TL: {
      title: "執行時間超限 (Time Limit Exceeded)",
      explanation: "程式執行時間超過限制。",
      commonCauses: ["程式進入無限迴圈", "演算法效率太低", "程式邏輯有問題"],
      suggestions: [
        "檢查迴圈是否有正確的結束條件",
        "優化演算法效率",
        "檢查程式邏輯是否正確",
      ],
    },
  };

  const explanation = explanations[analysis.type] || explanations["RE"];

  return {
    success: true,
    explanation: `錯誤類型: ${analysis.type}\n\n具體錯誤: ${analysis.specificError}\n\n白話解釋: ${explanation.explanation}`,
    errorType: analysis.type,
    specificError: analysis.specificError,
    suggestion: analysis.suggestion,
  };
}
