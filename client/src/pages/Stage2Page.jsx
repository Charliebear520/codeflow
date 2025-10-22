import { Layout, Card, Button, Tabs, Collapse, Input } from "antd";
import StageSwitcher from "../components/StageSwitcher";
import TopicStage2 from "../components/TopicStage2";
import Check from "../components/Check";
import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import styles from "./Stage2Page.module.css";

export default function Stage2Page() {
  // 新增 currentStage 狀態
  const [currentStage, setCurrentStage] = useState(1); // 預設第二階段
  // 新增放大模式狀態
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  // 題目從 localStorage 取得，若無則用預設
  const defaultQuestion =
    "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。";
  const [question, setQuestion] = useState(
    () => localStorage.getItem("currentFlowchartQuestion") || defaultQuestion
  );
  const [feedback, setFeedback] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // 處理放大/縮小切換
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 處理芙蓉助教按鈕點擊
  const handleTutorClick = () => {
    navigate("/tutor");
  };

  // 動態計算列寬
  const getColumnSpans = () => {
    if (isExpanded) {
      return { left: 6, center: 18, right: 0 };
    }
    return { left: 6, center: 12, right: 6 };
  };

  const spans = getColumnSpans();

  return (
    <div className={styles.stage2Container}>
      <Row>
        <Col span={spans.left}>
          <TopicStage2
            question={question}
            setQuestion={setQuestion}
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
          />
        </Col>
        <Col span={spans.center} className={styles.centerbackground}>
          <OnlineCoding
            question={question}
            currentStage={currentStage}
            onFeedback={setFeedback}
            onChecking={setIsChecking}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            onTutorClick={handleTutorClick}
          />
        </Col>
        {!isExpanded && (
          <Col span={spans.right} className={styles.fadeIn}>
            <Check
              feedback={feedback}
              isChecking={isChecking}
              onTutorClick={handleTutorClick}
            />
          </Col>
        )}
      </Row>
    </div>
  );
}
