import express from "express";
import Submission from "../models/Submission.js";
const router = express.Router();

app.get("/api/submissions/stage1", async (req, res) => {
  try {
    const submissions = await Submission.find({});
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

export default router;