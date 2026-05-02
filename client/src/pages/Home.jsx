import React, { useState } from "react";
import { Col, Row, Button, Modal, Spin, App, List, Tag } from "antd";
import Topic from "../components/Topic";
import Answer from "../components/Answer";
import Check from "../components/Check";
import { EditorProvider } from "../contexts/EditorContext";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@clerk/clerk-react";

// 時間格式化工具函數
const formatTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) {
    return `${diffMins} 分鐘前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小時前`;
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${mins}`;
  }
};

const Home = () => {
  const navigate = useNavigate();
  const [clicked, setClicked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const { isSignedIn, getToken } = useAuth();
  const { message } = App.useApp();

  const handleTutorClick = () => {
    navigate("/tutor");
  };

  const handleShowSummary = async (regenerate = false) => {
    if (!isSignedIn) {
      message.error("請先登入");
      return;
    }

    if (regenerate) {
      setIsRegenerating(true);
    } else {
      setShowSummaryModal(true);
      setLoadingSummary(true);
    }

    try {
      const token = await getToken();
      const res = await fetch(
        "http://localhost:5000/api/submissions/all-stages/summary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ questionId: "Q001", regenerate }),
        },
      );

      const data = await res.json();
      if (data.success) {
        setSummaryData(data);
        if (regenerate) {
          message.success("報告已更新");
        }
      } else {
        throw new Error(data.error || "載入失敗");
      }
    } catch (error) {
      console.error("載入總結失敗:", error);
      message.error(error.message || "載入總結失敗");
      if (!regenerate) {
        setShowSummaryModal(false);
      }
    } finally {
      setLoadingSummary(false);
      setIsRegenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleShowSummary(true);
  };

  const handleShowHistory = async () => {
    if (!isSignedIn) {
      message.error("請先登入");
      return;
    }

    try {
      const token = await getToken();
      const res = await fetch(
        "http://localhost:5000/api/submissions/all-stages/summary/history?questionId=Q001",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();
      if (data.success) {
        setHistoryData(data.history || []);
        setShowHistoryModal(true);
      } else {
        throw new Error(data.error || "載入失敗");
      }
    } catch (error) {
      console.error("載入歷史失敗:", error);
      message.error(error.message || "載入歷史失敗");
    }
  };

  return (
    <App>
      <EditorProvider>
        <div style={{ position: "relative", minHeight: "100vh" }}>
          <Row>
            <Col span={6}>
              <Topic />
            </Col>
            <Col span={12}>
              <Answer onChecking={setIsChecking} />
            </Col>
            <Col span={6}>
              <Check
                onTutorClick={handleTutorClick}
                isChecking={isChecking}
                stage={1}
              />
            </Col>
          </Row>

          {/* 學生整體作答結果統整按鈕 */}
          <div
            style={{
              position: "fixed",
              bottom: "40px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
            }}
          >
            <Button
              style={{
                height: "36px",
                fontSize: "16px",
                backgroundColor: "#375bd3",
                color: "#FFFFFF",
              }}
              onClick={() => handleShowSummary()}
            >
              學生整體作答結果統整
            </Button>
          </div>

          {/* 整體總結 Modal */}
          <Modal
            open={showSummaryModal}
            onCancel={() => setShowSummaryModal(false)}
            footer={() => [
              <Button key="close" onClick={() => setShowSummaryModal(false)}>
                關閉
              </Button>,
              <Button
                key="regenerate"
                type="primary"
                loading={isRegenerating}
                onClick={handleRegenerate}
              >
                重新生成報告
              </Button>,
              <Button
                key="history"
                disabled={!summaryData?.hasHistory}
                onClick={handleShowHistory}
              >
                查看歷史紀錄
              </Button>,
            ]}
            centered
            width="calc(50% + 60px)"
            styles={{ body: { padding: "30px" } }}
            maskClosable={true}
          >
            <Spin spinning={loadingSummary}>
              <div style={{ minHeight: "400px" }}>
                <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
                  學生整體作答結果統整
                </h2>
                {summaryData ? (
                  <>
                    <ReactMarkdown>{summaryData.summary}</ReactMarkdown>
                    {summaryData.generatedAt && (
                      <div
                        style={{
                          marginTop: "20px",
                          paddingTop: "15px",
                          borderTop: "1px solid #e8e8e8",
                          fontSize: "12px",
                          color: "#999",
                          textAlign: "right",
                        }}
                      >
                        生成時間：{formatTime(summaryData.generatedAt)}{" "}
                        {summaryData.isFromCache ? (
                          <Tag color="green">使用快取</Tag>
                        ) : (
                          <Tag color="blue">剛生成</Tag>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ textAlign: "center", color: "#999" }}>
                    載入中...
                  </p>
                )}
              </div>
            </Spin>
          </Modal>

          {/* 歷史紀錄 Modal */}
          <Modal
            open={showHistoryModal}
            onCancel={() => {
              setShowHistoryModal(false);
              setSelectedHistory(null);
            }}
            title="報告歷史紀錄"
            width={700}
            footer={() => [
              <Button
                key="close"
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistory(null);
                }}
              >
                關閉
              </Button>,
            ]}
          >
            {historyData.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "40px", color: "#999" }}
              >
                尚無歷史紀錄
              </div>
            ) : (
              <List
                dataSource={historyData}
                renderItem={(item, index) => (
                  <List.Item
                    key={index}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedHistory === index ? "#f0f5ff" : "transparent",
                    }}
                    onClick={() =>
                      setSelectedHistory(
                        selectedHistory === index ? null : index,
                      )
                    }
                  >
                    <List.Item.Meta
                      title={
                        <div>
                          <span>{formatTime(item.generatedAt)}</span>
                          <Tag
                            color="blue"
                            style={{ marginLeft: "10px", float: "right" }}
                          >
                            分數：{item.totalScore}/100
                          </Tag>
                          <Tag
                            color="green"
                            style={{ marginLeft: "5px", float: "right" }}
                          >
                            完成：{item.completedStages}/3 階段
                          </Tag>
                        </div>
                      }
                      description={
                        selectedHistory === index ? (
                          <div
                            style={{
                              marginTop: "15px",
                              padding: "15px",
                              backgroundColor: "#fff",
                              border: "1px solid #e8e8e8",
                              borderRadius: "4px",
                            }}
                          >
                            <ReactMarkdown>{item.summary}</ReactMarkdown>
                          </div>
                        ) : (
                          <span style={{ color: "#999" }}>
                            點擊查看報告內容
                          </span>
                        )
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Modal>

          {/* 原本的導頁功能先隱藏 */}
          {/* 
      <button
        style={{ position: "fixed", bottom: 20, right: 20 }}
        onClick={() => navigate("/add-question")}
      >
        新增題目
      </button>
      */}

          {/* 測試按鈕暫時隱藏
      {<button
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          backgroundColor: "#375BD3",
          color: "#FFFFFF",
          border: "none",
        }}
        onClick={() => navigate("/add-question")}
      >
        前往AddQuestion頁面（測試用）
      </button> }
      <button
        style={{ position: "fixed", bottom: 20, right: 300,backgroundColor: "#375BD3", color: "#FFFFFF", border: "none" }}
        onClick={() => navigate("/stage-list")}
      >
        前往StageList頁面（測試用）
      </button>
      */}
        </div>
      </EditorProvider>
    </App>
  );
};

export default Home;
