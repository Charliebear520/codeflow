import { readJson } from "./api.js";

const pending = new Map();
const running = new Map();
export function currentQuestionId() {
  const selected = new URLSearchParams(window.location.search).get("questionId");
  if (selected && selected.length <= 100) {
    localStorage.setItem("currentFlowchartQuestionId", selected);
    return selected;
  }
  return localStorage.getItem("currentFlowchartQuestionId") || "Q001";
}

// 網路失敗後重試沿用原始 id、內容與時間增量；不同帳號隔離。
export async function submissionRequest(url, options, userId) {
  if (!userId) throw new Error("請先登入");
  const body = JSON.parse(options.body);
  const content = { ...body };
  delete content.durationDeltaSec;
  if (content.graph) delete content.imageBase64;
  const bytes = new TextEncoder().encode(JSON.stringify([userId, url, content]));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((v) => v.toString(16).padStart(2, "0")).join("");
  const key = `codeflow-operation:${hash}`;
  if (!running.has(key)) {
    const job = (async () => {
      let operation = pending.get(key);
      if (!operation) {
        try { operation = JSON.parse(sessionStorage.getItem(key)); } catch { /* 儲存空間不可用時仍可提交 */ }
      }
      if (!operation) operation = { id: crypto.randomUUID(), body: options.body };
      pending.set(key, operation);
      try { sessionStorage.setItem(key, JSON.stringify(operation)); } catch { /* 保留記憶體去重 */ }
      const response = await fetch(url, { ...options, body: operation.body,
        headers: { ...options.headers, "Idempotency-Key": operation.id } });
      if (response.ok) {
        let result = null;
        try { result = await response.clone().json(); } catch { /* 不把 HTML／破損回應當成寫入確認 */ }
        if (!result?.success || !result?.submissionId) {
          throw new Error("尚無法確認儲存結果，請重試；同一操作不會重複新增");
        }
      }
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        pending.delete(key);
        try { sessionStorage.removeItem(key); } catch { /* 儲存空間不可用 */ }
      }
      return response;
    })();
    running.set(key, job);
  }
  try { return (await running.get(key)).clone(); }
  finally { running.delete(key); }
}

export async function loadMySubmission(getToken, questionId = currentQuestionId()) {
  const token = await getToken();
  const response = await fetch(`/api/submissions/mine?questionId=${encodeURIComponent(questionId)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok || !data.success) throw new Error(data.error || "無法讀取已儲存作答");
  return data.item;
}

export async function requestHint(body, getToken, userId) {
  const token = await getToken();
  const response = await submissionRequest("/api/generate-hint", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify(body) }, userId);
  const data = await readJson(response);
  if (!response.ok || !data.success) throw new Error(data.error || "無法取得提示");
  return { data };
}
