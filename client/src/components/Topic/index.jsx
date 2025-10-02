import React, { useState, useEffect } from "react";
import styles from "./topic.module.css";
import { Image, Popover, Button, message, Modal } from "antd";
import {
  GlobalOutlined,
  SyncOutlined,
  BulbOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import axios from "axios";
import StageSwitcher from "../StageSwitcher";

const Topic = () => {
  const [question, setQuestion] = useState(
    "請根據下方敘述繪製流程圖。 你正要出門上學，但需要判斷門外是否會下雨。請應用流程圖，幫助你決定是否需要帶雨傘。"
  );
  const [loading, setLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(1); // 提示層級，從1開始
  const [isHintModalVisible, setIsHintModalVisible] = useState(false);
  const [hintContent, setHintContent] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  // 新增：保存已生成的提示
  const [hintCache, setHintCache] = useState({});
  const [regenerating, setRegenerating] = useState(false);

  // 生成新題目
  const fetchNewQuestion = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:3000/api/generate-question"
      );
      if (response.data.success) {
        setQuestion(response.data.question);
        // 將當前題目存儲到 localStorage，以便在提交流程圖時使用
        localStorage.setItem(
          "currentFlowchartQuestion",
          response.data.question
        );
        // 重置提示層級和提示緩存
        setHintLevel(1);
        setHintCache({});
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

  // 從後端獲取提示
  const fetchHint = async (forceRegenerate = false) => {
    // 檢查是否已經有緩存的提示
    if (!forceRegenerate && hintCache[hintLevel]) {
      setHintContent(hintCache[hintLevel]);
      return;
    }

    setHintLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:3000/api/generate-hint",
        {
          question,
          hintLevel,
        }
      );

      if (response.data.success) {
        const newHint = response.data.hint;
        setHintContent(newHint);

        // 更新提示緩存
        setHintCache((prevCache) => ({
          ...prevCache,
          [hintLevel]: newHint,
        }));
      } else {
        message.error("無法獲取提示");
        setHintContent("抱歉，無法生成提示。請稍後再試。");
      }
    } catch (error) {
      console.error("Error fetching hint:", error);
      message.error("獲取提示時發生錯誤");
      setHintContent("抱歉，生成提示時發生錯誤。請稍後再試。");
    } finally {
      setHintLoading(false);
      setRegenerating(false);
    }
  };

  // 重新生成當前層級的提示
  const regenerateHint = async () => {
    setRegenerating(true);
    await fetchHint(true);
  };

  // 顯示提示對話框
  const showHint = async () => {
    setIsHintModalVisible(true);
    await fetchHint();
  };

  // 前往上一層提示
  const handlePreviousHint = () => {
    if (hintLevel > 1) {
      setHintLevel((prevLevel) => prevLevel - 1);
    }
  };

  // 前往下一層提示
  const handleNextHint = () => {
    if (hintLevel < 7) {
      setHintLevel((prevLevel) => prevLevel + 1);
    }
  };

  // 提示層級改變時更新內容
  useEffect(() => {
    if (isHintModalVisible) {
      fetchHint();
    }
  }, [hintLevel]);

  // 關閉提示對話框
  const handleCloseHint = () => {
    setIsHintModalVisible(false);
  };

  // 初始加載時獲取題目
  useEffect(() => {
    // 或者從 localStorage 獲取先前生成的題目（如果有）
    const savedQuestion = localStorage.getItem("currentFlowchartQuestion");
    if (savedQuestion) {
      setQuestion(savedQuestion);
    }

    // 嘗試從 localStorage 恢復提示緩存
    const savedHintCache = localStorage.getItem("hintCache");
    if (savedHintCache) {
      try {
        setHintCache(JSON.parse(savedHintCache));
      } catch (e) {
        console.error("無法解析保存的提示緩存", e);
      }
    }
  }, []);

  // 保存提示緩存到 localStorage
  useEffect(() => {
    if (Object.keys(hintCache).length > 0) {
      localStorage.setItem("hintCache", JSON.stringify(hintCache));
    }
  }, [hintCache]);

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
    <div className={styles.mainspace}>
      <div
        style={{
          height: "5%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          
        }}
      >
        {/* <div className={styles.parsebox}>
          <img
            src="./public/Icon.svg"
            alt="rightarrow"
            width="24"
            height="24"
          />
          <h4 className={styles.h4}>第一階段</h4>
        </div> */}
        <div
          style={{
            width: "100%",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <StageSwitcher current={currentStage} onChange={setCurrentStage} />
        </div>
      </div>

      <div className={styles.container}>
      
      <div style={{ height: "85%"}}>
        <div className={styles.topicbox}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexDirection: "column",
              overflowY: "hidden",
            }}
          >
            <div style={{ paddingBottom: "2rem" }}>
              <h3>Ch1,繪製流程圖</h3>
            </div>
            <p style={{ flex: 1, padding: "0 1rem 1rem 0" }}>{question}</p>
            <br />
          </div>
          <div
              style={{
                width:"50%",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginTop: "10px",
                overflowY: "hidden",
                justifyContent: "flex-end",
                
              }}
            >
              <Button
                className={styles.buttonStyle01}
                icon={loading ? <SyncOutlined spin /> : <SyncOutlined />}
                onClick={fetchNewQuestion}
                disabled={loading}
              >
                生成新題目
              </Button>
              <Button
                className={styles.buttonStyle02}
                type="primary"
                icon={<BulbOutlined />}
                onClick={showHint}
                loading={hintLoading}
              >
                {`提示 (${hintLevel}/7)`}
              </Button>
          </div>

          <div className={styles.infobox}>
            <div className={styles.examplebox}>
              <img src={"/Camera.png"} height={15} width={16} />
              <Popover placement="right" content={content} trigger="hover">
                <h5 className={styles.example}>流程圖範例</h5>
              </Popover>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Graduation.png"} height={15} width={16} />
              <Popover placement="right" content={example} trigger="hover">
                <h5 className={styles.example}>流程圖的概念</h5>
              </Popover>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Book.png"} height={15} width={16} />
              <Popover placement="right" content={content} trigger="hover">
                <h5 className={styles.example}>流程圖大揭秘</h5>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* 提示對話框 */}
      <Modal
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{`繪圖提示 - 步驟 ${hintLevel}/7`}</span>
            <Button
              icon={<ReloadOutlined spin={regenerating} />}
              onClick={regenerateHint}
              disabled={hintLoading || regenerating}
              size="small"
              style={{ marginRight: "2rem" }}
            >
              重新生成提示
            </Button>
          </div>
        }
        open={isHintModalVisible}
        onCancel={handleCloseHint}
        footer={[
          <Button
            key="previous"
            onClick={handlePreviousHint}
            disabled={hintLevel === 1 || hintLoading}
          >
            上一步提示
          </Button>,
          <Button key="close" onClick={handleCloseHint}>
            關閉
          </Button>,
          <Button
            key="next"
            type="primary"
            onClick={handleNextHint}
            disabled={hintLevel === 7 || hintLoading}
          >
            {hintLevel < 7 ? "下一步提示" : "完成"}
          </Button>,
        ]}
        width={600}
      >
        {hintLoading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            正在生成提示...
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: "10px" }}>
              {Array.from({ length: 7 }).map((_, index) => (
                <Button
                  key={index}
                  type={index + 1 === hintLevel ? "primary" : "default"}
                  shape="circle"
                  size="small"
                  style={{ margin: "0 5px" }}
                  onClick={() => setHintLevel(index + 1)}
                  disabled={hintLoading}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
            <div style={{ whiteSpace: "pre-line" }}>{hintContent}</div>
          </div>
        )}
      </Modal>
    </div>

    </div>
   
  );
};

export default Topic;
