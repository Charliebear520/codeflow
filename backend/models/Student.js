import mongoose from "mongoose";

const { Schema } = mongoose;

const studentSchema = new Schema(
    {
      //基本資料  
      userId: { type: String, required: true, unique: true, index: true }, // Clerk 的 user.id (user_xxx)
      email: { type: String, index: true },
      role: { type: String, enum: ["student", "teacher"], default: "student", index: true },
      name: { type: String },
      gradeLevel: { type: Number },     // 可選：年級
      className: { type: String },      // 可選：班級
    },
    { timestamps: true, minimize: false }
  );
  

export default mongoose.models.Student || mongoose.model("Student", studentSchema);