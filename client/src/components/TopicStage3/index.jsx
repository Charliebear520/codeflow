import React from "react";
import styles from "../TopicStage2/topic.module.css";
import StageSwitcher from "../StageSwitcher";

const TopicStage3 = ({ question, currentStage, setCurrentStage }) => {
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
          <h4 className={styles.h4}>第三階段</h4>
        </div>
        <StageSwitcher current={currentStage} onChange={setCurrentStage} />
        <div>
          <h5>Ch1,主流程式語言實作</h5>
        </div>
      </div>
      <div style={{ height: "100%", overflowY: "hidden" }}>
        <div className={styles.topicbox}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflowY: "hidden",
            }}
          >
            <p style={{ flex: 1, padding: "0 1rem" }}>{question}</p>
          </div>
          <div className={styles.infobox}>
            <div className={styles.examplebox}>
              <img src={"/Book.png"} height={14} width={14} />
              <h5 className={styles.example}>
                請用主流程式語言（Python/JavaScript/C）完成題目
              </h5>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Graduation.png"} height={14} width={14} />
              <h5 className={styles.example}>可使用下方編譯器測試程式碼</h5>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicStage3;
