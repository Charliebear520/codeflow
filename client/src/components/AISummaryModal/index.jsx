import React, { useState, useEffect } from 'react';
import { Modal, Spin, message } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import styles from './AISummaryModal.module.css';

/**
 * AISummaryModal 組件
 * @param {boolean} isVisible - 控制 Modal 顯示
 * @param {function} onClose - 關閉 Modal 的回呼函式
 * @param {string} studentId - 用於查詢資料庫的學生唯一 ID
 * @param {string} studentName - 顯示在標題的學生姓名
 */
const AISummaryModal = ({ isVisible, onClose, studentId, studentName }) => {
  // --- 狀態管理 ---
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]); // 用於 Recharts 的圖表數據
  const [summary, setSummary] = useState({
    stages: {},
    totalTime: 0,
    chatCount: 0,
    attemptCount: 0,
    helpCount: 0,
    aiFeedback: '',
    errorPattern: ''
  });

  // --- 異步取得後端 MongoDB 資料 ---
  useEffect(() => {
    if (isVisible && studentId) {
      fetchStudentSummary();
    }
  }, [isVisible, studentId]);

  const secToMin = (sec) => {
    return Math.round(sec / 60);
  };

  const fetchStudentSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/submissions/summary/${studentId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error("後端回傳失敗");
      }

      const payload = result.data || {};
      console.log("🔥 後端 summary:", payload); // ⭐ 一定要看這個！

      const stages = payload.stages || {};

      // ===== 1️⃣ 圖表資料 =====
      const chartData = [
        {
          name: "第一階段",
          studentTime: secToMin(stages.stage1?.durationSec || 0),
          avgTime: payload.avgStage1 || 20, // 👉 改成後端提供
        },
        {
          name: "第二階段",
          studentTime: secToMin(stages.stage2?.durationSec || 0),
          avgTime: payload.avgStage2 || 30,
        },
        {
          name: "第三階段",
          studentTime: secToMin(stages.stage3?.durationSec || 0),
          avgTime: payload.avgStage3 || 45,
        },
      ];
      setData(chartData);

      // ===== 2️⃣ 加總（安全寫法）=====
      const totalChat = payload.chatCount ?? 0;
      const totalAttempt = payload.attemptCount ?? 0;
      const totalHelp = payload.helpCount ?? 0;

      // ===== 3️⃣ 設定 summary =====
      setSummary({
        stages,
        totalTime: Math.round((payload.totalDurationSec || 0) / 60),
        chatCount: totalChat,
        attemptCount: totalAttempt,
        helpCount: totalHelp,
        aiFeedback:
          payload.aiSummary ||
          generateFallbackFeedback(totalChat, totalAttempt, totalHelp),
        errorPattern: payload.lastError || "目前無錯誤紀錄",
      });
    } catch (error) {
      console.error("❌ 取得總結失敗:", error);
      message.error("連線伺服器失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isVisible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      // antd 5.x 樣式設定
      styles={{ body: { borderRadius: '20px', padding: '20px', minHeight: '400px' } }}
    >
      <Spin spinning={loading} tip="AI 正在分析歷程資料...">
        <div className={styles.modalContent}>
          <h2 className={styles.header}>{studentName} 答題總結</h2>

          <div className={styles.mainLayout}>
            {/* 左側欄位：統計與圖表 */}
            <div className={styles.leftColumn}>
              <div className={styles.sectionTitle}>總結統計</div>
              
              {/* 階段時間卡片：動態渲染 */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>第一階段時間</div>
                  <div className={styles.statValue}>{Math.round((summary.stages.stage1?.durationSec || 0) / 60)} 分</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>第二階段時間</div>
                  <div className={styles.statValue}>{Math.round((summary.stages.stage2?.durationSec || 0) / 60)} 分</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>第三階段時間</div>
                  <div className={styles.statValue}>{Math.round((summary.stages.stage3?.durationSec || 0) / 60)} 分</div>
                </div>
              </div>

              {/* 總時間強調區塊 */}
              <div className={styles.totalTimeBox}>
                <div>
                  <div className={styles.statLabel}>總花費時間</div>
                  <div className={styles.totalValue}>{summary.totalTime} 分鐘</div>
                </div>
                <div className={styles.timeNote}>
                  {summary.totalTime > 80 
                    ? "用時較長，建議針對邏輯判斷部分加強練習。" 
                    : "解題速度優於平均，表現優異。"}
                </div>
              </div>

              {/* 次數統計卡片 */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>對話次數</div>
                  <div className={styles.statValue}>{summary.chatCount} 次</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>嘗試次數</div>
                  <div className={styles.statValue}>{summary.attemptCount} 次</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>求助次數</div>
                  <div className={styles.statValue}>{summary.helpCount} 次</div>
                </div>
              </div>

              {/* 圖表呈現區塊 */}
              <div className={styles.chartArea}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 20, right: 30, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#888', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" verticalAlign="top" align="right" height={36}/>
                    <Line
                      name="學生用時"
                      type="monotone"
                      dataKey="studentTime"
                      stroke="#4a90e2"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#4a90e2' }}
                    />
                    <Line
                      name="平均用時"
                      type="monotone"
                      dataKey="avgTime"
                      stroke="#ccc"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 右側欄位：AI 分析文字 */}
            <div className={styles.rightColumn}>
              <div className={styles.sectionTitle}>問題總結</div>
              <div className={styles.summaryCard}>
                <p>{summary.aiFeedback}</p>
              </div>

              <div className={styles.sectionTitle}>解題歷程分析</div>
              <div className={styles.statusTag}>
                {summary.totalTime < 60 ? '✓ 表現優異' : '✓ 目前尚可'}
              </div>

              <div className={styles.sectionTitle}>錯誤模式分析</div>
              <div className={styles.errorBox}>
                <div className={styles.errorTitle}>! 注意邏輯分析，以下為該學生常犯錯誤</div>
                <div className={styles.errorContent}>
                  {summary.errorPattern}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

export default AISummaryModal;