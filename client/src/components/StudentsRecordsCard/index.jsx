import styles from "./StudentsRecordsCard.module.css";
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd'; 
import StudentAnswerModal from "../StudentAnswerModal";

const StudentsRecordsCard = () => {
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
        <Button className={styles.aiButton}>AI總結</Button>
      </div>
    </div>
  );
};


export default StudentsRecordsCard;