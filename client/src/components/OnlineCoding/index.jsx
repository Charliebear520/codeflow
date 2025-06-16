import React, { useState, useEffect } from "react";
import { Button, App, Spin } from "antd";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import "./blankHighlight.css";

// 方案A：高亮___
function blankDecorationExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.buildDecorations(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
      buildDecorations(view) {
        const builder = new RangeSetBuilder();
        const regex = /___/g;
        for (let { from, to } of view.visibleRanges) {
          let text = view.state.doc.sliceString(from, to);
          let match;
          while ((match = regex.exec(text))) {
            const start = from + match.index;
            const end = start + 3;
            builder.add(
              start,
              end,
              Decoration.mark({ class: "cm-blank-field" })
            );
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

const OnlineCoding = ({ value, onChange, question, currentStage }) => {
  const { message: antdMessage } = App.useApp();
  const [code, setCode] = useState(value || "");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  // 自動請求後端生成 PseudoCode
  useEffect(() => {
    if (!question) return;
    setLoading(true);
    setApiError("");
    fetch("http://localhost:3000/api/generate-pseudocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.pseudoCode && data.answers) {
          setAnswers(data.answers);
          // 將 pseudoCode array 轉為字串，並自動填入編輯器
          setCode(data.pseudoCode.join("\n"));
          onChange && onChange(data.pseudoCode.join("\n"));
        } else {
          setAnswers([]);
          setCode("");
          setApiError("後端回傳格式錯誤，請聯絡管理員。");
        }
      })
      .catch(() => {
        setAnswers([]);
        setCode("");
        setApiError("生成 PseudoCode 失敗，請稍後再試。");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [question]);

  const handleCheck = () => {
    // 比對用戶填寫的內容與正確答案
    if (!answers.length) {
      antdMessage.info("無正確答案可檢查");
      return;
    }
    // 取出所有 ___ 的填空
    const userInputs = [];
    const regex = /___/g;
    let match;
    let codeCopy = code;
    while ((match = regex.exec(codeCopy))) {
      // 取得 ___ 的實際填寫內容
      // 這裡可進一步優化為用戶填空的內容
    }
    // 你可以根據需求進行更進階的比對
    antdMessage.info("檢查功能請根據需求自訂");
  };

  const handleReset = () => {
    setCode("");
    onChange && onChange("");
  };

  const handleRun = () => {
    antdMessage.info("Run 功能尚未實作");
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
        {loading ? (
          <Spin />
        ) : apiError ? (
          <div style={{ color: "red", marginTop: 12 }}>{apiError}</div>
        ) : (
          <CodeMirror
            value={code}
            height="450px"
            extensions={[python(), blankDecorationExtension()]}
            onChange={handleChange}
            theme="light"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
            }}
          />
        )}
      </div>
    </App>
  );
};

export default OnlineCoding;
