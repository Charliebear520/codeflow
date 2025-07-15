import { Layout, Card, Button, Tabs, Collapse, Input } from "antd";
import StageSwitcher from "../components/StageSwitcher";
import TopicStage2 from "../components/TopicStage2";
import Check from "../components/Check";
import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import React, { useState } from "react";

export default function Stage2Page() {
  // 新增 currentStage 狀態
  const [currentStage, setCurrentStage] = useState(1); // 預設第二階段
  // 題目從 localStorage 取得，若無則用預設
  const defaultQuestion =
    "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。";
  const [question, setQuestion] = useState(
    () => localStorage.getItem("currentFlowchartQuestion") || defaultQuestion
  );
  const [feedback, setFeedback] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  return (
    <div>
      <Row>
        <Col span={6}>
          <TopicStage2
            question={question}
            setQuestion={setQuestion}
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
          />
        </Col>
        <Col span={12}>
          <OnlineCoding
            question={question}
            currentStage={currentStage}
            onFeedback={setFeedback}
            onChecking={setIsChecking}
          />
        </Col>
        <Col span={6}>
          <Check feedback={feedback} isChecking={isChecking} />
        </Col>
      </Row>
    </div>
  );
}
