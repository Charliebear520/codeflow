import { useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  useReactFlow,
  Background,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import styles from './dndflow.module.css';

import Sidebar from '../Sidebar';
import { DnDProvider, useDnD } from '../DnDContext';

import Triangle from '../Shapes/Triangle/TringleNode';
import DiamondNode from '../Shapes/Diamond/DiamondNode';

const nodeTypes = {
  triangle: Triangle, // 新增 triangle 節點
  diamond: DiamondNode, // 註冊新節點類型
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const DnDFlow = ({ initialNodes, initialEdges, onReset }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [type] = useDnD();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const updateNodeLabel = (id, newLabel) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label: newLabel } } : node
      )
    );
  };

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      if (!type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `雙擊編輯文字`, onChange: updateNodeLabel },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, type]
  );

  const resetFlow = useCallback(() => {
    setNodes([...initialNodes]);
    setEdges([...initialEdges]);
  }, [initialNodes, initialEdges]);

  useEffect(() => {
    if (onReset) {
      onReset(resetFlow);
    }
  }, [onReset, resetFlow]);

  return (
    <div className={styles.dndflow}>
      <div className={styles.reactflow_wrapper} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          style={{ backgroundColor: "#F7F9FB" }}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <Sidebar style={{ backgroundColor: "#F7F9FF" }} />
    </div>
  );
};

export default ({ initialNodes, initialEdges, onReset }) => (
  <ReactFlowProvider>
    <DnDProvider>
      <DnDFlow initialNodes={initialNodes} initialEdges={initialEdges} onReset={onReset} />
    </DnDProvider>
  </ReactFlowProvider>
);