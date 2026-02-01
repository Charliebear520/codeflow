import mongoose from "mongoose";

const { Schema } = mongoose;

const idealAnswerSchema = new Schema(
  {
    // 可用你的 Question._id（ObjectId）或自訂字串（如 "Q001"）
    questionId: { type: String, required: true, index: true, unique: true },

    // Stage 1: 流程圖理想答案
    flowSpec: { type: Schema.Types.Mixed, required: true },

    // Stage 2: 虛擬碼理想答案
    pseudocode: { type: String, default: null },
    pseudocodeStructure: {
      variables: { type: [String], default: [] },
      conditions: { type: [String], default: [] },
      loops: { type: [String], default: [] },
      logicFlow: { type: [String], default: [] },
    },

    // Stage 3: 程式碼理想答案
    code: { type: String, default: null },
    language: {
      type: String,
      enum: ["python", "javascript", "c", null],
      default: null,
    },
    codeStructure: {
      functions: { type: [String], default: [] },
      variables: { type: [String], default: [] },
      controlFlow: { type: [String], default: [] },
      expectedOutput: { type: String, default: "" },
    },

    version: { type: String, default: "v1" },
    modelUsed: { type: String, default: "gemini-2.5-flash" },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.IdealAnswer ||
  mongoose.model("IdealAnswer", idealAnswerSchema);
