import React from "react";
import styles from "./tutor.module.css";

const AI = ({ feedback }) => {
  return (
    <div className={styles.container}>
      <div style={{ whiteSpace: "pre-line" }}>
        {feedback || "請在左側完成檢查，這裡會顯示AI助教回饋。"}
      </div>
    </div>
  );
};

export default AI;
