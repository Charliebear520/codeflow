import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Modal, Input } from "antd"; // ✅ 新增 Ant Design 組件
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  useReactFlow,
  Background,
  Panel,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import styles from "./dndflow.module.css";

import Sidebar from "../Sidebar";
import { DnDProvider, useDnD } from "../DnDContext";

import Triangle from "../Shapes/Triangle/TringleNode";
import DiamondNode from "../Shapes/Diamond/DiamondNode";

const nodeTypes = {
  triangle: Triangle,
  diamond: DiamondNode,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const DnDFlow = forwardRef(({ initialNodes, initialEdges, onReset }, ref) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [type] = useDnD();

  // ✅ 新增狀態來管理 Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEdgeId, setCurrentEdgeId] = useState(null);
  const [newLabel, setNewLabel] = useState("");

  // ✅ 暴露重置方法給父組件
  useImperativeHandle(ref, () => ({
    resetFlow: () => {
      setNodes(initialNodes);
      setEdges(initialEdges);
    },
  }));

  // ✅ 點擊 edge 時開啟 Modal
  const onEdgeClick = (event, edge) => {
    setCurrentEdgeId(edge.id);
    setNewLabel(edge.label || "");
    setIsModalOpen(true);
  };

  // ✅ 更新 edge 的 label
  const handleUpdateEdgeLabel = () => {
    setEdges((eds) =>
      eds.map((e) => (e.id === currentEdgeId ? { ...e, label: newLabel } : e))
    );
    setIsModalOpen(false);
  };

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: "請輸入文字",
            markerEnd: { type: "arrow" },
            style: { strokeWidth: 2, stroke: "#007bff" },
          },
          eds
        )
      ),
    []
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const updateNodeLabel = (id, newLabel) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newLabel } }
          : node
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
          onEdgeClick={onEdgeClick} // ✅ 讓 edges 可點擊編輯
          nodeTypes={nodeTypes}
          fitView
          style={{ backgroundColor: "#F7F9FB" }}
        >
          <svg>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#007bff" />
              </marker>
            </defs>
          </svg>
          <Panel position="bottom-center">
            <Sidebar style={{ backgroundColor: "#F7F9FF" }} />
          </Panel>
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* ✅ Modal 讓使用者輸入新的 edge 文字 */}
      <Modal
        title="編輯連線文字"
        open={isModalOpen}
        onOk={handleUpdateEdgeLabel}
        onCancel={() => setIsModalOpen(false)}
        okText="確認"
        cancelText="取消"
      >
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          allowClear
          placeholder="輸入新的連線文字"
        />
      </Modal>
    </div>
  );
});

// 包裝導出的組件
export default forwardRef((props, ref) => (
  <ReactFlowProvider>
    <DnDProvider>
      <DnDFlow {...props} ref={ref} />
    </DnDProvider>
  </ReactFlowProvider>
));
