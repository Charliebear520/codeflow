import React, { useState } from "react";
import styles from "./collapse.module.css";

const Collapse = () => {
  const [isCollapsed, setIsCollapsed] = useState(true); // 預設為收起狀態

  // 切換 sidebar 狀態
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={styles.container}>
      {/* 左側的 sidebar */}
      <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : styles.expanded}`}>
        <button className={styles.toggleButton} onClick={toggleSidebar}>
          {isCollapsed ? "→" : "←"} {/* 根據狀態顯示箭頭 */}
        </button>
      </div>

      {/* 主內容區域 */}
      <div className={`${styles.mainContent} ${isCollapsed ? styles.hideContent : styles.showContent}`}>
        <div className={styles.answerbox}>
          <div className={styles.text}>
            <p>
              你的流程圖存在一些問題：
              缺少判斷符號：流程圖中沒有使用判斷符號來決定是否需要帶雨傘，這是題目要求的。
              邏輯不清晰：直接將「看見外面在下雨」和「看見外面沒下雨」作為平行步驟，沒有明確的判斷過程。
              建議改進： 在「準備出門」後，加入一個判斷符號，以確認外面是否下雨。
              根據判斷結果，分別進入「去拿傘」或「不拿傘」的步驟。
            </p>
          </div>
        </div>
        <div className={styles.imagebox}>
          <div>This is your image.</div>
        </div>
      </div>
    </div>
  );
};

export default Collapse;
