import express from "express";

const app = express();

// 基本中間件
app.use(express.json());

// 測試端點
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Simple API is working" });
});

export default app;
