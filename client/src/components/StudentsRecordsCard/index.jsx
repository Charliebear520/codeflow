import { useState } from "react";
import { Button, Tooltip } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import StudentAnswerModal from "../StudentAnswerModal";
import AISummaryModal from "../AISummaryModal";
import { minutes, totalDuration, savedAnswer } from "../../lib/learningDisplay";
import styles from "./StudentsRecordsCard.module.css";

export default function StudentsRecordsCard({ student, submission }) {
  const [openStage, setOpenStage] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  return (
    <article className={styles.card}>
      <header className={styles.heading}>
        <div><h3>{student?.name || submission.studentName || "未命名學生"}</h3>
          <div className={styles.meta}>{submission.isDemo && <span className={styles.demo}>示範資料</span>}<span>{submission.questionId}</span></div>
        </div>
        <span className={styles.time}>共計 {minutes(totalDuration(submission))} 分鐘</span>
      </header>
      <div className={styles.stages}>
        {["stage1", "stage2", "stage3"].map((key, index) => {
          const stage = submission.stages?.[key];
          const available = savedAnswer(stage, key) || (key === "stage1" && submission.stage1History?.length > 0);
          return <div className={styles.stage} key={key}>
            <span>階段{["一", "二", "三"][index]}</span>
            <Tooltip title={stage?.completed ? "已達完成標準" : available ? "已保存作答，尚未達完成標準" : "尚未作答"}>
              {stage?.completed ? <CheckOutlined className={styles.complete} aria-label="已完成" /> : <CloseOutlined className={styles.incomplete} aria-label={available ? "尚未完成" : "尚未作答"} />}
            </Tooltip>
            <Button size="small" className={styles.view} disabled={!available} onClick={() => setOpenStage(key)}>查看</Button>
          </div>;
        })}
      </div>
      <Button type="primary" className={styles.summary} onClick={() => setSummaryOpen(true)}>AI 總結</Button>
      <StudentAnswerModal openStage={openStage} onClose={() => setOpenStage(null)} student={student} submission={submission} />
      <AISummaryModal isVisible={summaryOpen} onClose={() => setSummaryOpen(false)} studentId={student?._id}
        studentName={student?.name || submission.studentName} submissionId={submission._id} questionId={submission.questionId} revision={submission.updatedAt} />
    </article>
  );
}
