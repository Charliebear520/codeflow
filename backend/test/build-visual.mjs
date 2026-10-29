import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../../",import.meta.url));
const require=createRequire(import.meta.url);const {build}=require(path.join(root,"client/node_modules/esbuild"));
await build({entryPoints:[path.join(root,"client/test/visual/preview.jsx")],bundle:true,outfile:path.join(root,".dashboard-preview/app.js"),minify:true,jsx:"automatic",
  define:{"process.env.NODE_ENV":'"production"'},alias:{"@clerk/clerk-react":path.join(root,"client/test/visual/clerkStub.js")},loader:{".svg":"dataurl"},logLevel:"silent"});
console.log("Isolated preview bundle updated");
