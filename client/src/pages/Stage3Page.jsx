import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import Check from "../components/Check";
import Topic from "../components/Topic";
import React, { useState, useEffect } from "react";

export default function Stage3Page() {
  // 題目從 localStorage 取得，若無則用預設
  const defaultQuestion =
    "請根據下方敘述以主流程式語言（Python/JavaScript/C）實作。你正要出門上學，但需要判斷門外是否會下雨。請應用程式語言，幫助你決定是否需要帶雨傘。";
  const [question, setQuestion] = useState(
    () => localStorage.getItem("currentFlowchartQuestion") || defaultQuestion
  );
  const [feedback, setFeedback] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  // 控制全螢幕狀態
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div>
      <Row>
        <Col
          span={fullscreen ? 0 : 6}
          style={{ display: fullscreen ? "none" : "block" }}
        >
          <Topic question={question} />
        </Col>
        <Col span={fullscreen ? 24 : 12}>
          <OnlineCoding
            question={question}
            onFeedback={setFeedback}
            onChecking={setIsChecking}
            fullscreen={fullscreen}
            setFullscreen={setFullscreen}
          />
        </Col>
        <Col
          span={fullscreen ? 0 : 6}
          style={{ display: fullscreen ? "none" : "block" }}
        >
          <Check feedback={feedback} isChecking={isChecking} />
        </Col>
      </Row>
    </div>
  );
}
