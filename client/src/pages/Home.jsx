import { Col, Row } from "antd";
import React, { useState } from "react";
import Topic from "../components/Topic";
import Answer from "../components/Answer";
import Check from "../components/Check";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const [clicked, setClicked] = useState(false);

  return (
    <div>
      <Row>
        <Col span={6}>
          <Topic />
        </Col>
        <Col span={12}>
          <Answer />
        </Col>
        <Col span={6}>
          <Check />
        </Col>
      </Row>
      {/* 原本的導頁功能先隱藏 */}
      {/* 
      <button
        style={{ position: "fixed", bottom: 20, right: 20 }}
        onClick={() => navigate("/add-question")}
      >
        新增題目
      </button>
      */}

      <button
        style={{ position: "fixed", bottom: 20, right: 20,backgroundColor: "#375BD3", color: "#FFFFFF", border: "none" }}
        onClick={() => navigate("/add-question")}
      >
        前往AddQuestion頁面（測試用）
      </button>
      <button
        style={{ position: "fixed", bottom: 20, right: 300,backgroundColor: "#375BD3", color: "#FFFFFF", border: "none" }}
        onClick={() => navigate("/stage-list")}
      >
        前往StageList頁面（測試用）
      </button>
    </div>
  );
};

export default Home;
