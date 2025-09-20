import mongoose from "mongoose";

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    questionTitle: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Question || mongoose.model("Question", questionSchema);


