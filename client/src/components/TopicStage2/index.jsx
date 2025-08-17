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

const TopicStage2 = ({
  question,
  setQuestion,
  currentStage,
  setCurrentStage,
}) => {
  const [loading, setLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState(1); // 提示層級，從1開始
  const [isHintModalVisible, setIsHintModalVisible] = useState(false);
  const [hintContent, setHintContent] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
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
        localStorage.setItem(
          "currentFlowchartQuestion",
          response.data.question
        );
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
    const savedQuestion = localStorage.getItem("currentFlowchartQuestion");
    if (savedQuestion) {
      setQuestion(savedQuestion);
    }
    const savedHintCache = localStorage.getItem("hintCache");
    if (savedHintCache) {
      try {
        setHintCache(JSON.parse(savedHintCache));
      } catch (e) {
        console.error("無法解析保存的提示緩存", e);
      }
    }
  }, [setQuestion]);

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
          <h4 className={styles.h4}>
            {currentStage === 0
              ? "第一階段"
              : currentStage === 1
              ? "第二階段"
              : `第${currentStage + 1}階段`}
          </h4>
        </div>
        <div style={{ width: "100%", overflow: "hidden" }}>
          <StageSwitcher current={currentStage} onChange={setCurrentStage} />
        </div>
        <div>
          <h5>
            Ch1,
            {currentStage === 0
              ? "繪製流程圖"
              : currentStage === 1
              ? "製作pseudocode"
              : ""}
          </h5>
        </div>
      </div>
      <div style={{ height: "100%", overflowY: "hidden" }}>
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
            <p style={{ flex: 1, padding: "0 1rem" }}>{question}</p>
            <br />
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

export default TopicStage2;
