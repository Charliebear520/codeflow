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
              <td>{JSON.stringify(item.stages.stage1.graph)}</td>
              <td>{item.stages.stage1.score}</td>
              <td>{item.stages.stage1.feedback}</td>
              <td>{item.stages.stage1.completed ? "已完成" : "未完成"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stage1List;