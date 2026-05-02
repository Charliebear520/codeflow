import React, { useState, useEffect, useRef } from "react";
import styles from "./check.module.css";
// 合併所有的 Ant Design 組件
import {
  Button,
  Spin,
  Input,
  Flex,
  Card,
  Row,
  Col,
  Statistic,
  App,
} from "antd";
import { UserOutlined, SendOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@clerk/clerk-react";
import { toPng } from "html-to-image";
import { useEditor } from "../../contexts/EditorContext";

const { TextArea } = Input;

const Check = ({ feedback, isChecking, onTutorClick, stage, question }) => {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lastCheckHash, setLastCheckHash] = useState(null);

  const chatBoxRef = useRef(null);

  // Auth 和工具
  const { isSignedIn, getToken } = useAuth();
  const { message } = App.useApp(); // 需要外層有 <App>
  const dispatch = useDispatch();

  // 從 EditorContext 取得當前階段的內容
  const { content, language, setChatCount, setHelpCount, setAttemptCount } =
    useEditor();

  // ⚠️ [偵測代碼 #1-擴展] 詳細的 EditorContext 初始化診斷
  useEffect(() => {
    console.group("🔍 EditorContext 初始化診斷");
    try {
      const contextValue = {
        content,
        language,
        setChatCount,
        setHelpCount,
        setAttemptCount,
      };

      const hasAllSetters =
        typeof setAttemptCount === "function" &&
        typeof setHelpCount === "function" &&
        typeof setChatCount === "function";

      if (!hasAllSetters) {
        console.error("❌ EditorContext 初始化失敗！", {
          hasSetAttemptCount: typeof setAttemptCount === "function",
          hasSetHelpCount: typeof setHelpCount === "function",
          hasChatCount: typeof setChatCount === "function",
          context: contextValue,
        });
        console.error("💡 可能的原因：Check 組件未被 EditorProvider 包裝");
      } else {
        console.log("✅ EditorContext 初始化成功", {
          hasAllSetters,
          componentName: "Check",
        });
        console.log("✅ 可用的 setters:", {
          setAttemptCount: "✓ 函數",
          setHelpCount: "✓ 函數",
          setChatCount: "✓ 函數",
        });
      }
    } catch (err) {
      console.error("❌ EditorContext 診斷出錯:", err);
    }
    console.groupEnd();
  }, [setAttemptCount, setHelpCount, setChatCount]);

  // 從 Redux 取得資料
  const byStage = useSelector((state) => state.check.byStage);
  const currentQuestion = useSelector((state) => state.question?.content);
  const scores = useSelector((state) => state.check.scores);
  const diffs = useSelector((state) => state.check.diffs);
  const checkFeedback = useSelector((state) => state.check.feedback);

  const stageResult =
    feedback != null ? feedback : stage ? byStage?.[stage] || null : null;
  const hasSuggestionsData = scores && diffs && checkFeedback;

  const getApiEndpoint = (stageNum) => {
    return `http://localhost:5000/api/submissions/stage${stageNum}/compare`;
  };

  const preparePayload = async (stageNum) => {
    const basePayload = { questionId: "Q001" };
    if (stageNum === 1) {
      const reactFlowWrapper = document.querySelector(".react-flow");
      if (!reactFlowWrapper) throw new Error("找不到流程圖");
      const reactFlowInstance = window.reactFlowInstance;
      if (!reactFlowInstance) throw new Error("流程圖尚未初始化");
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();
      if (!nodes || nodes.length === 0) throw new Error("請先繪製流程圖");
      const dataUrl = await toPng(reactFlowWrapper, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      return {
        ...basePayload,
        graph: { nodes, edges },
        imageBase64: dataUrl.split(",")[1],
      };
    } else if (stageNum === 2) {
      if (!content || content.trim() === "") throw new Error("請先撰寫虛擬碼");
      return { ...basePayload, pseudocode: content };
    } else if (stageNum === 3) {
      if (!content || content.trim() === "") throw new Error("請先撰寫程式碼");
      return { ...basePayload, code: content, language: language || "python" };
    }
    throw new Error(`未知的 stage: ${stageNum}`);
  };

  const getContentHash = (stageNum) => {
    if (stageNum === 1) return getFlowHash();
    return `${stageNum}-${content?.length || 0}-${content?.substring(0, 100) || ""}`;
  };

  const getFlowHash = () => {
    const reactFlowInstance = window.reactFlowInstance;
    if (!reactFlowInstance) return null;
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    const nodeLabels = nodes.map((n) => n.data?.label || "").join(",");
    return `${nodes.length}-${edges.length}-${nodeLabels}`;
  };

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (stageResult && messages.length === 0) {
      setMessages([{ sender: "assistant", text: stageResult }]);
    }
  }, [stageResult]);

  const handleInputChange = (e) => setInputValue(e.target.value);

  const handleCheck = async () => {
    // ⚠️ [偵測代碼 #2-擴展] 檢查 setters 是否真的可用
    console.log("🔍 [handleCheck] 驗證 setters 可用性...");
    try {
      if (typeof setAttemptCount !== "function") {
        throw new Error("❌ setAttemptCount 不是函數！");
      }
      if (typeof setHelpCount !== "function") {
        throw new Error("❌ setHelpCount 不是函數！");
      }
      console.log("✅ setters 驗證通過，準備執行檢查...");
    } catch (err) {
      console.error("❌ setters 驗證失敗:", err);
      throw err;
    }

    if (isTyping) return;
    setAttemptCount((prev) => prev + 1);
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: "請幫我檢查目前的邏輯是否正確" },
    ]);
    setIsTyping(true);
    try {
      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: `好的！讓我檢查中... 🔍` },
      ]);
      if (!isSignedIn) throw new Error("請先登入");
      const payload = await preparePayload(stage);
      const token = await getToken();
      const res = await fetch(getApiEndpoint(stage), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // ⚠️ [偵測代碼 #3-擴展] 詳細的 scores 數據驗證
      console.log("📊 API 回應的 scores 詳細驗證:");
      if (data.scores) {
        const expectedFields = ["overall", "structure", "nodes", "edges"];
        const presentFields = expectedFields.filter((f) =>
          data.scores.hasOwnProperty(f),
        );
        const missingFields = expectedFields.filter(
          (f) => !data.scores.hasOwnProperty(f),
        );

        console.log("  ✅ 存在的欄位:", presentFields);
        if (missingFields.length > 0) {
          console.warn("  ⚠️ 缺少的欄位:", missingFields);
        }

        console.log("  數值檢查:", {
          overall: `${data.scores.overall} (預期: 0-100 範圍)`,
          structure: `${data.scores.structure} (預期: 0-100 範圍)`,
          nodes: `${data.scores.nodes} (預期: 0-100 範圍)`,
          edges: `${data.scores.edges} (預期: 0-100 範圍)`,
        });

        // 檢查值是否在合理範圍內
        if (data.scores.overall < 0 || data.scores.overall > 100) {
          console.warn(
            `⚠️ scores.overall (${data.scores.overall}) 超出範圍 [0, 100]`,
          );
        }
      }

      if (!res.ok || !data.success) throw new Error(data.error || "檢查失敗");
      dispatch({ type: "check/setCheckResult", payload: data });
      setLastCheckHash(getContentHash(stage));
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          sender: "assistant",
          text: `## 檢查結果\n\n${data.checkReport || "已完成檢查"}\n\n有任何問題都可以問我！`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { sender: "assistant", text: `❌ ${error.message}` },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (textOverride = null) => {
    const textToSend = (
      typeof textOverride === "string" ? textOverride : inputValue
    ).trim();
    if (textToSend === "" || isTyping) return;

    // if (textToSend.includes("接下來")) {
    //     handleCheck();
    //     return;
    // }

    // 只有「正常聊天」才算 chat
    setChatCount((prev) => prev + 1);

    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          stage,
          currentData: stageResult,
          question,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: data.result || "無法回覆" },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: "❌ 服務故障" },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg, index) => (
    <div
      key={index}
      className={msg.sender === "assistant" ? styles.rowLeft : styles.rowRight}
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
              {isChecking && (
                <div style={{ textAlign: "center", padding: "10px" }}>
                  <Spin size="small" tip="AI 辨識中..." />
                </div>
              )}

              {scores && checkFeedback && (
                <div
                  style={{
                    marginBottom: "20px",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "20px",
                  }}
                >
                  <h3 style={{ color: "#9287EE", marginBottom: "16px" }}>
                    檢查結果報告
                  </h3>
                  <Card title="評分結果" style={{ marginBottom: "16px" }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic
                          title="總分"
                          value={Math.round(scores.overall || 0)}
                          suffix="分"
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title="結構"
                          value={Math.round(scores.structure || 0)}
                          suffix="分"
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title="節點"
                          value={Math.round(scores.nodes || 0)}
                          suffix="分"
                        />
                      </Col>
                      <Col span={6}>
                        <Statistic
                          title="連線"
                          value={Math.round(scores.edges || 0)}
                          suffix="分"
                        />
                      </Col>
                    </Row>
                  </Card>
                  <Card title="AI 助教建議">
                    <ReactMarkdown>{checkFeedback}</ReactMarkdown>
                  </Card>
                </div>
              )}

              <div className={styles.chatBox} ref={chatBoxRef}>
                {messages.length === 0 && !isChecking ? (
                  <p className={styles.placeholder}>
                    請在下方輸入訊息開始對話...
                  </p>
                ) : (
                  messages.map((msg, index) => renderMessage(msg, index))
                )}
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
                <div className={styles.actionButtons}>
                  <Button
                    type="primary"
                    disabled={isTyping}
                    onClick={handleCheck}
                    style={{
                      backgroundColor: "#b2c8ff",
                      color: "#223687",
                      borderRadius: "10px",
                      border: "none",
                    }}
                  >
                    檢查
                  </Button>
                  <Button
                    type="primary"
                    disabled={isTyping}
                    onClick={() => {
                      setHelpCount((prev) => prev + 1); // ✅ 求助次數
                      handleSend("接下來我該做什麼？");
                    }}
                    style={{
                      backgroundColor: "#b2c8ff",
                      color: "#223687",
                      borderRadius: "10px",
                      border: "none",
                    }}
                  >
                    接下來該怎麼做
                  </Button>
                </div>
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
