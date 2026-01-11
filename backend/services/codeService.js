import { generateContent } from "./geminiService.js";

/**
 * 生成理想程式碼
 * @param {string} questionText - 題目描述
 * @param {string} language - 程式語言 (python/javascript/c)
 * @returns {Promise<{code: string, structure: object}>}
 */
export async function generateIdealCode(questionText, language = "python") {
  const languageMap = {
    python: "Python",
    javascript: "JavaScript",
    c: "C",
  };

  const langName = languageMap[language] || "Python";

  const prompt = `你是一位 ${langName} 程式教學專家，請根據以下題目生成標準的程式碼。

題目：
${questionText}

要求：
1. 語法完全正確，可直接執行
2. 邏輯清晰易懂
3. 包含適當的註解
4. 處理可能的邊界情況
5. 使用最佳實踐
6. 變數命名清晰有意義

請以 JSON 格式回傳，不要包含 markdown 標記：
{
  "code": "完整的程式碼",
  "structure": {
    "functions": ["函數名稱列表"],
    "variables": ["主要變數列表"],
    "controlFlow": ["使用的控制結構，如 if-else, while loop 等"],
    "expectedOutput": "執行後的預期輸出範例"
  }
}`;

  try {
    const result = await generateContent(prompt);
    // 移除可能的 markdown 標記
    const cleanResult = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleanResult);
    return parsed;
  } catch (error) {
    console.error("生成程式碼失敗:", error);
    // 回傳預設結構
    const defaultCode =
      language === "python"
        ? `# ${questionText}\nprint("請實作程式碼")`
        : language === "javascript"
        ? `// ${questionText}\nconsole.log("請實作程式碼");`
        : `// ${questionText}\n#include <stdio.h>\nint main() {\n  printf("請實作程式碼");\n  return 0;\n}`;

    return {
      code: defaultCode,
      structure: {
        functions: [],
        variables: [],
        controlFlow: [],
        expectedOutput: "",
      },
    };
  }
}

/**
 * 比對程式碼
 * @param {object} idealStructure - 理想答案的結構
 * @param {string} studentCode - 學生的程式碼
 * @param {string} language - 程式語言
 * @param {string} questionText - 題目描述（用於智慧提示）
 * @returns {object} {scores, diffs}
 */
