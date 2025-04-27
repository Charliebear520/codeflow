import { Layout, Card, Button, Tabs, Collapse, Input } from "antd";
import StageSwitcher from "../components/StageSwitcher";
import TopicStage2 from "../components/TopicStage2";
import Check from "../components/Check";
import { Row, Col } from "antd";
import OnlineCoding from "../components/OnlineCoding";
import React, { useState } from "react";

export default function Stage2Page() {
  // 取得題目內容，這裡假設和 TopicStage2 的初始題目一致
  const [question, setQuestion] = useState(
    "請根據下方敘述繪製流程圖。 你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。"
  );

  return (
    <div>
      <Row>
        <Col span={6}>
          <TopicStage2 question={question} setQuestion={setQuestion} />
        </Col>
        <Col span={12}>
          <OnlineCoding question={question} />
        </Col>
        <Col span={6}>
          <Check />
        </Col>
      </Row>
    </div>
  );
}
