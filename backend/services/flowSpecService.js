// FlowSpec 服務層：生成理想答案、解析學生答案、正規化、比對、回饋
import { GoogleGenerativeAI } from "@google/generative-ai";

// 延遲初始化，避免在 import 階段檢查環境變數
let genAI = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment variables");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// 預設權重與同義詞(可放 DB 讓教師自訂)
const DEFAULT_SCORING = { structure: 0.3, nodes: 0.3, edges: 0.2, logic: 0.2 };
const DEFAULT_SYNONYMS = {
  start: ["開始", "起點", "start", "start node"],
  end: ["結束", "終點", "end", "end node", "finish"],
  decision: ["判斷", "決策", "條件", "decision", "if", "判斷節點", "diamond"],
  input: ["輸入", "input", "讀入", "取得資料"],
  output: ["輸出", "output", "顯示", "print", "顯示結果"],
  process: ["處理", "process", "步驟", "執行", "運算"],
  umbrella: ["帶傘", "拿雨傘", "攜帶雨傘"],
  "no umbrella": ["不帶傘", "不用帶傘"],
};

function normalizeLabel(label = "", synonyms = DEFAULT_SYNONYMS) {
  const s = String(label).trim().toLowerCase();
  // 對常見 yes/no 標註標準化
  if (["yes", "y", "是", "true"].includes(s)) return "yes";
  if (["no", "n", "否", "false"].includes(s)) return "no";

  // 同義詞映射
  for (const [canon, list] of Object.entries(synonyms)) {
    if (canon === s) return canon;
    if (list.some((w) => w.toLowerCase() === s)) return canon;
  }
  return s;
}

function normalizeFlowSpec(flowSpec, synonyms = DEFAULT_SYNONYMS) {
  const copy = JSON.parse(JSON.stringify(flowSpec || {}));
  copy.nodes = (copy.nodes || []).map((n, i) => ({
    id: n.id ?? `n${i + 1}`,
    type: normalizeLabel(n.type, synonyms),
    label: normalizeLabel(n.label, synonyms),
    required: !!n.required,
  }));
  copy.edges = (copy.edges || []).map((e, i) => ({
    id: e.id ?? `e${i + 1}`,
    from: e.from,
    to: e.to,
    label: e.label ? normalizeLabel(e.label, synonyms) : undefined,
    required: !!e.required,
  }));
  copy.rubrics = copy.rubrics || {};
  copy.scoringWeights = copy.scoringWeights || DEFAULT_SCORING;
  copy.synonyms = copy.synonyms || synonyms;
  return copy;
}

function summarizeFlowSpec(spec) {
  const nodes = (spec?.nodes || [])
    .map((n) => `${n.type}:${n.label}`)
    .join(", ");
  const edges = (spec?.edges || [])
    .map((e) => `${e.from} -> ${e.to}${e.label ? `(${e.label})` : ""}`)
    .join(", ");
  return `Nodes: ${nodes}\nEdges: ${edges}`;
}

