import { Col, Row } from "antd";
import React from "react";
import Topic from "../components/Topic";
import Answer from "../components/Answer";
import Check from "../components/Check";

const Home = () => {
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
    </div>
  );
};

export default Home;
