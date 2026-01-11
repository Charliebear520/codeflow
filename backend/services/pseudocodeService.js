import { generateContent } from "./geminiService.js";

/**
 * 生成理想虛擬碼
 * @param {string} questionText - 題目描述
 * @returns {Promise<{pseudocode: string, structure: object}>}
 */
export async function generateIdealPseudocode(questionText) {
  const prompt = `你是一位程式教學專家，請根據以下題目生成標準的虛擬碼（Pseudocode）。

題目：
${questionText}

要求：
1. 使用清晰的邏輯結構（BEGIN/END, IF/ELSE/ENDIF, WHILE/ENDWHILE等）
2. 明確列出所有需要的變數
3. 包含所有必要的條件判斷
4. 使用適當的迴圈結構
5. 遵循虛擬碼標準慣例
6. 加入必要的註解說明

請以 JSON 格式回傳，不要包含 markdown 標記：
{
  "pseudocode": "完整的虛擬碼文字",
  "structure": {
    "variables": ["變數1", "變數2"],
    "conditions": ["條件1", "條件2"],
    "loops": ["迴圈類型"],
    "logicFlow": ["步驟1", "步驟2", "步驟3"]
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
    console.error("生成虛擬碼失敗:", error);
    // 回傳預設結構
    return {
      pseudocode: `BEGIN\n  // 根據題目生成的虛擬碼\n  ${questionText}\nEND`,
      structure: {
        variables: [],
        conditions: [],
        loops: [],
        logicFlow: [],
      },
    };
  }
}

/**
 * 比對虛擬碼
 * @param {object} idealStructure - 理想答案的結構
 * @param {string} studentPseudocode - 學生的虛擬碼
 * @param {string} questionText - 題目描述（用於智慧提示）
 * @returns {object} {scores, diffs}
 */
export function comparePseudocode(
  idealStructure,
  studentPseudocode,
  questionText = ""
) {
  const studentLower = studentPseudocode.toLowerCase();

  // 檢查變數使用
  const usedVariables =
    idealStructure.variables?.filter((v) =>
      studentLower.includes(v.toLowerCase())
    ) || [];
  const missingVariables =
    idealStructure.variables?.filter(
      (v) => !studentLower.includes(v.toLowerCase())
    ) || [];

  // 檢查條件判斷
  const usedConditions =
    idealStructure.conditions?.filter(
      (c) =>
        studentLower.includes(c.toLowerCase()) ||
        studentLower.includes("if") ||
        studentLower.includes("else")
    ) || [];
  const missingConditions =
    idealStructure.conditions?.filter(
      (c) => !studentLower.includes(c.toLowerCase())
    ) || [];

  // 檢查迴圈
  const hasLoops =
    studentLower.includes("while") ||
    studentLower.includes("for") ||
    studentLower.includes("repeat");
  const missingLoops =
    !hasLoops && idealStructure.loops?.length > 0 ? idealStructure.loops : [];

  // 檢查邏輯流程
  const missingLogic =
    idealStructure.logicFlow?.filter(
      (logic) => !studentLower.includes(logic.toLowerCase().substring(0, 10))
    ) || [];

  // 計算分數
  const variableScore =
    idealStructure.variables?.length > 0
      ? (usedVariables.length / idealStructure.variables.length) * 100
      : 100;
  const conditionScore =
    idealStructure.conditions?.length > 0
      ? (usedConditions.length / idealStructure.conditions.length) * 100
      : 100;
  const loopScore =
    idealStructure.loops?.length > 0 ? (hasLoops ? 100 : 0) : 100;
  const logicScore =
    idealStructure.logicFlow?.length > 0
      ? ((idealStructure.logicFlow.length - missingLogic.length) /
          idealStructure.logicFlow.length) *
        100
      : 100;

  const overall = (variableScore + conditionScore + loopScore + logicScore) / 4;

  // 結構問題
  const structureIssues = [];
  if (!studentLower.includes("begin") && !studentLower.includes("start")) {
    structureIssues.push("缺少程式開始標記");
  }
  if (!studentLower.includes("end") && !studentLower.includes("stop")) {
    structureIssues.push("缺少程式結束標記");
  }

  return {
    scores: {
      logicSimilarity: Math.round(logicScore),
      structureCompleteness: Math.round((variableScore + conditionScore) / 2),
      variableUsage: Math.round(variableScore),
      controlFlow: Math.round((conditionScore + loopScore) / 2),
      overall: Math.round(overall),
    },
    diffs: {
      missingLogic: missingLogic.map((l) => `缺少邏輯: ${l}`),
      incorrectConditions: missingConditions.map((c) => `缺少條件判斷: ${c}`),
      missingVariables: missingVariables.map((v) => `缺少變數: ${v}`),
      missingLoops:
        missingLoops.length > 0
          ? [`需要使用迴圈: ${missingLoops.join(", ")}`]
          : [],
      structureIssues,
    },
  };
}

