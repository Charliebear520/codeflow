import { Handle,Position } from '@xyflow/react';
import styles from './Triangle.module.css';


function Triangle({ data }) {
    return (
      <div className={styles.triangleNode}>
        <Handle type="target" position={Position.Top} className={styles.handleTop}/>
        <Handle type="source" position={Position.Bottom} className={styles.handleBottom}/>
      </div>
    );
  }
  
  export default Triangle;