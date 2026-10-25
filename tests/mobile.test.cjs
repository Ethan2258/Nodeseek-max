"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright");
const {launch,open}=require("./harness.cjs");
const P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const scrollTo=async(page,y)=>{await page.evaluate(y=>{const root=document.documentElement,old=root.style.scrollBehavior;root.style.scrollBehavior="auto";window.scrollTo(0,y);return new Promise(resolve=>requestAnimationFrame(()=>{root.style.scrollBehavior=old;resolve();}));},y);await page.waitForFunction(y=>Math.abs(scrollY-y)<2,y);};
const tapVisible=async(page,locator)=>{const r=await locator.boundingBox();assert.ok(r&&r.y>=0,"目标已在视口内，坐标触摸不应先自动滚动页面");await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);};
const mobile=(width=390,height=844)=>({viewport:{width,height},device:{...devices["iPhone 13"],viewport:{width,height}},seed:{"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}}});
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
for(const engine of engines) {
 let browser;
 test.before(async()=>{if(!browser)browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} iPhone：正文与输入区可读，主要操作 44px，编辑工具一行排开`,async()=>{
  for(const width of [390,320]) {
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(width),html:P.postPage({mobile:true})});
  try {
   await ready(page);
   const sizes=await page.evaluate(()=>({touch:matchMedia("(pointer: coarse)").matches,body:parseFloat(getComputedStyle(document.querySelector(".nsk-post article.post-content")).fontSize),input:parseFloat(getComputedStyle(document.querySelector(".md-editor textarea")).fontSize),buttons:[...document.querySelectorAll("#nsk-head > .nsmax-header-action,.nsmax-editor-controls button,.nsmax-op-actions a,.nsmax-owner-only,.nsmax-layout-toggle,.nsmax-jump-reply,.nsmax-code>[data-nspp-copy]")].filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute("aria-label")||e.textContent.trim(),height:e.getBoundingClientRect().height})),rows:[...document.querySelectorAll(".nsmax-editor-controls button")].map(e=>Math.round(e.getBoundingClientRect().top)),clipped:[...document.querySelectorAll(".nsmax-editor-controls button")].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1}));
   assert.equal(sizes.touch,true);assert.ok(sizes.body>=16,JSON.stringify(sizes));assert.ok(sizes.input>=16);
   assert.ok(sizes.buttons.every(b=>b.height>=43),JSON.stringify(sizes.buttons));
   assert.equal(new Set(sizes.rows).size,1,"工具栏不再换成两行");assert.deepEqual(sizes.clipped,[],"工具文字不会挤到相邻按钮上");assert.equal(sizes.overflow,false);assert.deepEqual(errors,[]);
  } finally {await context.close();}
  }
 });
 test(`${engine} iPhone：搜索点开可输入完整关键词，Enter 进入站内搜索`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(375),html:P.listPage({mobile:true}),pages:{"/search":P.searchPage({mobile:true})}});
  try {
   await ready(page);
   const input=page.locator("#search-site2");
   assert.equal(await input.evaluate(e=>getComputedStyle(e,"::placeholder").opacity),"0","收起时只有搜索图标，没有半截文字");
   await input.tap();
   assert.ok((await input.boundingBox()).width>=280);
   assert.ok(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
   await input.fill("香港 VPS");
   await page.keyboard.press("Enter");await page.waitForURL(/\/search\?q=/);
   assert.equal(new URL(page.url()).searchParams.get("q"),"香港 VPS");assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：菜单有关闭入口，打开锁住背景，关闭恢复原滚动位置`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30})});
  try {
   await ready(page);await scrollTo(page,500);const before=await page.evaluate(()=>scrollY);
   await tapVisible(page,page.locator("#toggle-left-panel a"));
   await page.waitForFunction(()=>document.body.style.position==="fixed");
   const close=page.getByRole("button",{name:"关闭菜单",exact:true});assert.ok((await close.boundingBox()).height>=44);
   await close.tap();await page.waitForFunction(()=>document.body.style.position!=="fixed");
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：设置整屏显示，背景锁定，短视口下底部操作仍可见`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30})});
  try {
   await ready(page);await scrollTo(page,400);const before=await page.evaluate(()=>scrollY);
   await tapVisible(page,page.getByRole("button",{name:"NodeSeek Max 设置",exact:true}));const host=page.locator("#nspp-settings");
   await page.waitForFunction(()=>document.body.style.position==="fixed");
   assert.ok((await host.locator("dialog").boundingBox()).width>=388);
   assert.ok(await host.getByRole("searchbox",{name:"搜索设置",exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));
   await page.setViewportSize({width:390,height:430});
   await page.waitForFunction(()=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue("--nsmax-overlay-height"))-430)<2);
   const save=await host.getByRole("button",{name:"保存并刷新",exact:true}).boundingBox();assert.ok(save.y+save.height<=431,JSON.stringify(save));
   await host.getByRole("button",{name:"关闭",exact:true}).tap();await page.waitForFunction(()=>document.body.style.position!=="fixed");
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：楼号点按不触发桌面悬停卡，列表不做悬停预取`,async()=>{
  const html=P.postPage({mobile:true}).replace("</article>",'<p><a href="/post-1000-1#1">#1</a></p></article>');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(),html});
  try {
   await ready(page);const link=page.locator(".nsk-post article.post-content a").filter({hasText:/^#1$/});
   await link.dispatchEvent("mouseover");await page.waitForTimeout(200);assert.equal(await page.locator(".nsmax-floor-hover:visible").count(),0);
   await link.tap();assert.equal(await page.locator(".nsmax-floor-hover:visible").count(),0);
   assert.equal(await page.locator('script[type="speculationrules"]').count(),0);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：列表收起次要元信息，点整行空白也能进入帖子`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true}),pages:{"/post-1000-1":P.postPage({mobile:true})}});
  try {
   await ready(page);const row=page.locator("ul.post-list > li.post-list-item").first();
   const fonts=await page.evaluate(()=>{const root=document.documentElement,old=root.getAttribute('data-nsmax-size');const sizes=['standard','large','xlarge'].map(size=>{root.setAttribute('data-nsmax-size',size);return parseFloat(getComputedStyle(document.querySelector('.post-title > a')).fontSize);});root.setAttribute('data-nsmax-size',old);return sizes;});
   assert.deepEqual(fonts,[15,17,18],'手机列表的标准、大、特大字号均真实生效');
   assert.equal(await row.locator(".info-last-commenter").isVisible(),false);assert.equal(await row.locator(".info-views").isVisible(),false);
   const r=await row.boundingBox();await page.touchscreen.tap(r.x+r.width-5,r.y+r.height-5);await page.waitForURL(/\/post-1000-1$/);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：发帖输入和选择框不少于 16px，横屏也没有横向溢出`,async()=>{
  for(const size of [[320,740],[844,390]]) {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/new-discussion",{...mobile(...size),html:P.newPostPage({mobile:true})});
   try {await ready(page);const fonts=await page.locator(".md-editor :is(input,textarea,select)").evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(fonts.every(n=>n>=16),JSON.stringify(fonts));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);}finally{await context.close();}
  }
 });
 test(`${engine} iPhone：可视区被键盘缩小时回复框不会误判为已经完整可见`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(),html:P.postPage({mobile:true})});
  try {
   await ready(page);await page.evaluate(()=>{document.documentElement.style.scrollBehavior="auto";const editor=document.querySelector(".md-editor");window.scrollTo(0,editor.getBoundingClientRect().top+scrollY-100);});
   const result=await page.evaluate(()=>{const editor=document.querySelector(".md-editor"),rect=editor.getBoundingClientRect();const native=Element.prototype.scrollIntoView;let called=null;Element.prototype.scrollIntoView=function(options){called=options;};Object.defineProperty(window,"visualViewport",{configurable:true,value:{height:180,offsetTop:0}});try{editor.scrollIntoView();return{called,top:rect.top,bottom:rect.bottom};}finally{Element.prototype.scrollIntoView=native;}});
   assert.ok(result.top>=68&&result.bottom<844,JSON.stringify(result));assert.equal(result.called?.behavior,"auto");assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：图片预览支持切图，大按钮关闭后恢复背景滚动`,async()=>{
  const html=P.postPage({mobile:true}).replace("</article>",'<p><img src="/mobile-picture-1.svg" alt="手机图片一"><img src="/mobile-picture-2.svg" alt="手机图片二"></p></article>');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(),html,beforeNavigate:p=>p.route("**/mobile-picture-*.svg",route=>route.fulfill({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8899aa"/></svg>'}))});
  try {
   await ready(page);const image=page.getByAltText("手机图片一");await image.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);
   await page.evaluate(()=>{window.__viewerShown=false;document.addEventListener("shown",()=>{window.__viewerShown=true;},{capture:true,once:true});});await tapVisible(page,image);
   await page.waitForSelector(".viewer-container");await page.waitForFunction(()=>document.body.style.position==="fixed");
   await page.waitForFunction(()=>window.__viewerShown);
   const next=page.locator('.viewer-toolbar [data-viewer-action="next"]');assert.ok((await next.boundingBox()).height>=44);await next.tap();
   await page.waitForFunction(()=>document.querySelector(".viewer-canvas img")?.src.includes("mobile-picture-2"));
   const close=page.locator(".viewer-button");assert.ok((await close.boundingBox()).height>=44);await close.tap();
   await page.waitForFunction(()=>document.body.style.position!=="fixed");assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
 test(`${engine} iPhone：普通列表不额外扫描帖子，主动打开抽奖分类仍正常查询`,async()=>{
  for(const lottery of [false,true]) {
   let asked=0;const html=lottery?P.searchPage({mobile:true,count:6}):P.listPage({mobile:true}).replace("出一台香港 CN2 GIA 小鸡，年付 99","抽奖送 VPS");
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/"+(lottery?"search?q=%E6%8A%BD%E5%A5%96":""),{...mobile(),html,beforeNavigate:p=>p.route(/\/post-\d+-1$/,async route=>{asked++;await route.fulfill({status:200,contentType:"text/html",body:P.postPage()});})});
   try {await ready(page);if(lottery){const until=Date.now()+10000;while(!asked&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(asked>0);}else{await page.waitForTimeout(4200);assert.equal(asked,0);}assert.deepEqual(errors,[]);}finally{await context.close();}
  }
 });
 test(`${engine} iPhone：原生菜单被替换或移除时也能解除背景锁定`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30})});
  try {await ready(page);await tapVisible(page,page.locator("#toggle-left-panel a"));await page.waitForFunction(()=>document.body.style.position==="fixed");await page.evaluate(()=>document.getElementById("left-slide-panel").remove());await page.waitForFunction(()=>document.body.style.position!=="fixed");assert.equal(await page.locator(".global-mask").isVisible(),false);assert.deepEqual(errors,[]);}finally{await context.close();}
 });
 test(`${engine} iPhone：进入帖子再返回列表，恢复阅读滚动位置`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30}),pages:{"/post-1000-1":P.postPage({mobile:true})}});
  try {await ready(page);await scrollTo(page,600);await page.goto("https://www.nodeseek.com/post-1000-1");await ready(page);await page.goBack({waitUntil:"domcontentloaded"});await ready(page);await page.waitForFunction(()=>Math.abs(scrollY-600)<4);assert.equal(await page.evaluate(()=>document.body.style.position),"");assert.deepEqual(errors,[]);}finally{await context.close();}
 });
 test(`${engine} iPhone：触屏样式在解析阶段就生效，不等慢站点脚本回来再跳一次`,async()=>{
  let early;
  const html=P.postPage({mobile:true}).replace("</footer>",'</footer><script src="/slow-mobile-native.js"></script>');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(),html,beforeNavigate:p=>p.route("**/slow-mobile-native.js",async route=>{
   await p.waitForFunction(()=>document.querySelector(".nsk-post article.post-content"));
   early=await p.evaluate(()=>({loading:document.readyState==="loading",primary:performance.getEntriesByName("nsmax:primary-ready").length,font:parseFloat(getComputedStyle(document.querySelector(".nsk-post article.post-content")).fontSize)}));
   await route.fulfill({status:200,contentType:"application/javascript",body:"window.__nativeReady=true;"});
  })});
  try {assert.equal(early.loading,true);assert.equal(early.primary,0);assert.ok(early.font>=16,JSON.stringify(early));assert.deepEqual(errors,[]);}finally{await context.close();}
 });
}
