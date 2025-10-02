import React from "react";
import styles from "../TopicStage2/topic.module.css";
import StageSwitcher from "../StageSwitcher";

const TopicStage3 = ({ question, currentStage, setCurrentStage }) => {
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
            <h4 className={styles.h4}>第三階段</h4>
          </div> */}
        <div style={{ width: "100%", overflow: "hidden" }}>
          <StageSwitcher current={currentStage} onChange={setCurrentStage} />
        </div>

      </div>
      <div className={styles.container}>
     
      <div style={{ height: "85%"}}>
        <div className={styles.topicbox}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflowY: "hidden",
            }}
          >
            <div style={{ paddingBottom: "2rem" }}>
              <h3>Ch3,撰寫程式碼</h3>
            </div>
            <p style={{ flex: 1, padding: "0 1rem" }}>{question}</p>
          </div>
          <div className={styles.infobox}>
            <div className={styles.examplebox}>
              <img src={"/Book.png"} height={15} width={16} />
              <h5 className={styles.example}>
                可自由選擇程式語言（Python/JavaScript/C）完成題目
              </h5>
            </div>
            <div className={styles.examplebox}>
              <img src={"/Graduation.png"} height={15} width={16} />
              <h5 className={styles.example}>可使用右方編譯器測試程式碼</h5>
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>
    
  );
};

export default TopicStage3;