// 比對器(非 AI)：回傳 diffs 與 scores
function compareFlowSpecs(ideal, student) {
  console.log("🔍 開始比對流程圖...");
  console.log("📘 理想答案 nodes:", JSON.stringify(ideal.nodes, null, 2));
  console.log("📘 理想答案 edges:", JSON.stringify(ideal.edges, null, 2));
  console.log("📗 學生答案 nodes:", JSON.stringify(student.nodes, null, 2));
  console.log("📗 學生答案 edges:", JSON.stringify(student.edges, null, 2));

  const weights = { ...DEFAULT_SCORING, ...(ideal.scoringWeights || {}) };

  const mustTypes = new Set(
    (ideal.nodes || [])
      .filter(
        (n) => n.required || ["start", "end", "decision"].includes(n.type)
      )
      .map((n) => n.type)
  );

  const studentTypes = new Set((student.nodes || []).map((n) => n.type));

  // 結構：至少要有 start/end，且 decision 節點數量合理
  const structureIssues = [];
  if (!studentTypes.has("start")) structureIssues.push("缺少開始節點");
  if (!studentTypes.has("end")) structureIssues.push("缺少結束節點");

  // 節點涵蓋率
  const requiredNodes = (ideal.nodes || []).filter((n) => n.required);
  const missingNodes = requiredNodes.filter(
    (rn) =>
      !(student.nodes || []).some(
        (sn) => sn.type === rn.type && sn.label === rn.label
      )
  );

  const nodesCoverage =
    requiredNodes.length === 0
      ? 1
      : (requiredNodes.length - missingNodes.length) / requiredNodes.length;

  // 建立 ID 對應映射:理想答案的語義 ID → 學生答案的 UUID
  // 策略:依序配對相同 type 的節點 (不考慮 label,因為學生可能用不同文字)
  const idMapping = {};
  const usedStudentIds = new Set(); // 追蹤已使用的學生節點 ID
  console.log("🔗 開始建立 ID 對應映射...");

  for (const idealNode of ideal.nodes || []) {
    // 找第一個相同 type 且尚未使用的學生節點
    const matchingStudent = (student.nodes || []).find(
      (sn) => sn.type === idealNode.type && !usedStudentIds.has(sn.id)
    );
    if (matchingStudent) {
      idMapping[idealNode.id] = matchingStudent.id;
      usedStudentIds.add(matchingStudent.id);
      console.log(
        `  ✅ 映射: ${idealNode.id} (${idealNode.type}, "${idealNode.label}") → ${matchingStudent.id} (${matchingStudent.type}, "${matchingStudent.label}")`
      );
    } else {
      console.log(
        `  ⚠️ 找不到匹配節點: ${idealNode.id} (${idealNode.type}, "${idealNode.label}")`
      );
    }
  }
  console.log("🔗 ID 映射表:", JSON.stringify(idMapping, null, 2));

  // 邊涵蓋率(僅檢查 required=true 的邊)
  const requiredEdges = (ideal.edges || []).filter((e) => e.required);
  console.log(
    "🔗 必要的邊(requiredEdges):",
    JSON.stringify(requiredEdges, null, 2)
  );
  console.log("🔗 學生的所有邊:", JSON.stringify(student.edges, null, 2));

  const missingEdges = requiredEdges.filter((re) => {
    // 使用映射表將理想答案的 ID 轉換為學生的 ID
    const mappedFrom = idMapping[re.from] || re.from;
    const mappedTo = idMapping[re.to] || re.to;

    const found = (student.edges || []).some((se) => {
      const fromMatch = se.from === mappedFrom;
      const toMatch = se.to === mappedTo;
      const labelMatch = re.label ? se.label === re.label : true;
      console.log(`  檢查邊 ${re.from} → ${re.to} (${re.label || "無標籤"})`);
      console.log(`    映射後: ${mappedFrom} → ${mappedTo}`);
      console.log(`    學生邊 ${se.from} → ${se.to} (${se.label || "無標籤"})`);
      console.log(
        `    from匹配:${fromMatch}, to匹配:${toMatch}, label匹配:${labelMatch}`
      );
      return fromMatch && toMatch && labelMatch;
    });
    console.log(
      `  必要邊 ${re.from} → ${re.to} ${found ? "✅找到" : "❌缺少"}`
    );
    return !found;
  });
  console.log("❌ 缺少的邊:", JSON.stringify(missingEdges, null, 2));

  const edgesCoverage =
    requiredEdges.length === 0
      ? 1
      : (requiredEdges.length - missingEdges.length) / requiredEdges.length;

  // 邏輯簡檢：decision 節點是否帶有 yes/no 出邊
  const studentEdgesByFrom = {};
  (student.edges || []).forEach((e) => {
    studentEdgesByFrom[e.from] = studentEdgesByFrom[e.from] || [];
    studentEdgesByFrom[e.from].push(e);
  });
  const decisionNodes = (student.nodes || []).filter(
    (n) => n.type === "decision"
  );
  const logicIssues = [];
  decisionNodes.forEach((d) => {
    const outs = studentEdgesByFrom[d.id] || [];
    const labels = outs.map((e) => (e.label || "").toLowerCase());
    const hasYes = labels.includes("yes");
    const hasNo = labels.includes("no");
    if (!hasYes || !hasNo)
      logicIssues.push(`決策節點 ${d.label || d.id} 的分支標註需包含 yes/no`);
  });

  // 結構分數：若 start/end 缺少則扣分
  const structureScore = structureIssues.length === 0 ? 1 : 0.5;

  const logicScore = logicIssues.length === 0 ? 1 : 0.6;

  const total =
    structureScore * weights.structure +
    nodesCoverage * weights.nodes +
    edgesCoverage * weights.edges +
    logicScore * weights.logic;

  const diffs = {
    structureIssues,
    missingNodes: missingNodes.map((n) => ({ type: n.type, label: n.label })),
    missingEdges: missingEdges.map((e) => ({
      from: e.from,
      to: e.to,
      label: e.label,
    })),
    logicIssues,
  };

  const scores = {
    structure: Number(structureScore.toFixed(2)),
    nodes: Number(nodesCoverage.toFixed(2)),
    edges: Number(edgesCoverage.toFixed(2)),
    logic: Number(logicScore.toFixed(2)),
    total: Number(total.toFixed(2)),
  };

  return { diffs, scores };
}

