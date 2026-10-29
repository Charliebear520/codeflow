import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Spin, Alert, Button, Tag, Empty } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useAuth } from "@clerk/clerk-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { readJson } from "../../lib/api";
import { minutes } from "../../lib/learningDisplay";
import styles from "./AISummaryModal.module.css";

export default function AISummaryModal({ isVisible, onClose, studentId, studentName, submissionId, questionId, revision }) {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(null);
  const reload = useCallback(async () => {
    if (!studentId) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setData(null); setError("");
    try {
      const token = await getToken();
      const query = new URLSearchParams({ ...(submissionId ? { submissionId } : {}), ...(questionId ? { questionId } : {}) });
      const response = await fetch(`/api/submissions/summary/${studentId}?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache:"no-store", signal:controller.signal });
      const body = await readJson(response);
      if (!response.ok || !body.success) throw new Error(body.error || "無法取得總結");
      if (!controller.signal.aborted) setData(body.data);
    } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [getToken, studentId, submissionId, questionId, revision]);
  useEffect(() => { if (isVisible) reload(); return () => active.current?.abort(); }, [isVisible, reload]);
  const stat = (label, value, unit) => <div className={styles.statCard} key={label}><span>{label}</span><strong>{value}<small> {unit}</small></strong></div>;
  return <Modal open={isVisible} onCancel={onClose} footer={null} centered width={1000} className={styles.modal} destroyOnClose
    title={<div className={styles.title}><span>{studentName || "學生"} · 答題總結</span><Button type="text" aria-label="重新取得總結" icon={<ReloadOutlined />} onClick={reload} loading={loading} /></div>}>
    <div className={styles.scroller}>
      {error && <Alert type="error" showIcon message="無法讀取總結" description={error} />}
      <Spin spinning={loading}>
        {!data && !loading && !error && <Empty description="沒有總結資料" />}
        {data && <>
          <div className={styles.source}><Tag color={data.isDemo ? "blue" : "default"}>{data.analysis.source}</Tag><span>{data.questionId} · {data.questionTitle}</span></div>
          <div className={styles.layout}>
            <section className={styles.left}>
              <h3>總結統計</h3>
              <div className={styles.stats}>{["stage1","stage2","stage3"].map((key,i) => stat(`第${["一","二","三"][i]}階段時間`, minutes(data.stages?.[key]?.durationSec), "分鐘"))}</div>
              <div className={styles.total}><div><span>本題累積用時</span><strong>{minutes(data.totalDurationSec)} 分鐘</strong></div><p>依已儲存的三階段秒數加總，用時不作為表現評級。</p></div>
              <h3>四週互動紀錄</h3>
              <p className={styles.caption}>{data.activity.dateStart} ～ {data.activity.dateEnd}（台灣時間）<br />來源：{data.activity.source}</p>
              <div className={styles.stats}>{stat("對話次數",data.activity.totals.chat,"次")}{stat("嘗試次數",data.activity.totals.attempt,"次")}{stat("求助次數",data.activity.totals.help,"次")}</div>
              {data.activity.hasHistory ? <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%"><LineChart data={data.activity.weekly} margin={{top:12,right:40,left:8,bottom:12}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f5" />
                  <XAxis dataKey="label" tick={{fontSize:10}} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} label={{value:"次數",angle:-90,position:"insideLeft"}} tick={{fontSize:11}} width={42} />
                  <Tooltip labelFormatter={(label,payload) => { const row=payload?.[0]?.payload; return row ? `${row.dateStart}～${row.dateEnd}` : label; }} />
                  <Legend wrapperStyle={{fontSize:12}} />
                  <Line name="對話次數" dataKey="chat" stroke="#2cb7d4" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />
                  <Line name="嘗試次數" dataKey="attempt" stroke="#65bf96" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />
                  <Line name="求助次數" dataKey="help" stroke="#e3ac49" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />
                </LineChart></ResponsiveContainer>
              </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="歷史資料不足，無法還原四週折線" />}
              <p className={styles.caption}>{data.activity.trackingStartedAt ? `事件自 ${new Date(data.activity.trackingStartedAt).toLocaleDateString("zh-TW",{timeZone:"Asia/Taipei"})} 起記錄；較早的未記錄週不補成零。` : "既有累計次數沒有操作時間戳，不轉換成週資料。"}</p>
              {!data.isDemo && data.activity.hasHistory && !data.activity.completeWindow && <p className={styles.caption}>歷史紀錄不足以比較完整四週，目前只呈現已記錄的部分期間。</p>}
              <details className={styles.definitions}><summary>計數定義與耗時比較</summary>
                {Object.entries(data.activity.definitions).map(([key,text]) => <p key={key}>{text}</p>)}
                <p>同班、同題、同主題、同資料來源的有紀錄階段平均；不混用示範與真實學生。</p>
                <div className={styles.chart}><ResponsiveContainer width="100%" height="100%"><LineChart data={data.timingChart} margin={{top:16,right:12,left:8,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{fontSize:11}} /><YAxis label={{value:"分鐘",angle:-90,position:"insideLeft"}} width={42} /><Tooltip /><Legend />
                  <Line name="學生用時（分鐘）" dataKey="studentMinutes" stroke="#527bf0" isAnimationActive={false} />
                  <Line name="同組平均（分鐘）" dataKey="averageMinutes" stroke="#abb5c8" strokeDasharray="4 4" isAnimationActive={false} />
                </LineChart></ResponsiveContainer></div>
              </details>
            </section>
            <section className={styles.right}>
              <h3>問題總結</h3><div className={styles.textCard}>{data.analysis.problem}
                {data.analysis.aiAdvice && <p style={{marginTop:12}}>AI 學習建議：{data.analysis.aiAdvice}</p>}
                {data.analysis.aiUnavailable && <p className={styles.caption}>即時 AI 建議暫時無法取得；以上事實仍由目前紀錄計算。</p>}
              </div>
              <h3>解題歷程分析</h3><div className={`${styles.status} ${styles[data.analysis.tone]}`}>{data.analysis.status}</div>
              <p className={styles.process}>{data.analysis.process}</p>
              <h3>錯誤模式分析</h3><div className={data.analysis.errors.length ? styles.errorCard : styles.neutralCard}>
                <strong>{data.analysis.errors.length ? "已保存的問題紀錄" : "尚無已保存的錯誤"}</strong><p>{data.analysis.errorNote}</p>
                {data.analysis.errors.length > 0 && <ul>{data.analysis.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>}
              </div>
            </section>
          </div>
        </>}
      </Spin>
    </div>
  </Modal>;
}
