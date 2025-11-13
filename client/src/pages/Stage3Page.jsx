import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import Check from "../components/Check";
import TopicStage3 from "../components/TopicStage3";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { resetCheck, setStageFeedback } from "../redux/slices/checkSlice";

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
  const dispatch = useDispatch();
  const savedStage3Feedback = useSelector((state) => state.check.byStage?.[3]);

  const handleTutorClick = () => {
    navigate("/tutor");
  };

  // 進入第三階段時，清掉先前階段的全域檢查結果，避免右側回退顯示上一階段內容
  useEffect(() => {
    dispatch(resetCheck());
  }, [dispatch]);

  // 從 Redux 回填第三階段既有回饋
  useEffect(() => {
    if (savedStage3Feedback) {
      setFeedback(savedStage3Feedback);
    }
  }, [savedStage3Feedback]);

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
            onFeedback={(fb) => {
              setFeedback(fb);
              dispatch(setStageFeedback({ stage: 3, feedback: fb }));
            }}
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