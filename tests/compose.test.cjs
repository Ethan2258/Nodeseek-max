"use strict";
// 发帖页（2026-11-01）：精简编辑器要等站点建好 CodeMirror 才搭得起来，在那之前原生编辑器先按搭好后的样子占位，
// 搭好的那一下输入框、版块和「发布帖子」不再往上跳
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
// 站点晚一步建 CodeMirror：原始网页里只有空的 #code-mirror-editor，700ms 后才插进 .CodeMirror（真站要等编辑器脚本加载完）
const lateCodeMirror=`document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{const host=document.querySelector("#code-mirror-editor");const el=document.createElement("div");el.className="CodeMirror cm-s-default";el.innerHTML='<div class="CodeMirror-scroll" style="min-height:300px"><div class="CodeMirror-sizer"><div class="CodeMirror-code"><pre class="CodeMirror-line"> </pre></div></div></div><textarea></textarea>';let v="";el.CodeMirror={getValue:()=>v,setValue:x=>{v=x},on(){},off(){},refresh(){},focus(){},getSelection:()=>"",getCursor:()=>({line:0,ch:0}),replaceRange(){},getWrapperElement:()=>el,getScrollerElement:()=>el.firstChild,setOption(){},getOption(){}};host.append(el);},700));
window.__nsmaxEditorLog=[];const tick=()=>{const body=document.querySelector(".md-editor > #editor-body"),pane=document.querySelector(".md-editor .content-area");if(body&&pane&&document.documentElement.hasAttribute("data-nsmax-theme")){const b=body.getBoundingClientRect(),p=pane.getBoundingClientRect();window.__nsmaxEditorLog.push({compact:body.parentElement.classList.contains("nsmax-compact-reply"),body:b.height,top:p.top-b.top,pane:p.height});}requestAnimationFrame(tick)};requestAnimationFrame(tick);`;
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
}
