import React from "react";
import styles from "./check.module.css";
import { Button, Spin } from "antd";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";

const Check = ({ feedback, isChecking, onTutorClick }) => {
  const { result } = useSelector((state) => state.check);

  return (
    <div className={styles.container}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
      >
        {onTutorClick && (
          <div className={styles.tutorbox}>
            <Button
              style={{ height: "36px", fontSize: "16px", backgroundColor: "#375BD3", color: "#FFFFFF" }}
              onClick={onTutorClick}
            >
              詢問沐芙助教
            </Button>
          </div>
        )}
      </div>
      <div style={{ height: "83%" }}>
        <div className={styles.topicbox}>
          {isChecking ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <Spin size="large" />
            </div>
          ) : feedback ? (
            <div>
              <p style={{ color: "#9287EE" }}>AI 助教回饋：</p>
              <ReactMarkdown>{feedback}</ReactMarkdown>
            </div>
          ) : result ? (
            <div>
              <p style={{ color: "#9287EE" }}>流程圖分析結果：</p>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Check;
