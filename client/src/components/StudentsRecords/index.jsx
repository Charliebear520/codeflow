import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Select, Spin, Empty, Button, Alert, Pagination, Tooltip } from "antd";
import StudentsRecordsCard from "../StudentsRecordsCard";
import { readJson } from "../../lib/api";
import { minutes } from "../../lib/learningDisplay";
import styles from "./StudentsRecords.module.css";

export default function StudentsRecords() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ className: "all", topic: "all", questionId: "all", source: "all" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const active = useRef(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true);
    try {
      const token = await getToken();
      const query = new URLSearchParams({ ...filter, page: String(page), pageSize: "20" });
      const response = await fetch(`/api/admin/submissions?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
      const body = await readJson(response);
      if (!response.ok || !body.success) throw new Error(body.error || "讀取失敗");
      if (controller.signal.aborted) return;
      setData(body); setUpdatedAt(new Date()); setError("");
    } catch (e) { if (!controller.signal.aborted) { setError(e.message); setData(null); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [getToken, filter, page]);
  useEffect(() => {
    reload(); const timer = setInterval(reload, 15000); window.addEventListener("focus", reload);
    return () => { clearInterval(timer); window.removeEventListener("focus", reload); active.current?.abort(); };
  }, [reload]);
  const change = (name, value) => {
    setPage(1); setFilter((f) => ({ ...f, [name]: value, ...(name === "className" ? { topic: "all", questionId: "all" } : name === "topic" ? { questionId: "all" } : {}) }));
  };
  const choices = (values = []) => [{ value: "all", label: "全部" }, ...values.map((value) => typeof value === "string" ? { value, label: value } : value)];
  return <div className={styles.container}>
    <div className={styles.filters}>
      <label>選擇班級<Select aria-label="選擇班級" value={filter.className} options={choices(data?.options?.classes)} onChange={(v) => change("className", v)} /></label>
      <label>選擇主題<Select aria-label="選擇主題" value={filter.topic} options={choices(data?.options?.topics)} onChange={(v) => change("topic", v)} /></label>
      <label>選擇題目<Select aria-label="選擇題目" value={filter.questionId} options={choices(data?.options?.questions)} onChange={(v) => change("questionId", v)} /></label>
      <label>資料來源<Select aria-label="資料來源" value={filter.source} options={[{ value:"all",label:"全部" },{ value:"demo",label:"示範" },{ value:"real",label:"真實" }]} onChange={(v) => change("source", v)} /></label>
    </div>
    <div className={styles.toolbar}>
      <div><Button onClick={reload} loading={loading}>重新整理</Button><span>每 15 秒及切回視窗時更新{updatedAt && ` · ${updatedAt.toLocaleTimeString("zh-TW", { timeZone:"Asia/Taipei",hour12:false })}`}</span></div>
      {data && <span>{data.statistics.studentCount} 位學生 · {data.total} 筆作答</span>}
    </div>
    {error && <Alert type="error" showIcon message="無法取得作答紀錄" description={error} />}
    {data && <div className={styles.statistics}>
      {["demo", "real"].map((key) => { const s = data.statistics[key]; return <div key={key}>
        <strong>{key === "demo" ? "示範資料" : "真實學生"}</strong><span>{s.studentCount} 人／{s.submissionCount} 筆</span>
        <Tooltip title="目前篩選結果中，至少一筆三階段均已完成的學生；平均只計算已完成的作答。"><span>完成 {s.completedStudents} 人（{s.completedSubmissions} 筆）</span></Tooltip>
        <span>平均完成時間：{s.averageCompletedDurationSec === null ? "尚無完成紀錄" : `${minutes(s.averageCompletedDurationSec)} 分鐘`}</span>
      </div>; })}
    </div>}
    <Spin spinning={loading}>
      {!error && data?.items?.length === 0 ? <Empty description="目前篩選沒有作答紀錄" /> : <div className={styles.grid}>
        {data?.items?.map((submission) => <StudentsRecordsCard key={submission._id} submission={submission} student={submission.student} />)}
      </div>}
    </Spin>
    <Pagination current={page} total={data?.total || 0} pageSize={20} showSizeChanger={false} onChange={setPage} className={styles.pagination} />
  </div>;
}
