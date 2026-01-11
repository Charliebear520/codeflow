import React, { useState, useEffect, useRef } from "react";
import styles from "./check.module.css";
import { Button, Spin, Input, Flex, App } from "antd";
import { UserOutlined, SendOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@clerk/clerk-react";
import { toPng } from "html-to-image";

const { TextArea } = Input;

const Check = ({ feedback, isChecking, onTutorClick, stage, question }) => {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastCheckHash, setLastCheckHash] = useState(null); // 記錄上次檢查的流程圖狀態

  const chatBoxRef = useRef(null);

  // Auth 和工具
  const { isSignedIn, getToken } = useAuth();
  const { message } = App.useApp();
  const dispatch = useDispatch();

  // 從 Redux 取得資料
  const byStage = useSelector((state) => state.check.byStage);
  const scores = useSelector((state) => state.check.scores);
  const diffs = useSelector((state) => state.check.diffs);
  const checkFeedback = useSelector((state) => state.check.feedback);

  // 優先使用新格式的完整回饋，否則使用舊格式
  const stageResult =
    feedback != null ? feedback : stage ? byStage?.[stage] || null : null;

  // 從 Redux 獲取詳細的建議資料
  const hasSuggestionsData = scores && diffs && checkFeedback;

  // 1. 自動捲動邏輯
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  // 2. 初始訊息：將 AI 第一次的分析結果放入對話框
  useEffect(() => {
    if (stageResult && messages.length === 0) {
      setMessages([{ sender: "assistant", text: stageResult }]);
    }
  }, [stageResult]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // *** 計算流程圖的 hash 值 ***
  const getFlowHash = () => {
    const reactFlowInstance = window.reactFlowInstance;
    if (!reactFlowInstance) return null;

    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();

    // 使用節點數量、邊數量和節點標籤組成 hash
    const nodeLabels = nodes.map((n) => n.data?.label || "").join(",");
    const edgeLabels = edges
      .map((e) => `${e.source}-${e.target}-${e.label || ""}`)
      .join(",");

    return `${nodes.length}-${edges.length}-${nodeLabels}-${edgeLabels}`;
  };

  // *** 格式化詳細分析 ***
  const formatDetailedAnalysis = (diffs) => {
    if (!diffs) return "暫無分析資料";

    const sections = [];

    // 1. 結構問題
    if (diffs.structureIssues && diffs.structureIssues.length > 0) {
      sections.push(
        "### 🏗️ 結構問題\n" +
          diffs.structureIssues.map((issue) => `- ${issue}`).join("\n")
      );
    } else {
      sections.push("### 🏗️ 結構問題\n✅ 沒有問題");
    }

    // 2. 缺少節點
    if (diffs.missingNodes && diffs.missingNodes.length > 0) {
      sections.push(
        "### 📦 缺少節點\n" +
          diffs.missingNodes
            .map((node) => `- **${node.type}**：${node.label || "（無標籤）"}`)
            .join("\n")
      );
    } else {
      sections.push("### 📦 缺少節點\n✅ 沒有問題");
    }

    // 3. 缺少連線
    if (diffs.missingEdges && diffs.missingEdges.length > 0) {
      sections.push(
        "### 🔗 缺少連線\n" +
          diffs.missingEdges
            .map(
              (edge) =>
                `- \`${edge.from}\` → \`${edge.to}\`${
                  edge.label ? ` (${edge.label})` : ""
                }`
            )
            .join("\n")
      );
    } else {
      sections.push("### 🔗 缺少連線\n✅ 沒有問題");
    }

    // 4. 邏輯問題
    if (diffs.logicIssues && diffs.logicIssues.length > 0) {
      sections.push(
        "### 🧠 邏輯問題\n" +
          diffs.logicIssues.map((issue) => `- ${issue}`).join("\n")
      );
    } else {
      sections.push("### 🧠 邏輯問題\n✅ 沒有問題");
    }

    return sections.join("\n\n");
  };

  // *** 格式化檢查結果(數字列表) ***
  const formatCheckResult = (diffs) => {
    if (!diffs) return "暫無分析資料";

    let itemNumber = 1;
    const items = [];

    // 1. 缺少節點
    if (diffs.missingNodes && diffs.missingNodes.length > 0) {
      diffs.missingNodes.forEach((node) => {
        items.push(
          `${itemNumber}. 缺少節點：**${node.type}**${
            node.label ? ` - ${node.label}` : ""
          }`
        );
        itemNumber++;
      });
    }

    // 2. 缺少連線
    if (diffs.missingEdges && diffs.missingEdges.length > 0) {
      diffs.missingEdges.forEach((edge) => {
        items.push(
          `${itemNumber}. 缺少連線：${edge.from} → ${edge.to}${
            edge.label ? ` (${edge.label})` : ""
          }`
        );
        itemNumber++;
      });
    }

    // 3. 結構問題
    if (diffs.structureIssues && diffs.structureIssues.length > 0) {
      diffs.structureIssues.forEach((issue) => {
        items.push(`${itemNumber}. 結構問題：${issue}`);
        itemNumber++;
      });
    }

    // 4. 邏輯問題
    if (diffs.logicIssues && diffs.logicIssues.length > 0) {
      diffs.logicIssues.forEach((issue) => {
        items.push(`${itemNumber}. 邏輯問題：${issue}`);
        itemNumber++;
      });
    }

    // 如果沒有任何問題
    if (items.length === 0) {
      return "✅ 太棒了！流程圖沒有發現任何問題！";
    }

    return items.join("\n\n");
  };

  // *** 執行檢查並顯示 AI 建議 ***
  const handleCheck = async () => {
    console.log("🟢 ========== 【檢查】按鈕 DEBUG 開始 ==========");
    if (isTyping) return;

    // 先將使用者訊息加入畫面
    const newUserMessage = {
      sender: "user",
      text: "請幫我檢查目前的邏輯是否正確",
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsTyping(true);

    try {
      // 顯示檢查中訊息
      const checkingMsg = {
        sender: "assistant",
        text: "好的！讓我先幫你檢查流程圖... 🔍",
      };
      setMessages((prev) => [...prev, checkingMsg]);

      // 執行檢查 API
      if (!isSignedIn) {
        throw new Error("請先登入");
      }

      // 從 ReactFlow DOM 獲取流程圖資料
      const reactFlowWrapper = document.querySelector(".react-flow");
      if (!reactFlowWrapper) {
        throw new Error("找不到流程圖，請確認已繪製流程圖");
      }

      // 使用 React Flow 的內部實例獲取資料
      const reactFlowInstance = window.reactFlowInstance;
      if (!reactFlowInstance) {
        throw new Error("流程圖尚未初始化，請稍後再試");
      }

      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();

      if (!nodes || nodes.length === 0) {
        throw new Error("請先繪製流程圖");
      }

      console.log("🔍 Debug 檢查點 1: 流程圖資料");
      console.log("  - nodes 數量:", nodes.length);
      console.log("  - edges 數量:", edges.length);

      // 生成圖片
      const dataUrl = await toPng(reactFlowWrapper, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const payload = {
        questionId: "Q001",
        graph: { nodes, edges },
        imageBase64: dataUrl.split(",")[1],
      };

      console.log("🔍 Debug 檢查點 2: 準備呼叫 API");
      console.log(
        "  - endpoint: http://localhost:5000/api/submissions/stage1/compare"
      );
      console.log("  - questionId:", payload.questionId);
      console.log("  - 圖片大小:", payload.imageBase64.length, "bytes");

      const token = await getToken();
      const res = await fetch(
        `http://localhost:5000/api/submissions/stage1/compare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      console.log("🔍 Debug 檢查點 3: API 回應");
      console.log("  - HTTP 狀態:", res.status, res.statusText);
      console.log("  - res.ok:", res.ok);
      console.log("  - data.success:", data.success);
      console.log("  - data.scores:", data.scores);
      console.log("  - data.diffs:", data.diffs);
      console.log("🚨 關鍵: data.feedback 內容");
      console.log("=".repeat(80));
      console.log(data.feedback);
      console.log("=".repeat(80));
      console.log("  - feedback 長度:", data.feedback?.length);
      console.log("  - 包含 '-':", data.feedback?.includes("-"));
      console.log("  - 包含 '•':", data.feedback?.includes("•"));
      console.log("  - 包含 '*':", data.feedback?.includes("*"));
      console.log("  - 包含 '1.':", data.feedback?.includes("1."));
      console.log("  - 包含 '2.':", data.feedback?.includes("2."));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "檢查失敗");
      }

      // 儲存到 Redux
      console.log("🔍 Debug 檢查點 4: 儲存到 Redux");
      dispatch({
        type: "check/setCheckResult",
        payload: {
          scores: data.scores,
          diffs: data.diffs,
          feedback: data.feedback,
          submissionId: data.submissionId,
        },
      });
      console.log("  - 已儲存 feedback 到 Redux.check.feedback");

      // 更新最後檢查的 hash
      const newHash = getFlowHash();
      setLastCheckHash(newHash);
      console.log("🔍 Debug 檢查點 5: 更新 lastCheckHash");
      console.log("  - 新的 lastCheckHash:", newHash);

      // 顯示檢查結果（使用 data.diffs 結構化資料）
      const formattedResult = formatCheckResult(data.diffs);
      const checkResultText = `## 檢查結果\n\n${formattedResult}\n\n---\n\n有任何問題都可以隨時問我喔！`;

      console.log("🔍 Debug 檢查點 6: 最終顯示文字");
      console.log("  - 使用數據來源: data.diffs (結構化資料)");
      console.log("  - checkResultText 長度:", checkResultText.length);
      console.log("  - 格式: 數字列表 (1. 2. 3.)");
      console.log("🟢 ========== 【檢查】按鈕 DEBUG 結束 ==========\n");

      setMessages((prev) => [
        ...prev.slice(0, -1), // 移除「檢查中」訊息
        { sender: "assistant", text: checkResultText },
      ]);
    } catch (error) {
      console.error("❌ 檢查失敗:", error);
      console.error("  - 錯誤訊息:", error.message);
      console.error("  - 錯誤堆疊:", error.stack);
      console.log("🟢 ========== 【檢查】按鈕 DEBUG 結束 (錯誤) ==========\n");

      setMessages((prev) => [
        ...prev.slice(0, -1), // 移除「檢查中」訊息
        {
          sender: "assistant",
          text: `❌ ${error.message || "檢查過程發生錯誤，請稍後再試。"}`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // *** 核心功能：向後端傳送訊息並獲取實時 AI 回覆 ***
  const handleSend = async (textOverride = null) => {
    const textToSend = (
      typeof textOverride === "string" ? textOverride : inputValue
    ).trim();

    if (textToSend === "" || isTyping) return;

    // A. 先將使用者訊息加入畫面
    const newUserMessage = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue(""); // 清空輸入框

    // B. 特殊處理：如果是「接下來該怎麼做」
    if (textToSend.includes("接下來")) {
      console.log("🔵 ========== 【接下來該怎麼做】DEBUG 開始 ==========");
      setIsTyping(true);

      // 檢查流程圖是否有變更
      const currentHash = getFlowHash();
      const flowChanged = !lastCheckHash || currentHash !== lastCheckHash;

      console.log("🔍 Debug 檢查點 1: 流程圖狀態");
      console.log("  - currentHash:", currentHash);
      console.log("  - lastCheckHash:", lastCheckHash);
      console.log("  - flowChanged:", flowChanged);
      console.log("  - hasSuggestionsData:", hasSuggestionsData);
      console.log("  - scores:", scores);
      console.log("  - diffs:", diffs);
      console.log("🚨 關鍵: checkFeedback 狀態");
      console.log("  - checkFeedback:", checkFeedback);
      console.log("  - checkFeedback 長度:", checkFeedback?.length);
      console.log("  - 包含 '-':", checkFeedback?.includes("-"));
      console.log("  - 包含 '•':", checkFeedback?.includes("•"));
      console.log("  - 包含 '*':", checkFeedback?.includes("*"));

      // B1. 如果沒有建議資料或流程圖已變更，需要重新執行檢查
      if (!hasSuggestionsData || flowChanged) {
        console.log("🟢 決策: 需要重新檢查");
        console.log(
          "  - 原因: hasSuggestionsData=",
          hasSuggestionsData,
          ", flowChanged=",
          flowChanged
        );
        try {
          // 顯示檢查中訊息
          const checkingMsg = {
            sender: "assistant",
            text: flowChanged
              ? "流程圖有變更，讓我重新幫你檢查... 🔍"
              : "好的！讓我先幫你檢查流程圖... 🔍",
          };
          setMessages((prev) => [...prev, checkingMsg]);

          // 執行檢查 API
          if (!isSignedIn) {
            throw new Error("請先登入");
          }

          // 從 ReactFlow DOM 獲取流程圖資料
          const reactFlowWrapper = document.querySelector(".react-flow");
          if (!reactFlowWrapper) {
            throw new Error("找不到流程圖，請確認已繪製流程圖");
          }

          // 使用 React Flow 的內部實例獲取資料
          const reactFlowInstance = window.reactFlowInstance;
          if (!reactFlowInstance) {
            throw new Error("流程圖尚未初始化，請稍後再試");
          }

          const nodes = reactFlowInstance.getNodes();
          const edges = reactFlowInstance.getEdges();

          if (!nodes || nodes.length === 0) {
            throw new Error("請先繪製流程圖");
          }

          // 生成圖片
          const dataUrl = await toPng(reactFlowWrapper, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
          });

          const payload = {
            questionId: "Q001",
            graph: { nodes, edges },
            imageBase64: dataUrl.split(",")[1],
          };

          const token = await getToken();

          console.log("🔍 Debug 檢查點 2: 準備呼叫 API");
          console.log(
            "  - endpoint: http://localhost:5000/api/submissions/stage1/compare"
          );
          console.log("  - questionId:", payload.questionId);
          console.log("  - nodes 數量:", payload.graph.nodes.length);
          console.log("  - edges 數量:", payload.graph.edges.length);
          console.log("  - 圖片大小:", payload.imageBase64.length, "bytes");

          const res = await fetch(
            `http://localhost:5000/api/submissions/stage1/compare`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            }
          );

          const data = await res.json();

          console.log("🔍 Debug 檢查點 3: API 回應");
          console.log("  - HTTP 狀態:", res.status, res.statusText);
          console.log("  - res.ok:", res.ok);
          console.log("  - data.success:", data.success);
          console.log("  - data.scores:", data.scores);
          console.log("  - data.diffs:", data.diffs);
          console.log("🚨 關鍵: data.feedback 內容");
          console.log("=".repeat(80));
          console.log(data.feedback);
          console.log("=".repeat(80));
          console.log("  - feedback 長度:", data.feedback?.length);
          console.log("  - 包含 '-':", data.feedback?.includes("-"));
          console.log("  - 包含 '•':", data.feedback?.includes("•"));
          console.log("  - 包含 '*':", data.feedback?.includes("*"));
          console.log("  - 包含 '1.':", data.feedback?.includes("1."));
          console.log("  - 包含 '2.':", data.feedback?.includes("2."));

          if (!res.ok || !data.success) {
            throw new Error(data.error || "檢查失敗");
          }

          // 儲存到 Redux
          console.log("🔍 Debug 檢查點 4: 儲存到 Redux");
          dispatch({
            type: "check/setCheckResult",
            payload: {
              scores: data.scores,
              diffs: data.diffs,
              feedback: data.feedback,
              submissionId: data.submissionId,
            },
          });
          console.log("  - 已儲存 feedback 到 Redux.check.feedback");

          // 更新最後檢查的 hash
          setLastCheckHash(currentHash);
          console.log("🔍 Debug 檢查點 5: 更新 lastCheckHash");
          console.log("  - 新的 lastCheckHash:", currentHash);

          // 顯示最新的 AI 建議
          const suggestionsText =
            `## 助教建議\n\n${data.feedback}\n\n` +
            `---\n\n你可以根據以上建議調整你的流程圖，有任何問題都可以隨時問我喔！`;

          setMessages((prev) => [
            ...prev.slice(0, -1), // 移除「檢查中」訊息
            { sender: "assistant", text: suggestionsText },
          ]);
        } catch (error) {
          console.error("自動檢查失敗:", error);
          setMessages((prev) => [
            ...prev.slice(0, -1), // 移除「檢查中」訊息
            {
              sender: "assistant",
              text: `❌ ${error.message || "檢查過程發生錯誤，請稍後再試。"}`,
            },
          ]);
        } finally {
          setIsTyping(false);
        }
        return;
      }

      // B2. 如果流程圖沒變更且有建議資料，直接顯示快取的建議
      console.log("🟡 決策: 使用快取資料 (Redux)");
      console.log("🚨 關鍵: 從 Redux 讀取的 checkFeedback");
      console.log("=".repeat(80));
      console.log(checkFeedback);
      console.log("=".repeat(80));
      console.log("  - checkFeedback 長度:", checkFeedback?.length);
      console.log("  - 包含 '-':", checkFeedback?.includes("-"));
      console.log("  - 包含 '•':", checkFeedback?.includes("•"));
      console.log("  - 包含 '*':", checkFeedback?.includes("*"));
      console.log("  - 包含 '1.':", checkFeedback?.includes("1."));

      const suggestionsText =
        `## 助教建議\n\n${checkFeedback}\n\n` +
        `---\n\n你可以根據以上建議調整你的流程圖，有任何問題都可以隨時問我喔！`;

      console.log("🔍 Debug 檢查點 6: 最終顯示文字");
      console.log("  - suggestionsText 長度:", suggestionsText.length);
      console.log("🔵 ========== DEBUG 結束 ==========\n");

      setTimeout(() => {
        const aiReply = {
          sender: "assistant",
          text: suggestionsText,
        };
        setMessages((prev) => [...prev, aiReply]);
        setIsTyping(false);
      }, 500);
      return;
    }

    // C. 正常流程：開始請求後端 API
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend, // 使用者輸入
          stage: stage, // 目前階段 (flowchart/pseudocode/code)
          currentData: stageResult, // 目前的分析背景
          question: question, // 題目內容
        }),
      });

      if (!response.ok) throw new Error("伺服器連線失敗");

      const data = await response.json();

      // C. 將真正的 AI 回覆加入畫面
      const aiReply = {
        sender: "assistant",
        text: data.result || "抱歉，我現在無法思考，請稍後再試。",
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "❌ AI 服務暫時無法使用，請稍後再試。",
        },
      ]);
    } finally {
      setIsTyping(false); // 停止打字動畫
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg, index) => {
    return (
      <div
        key={index}
        className={
          msg.sender === "assistant" ? styles.rowLeft : styles.rowRight
        }
      >
        {msg.sender === "assistant" && <div className={styles.avatar}>🤖</div>}
        <div
          className={
            msg.sender === "assistant" ? styles.bubbleLeft : styles.bubbleRight
          }
        >
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
        {msg.sender === "user" && (
          <div className={styles.avatarUser}>
            <UserOutlined />
          </div>
        )}
      </div>
    );
  };

  return (
    <App>
      <div className={styles.mainspace}>
        <div className={styles.container}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {onTutorClick && (
              <div className={styles.tutorbox}>
                <Button
                  style={{
                    height: "36px",
                    fontSize: "16px",
                    backgroundColor: "#375bd3",
                    color: "#FFFFFF",
                  }}
                  onClick={onTutorClick}
                >
                  詢問沐芙助教
                </Button>
              </div>
            )}
          </div>

          <div style={{ height: "80%" }}>
            <div className={styles.topicbox}>
              {/* 分析狀態顯示 */}
              {isChecking && (
                <div style={{ textAlign: "center", padding: "10px" }}>
                  <Spin size="small" tip="AI 辨識中..." />
                </div>
              )}

              {/* 聊天紀錄區域 */}
              <div className={styles.chatBox} ref={chatBoxRef}>
                {messages.length === 0 && !isChecking ? (
                  <p className={styles.placeholder}>
                    請在下方輸入訊息開始對話...
                  </p>
                ) : (
                  messages.map((msg, index) => renderMessage(msg, index))
                )}
                {/* AI 正在輸入的動畫 */}
                {isTyping && (
                  <div className={styles.rowLeft}>
                    <div className={styles.avatar}>🤖</div>
                    <div className={styles.bubbleLeft}>
                      <Spin size="small" />{" "}
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "12px",
                          color: "#888",
                        }}
                      >
                        沐芙正在思考...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.chatArea}>
                {/* 快捷操作按鈕 */}
                <div className={styles.actionButtons}>
                  <Button
                    type="primary"
                    disabled={isTyping}
                    style={{
                      backgroundColor: "#b2c8ff",
                      color: "#223687",
                      borderRadius: "10px",
                      border: "none",
                    }}
                    onClick={handleCheck}
                  >
                    檢查
                  </Button>

                  <Button
                    type="primary"
                    disabled={isTyping}
                    style={{
                      backgroundColor: "#b2c8ff",
                      color: "#223687",
                      borderRadius: "10px",
                      border: "none",
                    }}
                    onClick={() => handleSend("接下來我該做什麼？")}
                  >
                    接下來該怎麼做
                  </Button>
                </div>

                {/* 輸入框 */}
                <Flex align="flex-end" gap={8} style={{ marginTop: "12px" }}>
                  <TextArea
                    placeholder="詢問助教..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    value={inputValue}
                    onChange={handleInputChange}
                    onPressEnter={handleKeyPress}
                    disabled={isTyping}
                    style={{ flexGrow: 1 }}
                  />
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SendOutlined />}
                    onClick={() => handleSend()}
                    disabled={inputValue.trim() === "" || isTyping}
                  />
                </Flex>
              </div>
            </div>
          </div>
        </div>
      </div>
    </App>
  );
};

export default Check;