/**
 * 生成虛擬碼反饋
 * @param {string} questionText - 題目
 * @param {object} ideal - 理想答案
 * @param {string} studentPseudocode - 學生虛擬碼
 * @param {object} diffs - 差異
 * @param {object} scores - 分數
 * @returns {Promise<string>} AI 生成的反饋文字
 */
export async function generatePseudocodeFeedback(
  questionText,
  ideal,
  studentPseudocode,
  diffs,
  scores
) {
  const prompt = `你是一位非常簡潔的國中程式設計助教。你的任務是根據「理想虛擬碼」和「學生虛擬碼」的比對結果，用繁體中文提供引導式建議。

**題目**：
${questionText}

**理想虛擬碼（標準答案）**：
${ideal.pseudocode}

**學生虛擬碼**：
${studentPseudocode}

**比對結果**：
- 邏輯相似度：${scores.logicSimilarity}%
- 結構完整度：${scores.structureCompleteness}%
- 變數使用：${scores.variableUsage}%
- 控制流程：${scores.controlFlow}%
- 總分：${scores.overall}%

**發現的差異**：
${
  diffs.missingLogic.length > 0
    ? "缺少的邏輯：" + diffs.missingLogic.join("、")
    : ""
}
${
  diffs.missingVariables.length > 0
    ? "缺少的變數：" + diffs.missingVariables.join("、")
    : ""
}
${
  diffs.incorrectConditions.length > 0
    ? "條件問題：" + diffs.incorrectConditions.join("、")
    : ""
}
${
  diffs.missingLoops.length > 0
    ? "缺少的迴圈：" + diffs.missingLoops.join("、")
    : ""
}
${
  diffs.structureIssues.length > 0
    ? "結構問題：" + diffs.structureIssues.join("、")
    : ""
}

**輸出規則（必須嚴格遵守）**：
1. **絕對不要**自己重新分析題目或給出完整答案。
2. **只根據**上方的「發現的差異」來產生提示。
3. **對比理想虛擬碼**，用引導式問句指出學生缺少了什麼，例如「是不是少了計算階乘的邏輯？」或「可以思考看看需要哪些變數來儲存結果」。
4. **格式規範（極為重要）**：
   - 絕對禁止使用任何符號：不可使用「-」、「•」、「*」、「1.」、「2.」等任何列表符號
   - 使用完整的句子段落，每個建議寫成一段完整的話
   - 建議之間用一個空行分隔
   - 每個建議都是獨立的段落，不要編號或加符號
5. **長度**：總字數嚴格控制在 150 字以內。
6. **如果差異很少**：就說「做得很好！虛擬碼架構很完整。」
7. **語言**：僅使用繁體中文。

請僅輸出建議文字，不要包含任何標題或額外說明。`;

  try {
    const feedback = await generateContent(prompt);
    return feedback;
  } catch (error) {
    console.error("生成虛擬碼反饋失敗:", error);
    return `虛擬碼分析完成，總分為 ${scores.overall} 分。${
      diffs.missingLogic.length > 0 ? "建議加強邏輯流程的完整性。" : ""
    }${diffs.missingVariables.length > 0 ? "建議檢查變數的使用。" : ""}${
      diffs.structureIssues.length > 0 ? "建議改善程式結構。" : ""
    }`;
  }
}
