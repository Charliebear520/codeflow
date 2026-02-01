import mongoose from "mongoose";

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    questionId: { type: String, unique: true, sparse: true, trim: true },
    questionTitle: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    stage1: {
      description: String,
    },
    stage2: {
      description: String,
    },
    stage3: {
      description: String,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Question ||
  mongoose.model("Question", questionSchema);