export function compareCode(
  idealStructure,
  studentCode,
  language,
  questionText = ""
) {
  const studentLower = studentCode.toLowerCase();

  // 基本語法檢查
  const syntaxErrors = [];

  // Python 語法檢查
  if (language === "python") {
    if (!studentCode.includes("def ") && idealStructure.functions?.length > 0) {
      syntaxErrors.push("可能缺少函數定義");
    }
    if (!studentCode.includes(":")) {
      syntaxErrors.push("可能缺少冒號");
    }
  }

  // JavaScript 語法檢查
  if (language === "javascript") {
    if (
      !studentCode.includes("function") &&
      !studentCode.includes("=>") &&
      idealStructure.functions?.length > 0
    ) {
      syntaxErrors.push("可能缺少函數定義");
    }
    const openBraces = (studentCode.match(/{/g) || []).length;
    const closeBraces = (studentCode.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      syntaxErrors.push("大括號不對稱");
    }
  }

  // C 語法檢查
  if (language === "c") {
    if (!studentCode.includes("main")) {
      syntaxErrors.push("缺少 main 函數");
    }
    if (!studentCode.includes("#include")) {
      syntaxErrors.push("可能缺少標頭檔引入");
    }
  }

  // 檢查變數使用
  const usedVariables =
    idealStructure.variables?.filter((v) => studentCode.includes(v)) || [];
  const missingVariables =
    idealStructure.variables?.filter((v) => !studentCode.includes(v)) || [];

  // 檢查控制結構
  const usedControlFlow =
    idealStructure.controlFlow?.filter((cf) => {
      const cfLower = cf.toLowerCase();
      return (
        studentLower.includes(cfLower) ||
        (cfLower.includes("if") && studentLower.includes("if")) ||
        (cfLower.includes("loop") &&
          (studentLower.includes("for") || studentLower.includes("while")))
      );
    }) || [];
  const missingControlFlow =
    idealStructure.controlFlow?.filter((cf) => !usedControlFlow.includes(cf)) ||
    [];

  // 執行時警告
  const runtimeWarnings = [];
  if (
    language === "python" &&
    !studentCode.includes("input") &&
    questionText.includes("輸入")
  ) {
    runtimeWarnings.push("可能需要處理使用者輸入");
  }
  if (
    !studentCode.includes("if") &&
    !studentCode.includes("?") &&
    questionText.includes("判斷")
  ) {
    runtimeWarnings.push("可能需要條件判斷");
  }

  // 計算分數
  const syntaxScore =
    syntaxErrors.length === 0
      ? 100
      : Math.max(0, 100 - syntaxErrors.length * 20);
  const variableScore =
    idealStructure.variables?.length > 0
      ? (usedVariables.length / idealStructure.variables.length) * 100
      : 100;
  const controlFlowScore =
    idealStructure.controlFlow?.length > 0
      ? (usedControlFlow.length / idealStructure.controlFlow.length) * 100
      : 100;
  const executionScore =
    runtimeWarnings.length === 0
      ? 100
      : Math.max(0, 100 - runtimeWarnings.length * 15);

  const overall =
    (syntaxScore + variableScore + controlFlowScore + executionScore) / 4;

  // 邏輯錯誤
  const logicErrors = [];
  if (missingControlFlow.length > 0) {
    missingControlFlow.forEach((cf) => logicErrors.push(`缺少控制結構: ${cf}`));
  }

  return {
    scores: {
      syntaxCorrectness: Math.round(syntaxScore),
      logicSimilarity: Math.round((variableScore + controlFlowScore) / 2),
      executionSafety: Math.round(executionScore),
      codeQuality: Math.round((syntaxScore + controlFlowScore) / 2),
      overall: Math.round(overall),
    },
    diffs: {
      syntaxErrors,
      logicErrors,
      runtimeWarnings,
      missingFeatures: missingVariables.map((v) => `建議使用變數: ${v}`),
      missingControlFlow: missingControlFlow.map((cf) => `缺少控制結構: ${cf}`),
    },
  };
}

/**
 * 生成程式碼反饋
 * @param {string} questionText - 題目
 * @param {object} ideal - 理想答案
 * @param {string} studentCode - 學生程式碼
 * @param {object} diffs - 差異
 * @param {object} scores - 分數
 * @param {string} language - 程式語言
 * @returns {Promise<string>} AI 生成的反饋文字
 */
export async function generateCodeFeedback(
  questionText,
  ideal,
  studentCode,
  diffs,
  scores,
  language
) {
  const languageMap = {
    python: "Python",
    javascript: "JavaScript",
    c: "C",
  };
  const langName = languageMap[language] || "Python";

  const prompt = `你是一位非常簡潔的國中 ${langName} 程式設計助教。你的任務是根據「理想程式碼」和「學生程式碼」的比對結果，用繁體中文提供引導式建議。

**題目**：
${questionText}

**理想程式碼（標準答案）**：
${ideal.code}

**學生程式碼**：
${studentCode}

**比對結果**：
- 語法正確性：${scores.syntaxCorrectness}%
- 邏輯相似度：${scores.logicSimilarity}%
- 執行安全性：${scores.executionSafety}%
- 程式碼品質：${scores.codeQuality}%
- 總分：${scores.overall}%

**發現的差異**：
${
  diffs.syntaxErrors.length > 0
    ? "語法問題：" + diffs.syntaxErrors.join("、")
    : ""
}
${
  diffs.logicErrors.length > 0
    ? "邏輯問題：" + diffs.logicErrors.join("、")
    : ""
}
${
  diffs.runtimeWarnings.length > 0
    ? "執行警告：" + diffs.runtimeWarnings.join("、")
    : ""
}
${
  diffs.missingFeatures.length > 0
    ? "缺少的功能：" + diffs.missingFeatures.join("、")
    : ""
}

**輸出規則（必須嚴格遵守）**：
1. **絕對不要**自己重新分析題目或給出完整答案。
2. **只根據**上方的「發現的差異」來產生提示。
3. **對比理想程式碼**，用引導式問句指出學生缺少了什麼，例如「是不是少了計算階乘的函數？」或「可以思考看看題目要求要輸出什麼」。
4. **格式規範（極為重要）**：
   - 絕對禁止使用任何符號：不可使用「-」、「•」、「*」、「1.」、「2.」等任何列表符號
   - 使用完整的句子段落，每個建議寫成一段完整的話
   - 建議之間用一個空行分隔
   - 每個建議都是獨立的段落，不要編號或加符號
5. **長度**：總字數嚴格控制在 150 字以內。
6. **如果差異很少**：就說「做得很好！程式碼架構很完整。」
7. **語言**：僅使用繁體中文。

請僅輸出建議文字，不要包含任何標題或額外說明。`;

  try {
    const feedback = await generateContent(prompt);
    return feedback;
  } catch (error) {
    console.error("生成程式碼反饋失敗:", error);
    return `程式碼分析完成，總分為 ${scores.overall} 分。${
      diffs.syntaxErrors.length > 0 ? "建議檢查語法問題。" : ""
    }${diffs.logicErrors.length > 0 ? "建議改善程式邏輯。" : ""}${
      diffs.runtimeWarnings.length > 0 ? "建議注意執行時的潛在問題。" : ""
    }`;
  }
}
