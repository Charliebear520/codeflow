import mongoose from "mongoose";

const { Schema } = mongoose;

const stageSchema_1 = new Schema(
  {
    graph: {
      nodes: [Schema.Types.Mixed],
      edges: [Schema.Types.Mixed],
    },
    imageBase64: { type: String, default: null },
    mode: { type: String, enum: ["upload", "editor"] },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null }, // 總分 (0-100)
    scores: { type: Schema.Types.Mixed }, // 詳細評分
    diffs: { type: Schema.Types.Mixed }, // 差異資料
    feedback: { type: String, default: "" },
    checkReport: { type: String, default: "" }, // 檢查報告
    updatedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const stageSchema_2 = new Schema(
  {
    pseudocode: { type: String, default: null },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null }, // 總分 (0-100)
    scores: { type: Schema.Types.Mixed }, // 詳細評分
    diffs: { type: Schema.Types.Mixed }, // 差異資料
    feedback: { type: String, default: "" },
    checkReport: { type: String, default: "" }, // 檢查報告
    updatedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const stageSchema_3 = new Schema(
  {
    code: { type: String, default: null },
    language: {
      type: String,
      enum: ["python", "javascript", "c", null],
      default: null,
    },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null }, // 總分 (0-100)
    scores: { type: Schema.Types.Mixed }, // 詳細評分
    diffs: { type: Schema.Types.Mixed }, // 差異資料
    feedback: { type: String, default: "" },
    checkReport: { type: String, default: "" }, // 檢查報告
    updatedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);
const submissionSchema = new Schema(
  {
    studentName: { type: String, required: true },
    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    questionId: { type: String, required: true, index: true },

    // attemptCount: { type: Number, default: 0 },
    // chatCount: { type: Number, default: 0 },
    // helpCount: { type: Number, default: 0 },

    stages: {
      stage1: stageSchema_1,
      stage2: stageSchema_2,
      stage3: stageSchema_3,
    },

    /*
  ✅ 行為追蹤欄位（新增）
    */
    attemptCount: { type: Number, default: 0 }, // 嘗試次數（按檢查）
    helpCount: { type: Number, default: 0 },    // 求助次數（按提示）
    hintCount: { type: Number, default: 0 },    // 看提示次數（可選）
    chatCount: { type: Number, default: 0 },    // 與 AI 聊天次數

    // 綜合學習報告（當前版本）
    currentSummary: {
      summary: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      totalScore: { type: Number, default: null },
      completedStages: { type: Number, default: null },
    },

    // 報告歷史版本（最多保存 10 筆）
    summaryHistory: [
      {
        summary: { type: String, required: true },
        generatedAt: { type: Date, required: true },
        totalScore: { type: Number, required: true },
        completedStages: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true, minimize: false },
);

// 一個學生對同一題只會有一筆作答紀錄
submissionSchema.index(
  { student: 1, questionId: 1, "stages.stage2": 1, "stages.stage3": 1 },
  { unique: true },
);

export default mongoose.model("Submission", submissionSchema);
