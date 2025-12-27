import React, { useState, useEffect, useRef } from "react";
import styles from "./check.module.css";
import { Button, Spin, Input, Flex } from "antd";
import { UserOutlined, SendOutlined } from '@ant-design/icons';
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;
const Check = ({ feedback, isChecking, onTutorClick, stage }) => {
  // *** 新增/修改的 State ***
  const [inputValue, setInputValue] = useState(''); // 用於輸入框的文字
  const [messages, setMessages] = useState([]); // 儲存所有對話紀錄

  // 聊天視窗 Ref (為未來的自動捲動做準備)
  const chatBoxRef = useRef(null);

  const byStage = useSelector((state) => state.check.byStage);
  const stageResult =
    feedback != null ? feedback : stage ? byStage?.[stage] || null : null;

  // 初始訊息的 useEffect 邏輯 (將初始回饋設定為第一條 AI 訊息)
  useEffect(() => {
    if (stageResult && messages.length === 0) {
      setMessages([{ sender: "assistant", text: stageResult }]);
    }
  }, [stageResult]);

  // 💡 移除你原本的靜態 messages 宣告
  // const messages = [];
  // if (stageResult) {
  //   messages.push({ sender: "assistant", text: stageResult });
  // }
  
  // 處理輸入框變動
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };
  
  // *** 訊息傳送函式 (核心) ***
  const handleSend = () => {
    const textToSend = inputValue.trim();
    if (textToSend === '') return; // 避免傳送空訊息

    const newUserMessage = { sender: 'user', text: textToSend };

    // 1. 將使用者訊息加入對話紀錄 (重要！使用函式形式確保基於最新狀態更新)
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    
    // 2. 清空輸入框
    setInputValue('');
    
    // *** 這裡暫時不需要 AI 回覆的邏輯 ***
  };
  
  // 處理 Enter 鍵傳送
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
      className={
        msg.sender === "assistant" ? styles.rowLeft : styles.rowRight
      }
    >
      {msg.sender === "assistant" && (
        <div className={styles.avatar}>🤖</div>
      )}

      <div
        className={
          msg.sender === "assistant"
            ? styles.bubbleLeft
            : styles.bubbleRight
        }
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
          }}
        >
          {onTutorClick && (
            <div className={styles.tutorbox}>
              <Button
                style={{
                  height: "36px",
                  fontSize: "16px",
                  backgroundColor: "#375bd3",
                  color: "#FFFFFF",
                }}
                onClick={() => {}}
              >
                詢問沐芙助教
              </Button>
            </div>
          )}
        </div>
        <div style={{ height: "80%" }}>
          <div className={styles.topicbox}>
            {isChecking ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <Spin size="large" />
              </div>
            ) : feedback ? (
              <div>
                <p style={{ color: "#9287EE" }}>AI 助教回饋：</p>
                <ReactMarkdown>{feedback}</ReactMarkdown>
              </div>
            ) : stageResult ? (
              <div>
                <p style={{ color: "#9287EE" }}>流程圖分析結果：</p>
                <ReactMarkdown>{stageResult}</ReactMarkdown>
              </div>
            ) : null}

            <div className={styles.chatBox} ref={chatBoxRef}>
              {messages.length === 0 ? (
                <p className={styles.placeholder}>等待訊息中...</p>
              ) : (
                messages.map((msg, index) => renderMessage(msg, index))
              )}
            </div>

            <div className={styles.chatArea}>
              {/* 1. 快捷操作按鈕 (保留不動) */}
              <div className={styles.actionButtons}>
                <Button
                  type="primary"
                  shape="round"
                  loading={isChecking}
                  style={{ 
                    backgroundColor: "#899BF9",
                    borderColor: "#899BF9",
                    fontWeight: 500 
                  }}
                  onClick={() => { /* 觸發檢查功能的函式 */ }}
                >
                  檢查
                </Button>

                <Button
                  shape="round"
                  style={{ 
                    backgroundColor: "#EBEFFD",
                    color: "#5B7EF9",
                    border: "none",
                    fontWeight: 500
                  }}
                  onClick={() => { /* 觸發接下來該怎麼做函式 */ }} 
                >
                  接下來該怎麼做
                </Button>
              </div>

              {/* 2. 輸入框與傳送按鈕 (新結構) */}
              <Flex align="flex-end" gap={8} style={{ marginTop: '12px' }}>
                <TextArea
                  placeholder="請輸入您的訊息"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  value={inputValue} // 💡 綁定 state
                  onChange={handleInputChange} // 💡 處理輸入變動
                  onPressEnter={handleKeyPress} // 💡 處理 Enter 鍵傳送
                  style={{ flexGrow: 1 }}
                />
                <Button
                  type="primary"
                  shape="circle"
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    minWidth: '40px',
                    backgroundColor: "#375bd3",
                    padding: 0
                  }}
                  onClick={handleSend} // 💡 綁定傳送函式
                  disabled={inputValue.trim() === ''} // 輸入為空時禁用
                >
                  <span style={{ fontSize: '18px' }}><SendOutlined /></span>
                </Button>
              </Flex>
            </div>

          </div>
         
        </div>
      </div>
    </div>
  );
};

export default Check;