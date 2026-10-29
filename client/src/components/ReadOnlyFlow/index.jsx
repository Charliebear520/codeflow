import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "antd";
import { ReactFlow, ReactFlowProvider, Controls, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import RectangleNode from "../Shapes/Rectangle/RectangleNode";
import DecisionNode from "../Shapes/Decision/DecisionNode";
import ProcessNode from "../Shapes/Process/ProcessNode";
import DiamondNode from "../Shapes/Diamond/DiamondNode";
import { normalizeSavedGraph } from "../../lib/savedGraph";
import styles from "./ReadOnlyFlow.module.css";

function StartEnd({ data }) {
  return <div className={styles.startEnd}><Handle type="target" position={Position.Top} />{data.label}<Handle type="source" position={Position.Bottom} /></div>;
}
const nodeTypes = { rectangle: RectangleNode, decision: DecisionNode, process: ProcessNode, diamond: DiamondNode, startEnd: StartEnd, start: StartEnd, end: StartEnd };
class FlowBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Alert type="info" message="這筆流程圖無法預覽，原始答案仍保留；請通知教師檢查格式。" /> : this.props.children; }
}
export default function ReadOnlyFlow({ graph }) {
  const saved = useMemo(() => normalizeSavedGraph(graph), [graph]);
  const box = useRef(null);
  const [instance, setInstance] = useState(null);
  useEffect(() => {
    if (!instance || !box.current) return;
    let timer;
    const fit = () => { clearTimeout(timer); timer = setTimeout(() => instance.fitView({ padding: 0.15, maxZoom: 1.15 }), 100); };
    const observer = new ResizeObserver(fit); observer.observe(box.current); fit();
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [instance, saved]);
  if (saved.error) return <Alert type="info" showIcon message={saved.error} />;
  return <div>
    {saved.warning && <Alert type="warning" message={saved.warning} style={{ marginBottom: 8 }} />}
    <div className={styles.canvas} ref={box} aria-label="唯讀學生流程圖">
      <FlowBoundary><ReactFlowProvider><ReactFlow nodes={saved.nodes} edges={saved.edges} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.6}
        fitViewOptions={{padding:0.15,maxZoom:1.15}} onInit={setInstance} nodesDraggable={false} nodesConnectable={false}
        elementsSelectable={false} deleteKeyCode={null} edgesFocusable={false} nodesFocusable={false} zoomOnScroll={false} preventScrolling={false}>
        <Controls showInteractive={false} />
      </ReactFlow></ReactFlowProvider></FlowBoundary>
    </div>
  </div>;
}
