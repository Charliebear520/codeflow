import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './Diamond.module.css';

function DiamondNode({ data, id, selected, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'Default Node');
  const handleTopStyle = { top: 0 };
  const handleBottomStyle = { left: 0 };

  useEffect(() => {
    setLabel(data.label || 'Default Node');
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
    <div className={styles.diamondNode} onDoubleClick={handleDoubleClick}>
      <Handle type="target" position={Position.Right} style={handleTopStyle}/>
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
      <Handle type="source" position={Position.Bottom} style={handleBottomStyle}/>
    </div>
  );
}

export default DiamondNode;
