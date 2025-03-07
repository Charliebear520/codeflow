import React, { useRef, useState } from "react";
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

// 定义初始节点和边
const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "input node" },
    position: { x: 250, y: 50 },
  },
];

const initialEdges = [
  {
    id: "e1-2", // 確保每個邊都有唯一的 id
    source: "1", // 來源節點的 id
    target: "2", // 目標節點的 id
    type: "straight", // 設置初始邊的類型為 straight
    markerEnd: {
      type: "arrow", // 使用箭頭作為標記
      color: "#007bff", // 標記顏色
    },
  },
]; // 初始边为空

const Answer = () => {
  const [activeKey, setActiveKey] = useState("1"); // 状态跟踪当前选中的标签页
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
  });
  const flowRef = useRef(null);
  const dispatch = useDispatch();
  const [fileList, setFileList] = useState([]);
  const { message } = App.useApp(); // 使用 App 的 message API

  const handleCheck = async () => {
    try {
      if (activeKey === "1") {
        if (fileList.length === 0) {
          message.error("請先上傳流程圖");
          return;
        }

        const base64Image = fileList[0].base64;
        if (!base64Image) {
          message.error("圖片處理中，請稍後再試");
          return;
        }

        const resultAction = await dispatch(checkFlowchart(base64Image));

        if (checkFlowchart.fulfilled.match(resultAction)) {
          message.success("檢查完成");
        } else {
          throw new Error(resultAction.error.message);
        }
      } else if (activeKey === "2") {
        const flowElement = document.querySelector(".react-flow");
        if (!flowElement) {
          message.error("找不到流程圖元素");
          return;
        }

        const dataUrl = await toPng(flowElement, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });

        const base64Image = dataUrl.split(",")[1];
        const resultAction = await dispatch(checkFlowchart(base64Image));

        if (checkFlowchart.fulfilled.match(resultAction)) {
          message.success("檢查完成");
        } else {
          throw new Error(resultAction.error.message);
        }
      }
    } catch (error) {
      console.error("檢查過程發生錯誤:", error);
      message.error(error.message || "檢查過程發生錯誤");
    }
  };

  const handleReset = () => {
    if (activeKey === "1") {
      setFileList([]);
    } else if (activeKey === "2") {
      if (flowRef.current) {
        flowRef.current.resetFlow();
      }
    }
    dispatch(resetCheck());
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
            initialNodes={initialNodes}
            initialEdges={initialEdges}
          />
        </div>
      ),
    },
  ];

  const extraButtons = (
    <div style={{ display: "flex", gap: "8px" }}>
      <Button type="primary" onClick={handleCheck}>
        檢查
      </Button>
      <Button danger onClick={handleReset}>
        清空
      </Button>
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
