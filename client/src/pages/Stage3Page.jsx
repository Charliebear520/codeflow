import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import Check from "../components/Check";
import TopicStage3 from "../components/TopicStage3";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Stage3Page() {
  // 題目從 localStorage 取得，若無則用預設
  const defaultQuestion =
    "請根據下方敘述以程式語言（Python/JavaScript/C）實作。你正要出門上學，但需要判斷門外是否會下雨。請應用程式語言，幫助你決定是否需要帶雨傘。";
  const [question, setQuestion] = useState(
    () => localStorage.getItem("currentFlowchartQuestion") || defaultQuestion
  );
  const [feedback, setFeedback] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [currentStage, setCurrentStage] = useState(2); // 預設第三階段
  // 控制全螢幕狀態
  const [fullscreen, setFullscreen] = useState(false);
  const navigate = useNavigate();

  const handleTutorClick = () => {
    navigate("/tutor");
  };

  return (
    <div>
      <Row>
        <Col span={6}>
          <TopicStage3
            question={question}
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
          />
        </Col>
        <Col span={12}>
          <OnlineCoding
            question={question}
            onFeedback={setFeedback}
            onChecking={setIsChecking}
            isExpanded={false}
            onToggleExpand={() => {}}
            onTutorClick={handleTutorClick}
          />
        </Col>
        <Col span={6}>
          <Check
            feedback={feedback}
            isChecking={isChecking}
            onTutorClick={handleTutorClick}
          />
        </Col>
      </Row>
    </div>
  );
}
