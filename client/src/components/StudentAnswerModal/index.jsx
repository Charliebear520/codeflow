import { useState } from 'react';
import { Button, Modal, Tabs } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import styles from "./StudentAnswerModal.module.css"

export default function StudentAnswerModal({
  openStage,        // 'stage1' | 'stage2' | 'stage3' | null
  onClose,
  submission,
  student,
}) {
  if (!openStage) return null;

  const s1 = submission?.stages?.stage1 || {};
  const s2 = submission?.stages?.stage2 || {};
  const s3 = submission?.stages?.stage3 || {};
  const titleMap = {
    stage1: "階段一的答案",
    stage2: "階段二的答案",
    stage3: "階段三的答案",
  };
  const name = student?.name || student?.email || "學生";
  const stageLabel = titleMap[openStage] || "作答顯示";

  const title = (
    <div className={styles.title}>
      <h2 className={styles.titleName}>{name}</h2>
      <h2 className={styles.titleSep}>-</h2>
      <h2 className={styles.titleStage}>{stageLabel}</h2>
    </div>
  );

  // 根據 openStage 決定要顯示的內容
  let content = null;
  if (openStage === "stage1") {
    content = (
      <div className={styles.block}>
        {s1.imageBase64 ? (
          <img
            src={s1.imageBase64}
            alt="流程圖截圖"
            className={styles.image}
          />
        ) : s1.graph ? (
          <pre className={styles.codebox}>
            {JSON.stringify(s1.graph, null, 2)}
          </pre>
        ) : (
          <div className={styles.empty}>沒有可顯示的內容</div>
        )}
      </div>
    );
  }

  if (openStage === "stage2") {
    content = (
      <div className={styles.block}>
        {s2.pseudocode ? (
          <pre className={styles.codebox}>{s2.pseudocode}</pre>
        ) : (
          <div className={styles.empty}>沒有可顯示的內容</div>
        )}
      </div>
    );
  }

  if (openStage === "stage3") {
    content = (
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>程式碼</h3>
        {s3.code ? (
          <>
            <div className={styles.meta}>
              語言：{s3.language || "未標註"}
            </div>
            <pre className={styles.codebox}>{s3.code}</pre>

            {(s3.stdout || s3.stderr) && (
              <>
                <h4 className={styles.blockSubTitle}>執行結果</h4>
                {s3.stdout && (
                  <>
                    <div className={styles.meta}>輸出：</div>
                    <pre className={styles.codebox}>{s3.stdout}</pre>
                  </>
                )}
                {s3.stderr && (
                  <>
                    <div className={styles.metaError}>錯誤：</div>
                    <pre className={styles.codeboxError}>{s3.stderr}</pre>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <div className={styles.empty}>沒有可顯示的內容</div>
        )}
      </div>
    );
  }

  // const current = {
  //   stage1: { label: "階段一", children: Stage1 },
  //   stage2: { label: "階段二", children: Stage2 },
  //   stage3: { label: "階段三", children: Stage3 },
  // }[openStage];

  return (
    <Modal
      title={title}
      open={!!openStage}
      onCancel={onClose}
      onOk={onClose}
      width={760}
      bodyStyle={{padding:24}}
      closeIcon={<CloseOutlined style={{ color: "#3B82F6", fontSize: 20 }} />}
      destroyOnClose
    >
      {content}
    </Modal>
  );
}