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

**題目**：${questionText}

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

**⚠️ 絕對限制（違反將視為無效輸出）**：
1. 總字數：**嚴格限制在 150 字以內**（包含標點符號）
2. 格式：**絕對禁止**使用任何符號：-、•、*、1.、2.、3. 等
3. 風格：每個建議寫成完整句子，用空行分隔，不編號

**輸出規則**：
1. **絕對不要**自己重新分析題目或給出完整答案
2. **只根據**上方的「發現的差異」來產生提示
3. **對比理想虛擬碼**，用引導式問句指出學生缺少了什麼，例如「是不是少了計算階乘的邏輯？」
4. **字數檢查**：完成後請自行確認總字數 ≤ 150 字
5. **如果差異很少**：就說「做得很好！虛擬碼架構很完整。」（限 20 字內）
6. **語言**：僅使用繁體中文

請僅輸出建議文字，不要包含任何標題、字數統計或額外說明。`;

  try {
    const feedback = await generateContent(prompt);

    // ========== 字數驗證與截斷 ==========
    const charCount = feedback.length;
    console.log(`📏 AI 回應字數: ${charCount} 字`);

    let finalFeedback = feedback;
    if (charCount > 150) {
      console.warn(`⚠️ 超過限制！原始 ${charCount} 字，將截斷至 150 字`);
      finalFeedback = feedback.substring(0, 147) + "...";
      console.log(`✂️ 截斷後: ${finalFeedback.length} 字`);
    }

    // 移除任何意外的列表符號
    finalFeedback = finalFeedback
      .replace(/^[\-\•\*]\s*/gm, "") // 移除行首符號
      .replace(/^\d+\.\s*/gm, "") // 移除數字編號
      .replace(/\n{3,}/g, "\n\n"); // 統一空行為兩個換行

    console.log("✅ 虛擬碼反饋字數:", finalFeedback.length, "字");
    return finalFeedback;
  } catch (error) {
    console.error("生成虛擬碼反饋失敗:", error);

    const tips = [];
    if (diffs.missingLogic.length > 0) {
      tips.push("可以思考看看邏輯流程是否完整");
    }
    if (diffs.missingVariables.length > 0) {
      tips.push("是不是少了某些重要的變數");
    }
    if (diffs.structureIssues.length > 0) {
      tips.push("虛擬碼的開頭結尾標記需要留意");
    }

    if (tips.length === 0) {
      return "做得很好！虛擬碼架構很完整。";
    }

    // 確保不超過 150 字
    const scoreText = `虛擬碼分析完成總分為 ${scores.overall} 分`;
    let tipsText = tips.slice(0, 2).join("\n\n"); // 最多兩個提示

    return `${scoreText}\n\n${tipsText}`;
  }
}

/**
 * 生成虛擬碼檢查報告（≤150字）
 * 用於「檢查」按鈕，列出具體問題點
 */
export async function generatePseudocodeCheckReport(diffs) {
  const prompt = `你是程式教學專家。請根據以下虛擬碼比對結果，生成一份簡潔的檢查報告，列出學生作答中的具體問題點。

比對結果：
- 缺少邏輯：${JSON.stringify(diffs.missingLogic || [])}
- 錯誤條件：${JSON.stringify(diffs.incorrectConditions || [])}
- 缺少變數：${JSON.stringify(diffs.missingVariables || [])}
- 缺少迴圈：${JSON.stringify(diffs.missingLoops || [])}
- 結構問題：${JSON.stringify(diffs.structureIssues || [])}

請生成格式如下（**每個問題類別獨立一行，類別之間用換行分隔**）：
缺少邏輯：輸入驗證、結果輸出

錯誤條件：迴圈條件應為 < 而非 <=

缺少變數：counter、sum

要求：
1. 只列出有問題的項目，沒問題的不要提及
2. 使用自然語言描述具體問題
3. **每個問題類別後面必須加上換行（\n）**
4. 總字數：嚴格限制在 150 字以內
5. 如果沒有任何問題，回覆：✅ 太棒了！虛擬碼沒有發現任何問題！`;

  try {
    const result = await generateContent(prompt);
    let checkReport = result.trim();

    // 驗證字數
    const charCount = checkReport.length;
    console.log("✅ 虛擬碼檢查報告字數:", charCount, "字");

    // 強制截斷超過 150 字的內容
    if (charCount > 150) {
      console.warn("⚠️ 檢查報告超過 150 字，進行截斷");
      checkReport = checkReport.substring(0, 147) + "...";
    }

    return checkReport;
  } catch (error) {
    console.error("生成虛擬碼檢查報告失敗:", error);

    // 降級方案：使用簡單列表
    const issues = [];
    if (diffs.missingLogic?.length > 0) {
      issues.push(`缺少邏輯：${diffs.missingLogic.join("、")}`);
    }
    if (diffs.incorrectConditions?.length > 0) {
      issues.push(`錯誤條件：${diffs.incorrectConditions.join("、")}`);
    }
    if (diffs.missingVariables?.length > 0) {
      issues.push(`缺少變數：${diffs.missingVariables.join("、")}`);
    }
    if (diffs.missingLoops?.length > 0) {
      issues.push(`缺少迴圈：${diffs.missingLoops.join("、")}`);
    }
    if (diffs.structureIssues?.length > 0) {
      issues.push(`結構問題：${diffs.structureIssues.join("、")}`);
    }

    if (issues.length === 0) {
      return "✅ 太棒了！虛擬碼沒有發現任何問題！";
    }

    const report = issues.join("\n");
    return report.length > 150 ? report.substring(0, 147) + "..." : report;
  }
}
