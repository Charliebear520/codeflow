import mongoose from "mongoose";

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    questionId: { type: String, required: true, unique: true, trim: true },
    stage1: { type: String, required: true },
    stage2: { type: String, required: true },
    stage3: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.models.Question || mongoose.model("Question", questionSchema);


