// Cloud seed reads a separate ignored file; never falls back to the local .env.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Student from "../models/Student.js";
import Submission from "../models/Submission.js";
import { buildDemoData, seedDemo, DEMO_DATABASE } from "../lib/demoData.js";

const configIndex = process.argv.indexOf("--config");
try {
  if (configIndex < 0 || !process.argv[configIndex + 1]) throw new Error("CONFIG_REQUIRED");
  const config = dotenv.parse(fs.readFileSync(path.resolve(process.argv[configIndex + 1])));
  if (config.MONGO_DB_NAME !== DEMO_DATABASE) throw new Error("DEMO_DATABASE_REQUIRED");
  // Atlas-only target for this deployment. Reject local hosts and non-TLS URIs.
  const uri = config.MONGO_URI?.trim();
  if (!uri || !/^mongodb\+srv:\/\/[^\s/]+@[^\s/:]+\.mongodb\.net\//i.test(uri)) throw new Error("ATLAS_SRV_URI_REQUIRED");
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ dryRun: true, database: DEMO_DATABASE, students: buildDemoData().length, submissions: buildDemoData().length, cloudWritePerformed: false }));
  } else {
    await mongoose.connect(uri, { dbName: DEMO_DATABASE, autoIndex: false, serverSelectionTimeoutMS: 15000 });
    console.log(JSON.stringify({ database: DEMO_DATABASE, ...await seedDemo({ Student, Submission }) }));
  }
} catch (error) {
  // Driver errors may contain credentials; only emit a safe category.
  const allowed = ["CONFIG_REQUIRED", "DEMO_DATABASE_REQUIRED", "ATLAS_SRV_URI_REQUIRED"];
  console.error(JSON.stringify({ success: false, reason: allowed.includes(error.message) ? error.message : "CLOUD_SEED_FAILED_CHECK_NETWORK_AUTH_AND_DEMO_ID_COLLISIONS" }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
