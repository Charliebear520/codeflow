import React from "react";
import { Tabs, ConfigProvider } from "antd";
import CreateOnline from "../CreateOnline";
import UploadFlowchart from "../UploadFlowChart";
import ReactFlowDnd from "../ReactFlowDnd";
import styles from "./answer.module.css";

const Answer = () => {
  const items = [
    {
      key: "1",
      label: "上傳流程圖",
      children: (
        <div style={{ height: "100%" }}>
          {" "}
          {/* 確保每個 children 撐滿 */}
          <UploadFlowchart />
        </div>
      ),
    },
    {
      key: "2",
      label: "線上製作",
      children: (
        <div style={{ height: "100%" }}>
          {" "}
          {/* 同樣對第二個 children 設置 */}
          {/* <CreateOnline /> */}
          <ReactFlowDnd />
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Tabs: {
            horizontalMargin: "0px",
            height: "100%",
          },
        },
      }}
    >
      <div className={styles.container}>
        <div style={{ height: "10%" }}>
          <></>
        </div>
        <div className={styles.tabContent}>
          <Tabs defaultActiveKey="1" type="card" items={items} />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Answer;
