import "dotenv/config";
import mongoose from "mongoose";
import Student from "../models/Student.js";
import Submission from "../models/Submission.js";
import { getMongoUri } from "../lib/db.js";
import { buildDemoData, seedDemo, DEMO_DATABASE } from "../lib/demoData.js";

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ dryRun: true, database: DEMO_DATABASE, records: buildDemoData().length, instruction: "確認測試庫後，以 npm.cmd run seed:demo -- --apply 執行" }));
} else {
  try {
    if (process.env.MONGO_DB_NAME !== DEMO_DATABASE) throw new Error("先設定 MONGO_DB_NAME=codeflow_demo 才能初始化");
    await mongoose.connect(getMongoUri(), { dbName: DEMO_DATABASE, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    console.log(JSON.stringify({ database: mongoose.connection.name, ...await seedDemo({ Student, Submission }) }));
  } catch (error) {
    console.error(JSON.stringify({ success: false, errorType: error.name, code: error.code, message: error.message.includes("codeflow_demo") ? error.message : "初始化失敗，請確認測試庫寫入權限；未輸出連線資訊" }));
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
