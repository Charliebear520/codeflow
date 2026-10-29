const DAY = 86400000;
const TAIPEI = 8 * 3600000;
export const stageKeys = ["stage1", "stage2", "stage3"];
export const totalSeconds = (record) => stageKeys.reduce((n, key) => n + Math.max(0, Number(record.stages?.[key]?.durationSec) || 0), 0);
export const hasAnswer = (stage, key) => key === "stage1"
  ? !!(stage?.graph?.nodes?.length || stage?.imageBase64)
  : !!(key === "stage2" ? stage?.pseudocode?.trim() : stage?.code?.trim());

export function extractErrors(diffs = {}) {
  const result = [];
  for (const key of ["syntaxErrors", "logicErrors", "structureIssues", "logicIssues", "missingVariables", "missingControlFlow", "missingConditions"]) {
    for (const item of Array.isArray(diffs?.[key]) ? diffs[key] : []) {
      if (typeof item === "string" && item.trim()) result.push(item);
    }
  }
  if (diffs?.missingNodes?.length) result.push(`缺少節點：${diffs.missingNodes.map((n) => n.label || n.type).join("、")}`);
  if (diffs?.missingEdges?.length) result.push(`缺少 ${diffs.missingEdges.length} 條必要連線`);
  return [...new Set(result)];
}

export function fourWeeks(anchor = new Date()) {
  const local = new Date(new Date(anchor).getTime() + TAIPEI);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    - ((local.getUTCDay() + 6) % 7) * DAY - TAIPEI;
  const dateText = (time) => new Date(time + TAIPEI).toISOString().slice(0, 10);
  return Array.from({ length: 4 }, (_, index) => {
    const start = monday - (3 - index) * 7 * DAY;
    return { week: index + 1, start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString(),
      dateStart: dateText(start), dateEnd: dateText(start + 6 * DAY),
      label: `${dateText(start).slice(5)}～${dateText(start + 6 * DAY).slice(5)}` };
  });
}

export function activitySummary(record, now = new Date()) {
  const events = (record.activityEvents || []).filter((e) => ["chat", "attempt", "help"].includes(e.kind) && Number.isFinite(new Date(e.at).getTime()));
  const latest = events.reduce((time, e) => Math.max(time, new Date(e.at).getTime()), 0);
  const weeks = fourWeeks(record.isDemo && latest ? new Date(latest) : now);
  const started = record.activityTrackingStartedAt ? new Date(record.activityTrackingStartedAt).getTime() : (events.length ? Math.min(...events.map((e) => new Date(e.at).getTime())) : null);
  const weekly = weeks.map((week) => {
    const observed = started !== null && new Date(week.end).getTime() > started;
    const data = { ...week, observed, chat: observed ? 0 : null, attempt: observed ? 0 : null, help: observed ? 0 : null };
    for (const e of events) if (new Date(e.at) >= new Date(week.start) && new Date(e.at) < new Date(week.end)) data[e.kind] = (data[e.kind] || 0) + 1;
    return data;
  });
  const inPeriod = events.filter((e) => new Date(e.at) >= new Date(weeks[0].start) && new Date(e.at) < new Date(weeks[3].end));
  const totals = weekly.reduce((s, w) => ({ chat: s.chat + (w.chat || 0), attempt: s.attempt + (w.attempt || 0), help: s.help + (w.help || 0) }), { chat: 0, attempt: 0, help: 0 });
  return { weekly, totals, hasHistory: inPeriod.length > 0, trackingStartedAt: started ? new Date(started).toISOString() : null,
    completeWindow: started !== null && started <= new Date(weeks[0].start).getTime(),
    dateStart: weeks[0].dateStart, dateEnd: weeks[3].dateEnd,
    source: record.isDemo ? "固定四週示範事件" : "實際已保存操作事件",
    errors: [...new Set(inPeriod.flatMap((e) => e.issues || e.errors || []))],
    definitions: { chat: "成功取得一般對話回覆一次；重試不重計", attempt: "檢查完成且評分成功保存一次；單純儲存不計", help: "成功取得提示或按「接下來我該做什麼」一次；不另計對話" } };
}

export function groupStatistics(records) {
  const calculate = (rows) => {
    const complete = rows.filter((r) => stageKeys.every((key) => r.stages?.[key]?.completed === true));
    return { submissionCount: rows.length, studentCount: new Set(rows.map((r) => String(r.student?._id || r.student))).size,
      completedSubmissions: complete.length, completedStudents: new Set(complete.map((r) => String(r.student?._id || r.student))).size,
      averageCompletedDurationSec: complete.length ? complete.reduce((n, r) => n + totalSeconds(r), 0) / complete.length : null };
  };
  return { submissionCount: records.length, studentCount: new Set(records.map((r) => String(r.student?._id || r.student))).size,
    demo: calculate(records.filter((r) => r.isDemo)), real: calculate(records.filter((r) => !r.isDemo)) };
}

export function recordAnalysis(record, activity) {
  const scored = stageKeys.map((key) => record.stages?.[key]?.score).filter((score) => typeof score === "number");
  const complete = stageKeys.filter((key) => record.stages?.[key]?.completed === true).length;
  const average = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const errors = [...new Set([...activity.errors, ...stageKeys.flatMap((key) => extractErrors(record.stages?.[key]?.diffs))])];
  return { source: record.isDemo ? "示範分析（依固定紀錄計算）" : "依目前紀錄分析（非即時模型生成）",
    problem: `本題已完成 ${complete}/3 階段，${scored.length} 階段有評分${average === null ? "" : `，平均 ${average.toFixed(1)} 分`}。累積用時 ${(totalSeconds(record) / 60).toFixed(1)} 分鐘；不能僅依速度判斷學習表現。`,
    status: complete === 3 && average >= 70 ? "三階段均已完成" : scored.length ? "部分階段仍待完成或修正" : "資料不足，尚待評分",
    tone: errors.length ? "warning" : complete === 3 ? "success" : "neutral",
    process: `本圖表期間記錄 ${activity.totals.attempt} 次檢查、${activity.totals.chat} 次對話及 ${activity.totals.help} 次求助。請結合已保存的答案與評分檢視解題過程，不以操作次數或用時單獨推論能力。`,
    errors, errorNote: errors.length ? "以下為已保存的比對／操作問題，應對照各次答案確認。" : "目前沒有已保存的錯誤紀錄；資料不足以證明答案完全無誤。" };
}