// 以 editor graph 轉 FlowSpec(nodes/edges)
function mapEditorGraphToFlowSpec(graph = {}, synonyms = DEFAULT_SYNONYMS) {
  // 類型映射表:UI 類型 → 標準類型
  const typeMapping = {
    rectangle: "process", // 矩形 → 處理
    diamond: "decision", // 菱形 → 判斷/決策
    process: "input", // 平行四邊形 → 輸入/輸出
    decision: "start", // 橢圓形預設為 start,但需根據 label 判斷
  };

  const nodes = (graph.nodes || []).map((n) => {
    let rawType = n.type || n.data?.type || "process";
    let mappedType = typeMapping[rawType] || rawType;

    // 特殊處理:橢圓形(decision)需根據 label 判斷是 start 還是 end
    if (rawType === "decision") {
      const label = String(n.data?.label || n.label || "")
        .trim()
        .toLowerCase();
      if (
        label.includes("結束") ||
        label.includes("end") ||
        label.includes("終點")
      ) {
        mappedType = "end";
      } else {
        mappedType = "start"; // 預設為開始
      }
    }

    return {
      id: n.id,
      type: normalizeLabel(mappedType, synonyms),
      label: normalizeLabel(n.data?.label || n.label || "", synonyms),
    };
  });

  const edges = (graph.edges || []).map((e) => ({
    id: e.id,
    from: e.source || e.from,
    to: e.target || e.to,
    label: e.label ? normalizeLabel(e.label, synonyms) : undefined,
  }));

  return normalizeFlowSpec({ nodes, edges }, synonyms);
}

