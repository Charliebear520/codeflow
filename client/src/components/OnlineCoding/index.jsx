import React, { useState, useEffect, useRef } from "react";
import { Button, App, Spin, Splitter, Popover } from "antd";
import {
  ArrowsAltOutlined,
  ShrinkOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { EditorView, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import "./blankHighlight.css";
import styles from "./answer.module.css";
import { useAuth } from "@clerk/clerk-react"; //額外加入

// 方案A：Highlight ___
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
  const [saving, setSaving] = useState(false); // 新增：檢查/儲存中的狀態，避免多次點擊與 ReferenceError
  const [terminalOutput, setTerminalOutput] = useState([]); // 終端機輸出歷史
  const [terminalInput, setTerminalInput] = useState(""); // 當前輸入
  const [isTerminalActive, setIsTerminalActive] = useState(false); // 終端機是否活躍
  const [processId, setProcessId] = useState(null); // 當前執行的程序ID
  const flowRef = useRef(null); //取得現在時間，儲存作答時間用的
  const lastTickRef = useRef(Date.now());

  // 新增：儲存中 flag，避免重複點擊 (修正 saving 未定義錯誤)
  const [checking, setChecking] = useState(false);
  const { getToken } = useAuth(); //額外加入
  const API_BASE = import.meta.env.VITE_API_BASE; //額外加入

  // 語言對應 CodeMirror extension
  const getLanguageExtension = () => {
    if (language === "python") return python();
    if (language === "javascript") return javascript();
    if (language === "c") return cpp();
    return python();
  };

  // 判斷是否為第三階段
  const isStage3 = !currentStage || currentStage === 2;

  // 執行結果的 Popover 內容
  const runResultContent = (
    <div>
      <p>你所輸入的結果會決定題目的走向，進而造成程式碼的差異。</p>
    </div>
  );

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
    fetch("/api/generate-pseudocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
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
      return false;
    }
    setChecking(true);
    if (onChecking) onChecking(true);
    setApiError("");
    try {
      if (isStage3) {
        // 第三階段：檢查程式語法
        const res = await fetch("/api/check-code", {
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
        const res = await fetch("/api/check-pseudocode", {
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
      setChecking(false);
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
    setTerminalOutput([]);
    setTerminalInput("");
    setIsTerminalActive(false);
    if (processId) {
      handleStopExecution();
    }
    setProcessId(null);
    onChange && onChange("");
    onFeedback && onFeedback("");
  };

  const handleRun = async () => {
    setRunLoading(true);
    setRunResult(null);
    setApiError("");
    setTerminalOutput([]);
    setIsTerminalActive(false);
    setProcessId(null);

    try {
      const res = await fetch("/api/run-code-interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();

      if (data.success) {
        setProcessId(data.processId);
        setIsTerminalActive(data.needsInput); // 只有需要輸入時才設為活躍
        setTerminalOutput([
          { type: "output", content: data.initialOutput || "" },
        ]);

        if (data.needsInput) {
          antdMessage.success("程式已開始執行，請在終端機中輸入資料");
        } else if (data.finished) {
          antdMessage.success("程式執行完成");
          setProcessId(null); // 程式已完成，清除processId
          setIsTerminalActive(false); // 確保終端機不活躍
        }
      } else {
        setRunResult({
          stdout: data.stdout || "",
          stderr: data.stderr || "",
          errorExplanation: data.errorExplanation,
          errorType: data.errorType,
        });
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

  // 處理終端機輸入
  const handleTerminalInput = async (e) => {
    if (e.key === "Enter" && isTerminalActive && processId) {
      const input = terminalInput.trim();
      setTerminalOutput((prev) => [
        ...prev,
        { type: "input", content: ` ${input}` },
      ]);

      try {
        const res = await fetch("/api/send-input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processId, input }),
        });
        const data = await res.json();

        if (data.success) {
          if (data.output) {
            setTerminalOutput((prev) => [
              ...prev,
              { type: "output", content: data.output },
            ]);
          }
          if (data.finished) {
            setIsTerminalActive(false);
            setProcessId(null);
            if (data.error) {
              setTerminalOutput((prev) => [
                ...prev,
                { type: "error", content: data.error },
              ]);
            }
          }
        } else {
          setTerminalOutput((prev) => [
            ...prev,
            { type: "error", content: data.error || "輸入失敗" },
          ]);
        }
      } catch (error) {
        setTerminalOutput((prev) => [
          ...prev,
          { type: "error", content: "輸入失敗，請稍後再試" },
        ]);
      }

      setTerminalInput("");
    }
  };

  // 停止程式執行
  const handleStopExecution = async () => {
    if (processId) {
      try {
        await fetch("/api/stop-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processId }),
        });
      } catch (error) {
        console.error("停止程序失敗:", error);
      }
    }
    setIsTerminalActive(false);
    setProcessId(null);
    setTerminalOutput((prev) => [
      ...prev,
      { type: "system", content: "程式執行已停止" },
    ]);
  };
  const HandleSave = async () => {
    const token = await getToken();
    let payload = { questionId: "Q001", completed: false };
    const now = Date.now();
    const deltaSec = Math.max(0, Math.floor((now - (lastTickRef.current || now)) / 1000));
    lastTickRef.current = now;
    payload.durationDeltaSec = deltaSec;

    if (saving) return; // 防止重複點擊
    setSaving(true);
    setApiError("");

    try {
      // ---------- 第 1 步：進行檢查 ----------
      if (!code || !question) {
        antdMessage.info("請先輸入程式碼與確認題目");
        return;
      }

      setChecking(true);
      if (onChecking) onChecking(true);

      let checkRes;
      let checkData;
      try {
        if (isStage3) {
          // 第三階段：檢查程式語法
          checkRes = await fetch("/api/check-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, code, language }),
          });
        } else {
          // 第二階段：檢查 pseudocode
          checkRes = await fetch("/api/check-pseudocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, userPseudoCode: code }),
          });
        }

        checkData = await checkRes.json();
      } catch (err) {
        console.error("檢查階段錯誤:", err);
        antdMessage.error("檢查失敗，請稍後再試。");
        return;
      } finally {
        setChecking(false);
        if (onChecking) onChecking(false);
      }

      // ---------- 第 2 步：檢查回傳結果 ----------
      if (!checkData?.success) {
        antdMessage.error(checkData?.error || "檢查未通過，請修改後再試。");
        if (onFeedback) onFeedback(checkData?.feedback || "");
        return;
      }

      // 檢查成功
      antdMessage.success("語法檢查回饋已顯示於右側助教區");
      if (onFeedback) onFeedback(checkData.feedback);

      // ---------- 第 3 步：進行儲存 ----------
      const questionId =
        localStorage.getItem("currentFlowchartQuestionId") || "Q001";
      // const API_BASE = import.meta.env.VITE_API_BASE;

      let saveRes, saveData;

      if (isStage3) {
        console.log("[HandleSave] 儲存第三階段資料...");
        saveRes = await fetch(`/api/submissions/stage3`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId,
            code,
            language,
            completed: false,
            durationDeltaSec: deltaSec,
          }),
        });
      } else {
        console.log("[HandleSave] 儲存第二階段資料...");
        saveRes = await fetch(`/api/submissions/stage2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId,
            pseudocode: code,
            completed: false,
            durationDeltaSec: deltaSec,
          }),
        });
      }

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        console.error("儲存階段 HTTP 錯誤:", errText);
        throw new Error(`HTTP error! status: ${saveRes.status}`);
      }

      saveData = await saveRes.json();
      console.log("💾 儲存回傳資料:", saveData);

      if (saveData.success) {
        antdMessage.success(
          isStage3 ? "已儲存第三階段的作答" : "已儲存第二階段的作答"
        );
        console.log("保存成功", { questionId, stage: isStage3 ? 3 : 2 });
      } else {
        antdMessage.error(saveData.error || "儲存失敗");
      }
    } catch (err) {
      console.error("HandleSave 發生錯誤:", err);
      setApiError("操作失敗，請稍後再試。");
      antdMessage.error("操作失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.mainspace}>
      <App style={{ height: "95%" }}>
        <div
          style={{
            width: "100%",
            background: "#fff",
            borderRadius: 8,
            // padding: 24,
            boxSizing: "border-box",
            height: "85%",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div
            style={{
              background: "#E4EBFF",
              padding: "6px 8px",
              // borderRadius: "8px",
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
                  <span style={{ marginRight: 8, fontWeight: 500 }}>
                    語言：
                  </span>
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
              <Button
                onClick={HandleSave}
                style={{
                  backgroundColor: "#B2C8FF",
                  color: "#223687",
                  border: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  // e.target.style.backgroundColor = "#9BB8FF";
                  e.target.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  // e.target.style.backgroundColor = "#B2C8FF";
                  e.target.style.transform = "scale(1)";
                }}
                loading={checking || saving}
                disabled={checking || saving}
              >
                檢查
              </Button>
              <Button
                onClick={handleReset}
                style={{
                  backgroundColor: "#9287ee94",
                  color: "#223687",
                  border: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  // e.target.style.backgroundColor = "#7A6FD8";
                  e.target.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  // e.target.style.backgroundColor = "#9287EE";
                  e.target.style.transform = "scale(1)";
                }}
              >
                清空
              </Button>

              {isStage3 && (
                <>
                  {!isTerminalActive ? (
                    <Button
                      onClick={handleRun}
                      loading={runLoading}
                      style={{
                        backgroundColor: "rgb(193, 232, 238)",
                        color: "#223687",
                        border: "none",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        // e.target.style.backgroundColor = "rgb(161 224 234)";
                        e.target.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        // e.target.style.backgroundColor = "rgb(193, 232, 238)";
                        e.target.style.transform = "scale(1)";
                      }}
                    >
                      Run
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopExecution}
                      style={{
                        backgroundColor: "#DFDFDF",
                        color: "#223687",
                        border: "none",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        // e.target.style.backgroundColor = "#ff5252";
                        e.target.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        // e.target.style.backgroundColor = "#ff6b6b";
                        e.target.style.transform = "scale(1)";
                      }}
                    >
                      STOP
                    </Button>
                  )}
                </>
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
                  {/* {isExpanded ? "縮小" : "放大"} */}
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
                  onClick={() => { }}
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
                defaultSize={200}
                style={{
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    // background: "rgb(250 249 255)",
                    borderRadius: 6,
                    padding: 16,
                    fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                    minHeight: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    color: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 12,
                      color: "rgb(122, 111, 216)",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {/* <span>🖥️</span> */}
                    <span style={{ color: "#375BD3" }}>執行結果</span>
                    {isTerminalActive && (
                      <span>
                        <Popover
                          placement="rightBottom"
                          content={runResultContent}
                          trigger="hover"
                          color="#E4EBFF"
                          style={{ width: "50%" }}
                        >
                          <QuestionCircleOutlined
                            style={{ fontSize: "16px", color: "#375BD3" }}
                          />
                        </Popover>
                      </span>
                    )}
                  </div>

                  {/* 終端機輸出區域 */}
                  <div
                    style={{
                      flex: 1,
                      overflow: "auto",
                      background: "#ffffff",
                      borderRadius: 4,
                      padding: "12px 12px 12px 0",
                      marginBottom: 12,
                      fontSize: 13,
                      lineHeight: 1.4,
                      maxHeight: "calc(100% - 80px)",
                    }}
                  >
                    {terminalOutput.length > 0 ? (
                      terminalOutput.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            marginBottom: 4,
                            color:
                              item.type === "error"
                                ? "#ff6b6b"
                                : item.type === "input"
                                  ? "#4CAF50"
                                  : item.type === "system"
                                    ? "#FFA726"
                                    : "rgb(0 0 0)",
                            whiteSpace: "pre-wrap",
                            wordWrap: "break-word",
                          }}
                        >
                          {item.content}
                        </div>
                      ))
                    ) : runResult ? (
                      <div>
                        {runResult.stdout && (
                          <div style={{ color: "#ffffff", marginBottom: 8 }}>
                            <div style={{ color: "#4CAF50", marginBottom: 4 }}>
                              輸出：
                            </div>
                            <pre style={{ margin: 0, color: "#ffffff" }}>
                              {runResult.stdout}
                            </pre>
                          </div>
                        )}
                        {runResult.stderr && (
                          <div>
                            {runResult.errorExplanation && (
                              <div style={{ marginTop: 12 }}>
                                <div
                                  style={{
                                    color: "#ff6b6b",
                                    fontWeight: 600,
                                    marginBottom: 8,
                                    fontSize: 14,
                                  }}
                                >
                                  🤖 錯誤說明
                                </div>
                                <div
                                  style={{
                                    background: "#2d2d2d",
                                    border: "1px solid #444",
                                    borderRadius: 6,
                                    padding: 12,
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                    wordWrap: "break-word",
                                    color: "#ffffff",
                                  }}
                                >
                                  {runResult.errorExplanation}
                                </div>
                                <div style={{ color: "#ff6b6b", marginTop: 8 }}>
                                  錯誤：
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    color: "#ff6b6b",
                                    wordWrap: "break-word",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {runResult.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: "#888" }}>（尚未執行程式）</div>
                    )}
                  </div>

                  {/* 終端機輸入區域 */}
                  {isTerminalActive && (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ color: "#4CAF50" }}></span>
                      <input
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalInput}
                        placeholder="請輸入資料..."
                        style={{
                          flex: 1,
                          background: "rgb(255 255 255)",
                          border: "1px solid rgb(191 191 191)",
                          borderRadius: 4,
                          padding: "8px 12px",
                          color: "rgb(5 5 5)",
                          fontSize: 13,
                          fontFamily: "inherit",
                          outline: "none",
                        }}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </Splitter.Panel>
            )}
          </Splitter>
        </div>
      </App>
    </div>
  );
};

export default OnlineCoding;