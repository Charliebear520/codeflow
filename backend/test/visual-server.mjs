// Explicit, read-only, loopback preview. No production authentication is changed.
import express from "express";
import mongoose from "mongoose";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import Student from "../models/Student.js";
import Submission from "../models/Submission.js";
import { createTeacherReporting } from "../lib/teacherReporting.js";
import { getMongoUri } from "../lib/db.js";
import { DEMO_BATCH } from "../lib/demoData.js";

if (!process.argv.includes("--demo-preview") || process.env.MONGO_DB_NAME !== "codeflow_demo") throw new Error("Only explicit codeflow_demo preview is allowed");
const root=fileURLToPath(new URL("../../",import.meta.url));
const out=path.join(root,".dashboard-preview"); await fs.mkdir(out,{recursive:true});
const require=createRequire(import.meta.url); const {build}=require(path.join(root,"client/node_modules/esbuild"));
await build({entryPoints:[path.join(root,"client/test/visual/preview.jsx")],bundle:true,outfile:path.join(out,"app.js"),minify:true,jsx:"automatic",
  define:{"process.env.NODE_ENV":'"production"'},alias:{"@clerk/clerk-react":path.join(root,"client/test/visual/clerkStub.js")},loader:{".svg":"dataurl"},logLevel:"silent"});
await mongoose.connect(getMongoUri(),{dbName:"codeflow_demo",autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:10000});
const DemoModel={db:Submission.db,find:(filter={})=>Submission.find({...filter,isDemo:true,demoBatch:DEMO_BATCH}),findOne:(filter={})=>Submission.findOne({...filter,isDemo:true,demoBatch:DEMO_BATCH})};
const reporting=createTeacherReporting(DemoModel);
const app=express();
app.use((req,res,next)=>req.method==="GET"?next():res.sendStatus(405));
app.get("/api/admin/submissions",async(req,res)=>{
  try {res.json(await reporting.list({...req.query,source:"demo",...(req.query.source==='real'?{className:"__preview_no_records__"}:{})}));}
  catch {res.status(500).json({success:false,error:"Preview query failed"});}
});
app.get("/api/submissions/summary/:studentId",async(req,res)=>{
  try {if(!await Student.exists({_id:req.params.studentId,isDemo:true,demoBatch:DEMO_BATCH}))return res.sendStatus(404);
    res.json(await reporting.summary(req.params.studentId,req.query));}
  catch {res.status(500).json({success:false,error:"Preview summary failed"});}
});
app.use(express.static(out));
app.get("/",(req,res)=>res.type("html").send('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Codeflow isolated visual preview</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>'));
const server=app.listen(5187,"127.0.0.1",()=>console.log(JSON.stringify({preview:"http://127.0.0.1:5187",readOnly:true,demoOnly:true,productionAuthUnchanged:true})));
server.on("error",(error)=>{console.error(JSON.stringify({errorType:error.name,code:error.code}));process.exitCode=1;mongoose.disconnect();});
async function close(){await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();}
process.on("SIGINT",()=>close().then(()=>process.exit()));process.on("SIGTERM",()=>close().then(()=>process.exit()));
