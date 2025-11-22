import React from "react";
import styles from "./check.module.css";
import { Button, Spin, Card, Row, Col, Statistic } from "antd";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";

const Check = ({ feedback, isChecking, onTutorClick, stage }) => {
  const byStage = useSelector((state) => state.check.byStage);
  const scores = useSelector((state) => state.check.scores);
  const diffs = useSelector((state) => state.check.diffs);
  const checkFeedback = useSelector((state) => state.check.feedback);

  // 優先使用新格式的完整回饋，否則使用舊格式
  const stageResult =
    feedback != null ? feedback : stage ? byStage?.[stage] || null : null;

  return (
    <div className={styles.mainspace}>
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
                style={{
                  height: "36px",
                  fontSize: "16px",
                  backgroundColor: "#375BD3",
                  color: "#FFFFFF",
                }}
                onClick={() => {}}
              >
                詢問沐芙助教
              </Button>
            </div>
          )}
        </div>
        <div style={{ height: "80%" }}>
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
            ) : scores && checkFeedback ? (
              // 新格式：顯示完整的比對結果
              <>
                <h3 style={{ color: "#9287EE", marginBottom: "16px" }}>
                  流程圖檢查結果
                </h3>

                {/* 分數卡片 */}
                <Card title="評分結果" style={{ marginBottom: "16px" }}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic
                        title="總分"
                        value={Math.round(scores.total * 100)}
                        suffix="分"
                        valueStyle={{
                          color: scores.total >= 0.7 ? "#3f8600" : "#cf1322",
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="結構"
                        value={Math.round(scores.structure * 100)}
                        suffix="分"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="節點"
                        value={Math.round(scores.nodes * 100)}
                        suffix="分"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="連線"
                        value={Math.round(scores.edges * 100)}
                        suffix="分"
                      />
                    </Col>
                  </Row>
                </Card>

                {/* AI 回饋 */}
                <Card title="AI 助教建議" style={{ marginBottom: "16px" }}>
                  <ReactMarkdown>{checkFeedback}</ReactMarkdown>
                </Card>

                {/* 詳細差異（可選） */}
                {diffs &&
                  (diffs.structureIssues?.length > 0 ||
                    diffs.missingNodes?.length > 0 ||
                    diffs.logicIssues?.length > 0) && (
                    <Card title="詳細分析" size="small">
                      {diffs.structureIssues?.length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <strong>結構問題：</strong>
                          <ul>
                            {diffs.structureIssues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diffs.missingNodes?.length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <strong>缺少節點：</strong>
                          <ul>
                            {diffs.missingNodes.map((node, i) => (
                              <li key={i}>
                                {node.type}: {node.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diffs.logicIssues?.length > 0 && (
                        <div>
                          <strong>邏輯問題：</strong>
                          <ul>
                            {diffs.logicIssues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  )}
              </>
            ) : feedback ? (
              // 舊格式：純文字回饋
              <div>
                <p style={{ color: "#9287EE" }}>AI 助教回饋：</p>
                <ReactMarkdown>{feedback}</ReactMarkdown>
              </div>
            ) : stageResult ? (
              // 舊格式：階段結果
              <div>
                <p style={{ color: "#9287EE" }}>流程圖分析結果：</p>
                <ReactMarkdown>{stageResult}</ReactMarkdown>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Check;
