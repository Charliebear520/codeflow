import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Modal, Input } from "antd";
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

import RectangleNode from "../Shapes/Rectangle/RectangleNode";
import DecisionNode from "../Shapes/Decision/DecisionNode";
import ProcessNode from "../Shapes/Process/ProcessNode";
import DiamondNode from "../Shapes/Diamond/DiamondNode";

const nodeTypes = {
  rectangle: RectangleNode,
  decision: DecisionNode,
  process: ProcessNode,
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

  // 狀態：編輯節點與邊的相關資料
  const [isEditing, setIsEditing] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEdgeId, setCurrentEdgeId] = useState(null);

  useImperativeHandle(ref, () => ({
    resetFlow: () => {
      setNodes(initialNodes);
      setEdges(initialEdges);
    },
  }));

  // 這裡我們使用 onEdgeDoubleClick，僅在雙擊時觸發編輯邊文字
  const onEdgeDoubleClick = (event, edge) => {
    setCurrentEdgeId(edge.id);
    setNewLabel(edge.label || "");
    setIsModalOpen(true);
  };

  const handleUpdateEdgeLabel = () => {
    setEdges((eds) =>
      eds.map((e) => (e.id === currentEdgeId ? { ...e, label: newLabel } : e))
    );
    setIsModalOpen(false);
  };

  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge(
        {
          ...params,
          type: "smoothstep",
          markerEnd: {
            type: "arrow",
            color: "#007bff",
          },
        },
        eds
      )
    );
  }, []);

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
      if (!type) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const defaultLabels = {
        rectangle: "處理符號",
        decision: "起止符號",
        process: "輸入/輸出符號",
        diamond: "判斷符號",
      };
      const newNode = {
        id: getId(),
        type,
        position,
        data: {
          label: defaultLabels[type] || "雙擊編輯文字",
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, type]
  );

  const handleNodeDoubleClick = (event, node) => {
    setCurrentNodeId(node.id);
    setNewLabel(node.data.label);
    setIsEditing(true);
  };

  const handleLabelChange = (e) => {
    setNewLabel(e.target.value);
  };

  const handleLabelSubmit = () => {
    updateNodeLabel(currentNodeId, newLabel);
    setIsEditing(false);
  };

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
          onEdgeDoubleClick={onEdgeDoubleClick} // 使用雙擊事件
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          defaultzoom={0.5} // 初始縮放比例
          defaultposition={[0, 0]} // 初始偏移，x 與 y 分別代表水平與垂直位移
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

      {/* 編輯連線文字 Modal */}
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

      {isEditing && (
        <Modal
          title="編輯節點文字"
          open={isEditing}
          onOk={handleLabelSubmit}
          onCancel={() => setIsEditing(false)}
          okText="確認"
          cancelText="取消"
        >
          <Input
            value={newLabel}
            onChange={handleLabelChange}
            allowClear
            placeholder="輸入新的節點文字"
          />
        </Modal>
      )}
    </div>
  );
});

export default forwardRef((props, ref) => (
  <ReactFlowProvider>
    <DnDProvider>
      <DnDFlow {...props} ref={ref} />
    </DnDProvider>
  </ReactFlowProvider>
));
