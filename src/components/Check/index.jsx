import React from "react";
import styles from "./check.module.css";
import { RightCircleOutlined } from "@ant-design/icons";
import { Button } from "antd";

const Check = () => {
  return (
    <div className={styles.container}>
      <div
        style={{
          height: "20%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div className={styles.tutorbox}>
          <Button style={{ backgroundColor: "#375BD3", color: "#FFFFFF" }}>
            詢問沐芙助教
          </Button>
        </div>
      </div>
      <div style={{ height: "80%" }}>
        <div className={styles.topicbox}>
          <div>
            <p style={{ color: "#9287EE" }}>
              你的流程圖作答是合理的。以下是流程圖的含義：
            </p>
            <p>
              1.開始：準備出門。 
              2.判斷：判斷窗外是否下雨：使用判斷符號來決定。
              如果是，則帶雨傘。 如果否，則不帶雨傘。
              3.結束：根據是否帶雨傘的決定來出門。
            </p>
            <p>
              這個流程圖正確地運用了判斷符號來幫助決定是否需要帶雨傘，符合題目的要求。
            </p>
          </div>


        </div>
      </div>
    </div>
  );
};

export default Check;
