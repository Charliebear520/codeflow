import { useState } from 'react';
import {Button, Modal } from 'antd';
import styles from "./StudentAnswerModal.module.css"

const StudentAnswerModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showModal = () => {
    setIsModalOpen(true);
  };
  const handleOk = () => {
    setIsModalOpen(false);
  };
  const handleCancel = () => {
    setIsModalOpen(false);
  };
  return (
    <>
      <Button type="primary" onClick={showModal}  className={styles.checkButton}>
        查看
      </Button>
      <Modal
        title="作答顯示"
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <div className={styles.modalstyle}>
            <h3>第一階段</h3>
            <img src={"/studentanswer.png"}  width={400} height={400}/>
            <p>Some contents...</p>

        </div>
        
      </Modal>
    </>
  );
};
export default StudentAnswerModal;