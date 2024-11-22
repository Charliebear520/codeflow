import React from "react";
import styles from "./topic.module.css";
import { Image, Popover } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

const Topic = () => {
  const content = (
    <div>
      <Image
        src="/image4.png"
        alt="流程圖範例"
        style={{ width: "200px" }}
        preview={false}
      />
    </div>
  );
  const example = (
    <div>
      <p style={{ width: "540px", height: "100%" }}>
        流程圖，又稱程式方塊圖是表示演算法、工作流或流程的一種方塊圖表示，它以不同類型的框代表不同種類的步驟，每兩個步驟之間則以箭頭連接。這種表示方法便於說明解決已知問題的方法。流程圖在分析、設計、記錄及操控許多領域的流程或程式都有廣泛應用。
      </p>
      <div className={styles.linkbox}>
        <Link
          to="https://zh.wikipedia.org/zh-tw/%E6%B5%81%E7%A8%8B%E5%9B%BE"
          target="_blank"
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <GlobalOutlined style={{ color: "#375bd3" }} />
          Wiki
        </Link>
      </div>
    </div>
  );
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
          <div className={styles.infobox}>
            <div className={styles.examplebox}>
              <img src={"/Camera.png"} height={14} width={14} />
              <Popover placement="right" content={content} trigger="hover">
                <h5 className={styles.example}>流程圖範例</h5>
              </Popover>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Graduation.png"} height={14} width={14} />
              <Popover placement="right" content={example} trigger="hover">
                <h5 className={styles.example}>流程圖的概念</h5>
              </Popover>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Book.png"} height={14} width={14} />
              <Popover placement="right" content={content} trigger="hover">
                <h5 className={styles.example}>流程圖大揭秘</h5>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topic;
