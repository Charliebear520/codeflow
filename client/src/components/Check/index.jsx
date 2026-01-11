import React, { useState, useEffect, useRef } from "react";
import styles from "./check.module.css";
import { Button, Spin, Input, Flex, App } from "antd";
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
  const [lastCheckHash, setLastCheckHash] = useState(null); // 記錄上次檢查的流程圖狀態

  const chatBoxRef = useRef(null);

  // Auth 和工具
  const { isSignedIn, getToken } = useAuth();
  const { message } = App.useApp();
  const dispatch = useDispatch();

  // 從 EditorContext 取得當前階段的內容
  const { content, language } = useEditor();

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

  // *** 輔助函數：根據 stage 取得 API 端點 ***
  const getApiEndpoint = (stageNum) => {
    return `http://localhost:5000/api/submissions/stage${stageNum}/compare`;
  };

  // *** 輔助函數：根據 stage 準備 payload ***
  const preparePayload = async (stageNum) => {
    const basePayload = { questionId: question?.questionId || "Q001" };

    if (stageNum === 1) {
      // Stage 1: 流程圖
      const reactFlowWrapper = document.querySelector(".react-flow");
      if (!reactFlowWrapper) {
        throw new Error("找不到流程圖，請確認已繪製流程圖");
      }

      const reactFlowInstance = window.reactFlowInstance;
      if (!reactFlowInstance) {
        throw new Error("流程圖尚未初始化，請稍後再試");
      }

      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();

      if (!nodes || nodes.length === 0) {
        throw new Error("請先繪製流程圖");
      }

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
      // Stage 2: 虛擬碼
      if (!content || content.trim() === "") {
        throw new Error("請先撰寫虛擬碼");
      }
      return {
        ...basePayload,
        pseudocode: content,
      };
    } else if (stageNum === 3) {
      // Stage 3: 程式碼
      if (!content || content.trim() === "") {
        throw new Error("請先撰寫程式碼");
      }
      return {
        ...basePayload,
        code: content,
        language: language || "python",
      };
    }

    throw new Error(`未知的 stage: ${stageNum}`);
  };

  // *** 輔助函數：根據 stage 計算 hash ***
  const getContentHash = (stageNum) => {
    if (stageNum === 1) {
      // Stage 1: 使用流程圖 hash
      return getFlowHash();
    } else if (stageNum === 2 || stageNum === 3) {
      // Stage 2/3: 使用內容 hash
      return `${stageNum}-${content?.length || 0}-${
        content?.substring(0, 100) || ""
      }`;
    }
    return null;
  };

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
  const formatCheckResult = (diffs, currentStage) => {
    if (!diffs) return "暫無分析資料";

    let itemNumber = 1;
    const items = [];

    // Stage 1: 流程圖
    if (currentStage === 1) {
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
      if (diffs.structureIssues && diffs.structureIssues.length > 0) {
        diffs.structureIssues.forEach((issue) => {
          items.push(`${itemNumber}. 結構問題：${issue}`);
          itemNumber++;
        });
      }
      if (diffs.logicIssues && diffs.logicIssues.length > 0) {
        diffs.logicIssues.forEach((issue) => {
          items.push(`${itemNumber}. 邏輯問題：${issue}`);
          itemNumber++;
        });
      }
    }
    // Stage 2: 虛擬碼
    else if (currentStage === 2) {
      if (diffs.missingLogic && diffs.missingLogic.length > 0) {
        diffs.missingLogic.forEach((logic) => {
          items.push(`${itemNumber}. ${logic}`);
          itemNumber++;
        });
      }
      if (diffs.incorrectConditions && diffs.incorrectConditions.length > 0) {
        diffs.incorrectConditions.forEach((cond) => {
          items.push(`${itemNumber}. 條件問題：${cond}`);
          itemNumber++;
        });
      }
      if (diffs.missingVariables && diffs.missingVariables.length > 0) {
        diffs.missingVariables.forEach((v) => {
          items.push(`${itemNumber}. 建議使用變數：${v}`);
          itemNumber++;
        });
      }
      if (diffs.missingLoops && diffs.missingLoops.length > 0) {
        diffs.missingLoops.forEach((loop) => {
          items.push(`${itemNumber}. 建議使用迴圈：${loop}`);
          itemNumber++;
        });
      }
      if (diffs.structureIssues && diffs.structureIssues.length > 0) {
        diffs.structureIssues.forEach((issue) => {
          items.push(`${itemNumber}. ${issue}`);
          itemNumber++;
        });
      }
    }
    // Stage 3: 程式碼
    else if (currentStage === 3) {
      if (diffs.syntaxErrors && diffs.syntaxErrors.length > 0) {
        diffs.syntaxErrors.forEach((err) => {
          items.push(`${itemNumber}. 語法問題：${err}`);
          itemNumber++;
        });
      }
      if (diffs.logicErrors && diffs.logicErrors.length > 0) {
        diffs.logicErrors.forEach((err) => {
          items.push(`${itemNumber}. ${err}`);
          itemNumber++;
        });
      }
      if (diffs.runtimeWarnings && diffs.runtimeWarnings.length > 0) {
        diffs.runtimeWarnings.forEach((warn) => {
          items.push(`${itemNumber}. 執行時警告：${warn}`);
          itemNumber++;
        });
      }
      if (diffs.missingFeatures && diffs.missingFeatures.length > 0) {
        diffs.missingFeatures.forEach((feature) => {
          items.push(`${itemNumber}. ${feature}`);
          itemNumber++;
        });
      }
      if (diffs.missingControlFlow && diffs.missingControlFlow.length > 0) {
        diffs.missingControlFlow.forEach((cf) => {
          items.push(`${itemNumber}. ${cf}`);
          itemNumber++;
        });
      }
    }

    if (items.length === 0) {
      const contentType =
        currentStage === 1
          ? "流程圖"
          : currentStage === 2
          ? "虛擬碼"
          : "程式碼";
      return `✅ 太棒了！${contentType}沒有發現任何問題！`;
    }

    return items.join("\n\n");
  };

  // *** 執行檢查並顯示 AI 建議 ***
  const handleCheck = async () => {
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
        text: `好的！讓我先幫你檢查${
          stage === 1 ? "流程圖" : stage === 2 ? "虛擬碼" : "程式碼"
        }... 🔍`,
      };
      setMessages((prev) => [...prev, checkingMsg]);

      // 執行檢查 API
      if (!isSignedIn) {
        throw new Error("請先登入");
      }

      // 準備 payload（根據 stage 決定）
      const payload = await preparePayload(stage);

      const token = await getToken();
      const endpoint = getApiEndpoint(stage);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "檢查失敗");
      }

      // 儲存到 Redux
      dispatch({
        type: "check/setCheckResult",
        payload: {
          scores: data.scores,
          diffs: data.diffs,
          feedback: data.feedback,
          submissionId: data.submissionId,
        },
      });

      // 更新最後檢查的 hash
      const newHash = getContentHash(stage);
      setLastCheckHash(newHash);

      // 顯示檢查結果（使用 data.diffs 結構化資料）
      const formattedResult = formatCheckResult(data.diffs, stage);
      const checkResultText = `## 檢查結果\n\n${formattedResult}\n\n---\n\n有任何問題都可以隨時問我喔！`;

      setMessages((prev) => [
        ...prev.slice(0, -1), // 移除「檢查中」訊息
        { sender: "assistant", text: checkResultText },
      ]);
    } catch (error) {
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
      setIsTyping(true);

      // 檢查內容是否有變更
      const currentHash = getContentHash(stage);
      const contentChanged = !lastCheckHash || currentHash !== lastCheckHash;

      // B1. 如果沒有建議資料或內容已變更，需要重新執行檢查
      if (!hasSuggestionsData || contentChanged) {
        try {
          // 顯示檢查中訊息
          const checkingMsg = {
            sender: "assistant",
            text: contentChanged
              ? `${
                  stage === 1 ? "流程圖" : stage === 2 ? "虛擬碼" : "程式碼"
                }有變更，讓我重新幫你檢查... 🔍`
              : `好的！讓我先幫你檢查${
                  stage === 1 ? "流程圖" : stage === 2 ? "虛擬碼" : "程式碼"
                }... 🔍`,
          };
          setMessages((prev) => [...prev, checkingMsg]);

          // 執行檢查 API
          if (!isSignedIn) {
            throw new Error("請先登入");
          }

          // 準備 payload（根據 stage 決定）
          const payload = await preparePayload(stage);

          const token = await getToken();
          const endpoint = getApiEndpoint(stage);

          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.error || "檢查失敗");
          }

          // 儲存到 Redux
          dispatch({
            type: "check/setCheckResult",
            payload: {
              scores: data.scores,
              diffs: data.diffs,
              feedback: data.feedback,
              submissionId: data.submissionId,
            },
          });

          // 更新最後檢查的 hash
          setLastCheckHash(currentHash);

          // 顯示最新的 AI 建議（字數限制：120-180字）
          const contentType =
            stage === 1 ? "流程圖" : stage === 2 ? "虛擬碼" : "程式碼";
          let feedback = data.feedback;
          if (feedback && feedback.length > 180) {
            feedback = feedback.substring(0, 180) + "...";
          }
          const suggestionsText =
            `## 助教建議\n\n${feedback}\n\n` +
            `---\n\n你可以根據以上建議調整你的${contentType}，有任何問題都可以隨時問我喔！`;

          setMessages((prev) => [
            ...prev.slice(0, -1), // 移除「檢查中」訊息
            { sender: "assistant", text: suggestionsText },
          ]);
        } catch (error) {
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

      // B2. 如果內容沒變更且有建議資料，直接顯示快取的建議
      const contentType =
        stage === 1 ? "流程圖" : stage === 2 ? "虛擬碼" : "程式碼";
      const suggestionsText =
        `## 助教建議\n\n${checkFeedback}\n\n` +
        `---\n\n你可以根據以上建議調整你的${contentType}，有任何問題都可以隨時問我喔！`;

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
