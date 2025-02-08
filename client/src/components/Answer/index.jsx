import React, { useRef, useState } from "react";
import { ConfigProvider, Tabs, Button, message } from "antd";
import ReactFlowDnd from "../ReactFlowDnd";
import Upload from "../upload";
import Check from "../Check"; // 引入 Check 组件
import styles from "./answer.module.css";
import { IKImage } from "imagekitio-react";
import html2canvas from "html2canvas";
import { toPng } from "html-to-image";
import { useDispatch } from "react-redux";
import { checkFlowchart, resetCheck } from "../../redux/slices/checkSlice";

// 定义初始节点和边
const initialNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "input node" },
    position: { x: 250, y: 5 },
  },
];

const initialEdges = []; // 初始边为空

const Answer = () => {
  const [activeKey, setActiveKey] = useState("1"); // 状态跟踪当前选中的标签页
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
  });
  const flowRef = useRef(null);
  const dispatch = useDispatch();

  const handleCheck = async () => {
    try {
      if (activeKey === "2") {
        const flowElement = document.querySelector(".react-flow");
        if (!flowElement) {
          message.error("找不到流程圖元素");
          return;
        }

        console.log("Converting flow to image...");
        const dataUrl = await toPng(flowElement, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });

        console.log("Preparing image data...");
        const base64Image = dataUrl.split(",")[1];

        console.log("Sending request to backend...");
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
      // 重置上傳的圖片
      setImg({
        isLoading: false,
        error: "",
        dbData: {},
      });
    } else if (activeKey === "2") {
      // 重置線上製作的流程圖
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
        <div style={{ height: "100%" }}>
          <Upload img={img} setImg={setImg} />
        </div>
      ),
    },
    {
      key: "2",
      label: "線上製作",
      children: (
        <div style={{ height: "100%" }}>
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
      <div className={styles.container}>
        <div style={{ height: "10%" }}>
          <></>
        </div>
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
    </ConfigProvider>
  );
};

export default Answer;
