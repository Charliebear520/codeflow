import { submissionRequest, currentQuestionId, loadMySubmission } from "../../lib/submissions";
import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ConfigProvider, Tabs, Button, App } from "antd";
import ReactFlowDnd from "../ReactFlowDnd";
import Check from "../Check"; // 引入 Check 组件
import styles from "./answer.module.css";
import { IKImage } from "imagekitio-react";
import html2canvas from "html2canvas";
import { toPng } from "html-to-image";
import { useDispatch } from "react-redux";
import { checkFlowchart, resetCheck } from "../../redux/slices/checkSlice";
import { InboxOutlined } from "@ant-design/icons";
import UploadImage from "../upload";

// const { Dragger } = Upload;

// 定義出初始節點和邊
const initialNodes = []; // 空數組，不顯示任何初始節點

const initialEdges = []; // 空數組，不顯示任何初始邊

const Answer = ({ onChecking }) => {
  const [activeKey, setActiveKey] = useState("1");
  const { isSignedIn, getToken, userId } = useAuth();
  const saveSubmission = (url, options) => submissionRequest(url, options, userId);
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
  });
  const flowRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const dispatch = useDispatch();
  const [fileList, setFileList] = useState([]);
  const { message } = App.useApp(); // 使用 App 的 message API
  const [checking, setChecking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savedStage1, setSavedStage1] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    setSavedStage1(null);
    setFileList([]);
    setActiveKey("1");
    setRestoring(true);
    loadMySubmission(getToken).then((doc) => {
      if (cancelled) return;
      const stage = doc?.stages?.stage1;
      if (!stage) return;
      setSavedStage1(stage);
      if (stage.graph?.nodes?.length) setActiveKey("2");
      else if (stage.imageBase64) setFileList([{ uid: "saved", name: "已儲存流程圖", status: "done", base64: stage.imageBase64, url: stage.imageBase64 }]);
    }).catch((error) => { if (!cancelled) message.error(error.message); })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, [isSignedIn, userId, getToken, message]);

  const handleCheck = async () => {
    try {
      setChecking(true);
      if (onChecking) onChecking(true);

      if (!isSignedIn) {
        message.error("請先登入");
        return;
      }

      // 準備 payload
      let payload = {
        questionId: currentQuestionId(), // TODO: 改為動態傳入的題目 ID
      };

      if (activeKey === "1") {
        // 上傳流程圖模式
        if (fileList.length === 0) {
          message.error("請先上傳流程圖");
          return;
        }

        const base64Image = fileList[0].base64;
        if (!base64Image) {
          message.error("圖片處理中，請稍後再試");
          return;
        }

        payload.imageBase64 = base64Image.startsWith("data:")
          ? base64Image.split(",")[1]
          : base64Image;
      } else if (activeKey === "2") {
        // 線上製作模式
        if (!flowRef.current?.exportGraph) {
          message.error("流程圖元件尚未載入");
          return;
        }

        const { nodes, edges } = flowRef.current.exportGraph();
        const hasData = (nodes?.length || 0) + (edges?.length || 0) > 0;

        if (!hasData) {
          message.error("請先繪製流程圖");
          return;
        }

        payload.graph = { nodes, edges };

        // 也生成圖片以便記錄
        const flowElement = document.querySelector(".react-flow");
        if (flowElement) {
          const dataUrl = await toPng(flowElement, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
          });
          payload.imageBase64 = dataUrl.split(",")[1];
        }
      }

      // 呼叫完整的比對 API
      const token = await getToken();
      const res = await saveSubmission(`/api/submissions/stage1/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      console.log("📊 收到的 API 回應:", data);

      // 將結果儲存到 Redux（讓 Check 元件顯示）
      dispatch({
        type: "check/setCheckResult",
        payload: {
          scores: data.scores,
          diffs: data.diffs,
          feedback: data.feedback,
          submissionId: data.submissionId,
        },
      });

      console.log("✅ 已更新 Redux state");
      message.success("檢查完成！已產生詳細回饋");
    } catch (error) {
      console.error("檢查過程發生錯誤:", error);
      message.error(error.message || "檢查過程發生錯誤");
    } finally {
      setChecking(false);
      if (onChecking) onChecking(false);
    }
  };

  const handleReset = () => {
    console.log("🧹 執行清空操作");
    if (activeKey === "1") {
      setFileList([]);
    } else if (activeKey === "2") {
      if (flowRef.current) {
        flowRef.current.resetFlow();
      }
    }
    dispatch(resetCheck());
    console.log("✅ 已清空 Redux state");
  };

  const items = [
    {
      key: "1",
      label: "上傳流程圖",
      children: (
        <div className={styles.uploadContainer}>
          <UploadImage fileList={fileList} setFileList={setFileList} />
        </div>
      ),
    },
    {
      key: "2",
      label: "線上製作",
      children: (
        <div className={styles.flowContainer}>
          <ReactFlowDnd
            ref={flowRef}
            key={savedStage1?.updatedAt || "new"}
            initialNodes={savedStage1?.graph?.nodes || initialNodes}
            initialEdges={savedStage1?.graph?.edges || initialEdges}
          />
        </div>
      ),
    },
  ];
  const handleSave = async () => {
    if (saving || restoring) return;
    setSaving(true);
    try {
      if (!isSignedIn) {
        message.error("請先登入");
        return;
      }

      let payload = { questionId: currentQuestionId(), completed: false };
      const now = Date.now();
      const deltaSec = Math.max(
        0,
        Math.floor((now - (lastTickRef.current || now)) / 1000),
      );
      payload.durationDeltaSec = deltaSec;

      if (activeKey === "1") {
        // 上傳流程圖
        if (fileList.length === 0 || !fileList[0].base64) {
          message.error("請先上傳流程圖圖片");
          return;
        }
        payload.imageBase64 = fileList[0].base64.startsWith("data:")
          ? fileList[0].base64
          : "data:image/png;base64," + fileList[0].base64;
        payload.mode = "upload";
        // 不檢查 flowRef
      } else if (activeKey === "2") {
        // 線上製作
        if (!flowRef.current?.exportGraph) {
          message.error("流程圖元件尚未載入");
          return;
        }
        const { nodes, edges } = flowRef.current.exportGraph();
        const hasData = (nodes?.length || 0) + (edges?.length || 0) > 0;
        if (!hasData) {
          message.error("還沒有流程圖可以儲存");
          return;
        }

        const flowElement = document.querySelector(".react-flow");
        if (!flowElement) {
          message.error("找不到流程圖元素");
          return;
        }
        const dataUrl = await toPng(flowElement, {
          backgroundColor: "#fff",
          pixelRatio: 2,
        });
        payload.graph = { nodes, edges };
        payload.imageBase64 = dataUrl;
        payload.mode = "editor";
        // ...existing code...
        console.log("送出前 payload：", payload);
        console.log(
          "imageBase64 長度：",
          payload.imageBase64 ? payload.imageBase64.length : "null",
        );
        // ...existing code...
      } else {
        message.error("未知的分頁");
        return;
      }

      const token = await getToken();
      const res = await saveSubmission(`/api/submissions/stage1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || `HTTP ${res.status}`);

      lastTickRef.current = now;
      message.success("已儲存第一階段的作答");
    } catch (err) {
      console.error(err);
      message.error(`儲存失敗：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const extraButtons = (
    <div style={{ display: "flex", gap: "8px" }}>
      <Button type="primary" className={styles.uploadButton} onClick={handleSave} disabled={restoring} loading={saving}>
        上傳
      </Button>
      <Button type="primary" className={styles.saveButton} onClick={handleSave} disabled={restoring} loading={saving}>
        儲存
      </Button>
      {/* <Button danger onClick={handleReset}>
        清空
      </Button> */}
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        components: {
          Tabs: {
            horizontalMargin: "0px",
            height: "100%",
          },
        },
      }}
    >
      <App>
        <div className={styles.container}>
          {/* <div style={{ height: "100%" }}>
            <></>
          </div> */}
          <div className={styles.tabContent}>
            <Tabs
              defaultActiveKey="1"
              activeKey={activeKey}
              onChange={setActiveKey}
              type="card"
              items={items}
              tabBarExtraContent={extraButtons}
            />
          </div>
        </div>
      </App>
    </ConfigProvider>
  );
};

export default Answer;
