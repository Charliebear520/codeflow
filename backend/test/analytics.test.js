import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoData, DEMO_MINUTES } from "../lib/demoData.js";
import { activitySummary, totalSeconds, groupStatistics, recordAnalysis } from "../lib/learningAnalytics.js";
import { normalizeSavedGraph } from "../../client/src/lib/savedGraph.js";

test("all eight fixed time triples and total durations exactly match requested minutes", () => {
  for (const [i,{submission}] of buildDemoData().entries()) {
    assert.deepEqual([1,2,3].map((s) => submission.stages[`stage${s}`].durationSec), DEMO_MINUTES[i].map((v) => v*60));
    assert.equal(totalSeconds(submission), DEMO_MINUTES[i].reduce((n,v) => n+v,0)*60);
  }
});
test("weekly counts derive from timestamped events and equal cards, with distinct demo trends", () => {
  const patterns = new Set();
  for (const {submission} of buildDemoData()) {
    const activity = activitySummary(submission);
    assert.equal(activity.weekly.length,4);
    assert.equal(activity.dateStart,"2026-10-05");
    assert.equal(activity.dateEnd,"2026-11-01");
    for (const [kind,field] of [["chat","chatCount"],["attempt","attemptCount"],["help","helpCount"]]) {
      assert.equal(activity.totals[kind],submission[field]);
      assert.equal(activity.totals[kind],activity.weekly.reduce((n,w)=>n+w[kind],0));
    }
    patterns.add(JSON.stringify(activity.weekly.map((w)=>[w.chat,w.attempt,w.help])));
  }
  assert.equal(patterns.size,8);
});
test("untimestamped legacy totals are never fabricated into weekly history", () => {
  const record={chatCount:100,attemptCount:50,helpCount:20,activityEvents:[]};
  const activity=activitySummary(record,new Date("2026-10-30T03:00:00Z"));
  assert.equal(activity.hasHistory,false);
  assert.deepEqual(activity.totals,{chat:0,attempt:0,help:0});
  assert.ok(activity.weekly.every((w)=>w.chat===null));
  const analysis=recordAnalysis({...record,stages:{}},activity);
  assert.equal(analysis.errors.length,0);
  assert.equal(analysis.tone,"neutral");
  assert.ok(!analysis.status.includes("優異"));
});
test("statistics distinguish people from records and completed-source averages", () => {
  const demo=buildDemoData().map(({submission})=>submission);
  const rows=[...demo,{...demo[0],_id:"other-question",questionId:"Q002"},{student:"real",isDemo:false,stages:{}}];
  const stats=groupStatistics(rows);
  assert.equal(stats.submissionCount,10); assert.equal(stats.studentCount,9);
  assert.equal(stats.demo.studentCount,8); assert.equal(stats.real.studentCount,1);
  assert.equal(stats.real.averageCompletedDurationSec,null);
  const complete=rows.filter((r)=>r.isDemo&&[1,2,3].every(s=>r.stages[`stage${s}`].completed));
  assert.equal(stats.demo.averageCompletedDurationSec,complete.reduce((n,r)=>n+totalSeconds(r),0)/complete.length);
});
test("read-only graph normalization keeps student positions and labels, rejecting malformed entries", () => {
  const graph=buildDemoData()[0].submission.stages.stage1.graph;
  const result=normalizeSavedGraph(graph);
  assert.equal(result.nodes[0].data.label,graph.nodes[0].data.label);
  assert.deepEqual(result.nodes[0].position,graph.nodes[0].position);
  assert.equal(result.edges.find(e=>e.id==='e3').label,"否");
  assert.ok(normalizeSavedGraph({nodes:[null],edges:[{}]}).error);
  assert.ok(normalizeSavedGraph(null).error);
  assert.ok(normalizeSavedGraph({...graph,edges:[...graph.edges,{source:"missing",target:"start"}]}).warning);
  const diamond=normalizeSavedGraph({nodes:[{id:"d",type:"diamond",position:{x:50,y:20},data:{label:"條件"}}],edges:[]});
  assert.equal(diamond.nodes[0].style.width,140);
  const measured=normalizeSavedGraph({nodes:[{id:"d",type:"diamond",position:{x:50,y:20},measured:{width:180,height:160},data:{label:"條件"}}],edges:[]});
  assert.equal(measured.nodes[0].width,180); assert.equal(measured.nodes[0].height,160);
});
