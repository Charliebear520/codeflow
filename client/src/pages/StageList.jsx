// Stage1List.jsx
import { useEffect, useState } from "react";

function Stage1List() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/submissions/stage1")
      .then(res => res.json())
      .then(setData);
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
              <td>{item.studentName}</td>
              <td>{item.studentEmail}</td>
              <td>
                {item.stages.stage1.imageBase64 ? (
                  <img
                    src={item.stages.stage1.imageBase64}
                    alt="流程圖"
                    style={{ maxWidth: "120px", maxHeight: "80px", border: "1px solid #ccc" }}
                  />
                ) : (
                  "無圖片"
                )}
              </td>
              <td>{item.stages.stage1.mode}</td>
              <td>{item.stages.stage1.score !== null ? item.stages.stage1.score : "無分數"}</td>
              <td>{item.stages.stage1.feedback}</td>
              <td>{item.stages.stage1.completed ? "已完成" : "未完成"}</td>
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
              <td>{item.studentName}</td>
              <td>{item.studentEmail}</td>
              <td>{item.stages?.stage2?.pseudocode ?? ""}</td>
              <td>{item.stages?.stage2?.score ?? "無分數"}</td>
              <td>{item.stages?.stage2?.feedback ?? "無回饋"}</td>
              <td>{item.stages?.stage2?.completed ? "已完成" : "未完成"}</td>
            </tr>
          ))}
        </tbody>
      </table>
            <div style={{ margin: "40px 0", borderTop: "2px solid #000" }}></div>
      <h2>第三階段資料</h2>
      <table>
        <thead>
          <tr>  
            <th>學生姓名</th>
            <th>學生Email</th>
            <th>程式碼</th> 
            <th>分數</th>
            <th>回饋</th>
            <th>完成狀態</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item._id}>
              <td>{item.studentName}</td>
              <td>{item.studentEmail}</td>
              <td>
                {item.stages?.stage3?.code ? (
                  <pre style={{ maxHeight: "100px", overflow: "auto", background: "#f4f4f4", padding: "10px", border: "1px solid #ccc" }}>
                    {item.stages.stage3.code}
                  </pre>
                ) : (
                  "無程式碼"
                )}
              </td>
              <td>{item.stages?.stage3?.score ?? "無分數"}</td>
              <td>{item.stages?.stage3?.feedback ?? "無回饋"}</td>
              <td>{item.stages?.stage3?.completed ? "已完成" : "未完成"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stage1List;