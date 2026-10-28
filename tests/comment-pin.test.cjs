"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const setup=mode=>`localStorage.setItem("nsmax:post-layout",${JSON.stringify(mode)});document.addEventListener("DOMContentLoaded",()=>{window.__nativePinCalls=[];window.__nativePinNodes={};for(const id of ["1","2"]){const row=document.querySelector('li.content-item[id="'+id+'"]'),menu=row.querySelector(".comment-menu"),action=document.createElement("div");action.className="menu-item";action.dataset.nativePin=id;action.innerHTML='<svg title="置顶" class="iconpark-icon"><use href="#pin"></use></svg><span>置顶</span>';let pinned=false;action.addEventListener("click",()=>{pinned=!pinned;__nativePinCalls.push({floor:id,pinned});const text=pinned?"取消置顶":"置顶";if(id==="1")action.querySelector("span").firstChild.data=text;action.querySelector("svg").setAttribute("title",text);const old=row.querySelector(".pined-comment-badge");if(pinned&&!old){const badge=document.createElementNS("http://www.w3.org/2000/svg","svg");badge.classList.add("pined-comment-badge");row.querySelector(".floor-link-wrapper").prepend(badge);}else if(!pinned)old?.remove();});menu.append(action);__nativePinNodes[id]=action;}});`;
for(const engine of ["chromium","webkit"]){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});test.after(async()=>{await browser?.close();});
 test(`${engine} 置顶他人评论：入口可见，保留原生点击，取消与键盘操作对应正确楼层`,async()=>{
  for(const mobile of [false,true])for(const mode of ["classic","simple"]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html:P.postPage({mobile}),device:mobile?{...devices["iPhone 13"],viewport:{width:390,height:844}}:{},viewport:{width:1440,height:900},seed:{"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}},init:setup(mode)});
   try{
    await ready(page);await page.waitForSelector('[data-native-pin="1"][data-nsmax-compact-action]');const first=page.locator('[data-native-pin="1"]');
    const before=await first.evaluate(e=>({text:getComputedStyle(e,"::before").content,height:e.getBoundingClientRect().height}));assert.equal(before.text,'"置顶"',JSON.stringify({mobile,mode,before}));assert.ok(before.height>=(mobile?44:18));
    await page.locator('li.content-item[id="1"]').getByRole("button",{name:"置顶评论",exact:true}).click();
    await page.locator('li.content-item[id="1"]').getByRole("button",{name:"取消置顶评论",exact:true}).waitFor();await page.waitForSelector('li.content-item[id="1"] .nsmax-pin-tag');
    assert.deepEqual(await page.evaluate(()=>__nativePinCalls),[{floor:"1",pinned:true}]);assert.equal(await first.evaluate(e=>e===window.__nativePinNodes["1"]),true);
    await first.focus();await first.press("Enter");await page.waitForFunction(()=>document.querySelector('[data-native-pin="1"]').getAttribute("aria-label")==="置顶评论"&&!document.querySelector('li.content-item[id="1"] .nsmax-pin-tag'));
    assert.deepEqual(await page.evaluate(()=>__nativePinCalls),[{floor:"1",pinned:true},{floor:"1",pinned:false}]);
    const second=page.locator('[data-native-pin="2"]');await second.focus();await second.press("Space");await page.waitForFunction(()=>__nativePinCalls.length===3);assert.deepEqual(await page.evaluate(()=>__nativePinCalls[2]),{floor:"2",pinned:true});await page.waitForFunction(()=>document.querySelector('[data-native-pin="2"]').getAttribute("aria-label")==="取消置顶评论");await second.press("Space");await page.waitForFunction(()=>__nativePinCalls.length===4&&document.querySelector('[data-native-pin="2"]').getAttribute("aria-label")==="置顶评论");assert.deepEqual(await page.evaluate(()=>__nativePinCalls[3]),{floor:"2",pinned:false});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(await page.locator('li.content-item[id="3"] [data-nsmax-action="pin"],li.content-item[id="3"] [data-nsmax-action="unpin"]').count(),0,"原站没有的权限入口不凭空添加");assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
