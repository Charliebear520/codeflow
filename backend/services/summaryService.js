import { generateContent } from "./geminiService.js";

/**
 * 生成三階段整體總結報告（≤500字）
 * @param {Object} stages - 三階段資料
 * @param {Object} stages.stage1 - { score, report, completed }
 * @param {Object} stages.stage2 - { score, report, completed }
 * @param {Object} stages.stage3 - { score, report, completed }
 */
export async function generateOverallSummary(stages) {
  const { stage1, stage2, stage3 } = stages;

  // 計算整體進度
  const completedStages = [
    stage1.completed,
    stage2.completed,
    stage3.completed,
  ].filter(Boolean).length;
  const totalScore = Math.round(
    (stage1.score + stage2.score + stage3.score) / 3,
  );

  const prompt = `你是程式教學專家。請根據學生在三個學習階段的作答情況，生成一份綜合學習總結報告。

## 學生作答資料

**階段一（流程圖）：**
- 完成狀態：${stage1.completed ? "已完成" : "未完成"}
- 分數：${stage1.score}/100
- 問題分析：${stage1.report}

**階段二（虛擬碼）：**
- 完成狀態：${stage2.completed ? "已完成" : "未完成"}
- 分數：${stage2.score}/100
- 問題分析：${stage2.report}

**階段三（程式碼）：**
- 完成狀態：${stage3.completed ? "已完成" : "未完成"}
- 分數：${stage3.score}/100
- 問題分析：${stage3.report}

## 報告要求

請生成包含以下四個部分的報告：

### 1. 整體進度評估
- 目前完成進度：${completedStages}/3 階段
- 整體平均分數：${totalScore}/100

### 2. 各階段表現摘要
- 簡要說明每個階段的表現（已作答的階段）
- 若某階段未作答，提醒學生需要完成

### 3. 需要加強的重點
- 根據三階段的問題分析，找出共通的弱點
- 指出最需要改進的部分

### 4. 學習建議
- 提供具體的改進方向
- 建議下一步應該做什麼

## 格式要求
- 使用 Markdown 格式
- 每個部分使用 ### 標題
- 使用簡潔的條列式說明
- **總字數：嚴格限制在 500 字以內**
- 語氣要鼓勵且具體，避免空泛的建議`;

  try {
    let summary = await generateContent(prompt);
    summary = summary.trim();

    // 驗證字數
    const charCount = summary.length;
    console.log("✅ 整體總結字數:", charCount, "字");

    // 強制截斷超過 500 字的內容
    if (charCount > 500) {
      console.warn("⚠️ 總結超過 500 字，進行截斷");
      summary = summary.substring(0, 497) + "...";
    }

    return summary;
  } catch (error) {
    console.error("生成整體總結失敗:", error);

    // 降級方案：使用簡單模板
    return `### 整體進度評估
目前完成進度：${completedStages}/3 階段
整體平均分數：${totalScore}/100

### 各階段表現
${stage1.completed ? `✅ 階段一已完成（${stage1.score}分）` : "⚠️ 階段一尚未完成"}
${stage2.completed ? `✅ 階段二已完成（${stage2.score}分）` : "⚠️ 階段二尚未完成"}
${stage3.completed ? `✅ 階段三已完成（${stage3.score}分）` : "⚠️ 階段三尚未完成"}

### 學習建議
請依序完成三個階段的學習，每完成一個階段後點擊「檢查」按鈕查看詳細回饋。`;
  }
}
