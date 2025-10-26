import mongoose from "mongoose";

const { Schema } = mongoose;

const idealAnswerSchema = new Schema(
  {
    // 可用你的 Question._id（ObjectId）或自訂字串（如 "Q001"）
    questionId: { type: String, required: true, index: true, unique: true },
    flowSpec: { type: Schema.Types.Mixed, required: true },
    version: { type: String, default: "v1" },
    modelUsed: { type: String, default: "gemini-2.0-flash" },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.IdealAnswer || mongoose.model("IdealAnswer", idealAnswerSchema);