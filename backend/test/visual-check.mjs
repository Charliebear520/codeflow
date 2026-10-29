import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const out=fileURLToPath(new URL("../../.dashboard-preview/",import.meta.url));
const pages=await(await fetch("http://127.0.0.1:9225/json")).json();
const page=pages.find(p=>p.type==='page'); if(!page)throw Error('No isolated browser page');
const socket=new WebSocket(page.webSocketDebuggerUrl);const pending=new Map();const errors=[];let next=0;
socket.addEventListener('message',(message)=>{const data=JSON.parse(message.data);if(data.id){const task=pending.get(data.id);if(task){pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);}}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);});
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
const waitFor=(predicate)=>evaluate(`new Promise((resolve,reject)=>{const deadline=Date.now()+15000;function tick(){if(${predicate})return resolve(true);if(Date.now()>deadline)return reject(Error('Visual readiness timeout'));setTimeout(tick,80);}tick();})`);
async function screenshot(name){const result=await send('Page.captureScreenshot',{format:'png',fromSurface:true});await fs.writeFile(new URL(name,new URL(`file:///${out.replaceAll('\\','/')}`)),Buffer.from(result.data,'base64'));}
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:5187/'});
 await waitFor(`document.querySelectorAll('article').length===8`);
 async function selectOption(index,label){
   await evaluate(`document.querySelectorAll('.ant-select-selector')[${index}].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))`);
   await waitFor(`[...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')].some(o=>o.textContent.trim()===${JSON.stringify(label)})`);
   await evaluate(`[...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')].find(o=>o.textContent.trim()===${JSON.stringify(label)}).click()`);
   await waitFor(`document.querySelectorAll('.ant-select-selection-item')[${index}].textContent.trim()===${JSON.stringify(label)}`);
   await evaluate(`new Promise(r=>setTimeout(r,200))`);
 }
 await selectOption(0,'示範班'); await waitFor(`document.querySelectorAll('article').length===8&&!document.querySelector('.ant-spin-spinning')`);
 await selectOption(1,'邏輯訓練'); await waitFor(`document.querySelectorAll('article').length===8&&!document.querySelector('.ant-spin-spinning')`);
 await selectOption(2,'Q001 · 下雨是否帶傘'); await waitFor(`document.querySelectorAll('article').length===8&&!document.querySelector('.ant-spin-spinning')`);
 await selectOption(3,'真實'); await waitFor(`document.querySelectorAll('article').length===0`);
 const filters={className:true,topic:true,question:true,realEmpty:true};
 await selectOption(3,'示範'); await waitFor(`document.querySelectorAll('article').length===8`);
 const beforeRefresh=await evaluate(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/admin/submissions')).length`);
 await evaluate(`document.querySelector('button').click()`);
 await waitFor(`performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/admin/submissions')).length>${beforeRefresh}`);
 const desktop=await evaluate(`(()=>{const cards=[...document.querySelectorAll('article')];return{cards:cards.length,names:cards.map(c=>c.querySelector('h3').textContent),columns:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,rows:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().top))).size,totalFirst:cards[0].innerText.includes('104'),horizontalOverflow:document.documentElement.scrollWidth>innerWidth};})()`);
 await screenshot('dashboard-desktop.png');
 await evaluate(`[...document.querySelectorAll('article button')].find(b=>b.textContent.includes('總結')).click()`);
 await waitFor(`document.querySelector('.ant-modal .recharts-wrapper')?.querySelectorAll('.recharts-line').length===3`);
 await evaluate(`new Promise(r=>setTimeout(r,450))`);
 const summary=await evaluate(`(()=>{const m=document.querySelector('.ant-modal');return{threeLines:m.querySelector('.recharts-wrapper').querySelectorAll('.recharts-line').length,hasChat:m.innerText.includes('對話次數'),hasAttempts:m.innerText.includes('嘗試次數'),hasHelp:m.innerText.includes('求助次數'),hasPeriod:m.innerText.includes('2026-10-05'),insideViewport:m.getBoundingClientRect().top>=0&&m.getBoundingClientRect().bottom<=innerHeight};})()`);
 const point=await evaluate(`(()=>{const r=document.querySelector('.ant-modal .recharts-line-dot').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
 await waitFor(`document.querySelector('.ant-modal .recharts-tooltip-wrapper')?.innerText.includes('2026-10-05')`);
 const tooltip=await evaluate(`document.querySelector('.ant-modal .recharts-tooltip-wrapper').innerText`);
 assert.ok(tooltip.includes('2026-10-11')); assert.match(tooltip,/對話次數\s*:\s*4/); assert.match(tooltip,/嘗試次數\s*:\s*2/); assert.match(tooltip,/求助次數\s*:\s*1/);
 await screenshot('summary-tooltip.png');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20});
 await evaluate(`new Promise(r=>setTimeout(r,200))`);
 await screenshot('summary-desktop.png');
 await evaluate(`document.querySelector('.ant-modal-close').click()`);
 await waitFor(`!document.querySelector('.ant-modal-wrap:not([style*="display: none"])')`);
 await evaluate(`document.querySelector('article button').click()`);
 await waitFor(`document.querySelectorAll('.ant-modal .react-flow__node').length>=9`);
 await evaluate(`new Promise(r=>setTimeout(r,500))`);
 const flow=await evaluate(`(()=>{const m=document.querySelector('.ant-modal');return{nodeCount:m.querySelectorAll('.react-flow__node').length,edgeCount:m.querySelectorAll('.react-flow__edge').length,first:m.innerText.includes('第1次提交'),second:m.innerText.includes('第2次提交'),hasRawJSON:m.innerText.includes('"nodes"'),insideViewport:m.getBoundingClientRect().top>=0&&m.getBoundingClientRect().bottom<=innerHeight};})()`);
 await screenshot('flow-history-desktop.png');
 await evaluate(`document.querySelector('.ant-modal-close').click()`);
 await send('Emulation.setDeviceMetricsOverride',{width:820,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate(`new Promise(r=>setTimeout(r,200))`);
 const tablet=await evaluate(`({columns:new Set([...document.querySelectorAll('article')].map(c=>Math.round(c.getBoundingClientRect().left))).size})`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await evaluate(`new Promise(r=>setTimeout(r,200))`);
 const mobile=await evaluate(`({columns:new Set([...document.querySelectorAll('article')].map(c=>Math.round(c.getBoundingClientRect().left))).size,horizontalOverflow:document.documentElement.scrollWidth>innerWidth})`);
 await screenshot('dashboard-mobile.png');
 await evaluate(`[...document.querySelectorAll('article button')].find(b=>b.textContent.includes('總結')).click()`);
 await waitFor(`document.querySelector('.ant-modal .recharts-wrapper')?.querySelectorAll('.recharts-line').length===3`);
 await evaluate(`new Promise(r=>setTimeout(r,450))`);
 await screenshot('summary-mobile.png');
 const report={isolatedPreview:true,demoOnly:true,notClerkLoginVerification:true,desktop,filters,refreshRequested:true,summary,tooltipDatesAndValuesVerified:true,flow,tablet,mobile,runtimeErrors:errors};
 assert.equal(desktop.cards,8); assert.equal(desktop.columns,4); assert.equal(desktop.rows,2);
 assert.equal(tablet.columns,2); assert.equal(mobile.columns,1);
 assert.equal(summary.threeLines,3); assert.equal(summary.insideViewport,true);
 assert.equal(flow.first,true); assert.equal(flow.second,true); assert.equal(flow.hasRawJSON,false);
 assert.equal(desktop.horizontalOverflow,false); assert.equal(mobile.horizontalOverflow,false); assert.deepEqual(errors,[]);
 await fs.writeFile(new URL('visual-report.json',new URL(`file:///${out.replaceAll('\\','/')}`)),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{socket.close();}
