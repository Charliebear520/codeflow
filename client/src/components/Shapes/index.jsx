import { useCallback, useState } from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
} from "reactflow";
import RectangleNode from "./Rectangle/RectangleNode.jsx";
import DecisionNode from "./Decision/DecisionNode.jsx";
import ProcessNode from "./Process/ProcessNode.jsx";
import DiamondNode from "./Diamond/DiamondNode.jsx";
import "reactflow/dist/style.css";
import "./text-updater-node.css";

const rfStyle = {
  backgroundColor: "#B8CEFF",
};

// we define the nodeTypes outside of the component to prevent re-renderings
// you could also use useMemo inside the component
const nodeTypes = {
  rectangle: RectangleNode,
  decision: DecisionNode,
  process: ProcessNode,
  diamond: DiamondNode,
};

function ShapeFlow() {
  const [btnArray, setBtnArray] = useState([]);
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
      data: { label: "判斷符號", onChange: updateNodeLabel },
    },
    {
      id: "node-3",
      type: "process",
      position: { x: 20, y: 20 },
      data: { label: "流程符號", onChange: updateNodeLabel },
    },
    {
      id: "node-4",
      type: "diamond",
      position: { x: 30, y: 30 },
      data: { label: "起止符號", onChange: updateNodeLabel },
    },
  ];
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);

  const handleSetbtnArray = () => {
    setBtnArray((prev) => btnArray.push("scghsvdghsvc"));
    console.log(btnArray);
    setNodes([...nodes]);
  };

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  return (
    // <ReactFlowProvider>
    // </ReactFlowProvider>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      style={rfStyle}
    />
  );
}

export default ShapeFlow;
