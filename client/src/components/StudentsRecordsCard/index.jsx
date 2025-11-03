import styles from "./StudentsRecordsCard.module.css";
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { useState, useMemo } from "react";
import StudentAnswerModal from "../StudentAnswerModal";


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
  const [openStage, setOpenStage] = useState(null); // 'stage1' | 'stage2' | 'stage3' | null
  const s1 = submission?.stages?.stage1 || {};
  const s2 = submission?.stages?.stage2 || {};
  const s3 = submission?.stages?.stage3 || {};


  // 若 completed 還沒寫入，改用「是否有內容」當備援
  const stage1Done = !!(s1.completed || s1.imageBase64 || s1?.graph?.nodes?.length);
  const stage2Done = !!(s2.completed || (s2.pseudocode && s2.pseudocode.trim()));
  const stage3Done = !!(s3.completed || (s3.code && s3.code.trim()));

  // 這邊是completed=true才能查看學生作答紀錄
  // const stage1Done = !!s1.completed;
  // const stage2Done = !!s2.completed;
  // const stage3Done = !!s3.completed;

  const meta = useMemo(
    () => [
      { key: "stage1", label: "階段一", done: stage1Done },
      { key: "stage2", label: "階段二", done: stage2Done },
      { key: "stage3", label: "階段三", done: stage3Done },
    ],
    [stage1Done, stage2Done, stage3Done]
  );
  console.log("student:", student);
  console.log("submission:", submission);
  return (
    <div className={styles.card}>
      <div className={styles.substance}>
        <div className={styles.studentName}>
          {student?.name || student?.email || "未命名學生"}{" "}
          {/* {submission?.questionId && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {submission.questionId}
            </Tag>
          )} */}
        </div>
        {meta.map((m) => (
          <StageRow
            key={m.key}
            label={m.label}
            done={m.done}
            onView={() => setOpenStage(m.key)}
          />
        ))}
        {/* <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段一</div>
          <CheckOutlined className={styles.CheckOutlined} />
          <StudentAnswerModal className={styles.checkButton} />
        </div>
        <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段二</div>
          <CloseOutlined className={styles.CloseOutlined} />
          <StudentAnswerModal className={styles.checkButton} />
        </div>
        <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段三</div>
          <CheckOutlined className={styles.CheckOutlined} />
          <StudentAnswerModal className={styles.checkButton} />
        </div> */}
        <Button className={styles.aiButton}>AI總結</Button>
        <StudentAnswerModal
          openStage={openStage}
          onClose={() => setOpenStage(null)}
          submission={submission}
          student={student}
        />
      </div>
    </div>
  );
};


export default StudentsRecordsCard;