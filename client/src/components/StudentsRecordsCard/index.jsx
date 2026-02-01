import React, { useState, useMemo } from "react";
import styles from "./StudentsRecordsCard.module.css";
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import StudentAnswerModal from "../StudentAnswerModal";
import AISummaryModal from "../AISummaryModal/index.jsx";

// 子元件：負責顯示每一列的狀態
function StageRow({ label, done, onView }) {
  const Icon = done ? CheckOutlined : CloseOutlined;
  return (
    <div className={styles.checkbox}>
      <div className={styles.homeworkText}>{label}</div>
      <Icon className={done ? styles.CheckOutlined : styles.CloseOutlined} />
      <Button
        size="small"
        className={styles.checkButton}
        onClick={onView}
        disabled={!done}
      >
        查看
      </Button>
    </div>
  );
}

const StudentsRecordsCard = ({ student, submission }) => {
  // 1. 狀態管理
  const [openStage, setOpenStage] = useState(null); // 控制作答細節彈窗
  const [isAIModalVisible, setIsAIModalVisible] = useState(false); // 控制 AI 總結彈窗

  // 2. 資料處理
  const s1 = submission?.stages?.stage1 || {};
  const s2 = submission?.stages?.stage2 || {};
  const s3 = submission?.stages?.stage3 || {};

  // 判斷各階段是否完成
  const stage1Done = !!(s1.completed || s1.imageBase64 || s1?.graph?.nodes?.length);
  const stage2Done = !!(s2.completed || (s2.pseudocode && s2.pseudocode.trim()));
  const stage3Done = !!(s3.completed || (s3.code && s3.code.trim()));

  const meta = useMemo(
    () => [
      { key: "stage1", label: "階段一", done: stage1Done },
      { key: "stage2", label: "階段二", done: stage2Done },
      { key: "stage3", label: "階段三", done: stage3Done },
    ],
    [stage1Done, stage2Done, stage3Done]
  );

  // 3. 事件處理
  const showAIModal = () => setIsAIModalVisible(true);
  const handleCloseAIModal = () => setIsAIModalVisible(false);

  return (
    <div className={styles.card}>
      <div className={styles.substance}>
        {/* 學生姓名顯示 */}
        <div className={styles.studentName}>
          {student?.name || student?.email || "未命名學生"}
        </div>

        {/* 渲染各階段列 */}
        {meta.map((m) => (
          <StageRow
            key={m.key}
            label={m.label}
            done={m.done}
            onView={() => setOpenStage(m.key)}
          />
        ))}

        {/* AI 總結按鈕 */}
        <Button className={styles.aiButton} onClick={showAIModal}>
          AI總結
        </Button>

        {/* 彈窗元件：作答紀錄細節 */}
        <StudentAnswerModal
          openStage={openStage}
          onClose={() => setOpenStage(null)}
          submission={submission}
          student={student}
        />

        {/* 彈窗元件：AI 總結內容 */}
        <AISummaryModal 
          isVisible={isAIModalVisible} 
          onClose={handleCloseAIModal} 
          studentName={student?.name || "學生"} 
        />
      </div>
    </div>
  );
};

export default StudentsRecordsCard;