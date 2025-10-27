import React, { useState, useEffect } from "react";
import { Handle, Position, NodeResizer, NodeToolbar } from "@xyflow/react";
import styles from "./Decision.module.css";

const DecisionNode = ({ data, id, selected, onChange, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "判斷符號");

  useEffect(() => {
    setLabel(data.label || "判斷符號");
  }, [data.label]);

  const handleDoubleClick = () => {
    if (selected) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onChange) {
      onChange(id, label);
    }
  };

  const handleChange = (e) => {
    setLabel(e.target.value);
  };

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <button
          onClick={() => onDelete && onDelete(id)}
          style={{
            background: "rgb(255 56 73 / 81%)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          ⚠️ 刪除
        </button>
      </NodeToolbar>
      <div className={styles.decisionNode} onDoubleClick={handleDoubleClick}>
        <NodeResizer
          color="#ff0071"
          isVisible={selected}
          minWidth={80}
          minHeight={50}
        />
        <Handle type="target" position={Position.Top} />
        {/* <Handle type="source" position={Position.Top} />
        <Handle type="target" position={Position.Right} />
        <Handle type="source" position={Position.Right} />
        <Handle type="target" position={Position.Bottom} /> */}
        <Handle type="source" position={Position.Bottom} />
        {/* <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Left} /> */}
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
    </>
  );
};

export default DecisionNode;
