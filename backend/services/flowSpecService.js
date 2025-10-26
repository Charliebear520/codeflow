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

// 預設權重與同義詞（可放 DB 讓教師自訂）
const DEFAULT_SCORING = { structure: 0.3, nodes: 0.3, edges: 0.2, logic: 0.2 };
const DEFAULT_SYNONYMS = {
  "start": ["開始", "起點", "start", "start node"],
  "end": ["結束", "終點", "end", "end node", "finish"],
  "decision": ["判斷", "決策", "條件", "decision", "if", "判斷節點"],
  "input": ["輸入", "input", "讀入", "取得資料"],
  "output": ["輸出", "output", "顯示", "print", "顯示結果"],
  "process": ["處理", "process", "步驟", "執行", "運算"],
  "umbrella": ["帶傘", "拿雨傘", "攜帶雨傘"],
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
  const nodes = (spec?.nodes || []).map((n) => `${n.type}:${n.label}`).join(", ");
  const edges = (spec?.edges || []).map((e) => `${e.from} -> ${e.to}${e.label ? `(${e.label})` : ""}`).join(", ");
  return `Nodes: ${nodes}\nEdges: ${edges}`;
}

// 比對器（非 AI）：回傳 diffs 與 scores
function compareFlowSpecs(ideal, student) {
  const weights = { ...DEFAULT_SCORING, ...(ideal.scoringWeights || {}) };

  const mustTypes = new Set((ideal.nodes || [])
    .filter((n) => n.required || ["start", "end", "decision"].includes(n.type))
    .map((n) => n.type));

  const studentTypes = new Set((student.nodes || []).map((n) => n.type));

  // 結構：至少要有 start/end，且 decision 節點數量合理
  const structureIssues = [];
  if (!studentTypes.has("start")) structureIssues.push("缺少開始節點");
  if (!studentTypes.has("end")) structureIssues.push("缺少結束節點");

  // 節點涵蓋率
  const requiredNodes = (ideal.nodes || []).filter((n) => n.required);
  const missingNodes = requiredNodes.filter((rn) =>
    !(student.nodes || []).some((sn) => sn.type === rn.type && sn.label === rn.label)
  );

  const nodesCoverage = requiredNodes.length === 0
    ? 1
    : (requiredNodes.length - missingNodes.length) / requiredNodes.length;

  // 邊涵蓋率（僅檢查 required=true 的邊）
  const requiredEdges = (ideal.edges || []).filter((e) => e.required);
  const missingEdges = requiredEdges.filter((re) =>
    !(student.edges || []).some((se) =>
      se.from === re.from &&
      se.to === re.to &&
      (re.label ? se.label === re.label : true)
    )
  );
  const edgesCoverage = requiredEdges.length === 0
    ? 1
    : (requiredEdges.length - missingEdges.length) / requiredEdges.length;

  // 邏輯簡檢：decision 節點是否帶有 yes/no 出邊
  const studentEdgesByFrom = {};
  (student.edges || []).forEach((e) => {
    studentEdgesByFrom[e.from] = studentEdgesByFrom[e.from] || [];
    studentEdgesByFrom[e.from].push(e);
  });
  const decisionNodes = (student.nodes || []).filter((n) => n.type === "decision");
  const logicIssues = [];
  decisionNodes.forEach((d) => {
    const outs = studentEdgesByFrom[d.id] || [];
    const labels = outs.map((e) => (e.label || "").toLowerCase());
    const hasYes = labels.includes("yes");
    const hasNo = labels.includes("no");
    if (!hasYes || !hasNo) logicIssues.push(`決策節點 ${d.label || d.id} 的分支標註需包含 yes/no`);
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
    missingEdges: missingEdges.map((e) => ({ from: e.from, to: e.to, label: e.label })),
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

// 以 editor graph 轉 FlowSpec（nodes/edges）
function mapEditorGraphToFlowSpec(graph = {}, synonyms = DEFAULT_SYNONYMS) {
  const nodes = (graph.nodes || []).map((n) => ({
    id: n.id,
    type: normalizeLabel(n.type || n.data?.type || "process", synonyms),
    label: normalizeLabel(n.data?.label || n.label || "", synonyms),
  }));
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
你是一位溫和的程式助教，請用繁體中文根據以下資訊，提供引導式建議（不要直接給出完整答案）。

題目：
${question}

理想流程摘要：
${summarizeFlowSpec(ideal)}

學生流程摘要：
${summarizeFlowSpec(student)}

比對差異：
${JSON.stringify(diffs, null, 2)}

分數：
${JSON.stringify(scores, null, 2)}

請用 120-200 字，條列 3-5 點具體建議，口吻友善且引導式，避免直接公佈標準答案。
僅輸出文字內容。
`;
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch {
    // Fallback：用規則式差異產出簡易回饋
    const tips = [];
    if (diffs.structureIssues?.length) tips.push(`結構建議：${diffs.structureIssues.join("、")}。`);
    if (diffs.missingNodes?.length) tips.push(`節點建議：補上 ${diffs.missingNodes.map(n => `${n.type}:${n.label}`).join("、")}。`);
    if (diffs.missingEdges?.length) tips.push(`連線建議：補上 ${diffs.missingEdges.map(e => `${e.from}->${e.to}${e.label ? `(${e.label})` : ""}`).join("、")}。`);
    if (diffs.logicIssues?.length) tips.push(`邏輯建議：${diffs.logicIssues.join("、")}。`);
    if (tips.length === 0) tips.push("做得很好！可以再檢查標籤命名是否一致，並確保決策分支清楚標示 yes/no。");
    return `評分總結：${Math.round(scores.total * 100)} 分。\n建議：\n- ${tips.join("\n- ")}`;
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