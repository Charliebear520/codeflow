import React, { useState, useEffect, useRef } from "react";
import styles from "./check.module.css";
import { Button, Spin, Input, Flex, Card, Row, Col, Statistic } from "antd";
import { UserOutlined, SendOutlined } from '@ant-design/icons';
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;

const Check = ({ feedback, isChecking, onTutorClick, stage }) => {
  const [inputValue, setInputValue] = useState(''); 
  const [messages, setMessages] = useState([]); 
  const [isTyping, setIsTyping] = useState(false);  

  const chatBoxRef = useRef(null);

  // 從 Redux 取得資料
  const byStage = useSelector((state) => state.check.byStage);
  const currentQuestion = useSelector((state) => state.question?.content); // 假設有儲存題目內容

  const scores = useSelector((state) => state.check.scores);
  const diffs = useSelector((state) => state.check.diffs);
  const checkFeedback = useSelector((state) => state.check.feedback);

  // 優先使用新格式的完整回饋，否則使用舊格式
  const stageResult =
    feedback != null ? feedback : stage ? byStage?.[stage] || null : null;

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

  // *** 核心功能：向後端傳送訊息並獲取實時 AI 回覆 ***
  const handleSend = async (textOverride = null) => {
    const textToSend = (typeof textOverride === 'string' ? textOverride : inputValue).trim();
    
    if (textToSend === '' || isTyping) return; 

    // A. 先將使用者訊息加入畫面
    const newUserMessage = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue(''); // 清空輸入框
    
    // B. 開始請求後端 API
    setIsTyping(true); 

    try {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,        // 使用者輸入
          stage: stage,             // 目前階段 (flowchart/pseudocode/code)
          currentData: stageResult,   // 目前的分析背景
          question: currentQuestion, // 題目內容
        }),
      });

      if (!response.ok) throw new Error("伺服器連線失敗");

      const data = await response.json();

      // C. 將真正的 AI 回覆加入畫面
      const aiReply = { 
        sender: 'assistant', 
        text: data.result || "抱歉，我現在無法思考，請稍後再試。" 
      };
      setMessages((prev) => [...prev, aiReply]);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [...prev, { 
        sender: 'assistant', 
        text: "❌ 發生連線錯誤，請確認後端伺服器 (Port 3000) 已啟動。" 
      }]);
    } finally {
      setIsTyping(false); // 停止打字動畫
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSend();
    }
  };

  const renderMessage = (msg, index) => {
    return (
      <div
        key={index}
        className={msg.sender === "assistant" ? styles.rowLeft : styles.rowRight}
      >
        {msg.sender === "assistant" && (
          <div className={styles.avatar}>🤖</div>
        )}
        <div
          className={msg.sender === "assistant" ? styles.bubbleLeft : styles.bubbleRight}
        >
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
        {msg.sender === "user" && (
          <div className={styles.avatarUser}><UserOutlined /></div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.mainspace}>
      <div className={styles.container}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {onTutorClick && (
            <div className={styles.tutorbox}>
              <Button
                style={{ height: "36px", fontSize: "16px", backgroundColor: "#375bd3", color: "#FFFFFF" }}
                onClick={onTutorClick}
              >
                詢問沐芙助教
              </Button>
            </div>
          )}
        </div>
        
        <div style={{ height: "80%" }}>
          <div className={styles.topicbox}>
            {/* 1. 分析狀態顯示 */}
            {isChecking && (
              <div style={{ textAlign: "center", padding: "10px" }}>
                <Spin size="small" tip="AI 辨識中..." />
              </div>
            )}

            {/* 2. 顯示遠端的評分卡片與詳細分析 (如果有資料就顯示) */}
            {scores && checkFeedback && (
              <div style={{ marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
                <h3 style={{ color: "#9287EE", marginBottom: "16px" }}>流程圖檢查結果</h3>
                <Card title="評分結果" style={{ marginBottom: "16px" }}>
                  <Row gutter={16}>
                    <Col span={6}><Statistic title="總分" value={Math.round(scores.total * 100)} suffix="分" /></Col>
                    <Col span={6}><Statistic title="結構" value={Math.round(scores.structure * 100)} suffix="分" /></Col>
                    <Col span={6}><Statistic title="節點" value={Math.round(scores.nodes * 100)} suffix="分" /></Col>
                    <Col span={6}><Statistic title="連線" value={Math.round(scores.edges * 100)} suffix="分" /></Col>
                  </Row>
                </Card>
                <Card title="AI 助教建議" style={{ marginBottom: "16px" }}>
                  <ReactMarkdown>{checkFeedback}</ReactMarkdown>
                </Card>
                
                {/* 詳細差異分析 */}
                {diffs && (diffs.structureIssues?.length > 0 || diffs.missingNodes?.length > 0 || diffs.logicIssues?.length > 0) && (
                  <Card title="詳細分析" size="small">
                    {diffs.structureIssues?.length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        <strong>結構問題：</strong>
                        <ul>{diffs.structureIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>
                      </div>
                    )}
                    {diffs.missingNodes?.length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        <strong>缺少節點：</strong>
                        <ul>{diffs.missingNodes.map((node, i) => <li key={i}>{node.type}: {node.label}</li>)}</ul>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* 3. 聊天紀錄區域 (你的功能) */}
            <div className={styles.chatBox} ref={chatBoxRef}>
              {messages.length === 0 && !isChecking ? (
                <p className={styles.placeholder}>請在下方輸入訊息開始對話...</p>
              ) : (
                messages.map((msg, index) => renderMessage(msg, index))
              )}
              {isTyping && (
                <div className={styles.rowLeft}>
                  <div className={styles.avatar}>🤖</div>
                  <div className={styles.bubbleLeft}>
                    <Spin size="small" /> <span style={{ marginLeft: 8, fontSize: '12px', color: '#888' }}>沐芙正在思考...</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. 聊天輸入區域 */}
            <div className={styles.chatArea}>
              <div className={styles.actionButtons}>
                <Button type="primary" disabled={isTyping} style={{ backgroundColor: "#b2c8ff", color: "#223687", borderRadius: "10px", border: "none" }} onClick={() => handleSend("請幫我檢查目前的邏輯是否正確")}>檢查</Button>
                <Button type="primary" disabled={isTyping} style={{ backgroundColor: "#b2c8ff", color: "#223687", borderRadius: "10px", border: "none" }} onClick={() => handleSend("接下來我該做什麼？")}>接下來該怎麼做</Button>
              </div>
              <Flex align="flex-end" gap={8} style={{ marginTop: '12px' }}>
                <TextArea placeholder="詢問助教..." autoSize={{ minRows: 1, maxRows: 4 }} value={inputValue} onChange={handleInputChange} onPressEnter={handleKeyPress} disabled={isTyping} style={{ flexGrow: 1 }} />
                <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={() => handleSend()} disabled={inputValue.trim() === '' || isTyping} />
              </Flex>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Check;