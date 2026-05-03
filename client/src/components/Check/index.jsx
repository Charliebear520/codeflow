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

  // 阶段切换时清空消息和输入框
  useEffect(() => {
    setMessages([]);
    setInputValue("");
    setLastCheckHash(null);
  }, [stage]);

  const handleInputChange = (e) => setInputValue(e.target.value);

  const handleCheck = async () => {
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

      if (!res.ok || !data.success) throw new Error(data.error || "檢查失敗");
      dispatch({ type: "check/setCheckResult", payload: data });
      setLastCheckHash(getContentHash(stage));

      // 生成报告消息
      const reportText = `
## 📋 檢查結果報告

**總分**：${Math.round(data.scores?.overall || 0)} 分
- 結構：${Math.round(data.scores?.structure || 0)} 分
- 節點：${Math.round(data.scores?.nodes || 0)} 分
- 連線：${Math.round(data.scores?.edges || 0)} 分

## 💡 AI 助教建議

${data.checkFeedback || data.feedback || "已完成檢查"}
`;

      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          sender: "assistant",
          text: reportText,
          isReport: true,
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
        className={`${
          msg.sender === "assistant" ? styles.bubbleLeft : styles.bubbleRight
        } ${
          msg.isReport ? styles.isReport : ""
        }`}
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
                      setHelpCount((prev) => prev + 1);
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
