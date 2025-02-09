import React, { useState, useEffect } from 'react';
import { Handle, NodeResizer } from '@xyflow/react';
import styles from './Diamond.module.css';

function DiamondNode({ data, id, selected, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'Default Node');

  useEffect(() => {
    setLabel(data.label || 'Default Node');
  }, [data.label]);

  const handleDoubleClick = () => {
    if (selected) setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange?.(id, label);
  };

  const handleChange = (e) => setLabel(e.target.value);

  // 調整後的 handle 位置設定，確保 handle 的中心位於菱形頂點：
  // - 上頂點 (50%, 0%) → 只需水平方向平移半個寬度
  // - 右頂點 (100%, 50%) → 需水平向左平移整個寬度，垂直向上平移半個高度
  // - 下頂點 (50%, 100%) → 需垂直向上平移整個高度，水平方向平移半個寬度
  // - 左頂點 (0%, 50%) → 需垂直向上平移半個高度
  const topPosition    = { top: '0%',   left: '50%',  transform: 'translate(-50%, 0)'    };
  const rightPosition  = { top: '50%',  left: '100%', transform: 'translate(-100%, -50%)' };
  const bottomPosition = { top: '100%', left: '50%',  transform: 'translate(-50%, -100%)' };
  const leftPosition   = { top: '50%',  left: '0%',   transform: 'translate(0, -50%)'    };

  return (
    <div className={styles.diamondNodeContainer}>
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={50}
        minHeight={50}
        lineStyle={{ border: '1px dashed #ff0071' }}
        handleStyle={{ width: 10, height: 10 }}
      />

      <div className={styles.diamondNode} onDoubleClick={handleDoubleClick}>
        {/* 上側：僅接收連線 */}
        <Handle type="target" id="target-top" style={topPosition} />

        {/* 右側：僅作為發起連線 (source) */}
        <Handle type="source" id="source-right" style={rightPosition} />

        {/* 下側：僅作為發起連線 (source) */}
        <Handle type="source" id="source-bottom" style={bottomPosition} />

        {/* 左側：僅作為發起連線 (source) */}
        <Handle type="source" id="source-left" style={leftPosition} />

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
