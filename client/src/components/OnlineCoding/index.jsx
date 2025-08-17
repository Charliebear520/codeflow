import React, { useState, useEffect } from "react";
import { Button, App, Spin, Splitter } from "antd";
import { ArrowsAltOutlined, ShrinkOutlined } from "@ant-design/icons";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
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

const OnlineCoding = ({
  value,
  onChange,
  question,
  currentStage,
  onFeedback,
  onChecking,
  isExpanded,
  onToggleExpand,
  onTutorClick,
}) => {
  const { message: antdMessage } = App.useApp();
  const [code, setCode] = useState(value || "");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [runResult, setRunResult] = useState(null); // { stdout, stderr }
  const [runLoading, setRunLoading] = useState(false);
  const [language, setLanguage] = useState("python");

  // 語言對應 CodeMirror extension
  const getLanguageExtension = () => {
    if (language === "python") return python();
    if (language === "javascript") return javascript();
    if (language === "c") return cpp();
    return python();
  };

  // 判斷是否為第三階段
  const isStage3 = !currentStage || currentStage === 2;

  // 自動請求後端生成 PseudoCode
  useEffect(() => {
    if (!question) return;
    if (isStage3) {
      // 第三階段：每次切換題目都清空編輯器
      setCode("");
      setAnswers([]);
      setApiError("");
      setLoading(false);
      onChange && onChange("");
      return;
    }
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

  const handleCheck = async () => {
    if (!code || !question) {
      antdMessage.info("請先輸入程式碼與確認題目");
      return;
    }
    if (onChecking) onChecking(true);
    setApiError("");
    try {
      if (isStage3) {
        // 第三階段：檢查程式語法
        const res = await fetch("http://localhost:3000/api/check-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, code, language }),
        });
        const data = await res.json();
        if (data.success) {
          antdMessage.success("語法檢查回饋已顯示於右側助教區");
          if (onFeedback) onFeedback(data.feedback);
        } else {
          antdMessage.error(data.error || "檢查失敗");
          if (onFeedback) onFeedback(data.feedback || "");
        }
      } else {
        // 第二階段：檢查 pseudocode
        const res = await fetch("http://localhost:3000/api/check-pseudocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, userPseudoCode: code }),
        });
        const data = await res.json();
        if (data.success) {
          antdMessage.success("Gemini 檢查回饋已顯示於右側助教區");
          if (onFeedback) onFeedback(data.feedback);
        } else {
          antdMessage.error(data.error || "檢查失敗");
          if (onFeedback) onFeedback("");
        }
      }
    } catch (e) {
      setApiError("檢查失敗，請稍後再試。");
      antdMessage.error("檢查失敗，請稍後再試。");
      if (onFeedback) onFeedback("");
    } finally {
      if (onChecking) onChecking(false);
    }
  };

  const handleReset = () => {
    if (!isStage3) {
      // 只清空填空區與芙蓉助教提醒
      if (answers.length > 0 && code) {
        // 將所有 ___ 之間的內容清空，保留 ___
        const blanked = code.replace(/___.*?(?=\n|$)/g, "___");
        setCode(blanked);
        onChange && onChange(blanked);
      }
      onFeedback && onFeedback("");
      return;
    }
    // 第三階段：全部清空，包含執行結果與助教回饋
    setCode("");
    setRunResult(null);
    onChange && onChange("");
    onFeedback && onFeedback("");
  };

  const handleRun = async () => {
    setRunLoading(true);
    setRunResult(null);
    setApiError("");
    try {
      const res = await fetch("http://localhost:3000/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setRunResult({ stdout: data.stdout, stderr: data.stderr });
      if (!data.success) {
        antdMessage.error("執行失敗");
      }
    } catch (e) {
      setApiError("執行失敗，請稍後再試。");
      setRunResult(null);
      antdMessage.error("執行失敗，請稍後再試。");
    } finally {
      setRunLoading(false);
    }
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
          height: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#E4EBFF",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isStage3 && (
              <>
                <span style={{ marginRight: 8, fontWeight: 500 }}>語言：</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    fontSize: 15,
                  }}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="c">C</option>
                </select>
              </>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Button onClick={handleCheck}>檢查</Button>
            <Button onClick={handleReset}>清空</Button>
            {isStage3 && (
              <Button type="primary" onClick={handleRun} loading={runLoading}>
                Run
              </Button>
            )}
            {/* 第二階段顯示放大/縮小按鈕 */}
            {!isStage3 && (
              <Button
                type="default"
                icon={isExpanded ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
                onClick={onToggleExpand}
                title={isExpanded ? "縮小" : "放大"}
                style={{
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "scale(1)";
                }}
              >
                {isExpanded ? "縮小" : "放大"}
              </Button>
            )}
            {/* 芙蓉助教按鈕 - 只在放大模式下顯示 */}
            {isExpanded && (
              <Button
                style={{
                  backgroundColor: "#375BD3",
                  color: "#FFFFFF",
                  border: "none",
                }}
                onClick={onTutorClick || (() => {})}
              >
                詢問沐芙助教
              </Button>
            )}
          </div>
        </div>
        {loading ? (
          <Spin />
        ) : apiError ? (
          <div style={{ color: "red", marginTop: 12 }}>{apiError}</div>
        ) : null}
        <Splitter layout="vertical" style={{ flex: 1, minHeight: 0 }}>
          <Splitter.Panel
            min={100}
            defaultSize={350}
            style={{ overflow: "auto" }}
          >
            <CodeMirror
              value={code}
              height="100%"
              extensions={
                isStage3
                  ? [getLanguageExtension(), blankDecorationExtension()]
                  : [blankDecorationExtension()]
              }
              onChange={handleChange}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
              }}
            />
          </Splitter.Panel>
          {isStage3 && (
            <Splitter.Panel
              min={60}
              defaultSize={120}
              style={{ overflow: "auto" }}
            >
              <div
                style={{
                  background: "#f6f6f6",
                  borderRadius: 6,
                  padding: 16,
                  fontFamily: "monospace",
                  minHeight: 60,
                  height: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>執行結果</div>
                {runResult && runResult.stdout && (
                  <div>
                    <div style={{ color: "#333", marginBottom: 4 }}>輸出：</div>
                    <pre style={{ margin: 0, color: "#222" }}>
                      {runResult.stdout}
                    </pre>
                  </div>
                )}
                {runResult && runResult.stderr && (
                  <div>
                    <div style={{ color: "#c00", marginTop: 8 }}>錯誤：</div>
                    <pre style={{ margin: 0, color: "#c00" }}>
                      {runResult.stderr}
                    </pre>
                  </div>
                )}
                {!runResult && (
                  <div style={{ color: "#888" }}>（尚未執行程式）</div>
                )}
              </div>
            </Splitter.Panel>
          )}
        </Splitter>
      </div>
    </App>
  );
};

export default OnlineCoding;
