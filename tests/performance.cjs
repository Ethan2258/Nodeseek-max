"use strict";
const { execFileSync } = require("node:child_process");
const { readFileSync,writeFileSync,mkdirSync } = require("node:fs");
const path=require("node:path");
const {launch,open,ROOT}=require("./harness.cjs");
const {listPage}=require("./fixtures/pages.cjs");
const baseline=execFileSync("git",["show","v1.7.1:nodeseek-max.user.js"],{cwd:ROOT,encoding:"utf8",maxBuffer:5e6});
const current=readFileSync(path.join(ROOT,"nodeseek-max.user.js"),"utf8");
async function main(){
	const browser=await launch(),runs=[];
	try{
		for(const count of [6,50])for(let run=0;run<3;run++)for(const [version,source]of[["1.7.1",baseline],["current",current]]){
			const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage({count}),viewport:{width:1440,height:900},scriptSource:source,init:`window.__tasks=[];new PerformanceObserver(l=>window.__tasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});`});
			try{
				await page.waitForTimeout(850);
				const result=await page.evaluate(()=>({fcp:performance.getEntriesByType("paint").find(e=>e.name==="first-contentful-paint")?.startTime,maxTask:Math.max(0,...window.__tasks),profileRequests:performance.getEntriesByType("resource").filter(e=>e.name.includes("/api/account/getInfo/")).length}));
				runs.push({version,count,run,...result,errors});
			}finally{await context.close();}
		}
	}finally{await browser.close();}
	const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
	const report=[6,50].flatMap(count=>["1.7.1","current"].map(version=>{const rows=runs.filter(x=>x.count===count&&x.version===version);return{count,version,fcpMedian:median(rows.map(x=>x.fcp)),maxTaskMedian:median(rows.map(x=>x.maxTask)),errors:rows.flatMap(x=>x.errors)}}));
	mkdirSync(path.join(ROOT,"docs/validation"),{recursive:true});
	writeFileSync(path.join(ROOT,"docs/validation/performance.json"),JSON.stringify({report,runs},null,2)+"\n");
	console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
