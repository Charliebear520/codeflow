import React, { useState, useEffect } from "react";
// !!! 注意這裡改用 'reactflow' 官方套件的 NodeResizer !!!
// import { Handle, NodeResizer } from 'reactflow';
import { Handle,NodeResizer } from "@xyflow/react";
import styles from "./Diamond.module.css";

function DiamondNode({ data, id, selected, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "Default Node");

  useEffect(() => {
    setLabel(data.label || "Default Node");
  }, [data.label]);

  const handleDoubleClick = () => {
    if (selected) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange?.(id, label);
  };

  const handleChange = (e) => setLabel(e.target.value);

  // 每個頂點都要有 source + target，各自帶有 id
  // clip-path 頂點座標: (50%,0%), (100%,50%), (50%,100%), (0%,50%)
  const handleTop = { top: "0%", left: "50%", transform: "translate(-50%, -50%)" };
  const handleRight = { top: "50%", left: "100%", transform: "translate(-50%, -50%)" };
  const handleBottom = { top: "100%", left: "50%", transform: "translate(-50%, -50%)" };
  const handleLeft = { top: "50%", left: "0%", transform: "translate(-50%, -50%)" };

  return (
    <div className={styles.diamondNodeContainer}>
      {/* 將 NodeResizer 放在外層，確保可自由縮放 */}
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={50}
        minHeight={50}
        lineStyle={{ border: "1px dashed #ff0071" }}
        handleStyle={{ width: 10, height: 10 }}
      />

      <div className={styles.diamondNode} onDoubleClick={handleDoubleClick}>
        {/* 上頂點：source + target，並加上唯一的 id */}
        <Handle type="source" id="source-top" style={handleTop} />
        <Handle type="target" id="target-top" style={handleTop} />

        {/* 右頂點 */}
        <Handle type="source" id="source-right" style={handleRight} />
        <Handle type="target" id="target-right" style={handleRight} />

        {/* 下頂點 */}
        <Handle type="source" id="source-bottom" style={handleBottom} />
        <Handle type="target" id="target-bottom" style={handleBottom} />

        {/* 左頂點 */}
        <Handle type="source" id="source-left" style={handleLeft} />
        <Handle type="target" id="target-left" style={handleLeft} />

        {isEditing ? (
          <input
            type="text"
            value={label}
            onChange={handleChange}
            onBlur={handleBlur}
            autoFocus
            className={styles.input}
          />
        ) : (
          <div className={styles.label}>{label}</div>
        )}
      </div>
    </div>
  );
}

export default DiamondNode;
