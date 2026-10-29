import { Alert, Modal, Tag } from "antd";
import ReadOnlyFlow from "../ReadOnlyFlow";
import { minutes, localTime } from "../../lib/learningDisplay";
import styles from "./StudentAnswerModal.module.css";

function FlowAnswer({ entry }) {
  if (entry.graph?.nodes?.length) return <ReadOnlyFlow graph={entry.graph} />;
  if (typeof entry.imageBase64 === "string" && entry.imageBase64) {
    const image = entry.imageBase64;
    if (image.startsWith("data:") && !image.startsWith("data:image/")) return <Alert type="info" message="這筆圖片格式無法預覽。" />;
    return <img className={styles.image} src={/^data:image\/|^https?:\/\//.test(image) ? image : `data:image/png;base64,${image}`} alt="學生儲存的流程圖" />;
  }
  if (entry.graph) return <ReadOnlyFlow graph={entry.graph} />;
  return <Alert type="info" message="這次提交沒有可顯示的流程圖或圖片。" />;
}

export default function StudentAnswerModal({ openStage, onClose, submission, student }) {
  if (!openStage) return null;
  const stage = submission?.stages?.[openStage] || {};
  const name = student?.name || submission?.studentName || "學生";
  const labels = {stage1:"階段一",stage2:"階段二",stage3:"階段三"};
  const history = (Array.isArray(submission?.stage1History) ? submission.stage1History.filter((entry) => entry && typeof entry === "object") : []).sort((a,b) => new Date(a.at) - new Date(b.at));
  let sequence = 0;
  return <Modal open onCancel={onClose} footer={null} centered width={840} className={styles.modal} destroyOnClose title={`${name} · ${labels[openStage]}的答案`}>
    <div className={styles.scroller}>
      <div className={styles.metadata}>
        {submission?.isDemo && <Tag color="blue">示範資料</Tag>}
        <span>分數：{typeof stage.score === "number" ? `${stage.score} / 100` : "尚未評分"}</span><span>累積用時：{minutes(stage.durationSec)} 分鐘</span>
        <span>本題累積檢查：{submission?.attemptCount || 0} 次</span>
      </div>
      {openStage === "stage1" ? history.length ? history.map((entry,index) => <section key={entry.operationId || index} className={styles.version}>
        <header><strong>{entry.kind === "legacy-latest" ? "既有最新版快照（歷史啟用前）" : `第${++sequence}次提交`}</strong>
          {entry.isDemo && <Tag>示範提交範例</Tag>}<time>{localTime(entry.at)}</time>
          {entry.kind === "compare" && <span>檢查並保存</span>}{typeof entry.score === "number" && <span>{entry.score} 分</span>}</header>
        <FlowAnswer entry={entry} />
      </section>) : <section className={styles.version}><header><strong>目前保存的最新版</strong><time>{localTime(stage.updatedAt)}</time></header>
        <Alert type="info" message="過去僅保存最新版，沒有可還原的歷次提交；後續提交才會開始記錄歷史。" style={{marginBottom:14}} /><FlowAnswer entry={stage} />
      </section> : <div className={styles.answer}>
        {openStage === "stage3" && <p>程式語言：{stage.language || "未記錄"}</p>}
        {stage.pseudocode || stage.code ? <pre>{openStage === "stage2" ? stage.pseudocode : stage.code}</pre> : <Alert type="info" message="尚無已保存的作答內容。" />}
        <p className={styles.time}>更新時間：{localTime(stage.updatedAt)}</p>
      </div>}
      {(stage.feedback || stage.checkReport) && <div className={styles.report}>
        {stage.feedback && <><h4>已保存回饋</h4><p>{stage.feedback}</p></>}
        {stage.checkReport && <><h4>已保存檢查報告</h4><p>{stage.checkReport}</p></>}
      </div>}
    </div>
  </Modal>;
}
