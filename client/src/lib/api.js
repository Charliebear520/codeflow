// 安全解析 API 回應：
// 伺服器逾時或部署錯誤時（例如 Vercel 回傳純文字 "An error occurred..."），
// 直接 res.json() 會丟出 "Unexpected token" 這類看不懂的錯誤，這裡改為可讀的訊息。
export async function readJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text().catch(() => "");
  console.error(`非 JSON 回應 (HTTP ${res.status}):`, text.slice(0, 200));

  if (res.status === 504 || /timed out|timeout/i.test(text)) {
    throw new Error("伺服器回應逾時，請稍後再試");
  }
  throw new Error(`伺服器暫時無法回應（HTTP ${res.status}），請稍後再試`);
}
