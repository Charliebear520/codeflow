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
    questionTitle: "",
    description: "",
  });
  const [msg, setMsg] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/add-question", {
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
        name="questionTitle"
        placeholder="題目標題"
        value={form.questionTitle}
        onChange={handleChange}
      />
      <br />
      <textarea
        name="description"
        placeholder="題目敘述"
        value={form.description}
        onChange={handleChange}
      />
      <button type="submit">新增題目</button>
      <div>{msg}</div>
    </form>
  );
}
