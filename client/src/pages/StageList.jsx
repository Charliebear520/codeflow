import { useEffect, useState } from "react";

function Stage1List() {
  const [data, setData] = useState([]);
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    fetch("/api/submissions/stage3")
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        return res.json();
      })
      .then((submissions) => {
        console.log("Fetched submissions (stage3):", submissions);
        if (Array.isArray(submissions)) {
          setData(submissions);
          setRaw(submissions);
        } else if (submissions && Array.isArray(submissions.data)) {
          setData(submissions.data);
          setRaw(submissions.data);
        } else if (submissions && Array.isArray(submissions.items)) {
          setData(submissions.items);
          setRaw(submissions.items);
        } else {
          setData([submissions]);
          setRaw(submissions);
        }
      })
      .catch((err) => {
        console.error("Failed to load submissions:", err);
        setData([]);
        setRaw(null);
      });
  }, []);

  return (
    <div>
      <h2>第一階段資料</h2>
      <table>
        <thead>
          <tr>
            <th>學生姓名</th>
            <th>學生Email</th>
            <th>流程圖</th>
            <th>模式</th>
            <th>分數</th>
            <th>回饋</th>
            <th>完成狀態</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item._id}>
              <td>{item.studentName ?? item.student?.name ?? "未設定"}</td>
              <td>{item.studentEmail ?? item.student?.email ?? "未設定"}</td>
              <td>
                {item.stages?.stage1?.imageBase64 ? (
                  <img
                    src={item.stages.stage1.imageBase64}
                    alt="流程圖"
                    style={{ maxWidth: "120px", maxHeight: "80px", border: "1px solid #ccc" }}
                  />
                ) : (
                  "無圖片"
                )}
              </td>
              <td>{item.stages?.stage1?.mode ?? "未設定"}</td>
              <td>
                {typeof item.stages?.stage1?.score === "number"
                  ? item.stages.stage1.score
                  : "無分數"}
              </td>
              <td>{item.stages?.stage1?.feedback ?? "無回饋"}</td>
              <td>{item.stages?.stage1?.completed ? "已完成" : "未完成"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: "40px 0", borderTop: "2px solid #000" }}></div>

      <h2>第二階段資料</h2>
      <table>
        <thead>
          <tr>
            <th>學生姓名</th>
            <th>學生Email</th>
            <th>pseudocode</th>
            <th>分數</th>
            <th>回饋</th>
            <th>完成狀態</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item._id}>
              <td>{item.studentName ?? item.student?.name ?? "未設定"}</td>
              <td>{item.studentEmail ?? item.student?.email ?? "未設定"}</td>
              <td>{item.stages?.stage2?.pseudocode ?? "無內容"}</td>
              <td>
                {typeof item.stages?.stage2?.score === "number"
                  ? item.stages.stage2.score
                  : "無分數"}
              </td>
              <td>{item.stages?.stage2?.feedback ?? "無回饋"}</td>
              <td>{item.stages?.stage2?.completed ? "已完成" : "未完成"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: "40px 0", borderTop: "2px solid #000" }}></div>
            <h2>第三階段資料</h2>

      {/* Debug: 顯示原始回傳（目前開發時打開看結構） */}
      <details style={{ marginBottom: 12 }}>
        <summary>顯示原始資料 (debug)</summary>
        <pre style={{ maxHeight: 300, overflow: "auto", background: "#fafafa", padding: 10 }}>
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>

      <table>
        <thead>
          <tr>
            <th>學生姓名</th>
            <th>學生Email</th>
            <th>程式語言</th>
            <th>程式碼</th>
            <th>分數</th>
            <th>回饋</th>
            <th>完成狀態</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            // 更寬容的欄位 fallback（有些情況後端可能用不同命名）
            const lang =
              item?.stages?.stage3?.language ??
              item?.stages?.stage3?.lang ??
              item?.stages?.stage3?.langauge ?? // typo guard
              "未設定";

            const code =
              item?.stages?.stage3?.code ??
              item?.stages?.stage3?.source ??
              item?.stages?.stage3?.pseudocode ?? // fallback in case stored under different key
              null;

            const score =
              typeof item?.stages?.stage3?.score === "number"
                ? item.stages.stage3.score
                : null;

            const feedback = item?.stages?.stage3?.feedback ?? "";

            const completed = !!item?.stages?.stage3?.completed;

            return (
              <tr key={item._id || (item && item.questionId) || Math.random()}>
                <td>{item.studentName ?? item.student?.name ?? "未設定"}</td>
                <td>{item.studentEmail ?? item.student?.email ?? "未設定"}</td>
                <td>{lang}</td>
                <td>
                  {code ? (
                    <pre style={{ maxHeight: "100px", overflow: "auto", background: "#f4f4f4", padding: "10px", border: "1px solid #ccc" }}>
                      {code}
                    </pre>
                  ) : (
                    "無程式碼"
                  )}
                </td>
                <td>{score !== null ? score : "無分數"}</td>
                <td>{feedback || "無回饋"}</td>
                <td>{completed ? "已完成" : "未完成"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Stage1List;