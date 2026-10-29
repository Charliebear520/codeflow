export function normalizeSavedGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return { error: "這筆流程圖格式不完整，無法顯示節點與連線。" };
  const ids = new Set(); let skipped = 0;
  const supported = ["rectangle", "decision", "process", "diamond", "startEnd", "start", "end", "default", "input", "output"];
  const nodes = graph.nodes.flatMap((node) => {
    if (!node || typeof node.id !== "string" || ids.has(node.id) || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) { skipped++; return []; }
    ids.add(node.id);
    let type = node.type || "default";
    if (!supported.includes(type)) { type = "default"; skipped++; }
    const width = Number.isFinite(node.width || node.measured?.width) && (node.width || node.measured?.width) > 0 ? node.width || node.measured.width : undefined;
    const height = Number.isFinite(node.height || node.measured?.height) && (node.height || node.measured?.height) > 0 ? node.height || node.measured.height : undefined;
    return [{ id: node.id, type, position: node.position, data: { ...node.data, label: typeof node.data?.label === "string" ? node.data.label : "未命名節點" },
      ...(width ? { width } : {}), ...(height ? { height } : {}),
      style: { ...(type === "diamond" ? { width: width || 140, height: height || 110 } : {}), ...(node.style && typeof node.style === "object" ? node.style : {}) } }];
  });
  const edgeIds = new Set();
  const edges = graph.edges.flatMap((edge, index) => {
    const id = typeof edge?.id === "string" ? edge.id : `edge-${index}`;
    if (!edge || !ids.has(edge.source) || !ids.has(edge.target) || edgeIds.has(id)) { skipped++; return []; }
    edgeIds.add(id);
    return [{ id, source: edge.source, target: edge.target, type: ["straight", "step", "smoothstep", "default"].includes(edge.type) ? edge.type : "smoothstep",
      label: typeof edge.label === "string" ? edge.label : "", sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle,
      markerEnd: { type: "arrowclosed", width: 16, height: 16, color: "#a0abc2" }, style: { stroke: "#a0abc2", strokeWidth: 1.7 } }];
  });
  if (!nodes.length) return { error: "這筆紀錄沒有可顯示的有效節點；原始答案仍保留在資料庫。" };
  return { nodes, edges, warning: skipped ? "部分節點或連線格式不完整，已略過無效內容或使用一般節點顯示；沒有改動原始答案。" : null };
}
