import mongoose from "mongoose";

const { Schema } = mongoose;

const stageSchema_1 = new Schema(
  {
    graph: {
      nodes: [Schema.Types.Mixed],
      edges: [Schema.Types.Mixed],
    },
    imageBase64: { type: String, default: null },
    mode: { type: String, enum: ["upload", "editor"]},
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null },
    feedback: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const stageSchema_2 = new Schema(
  {
    pseudocode: { type: String, default: null },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null },
    feedback: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const stageSchema_3 = new Schema(
  {
    // 先做 stage1 的流程圖；日後 stage2/stage3 可直接沿用此子結構
    graph: {
      nodes: [Schema.Types.Mixed],
      edges: [Schema.Types.Mixed],
    },
    imageBase64: { type: String, default: null }, // 若有「上傳圖片」模式
    completed: { type: Boolean, default: false },
    score: { type: Number, default: null },
    feedback: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const submissionSchema = new Schema(
  {
    studentName: { type: String, required: true }, // 改 required
    studentEmail: { type: String, required: true, lowercase: true, index: true }, // 改 required
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    questionId: { type: String, required: true, index: true },

    stages: {
      stage1: stageSchema_1,
      stage2: stageSchema_2,
      stage3: stageSchema_3,
    },
  },
  { timestamps: true, minimize: false }
);

// 一個學生對同一題只會有一筆作答紀錄
submissionSchema.index({ student: 1, questionId: 1, "stages.stage2": 1, "stages.stage3": 1 }, { unique: true });

export default mongoose.model("Submission", submissionSchema);
