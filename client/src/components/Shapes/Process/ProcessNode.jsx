import React, { useState, useEffect } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import styles from "./Process.module.css";

const ProcessNode = ({ data, id, selected, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "輸入/輸出符號");

  useEffect(() => {
    setLabel(data.label || "輸入/輸出符號");
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
    <div className={styles.processNode} onDoubleClick={handleDoubleClick}>
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
  );
};

export default ProcessNode;
