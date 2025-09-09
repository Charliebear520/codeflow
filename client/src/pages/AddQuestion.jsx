import React, { useState } from "react";

// const Question = require("./models/Question"); // 加在檔案最上方

// app.post("/api/add-question", async (req, res) => {
//   try {
//     const { questionId, stage1, stage2, stage3 } = req.body;
//     const newQuestion = new Question({ questionId, stage1, stage2, stage3 });
//     await newQuestion.save();
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

export default function AddQuestion() {
  const [form, setForm] = useState({
    questionId: "",
    stage1: "",
    stage2: "",
    stage3: "",
  });
  const [msg, setMsg] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:3000/api/add-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setMsg(data.success ? "新增成功" : "新增失敗：" + data.error);
    } catch (err) {
      setMsg("API 錯誤：" + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="questionId"
        placeholder="問題編號"
        value={form.questionId}
        onChange={handleChange}
      />
      <br />
      <textarea
        name="stage1"
        placeholder="第一階段提問"
        value={form.stage1}
        onChange={handleChange}
      />
      <br />
      <textarea
        name="stage2"
        placeholder="第二階段提問"
        value={form.stage2}
        onChange={handleChange}
      />
      <br />
      <textarea
        name="stage3"
        placeholder="第三階段提問"
        value={form.stage3}
        onChange={handleChange}
      />
      <br />
      <button type="submit" style={{ backgroundColor: "#375BD3", color: "#FFFFFF", border: "none" }}>新增題目</button>
      <div>{msg}</div>
    </form>
  );
}
