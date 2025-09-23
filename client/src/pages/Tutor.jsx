import { Col, Row } from "antd";
import React from "react";

const Tutor = () => {
  return (
    <Row gutter={16}>
      <Col span={8} style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: "100%",
            padding: 16,
            background: "#fff",
            borderRadius: 8,
          }}
        >
          助教工具（待實作）
        </div>
      </Col>
      <Col span={16}>
        <div
          style={{
            width: "100%",
            padding: 16,
            background: "#fff",
            borderRadius: 8,
          }}
        >
          助教面板（待實作）
        </div>
      </Col>
    </Row>
  );
};

export default Tutor;
