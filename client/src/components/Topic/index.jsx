import React, { useState, useEffect } from "react";
import styles from "./topic.module.css";
import { Image, Popover, Button, message } from "antd";
import { GlobalOutlined, SyncOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import axios from "axios";

const Topic = () => {
  const [question, setQuestion] = useState("請根據下方敘述繪製流程圖。 你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。");
  const [loading, setLoading] = useState(false);
  
  // 生成新題目
  const fetchNewQuestion = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:3000/api/generate-question");
      if (response.data.success) {
        setQuestion(response.data.question);
        // 將當前題目存儲到 localStorage，以便在提交流程圖時使用
        localStorage.setItem('currentFlowchartQuestion', response.data.question);
      } else {
        message.error("無法生成新題目");
      }
    } catch (error) {
      console.error("Error fetching question:", error);
      message.error("獲取題目時發生錯誤");
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加載時獲取題目
  useEffect(() => {
    // 如果想一開始就有動態題目，取消下面的注釋
    // fetchNewQuestion();
    
    // 或者從 localStorage 獲取先前生成的題目（如果有）
    const savedQuestion = localStorage.getItem('currentFlowchartQuestion');
    if (savedQuestion) {
      setQuestion(savedQuestion);
    }
  }, []);

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" ,flexDirection: "column"}}>
              <p style={{ flex: 1 }}>{question}</p>
              <Button 
                icon={loading ? <SyncOutlined spin /> : <SyncOutlined />} 
                onClick={fetchNewQuestion}
                disabled={loading}
                style={{ marginLeft: '10px' }}
              >
                生成新題目
              </Button>
            </div>
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
