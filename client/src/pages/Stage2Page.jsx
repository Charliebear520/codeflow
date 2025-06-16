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
  // 根據 currentStage 切換題目內容
  const questions = [
    "請根據下方敘述繪製流程圖。你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。",
    "請根據下方敘述以虛擬碼（pseudocode）形式描述流程。你正要出門上學，但需要判斷門外是否會下雨。請應用虛擬碼，幫助你決定是否需要帶雨傘。",
  ];
  const [question, setQuestion] = useState(questions[currentStage]);
  const [feedback, setFeedback] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  // 當 currentStage 改變時，切換題目
  React.useEffect(() => {
    setQuestion(questions[currentStage]);
  }, [currentStage]);

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
