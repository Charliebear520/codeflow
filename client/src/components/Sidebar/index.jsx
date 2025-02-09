import React from "react";
import { useDnD } from "../DnDContext";
import styles from "./sidebar.module.css";

export default () => {
  const [_, setType] = useDnD();

  const onDragStart = (event, nodeType) => {
    setType(nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={styles.container}>
      {/* <div className={styles.description}>You can drag these nodes to the pane on the right.</div> */}
      <div className={styles.symbolbox}>
        <div className={styles.node_box}>
          <div className={styles.dndnode_input_box}>
            <div
              className={styles.dndnode_input}
              onDragStart={(event) => onDragStart(event, "rectangle")}
              draggable
            ></div>
          </div>
          <p style={{ margin: 0 }}>處理符號</p>
        </div>
        <div className={styles.node_box}>
          <div className={styles.dndnode_output_box}>
            <div
              className={styles.dndnode_output}
              onDragStart={(event) => onDragStart(event, "decision")}
              draggable
            ></div>
          </div>
          <p style={{ margin: 0 }}>判斷符號</p>
        </div>

        <div className={styles.node_box}>
          <div className={styles.dndnode_diamond_box}>
            <div
              className={styles.dndnode_diamond}
              onDragStart={(event) => onDragStart(event, "diamond")}
              draggable
            ></div>
          </div>
          <p style={{ margin: 0 }}>起止符號</p>
        </div>

        <div className={styles.node_box}>
          <div className={styles.dndnode_process_box}>
            <div
              className={styles.dndnode_process}
              onDragStart={(event) => onDragStart(event, "process")}
              draggable
            ></div>
          </div>
          <p style={{ margin: 0 }}>流程符號</p>
        </div>
      </div>
    </div>
  );
};
