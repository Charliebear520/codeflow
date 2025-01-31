import { Handle, Position, NodeResizer } from '@xyflow/react';
import styles from './Triangle.module.css';

function Triangle({ data, selected }) {
    return (
      <div className={styles.triangleNode}>
        {/* 可調整大小的框架 */}
        <NodeResizer color="#ff0071" isVisible={selected} minWidth={80} minHeight={50} />

        {/* 連接點 */}
        <Handle type="target" position={Position.Top} className={styles.handleTop}/>
        <Handle type="source" position={Position.Bottom} className={styles.handleBottom}/>
      </div>
    );
}

export default Triangle;