// 產生理想答案（交由 AI 輸出 JSON，並做基本清洗）
async function generateIdealFlowSpec(questionText) {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `
你是一位流程圖教學助教。請針對題目用 JSON 結構輸出理想流程（嚴格輸出 JSON，不要任何多餘文字）。

題目：
${questionText}

請輸出結構：
{
  "nodes": [
    { "id": "s", "type": "start", "label": "開始", "required": true },
    { "id": "d1", "type": "decision", "label": "是否下雨", "required": true },
    { "id": "p1", "type": "process", "label": "帶傘", "required": true },
    { "id": "p2", "type": "process", "label": "不帶傘", "required": true },
    { "id": "e", "type": "end", "label": "結束", "required": true }
  ],
  "edges": [
    { "from": "s", "to": "d1", "required": true },
    { "from": "d1", "to": "p1", "label": "yes", "required": true },
    { "from": "d1", "to": "p2", "label": "no", "required": true },
    { "from": "p1", "to": "e", "required": true },
    { "from": "p2", "to": "e", "required": true }
  ],
  "scoringWeights": { "structure": 0.3, "nodes": 0.3, "edges": 0.2, "logic": 0.2 }
}
僅回傳 JSON。
`;
  const result = await model.generateContent(prompt);
  let text = (await result.response).text() || "";
  text = text.replace(/^```json\s*|^```\s*|```$/gm, "").trim();
  const parsed = JSON.parse(text);
  return normalizeFlowSpec(parsed, DEFAULT_SYNONYMS);
}

// 自圖片解析學生流程圖（Vision 模型）
async function parseStudentFlowSpecFromImage(imageBase64, questionText) {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `
你是流程圖解析器。請解析圖片中的流程圖，輸出 JSON（節點與連線），標準化決策分支為 yes/no，不要任何多餘文字。若無法判讀，適度推論。

題目（僅供理解，不直接當作答案）：${questionText}

輸出格式：
{
  "nodes": [{ "id": "...", "type": "start|end|input|process|decision|output", "label": "..." }, ...],
  "edges": [{ "from": "id1", "to": "id2", "label": "yes|no|..." }, ...]
}
僅回傳 JSON。
`;
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png",
      },
    },
  ]);
  let text = (await result.response).text() || "";
  text = text.replace(/^```json\s*|^```\s*|```$/gm, "").trim();
  const parsed = JSON.parse(text);
  return normalizeFlowSpec(parsed, DEFAULT_SYNONYMS);
}

// 產生回饋（AI 優先，失敗則 fallback 模板）
async function generateFeedbackText(question, ideal, student, diffs, scores) {
  try {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
你是一位非常簡潔的國中程式設計助教。你的任務是根據現有的「比對差異」和「分數」，只用繁體中文提供 3-5 點簡短的引導式建議。

**輸入資訊**：
- 比對差異：${JSON.stringify(diffs, null, 2)}
- 分數：${JSON.stringify(scores, null, 2)}

**輸出規則 (必須嚴格遵守)**：
1.  **絕對不要** 自己重新分析題目或給出完整答案。
2.  **只根據** 上方提供的「比對差異」來產生提示。
3.  **風格**：引導式問句，例如「是不是少了...？」或「可以思考看看...」。
4.  **格式**：條列式，3-5 點。
5.  **長度**：總字數嚴格控制在 150 字以內。
6.  **如果「比對差異」很少或沒有問題**：就說「做得很好，架構很完整！可以再檢查看看細節喔。」
7.  **語言**：僅使用繁體中文。

請僅輸出建議文字，不要包含任何標題或額外說明。
`;
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch {
    // Fallback：用規則式差異產出簡易回饋
    const tips = [];
    if (diffs.structureIssues?.length) {
      tips.push(`流程圖的開始和結束都放好了嗎？可以檢查看看喔。`);
    }
    if (diffs.missingNodes?.length) {
      tips.push(`好像少了一些關鍵步驟，試著想想看少了哪些動作？`);
    }
    if (diffs.missingEdges?.length) {
      tips.push("箭頭都連對了嗎？檢查一下是不是有漏掉的連線。");
    }
    if (diffs.logicIssues?.length) {
      tips.push(`決策節點（菱形）的「是/否」分支是不是都清楚標示了呢？`);
    }
    if (tips.length === 0) {
      return "做得很好，架構很完整！可以再檢查看看細節喔。";
    }
    return `你的分數是：${Math.round(
      scores.total * 100
    )} 分。\n\n這裡有些小提示，希望能幫助你：\n- ${tips.join("\n- ")}`;
  }
}

export {
  DEFAULT_SCORING,
  DEFAULT_SYNONYMS,
  normalizeFlowSpec,
  mapEditorGraphToFlowSpec,
  compareFlowSpecs,
  generateIdealFlowSpec,
  parseStudentFlowSpecFromImage,
  generateFeedbackText,
  summarizeFlowSpec,
};
