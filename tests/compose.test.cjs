"use strict";
// 页面打开过程中不跳、不闪（2026-11-01）：发帖页的精简编辑器要等站点建好 CodeMirror 才搭得起来，在那之前原生编辑器先按搭好后的样子占位；
// 个人主页站点先只给一个转圈 gif + Loading，拿到资料才换成内容，在那之前放和内容同样大小的骨架
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
// 站点晚一步建 CodeMirror：原始网页里只有空的 #code-mirror-editor，700ms 后才插进 .CodeMirror（真站要等编辑器脚本加载完）
const lateCodeMirror=`document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{const host=document.querySelector("#code-mirror-editor");const el=document.createElement("div");el.className="CodeMirror cm-s-default";el.innerHTML='<div class="CodeMirror-scroll" style="min-height:300px"><div class="CodeMirror-sizer"><div class="CodeMirror-code"><pre class="CodeMirror-line"> </pre></div></div></div><textarea></textarea>';let v="";el.CodeMirror={getValue:()=>v,setValue:x=>{v=x},on(){},off(){},refresh(){},focus(){},getSelection:()=>"",getCursor:()=>({line:0,ch:0}),replaceRange(){},getWrapperElement:()=>el,getScrollerElement:()=>el.firstChild,setOption(){},getOption(){}};host.append(el);},700));
window.__nsmaxEditorLog=[];const tick=()=>{const body=document.querySelector(".md-editor > #editor-body"),pane=document.querySelector(".md-editor .content-area");if(body&&pane&&document.documentElement.hasAttribute("data-nsmax-theme")){const b=body.getBoundingClientRect(),p=pane.getBoundingClientRect();window.__nsmaxEditorLog.push({compact:body.parentElement.classList.contains("nsmax-compact-reply"),body:b.height,top:p.top-b.top,pane:p.height});}requestAnimationFrame(tick)};requestAnimationFrame(tick);`;
// 照真站：服务器只给 #user-space-mount（转圈图 + Loading），站点脚本拿到资料后整块换成 .nsk-container
const spaceMount=(options,delay)=>{const html=P.spaceTopicsPage(options),m=html.match(/<section id="nsk-frame">([\s\S]*?)<\/section>/);
 return html.replace(m[0],`<section id="nsk-frame"><div id="user-space-mount"><img src="/avatar/1.png" alt class="loading-img"><span>Loading</span></div><script>setTimeout(()=>{const t=document.createElement("template");t.innerHTML=${JSON.stringify(m[1])};document.getElementById("user-space-mount").replaceWith(t.content);},${delay});</script></section>`);};
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 发帖页：精简编辑器搭好前后输入框位置、编辑区高度不变`,async()=>{
  for(const [width,mobile] of [[1440,false],[900,false],[390,true],[320,true]]){
   const html=P.newPostPage({mobile}).replace(/<textarea placeholder="鼓励友善发言，禁止人身攻击" aria-label="正文"><\/textarea>/,"");
   const options=mobile?{viewport:{width,height:844},device:{...devices["iPhone 13"],viewport:{width,height:844}},seed}:{viewport:{width,height:900},seed};
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/new-discussion",{...options,html,init:lateCodeMirror});
   try{
    await page.waitForFunction(()=>window.__nsmaxEditorLog.some(e=>e.compact)&&window.__nsmaxEditorLog.filter(e=>e.compact).length>5,null,{timeout:10000});
    const log=await page.evaluate(()=>window.__nsmaxEditorLog);
    const before=log.filter(e=>!e.compact),after=log.filter(e=>e.compact).at(-1);
    assert.ok(before.length>0,`${width}: 没看到搭好之前的样子`);
    for(const e of before){
     assert.ok(Math.abs(e.body-after.body)<=1,`${width}px 编辑区高度 ${e.body} → ${after.body}`);
     assert.ok(Math.abs(e.top-after.top)<=1,`${width}px 输入框离编辑区顶 ${e.top} → ${after.top}`);
     assert.ok(Math.abs(e.pane-after.pane)<=1,`${width}px 输入框高度 ${e.pane} → ${after.pane}`);
    }
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 个人主页：资料到之前是和资料卡一样大的骨架，不是转圈图加 Loading`,async()=>{
  for(const [width,mobile] of [[1440,false],[390,true]]){
   const options=mobile?{viewport:{width,height:844},device:{...devices["iPhone 13"],viewport:{width,height:844}},seed}:{viewport:{width,height:900},seed};
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{...options,html:spaceMount({mobile},1500)});
   try{
    await page.waitForSelector("#user-space-mount > .nsmax-space-skeleton",{timeout:5000});
    const before=await page.evaluate(()=>{const mount=document.getElementById("user-space-mount"),head=mount.querySelector(".nsmax-space-skel-head").getBoundingClientRect();
     return{loading:[...mount.querySelectorAll(":scope > .loading-img, :scope > span")].some(e=>e.getClientRects().length),top:head.top,left:head.left,width:head.width,height:head.height,lines:mount.querySelectorAll(".nsmax-skeleton-line").length};});
    assert.equal(before.loading,false,`${width}px：转圈图和 Loading 不显示`);
    assert.ok(before.lines>20);
    await page.waitForSelector("#nsk-frame .head-container .nsmax-space-top",{timeout:5000});
    const after=await page.evaluate(()=>{const head=document.querySelector("#nsk-frame .head-container").getBoundingClientRect();return{top:head.top,left:head.left,width:head.width,height:head.height,skeleton:!!document.querySelector(".nsmax-space-skeleton")};});
    assert.equal(after.skeleton,false);
    for(const key of ["top","left","width","height"])assert.ok(Math.abs(before[key]-after[key])<=2,`${width}px 资料卡 ${key}：骨架 ${before[key]} → 内容 ${after[key]}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
