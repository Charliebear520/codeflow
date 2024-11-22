import { Col, Row } from "antd";
import React from "react";
import Collapse from "../components/Collapse";
import AI from "../components/AI";

const Tutor = () => {
  return (
    <Row>
      <Col span={8} style={{ display: "flex", alignItems: "center" }}>
        <Collapse />
      </Col>
      <Col span={16}>
        <AI />
      </Col>
    </Row>
  );
};

export default Tutor;
