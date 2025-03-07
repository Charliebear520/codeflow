import { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";

import RectangleNode from "./Rectangle/RectangleNode.jsx";
import DecisionNode from "./Decision/DecisionNode.jsx";
import ProcessNode from "./Process/ProcessNode.jsx";
import DiamondNode from "./Diamond/DiamondNode.jsx";

// 改用 @xyflow/react 的 CSS
import "@xyflow/react/dist/style.css";
import "./text-updater-node.css";

// 定義 nodeTypes
const nodeTypes = {
  rectangle: RectangleNode,
  decision: DecisionNode,
  process: ProcessNode,
  diamond: DiamondNode,
};

// 你在 initialNodes 中用到 updateNodeLabel，需要定義它
function updateNodeLabel(nodeId, newLabel) {
  console.log(`Node ${nodeId} label updated to: ${newLabel}`);
}

function ShapeFlow() {
  const initialNodes = [
    {
      id: "node-1",
      type: "rectangle",
      position: { x: 400, y: 0 },
      data: { label: "處理符號", onChange: updateNodeLabel },
    },
    {
      id: "node-2",
      type: "decision",
      position: { x: 10, y: 10 },
      data: { label: "起止符號", onChange: updateNodeLabel },
    },
    {
      id: "node-3",
      type: "process",
      position: { x: 20, y: 20 },
      data: { label: "輸入/輸出符號", onChange: updateNodeLabel },
    },
    {
      id: "node-4",
      type: "diamond",
      position: { x: 30, y: 30 },
      data: { label: "判斷符號", onChange: updateNodeLabel },
    },
  ];

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      // 先移除 fitView 以便觀察節點縮放效果
      style={{ backgroundColor: "#B8CEFF", width: "100%", height: "100%" }}
    />
  );
}

export default ShapeFlow;
