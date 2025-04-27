import React, { useState } from "react";
import { Button, App } from "antd";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

const OnlineCoding = ({ value, onChange }) => {
  const [code, setCode] = useState(value || "");
  const { message } = App.useApp();

  const handleCheck = () => {
    // 這裡可以加上檢查邏輯
    message.info("檢查功能尚未實作");
  };

  const handleReset = () => {
    setCode("");
    onChange && onChange("");
  };

  const handleRun = () => {
    // 這裡可以加上執行邏輯
    message.info("Run 功能尚未實作");
  };

  const handleChange = (val) => {
    setCode(val);
    onChange && onChange(val);
  };

  return (
    <App>
      <div
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Button onClick={handleCheck}>檢查</Button>
          <Button onClick={handleReset}>清空</Button>
          <Button type="primary" onClick={handleRun}>
            Run
          </Button>
        </div>
        <CodeMirror
          value={code}
          height="350px"
          extensions={[python()]}
          onChange={handleChange}
          theme="light"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
          }}
        />
      </div>
    </App>
  );
};

export default OnlineCoding;
