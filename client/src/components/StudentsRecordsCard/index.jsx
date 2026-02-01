import React, { useState } from "react";
import styles from "./StudentsRecordsCard.module.css";
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd'; 
import StudentAnswerModal from "../StudentAnswerModal";
import AISummaryModal from "../AISummaryModal/index.jsx";

const StudentsRecordsCard = () => {
 // 建立控制 AI 總結彈窗的狀態
  const [isAIModalVisible, setIsAIModalVisible] = useState(false);

  const showAIModal = () => {
    setIsAIModalVisible(true);
  };

  const handleClose = () => {
    setIsAIModalVisible(false);
  };

    return (
    <div className={styles.card}>
      <div className={styles.substance}>
        <div className={styles.studentName}>學生</div>
        <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段一</div>
          <CheckOutlined className={styles.CheckOutlined} />
          <StudentAnswerModal className={styles.checkButton}/>
        </div>
        <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段二</div>
          <CloseOutlined className={styles.CloseOutlined} />
          <StudentAnswerModal className={styles.checkButton}/>
        </div>
        <div className={styles.checkbox}>
          <div className={styles.homeworkText}>階段三</div>
          <CheckOutlined className={styles.CheckOutlined} />
          <StudentAnswerModal className={styles.checkButton}/>
        </div>
        {/* AI 總結按鈕：加入 onClick 事件 */}
        <Button className={styles.aiButton} onClick={showAIModal}>
          AI總結
        </Button>

        {/* 引入 AI 總結彈窗元件 */}
        <AISummaryModal 
          isVisible={isAIModalVisible} 
          onClose={handleClose} 
          studentName="學生 A - 01" // 可以根據 props 傳遞不同學生姓名
        />
      </div>
    </div>
  );
};


export default StudentsRecordsCard;