"use strict";
const { execFileSync } = require("node:child_process");
const { readFileSync,writeFileSync,mkdirSync } = require("node:fs");
const path=require("node:path");
const {launch,open,ROOT}=require("./harness.cjs");
const {listPage}=require("./fixtures/pages.cjs");
const baselineRef=process.argv.find(arg=>arg.startsWith("--baseline="))?.slice(11)||process.env.NSMAX_PERF_BASELINE||"HEAD";
let baseline;
try{baseline=execFileSync("git",["show",baselineRef+":nodeseek-max.user.js"],{cwd:ROOT,encoding:"utf8",maxBuffer:10e6});}
catch{throw new Error("无法读取基线 "+baselineRef+"。请指定本地存在的提交或标签，例如 --baseline=HEAD。");}
const current=readFileSync(path.join(ROOT,"nodeseek-max.user.js"),"utf8");
async function main(){
	const browser=await launch(),runs=[];
	try{
		for(const count of [6,50])for(let run=0;run<3;run++)for(const [version,source]of[[baselineRef,baseline],["current",current]]){
			const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage({count}),viewport:{width:1440,height:900},scriptSource:source,init:`window.__tasks=[];new PerformanceObserver(l=>window.__tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});`});
			try{
				await page.waitForTimeout(1200);
				const result=await page.evaluate(()=>({fcp:performance.getEntriesByType("paint").find(e=>e.name==="first-contentful-paint")?.startTime,primary:performance.getEntriesByName("nsmax:primary-ready")[0]?.startTime,deferred:performance.getEntriesByName("nsmax:deferred-start")[0]?.startTime,maxTask:Math.max(0,...window.__tasks),profileRequests:performance.getEntriesByType("resource").filter(e=>e.name.includes("/api/account/getInfo/")).length}));
				runs.push({version,count,run,...result,errors});
			}finally{await context.close();}
		}
	}finally{await browser.close();}
	const median=values=>{const valid=values.filter(Number.isFinite).sort((a,b)=>a-b);return valid.length?valid[Math.floor(valid.length/2)]:null;};
	const report=[6,50].flatMap(count=>[baselineRef,"current"].map(version=>{const rows=runs.filter(x=>x.count===count&&x.version===version);return{count,version,fcpMedian:median(rows.map(x=>x.fcp)),maxTaskMedian:median(rows.map(x=>x.maxTask)),errors:rows.flatMap(x=>x.errors)}}));
	const output=process.env.NSMAX_AUDIT_DIR||path.join(ROOT,"docs/validation");
	mkdirSync(output,{recursive:true});
	writeFileSync(path.join(output,"performance.json"),JSON.stringify({baseline:baselineRef,report,runs},null,2)+"\n");
	console.log(JSON.stringify(report,null,2));
	if(runs.some(run=>run.errors.length))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
