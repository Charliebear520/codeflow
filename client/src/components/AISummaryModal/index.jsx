import React from 'react';
import { Modal } from 'antd';
import styles from './AISummaryModal.module.css';

const AISummaryModal = ({ isVisible, onClose, studentName }) => {
  return (
    <Modal
      open={isVisible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      bodyStyle={{ borderRadius: '20px' }}
    >
      <div className={styles.modalContent}>
        <h2 className={styles.header}>{studentName} 答題總結</h2>
        
        <div className={styles.mainLayout}>
          {/* 左側 */}
          <div className={styles.leftColumn}>
            <div className={styles.sectionTitle}>總結統計</div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>第一階段花費時間</div>
                <div className={styles.statValue}>12 分鐘</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>第二階段花費時間</div>
                <div className={styles.statValue}>34 分鐘</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>第三階段花費時間</div>
                <div className={styles.statValue}>58 分鐘</div>
              </div>
            </div>

            <div className={styles.totalTimeBox}>
              <div>
                <div className={styles.statLabel}>總花費時間</div>
                <div className={styles.totalValue}>104 分鐘</div>
              </div>
              <div className={styles.timeNote}>
                相較於平均的 80 分鐘顯著高出許多，表示整體流程效率可能需要檢視。
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>對話次數</div>
                <div className={styles.statValue}>125 次</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>嘗試次數</div>
                <div className={styles.statValue}>34 次</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>求助次數</div>
                <div className={styles.statValue}>58 次</div>
              </div>
            </div>

            <div className={styles.chartArea}>
               {/* 這裡之後放 Recharts 折線圖 */}
               <p style={{ color: '#999' }}>圖表載入中...</p>
            </div>
          </div>

          {/* 右側 */}
          <div className={styles.rightColumn}>
            <div className={styles.sectionTitle}>問題總結</div>
            <div className={styles.summaryCard}>
              <p>學生A的問題較多，除了沒有搞懂基本邏輯外，操作規則也不熟悉，建議可以花多點時間練習邏輯。</p>
            </div>

            <div className={styles.sectionTitle}>解題歷程分析</div>
            <div className={styles.statusTag}>✓ 目前尚可</div>

            <div className={styles.sectionTitle}>錯誤模式分析</div>
            <div className={styles.errorBox}>
              <div className={styles.errorTitle}>! 注意邏輯分析，以下為該學生常犯錯誤</div>
              <div className={styles.errorContent}>
                SyntaxError: invalid syntax (缺少冒號) if True
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AISummaryModal;