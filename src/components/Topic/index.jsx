import React from "react";
import styles from "./topic.module.css";
import { RightCircleOutlined } from "@ant-design/icons";

const Topic = () => {
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
        <div className={styles.parsebox}>
          <img
            src="./public/Icon.svg"
            alt="rightarrow"
            width="24"
            height="24"
          />
          <h4 className={styles.h4}>第一階段</h4>
        </div>
        <div>
          <h5>Ch1,繪製流程圖</h5>
        </div>
      </div>
      <div style={{ height: "80%" }}>
        <div className={styles.topicbox}>
          <div>
            <p>
              請根據下方敘述繪製流程圖。 你正要出門上學，但需要判斷門外是
              否會下雨。請應用流程圖，幫助你決 定是否需要帶雨傘。
            </p>
            <br />
            <p style={{ color: "#9287EE" }}>提示：這題請一定要使用判斷符號！</p>
          </div>

          <div className={styles.examplebox}>
            <h5 className={styles.example}>流程圖範例</h5>
            <RightCircleOutlined style={{ color: "#375BD3" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topic;
