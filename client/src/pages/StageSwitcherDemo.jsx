import React, { useState } from "react";
import StageSwitcher from "../components/StageSwitcher";

export default function StageSwitcherDemo() {
  const [currentStage, setCurrentStage] = useState(0);

  return (
    <div
      style={{
        padding: "40px",
        background: "#f5f5f5",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "40px", color: "#333" }}>
        階段切換組件演示
      </h1>

      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h2 style={{ marginBottom: "20px", color: "#375BD3" }}>
          當前階段: {currentStage + 1}
        </h2>

        <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}>
          <StageSwitcher current={currentStage} onChange={setCurrentStage} />
        </div>

        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
          }}
        >
          <h3>功能說明:</h3>
          <ul style={{ lineHeight: "1.6" }}>
            <li>
              ✅ 被選中的狀態背景色為{" "}
              <code
                style={{
                  background: "#375BD3",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                #375BD3
              </code>
            </li>
            <li>
              ✅ 未被選中的狀態背景色為{" "}
              <code
                style={{
                  background: "#B2C8FF",
                  color: "#375BD3",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                #B2C8FF
              </code>
            </li>
            <li>✅ 被點擊的狀態略微放大 (scale: 1.1)</li>
            <li>✅ 懸停效果和點擊動畫</li>
            <li>✅ 連接線根據進度變化顏色</li>
            <li>✅ 左右導航按鈕</li>
          </ul>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            background: "#e8f4fd",
            borderRadius: "8px",
            border: "1px solid #b3d9ff",
          }}
        >
          <h3>使用方式:</h3>
          <pre
            style={{
              background: "#f8f9fa",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
            }}
          >
            {`<StageSwitcher 
  current={currentStage} 
  onChange={setCurrentStage} 
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
