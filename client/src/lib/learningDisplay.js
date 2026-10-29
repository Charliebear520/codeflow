export const minutes = (seconds) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 1 }).format((Number(seconds) || 0) / 60);
export const totalDuration = (submission) => ["stage1", "stage2", "stage3"].reduce((n, key) => n + (Number(submission?.stages?.[key]?.durationSec) || 0), 0);
export const savedAnswer = (stage, key) => key === "stage1" ? !!(stage?.graph?.nodes?.length || stage?.imageBase64) : !!(key === "stage2" ? stage?.pseudocode?.trim() : stage?.code?.trim());
export const localTime = (date) => date && Number.isFinite(new Date(date).getTime()) ? new Date(date).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "未記錄時間";
