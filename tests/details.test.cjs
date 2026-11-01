"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const phone=(width=390,height=844)=>({viewport:{width,height},device:{...devices["iPhone 13"],viewport:{width,height}},seed});
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 打开页面不再淡出原站灰底：顶栏和主体没有背景过渡`,async()=>{
  for(const options of [phone(),{seed}]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{...options,html:P.notificationPage({mobile:!!options.device}),manager:{type:"userscripts",delay:10}});
   try{
    await ready(page);
    const state=await page.evaluate(()=>[document.querySelector("body>header"),document.getElementById("nsk-body")].map(e=>({transition:getComputedStyle(e).transitionProperty,duration:getComputedStyle(e).transitionDuration,running:e.getAnimations().length})));
    for(const s of state){assert.ok(s.transition==="none"||s.duration.split(",").every(d=>parseFloat(d)===0)||s.transition==="opacity",JSON.stringify(state));assert.equal(s.running,0,JSON.stringify(state));}
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 打开登录页、设置页和列表页时内容不跳：卡片和页签一开始就排好，帖子行预留高度等于实际行高`,async()=>{
  const init="window.__shift=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__shift+=e.value}).observe({type:'layout-shift',buffered:true});";
  for(const [url,render] of [["/signIn.html",P.signInPage],["/setting",P.settingPage],["/",P.listPage]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{html:render({}),viewport:{width:1440,height:900},seed,init});
   try{
    await ready(page);await page.waitForTimeout(400);
    const shift=await page.evaluate(()=>window.__shift);
    if(engine==="chromium")assert.ok(shift<0.002,`${url} 累计布局偏移 ${shift}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机主楼：楼主时间和操作同一行，代码块不再空出一整行`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const r=e=>e.getBoundingClientRect(),meta=document.querySelector(".nsk-post .nsk-content-meta-info>div:not([class])"),ops=document.querySelector(".nsk-post .nsmax-op-actions"),pre=document.querySelector(".post-content .nsmax-code>pre"),copy=document.querySelector(".nsmax-code>[data-nspp-copy]"),items=[...document.querySelectorAll(".nsk-post .topic-actions>.menu-item")].map(e=>Math.round(r(e).width));return{meta:r(meta),ops:r(ops),pre:r(pre).height,code:r(pre.querySelector("code")).top-r(pre).top,copy:r(copy),preTop:r(pre).top,items,menu:r(document.querySelector(".nsk-post .topic-actions")).width,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    if(width>=360){assert.ok(Math.abs((s.meta.top+s.meta.height/2)-(s.ops.top+s.ops.height/2))<3,JSON.stringify(s));assert.ok(s.ops.left>s.meta.left+100,JSON.stringify(s));}
    else assert.ok(s.ops.top>=s.meta.bottom-1,"窄屏放不下时操作仍换到下一行");
    assert.ok(s.copy.height>=43&&s.copy.width>=44,"复制按钮保留 44px 触控区");assert.ok(s.code<=46,JSON.stringify(s));assert.ok(s.copy.top-s.preTop<2,JSON.stringify(s));
    assert.equal(new Set(s.items).size,1,JSON.stringify(s.items));assert.ok(s.items.reduce((a,b)=>a+b,0)+8*(s.items.length-1)>=s.menu-4,"点赞一排平分整行");
    assert.equal(s.overflow,false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机消息中心：带未读数时三个标签都在屏幕内，边线和列表页一致`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{...phone(width),html:P.notificationPage({mobile:true})});
   try{
    await ready(page);await page.waitForFunction(()=>[...document.querySelectorAll(".nsmax-message-tabs .nspp-messages-count")].some(e=>!e.hidden&&e.textContent));
    const s=await page.evaluate(()=>{const top=document.querySelector(".nspp-messages-top").getBoundingClientRect();return{top,tabs:[...document.querySelectorAll(".nsmax-message-tabs>a")].map(a=>{const b=a.getBoundingClientRect();return{left:b.left,right:b.right}}),buttons:[...document.querySelectorAll(".nspp-messages-top-actions button")].filter(b=>b.getClientRects().length).map(b=>b.getBoundingClientRect().right),container:document.querySelector(".nsk-notification").getBoundingClientRect().left,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.equal(s.tabs.length,3);assert.ok(s.tabs.every(t=>t.left>=s.top.left&&t.right<=s.top.right),JSON.stringify(s));assert.ok(s.buttons.every(r=>r<=s.top.right),JSON.stringify(s));
    assert.ok(s.container<=14,JSON.stringify(s));assert.equal(s.overflow,false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 个人主页回帖摘要贴着标题，行内代码折行时两段边框完整`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10",{...phone(),html:P.nativeSpacePage({mobile:true})});
  try{
   await ready(page);
   const row=await page.evaluate(()=>{const p=document.querySelector(".comments-list>*>p");return{margin:getComputedStyle(p).marginTop,height:p.parentElement.getBoundingClientRect().height};});
   assert.equal(row.margin,"4px");assert.ok(row.height<90,JSON.stringify(row));assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{await ready(post.page);assert.equal(await post.page.locator("article.post-content :not(pre)>code").first().evaluate(e=>getComputedStyle(e).boxDecorationBreak||getComputedStyle(e).webkitBoxDecorationBreak),"clone");}finally{await post.context.close();}
 });
 test(`${engine} 上一个页面查未读数时还没等到回应就离开：这一页自己查，不挂着 0 等下一分钟`,async()=>{
  // 一分钟内别的页面拿到了查询权、但什么都没存下
  const init=`localStorage.setItem("nspp:lock:www.nodeseek.com:unread:1",JSON.stringify({started:Date.now(),until:Date.now()+12e4,owner:"gone"}));`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:P.listPage({}),viewport:{width:1440,height:900},seed,init});
  try{
   await ready(page);
   await page.waitForFunction(()=>document.querySelectorAll(".nspp-notification-link .nspp-unread-count").length===3,null,{timeout:5000});
   assert.deepEqual(await page.locator(".nspp-notification-link .nspp-unread-count").allTextContents(),["1","1","1"]);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 注册页密码框和别的输入框一样宽；带右栏的通知页消息中心和右栏顶端、列表页左边对齐`,async()=>{
  const reg=await open(browser,"https://www.nodeseek.com/register.html",{html:P.registerPage({}),viewport:{width:1280,height:900},seed});
  try{
   await ready(reg.page);
   const widths=await reg.page.evaluate(()=>["#stacked-username","#stacked-password","#password-reinput"].map(s=>Math.round(document.querySelector(s).getBoundingClientRect().right)));
   assert.equal(new Set(widths).size,1,JSON.stringify(widths));
   assert.deepEqual(reg.errors,[]);
  }finally{await reg.context.close();}
  const box=async(url,render)=>{const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{html:render({}),viewport:{width:1280,height:900},seed});try{await ready(page);const r=await page.evaluate(()=>{const left=[...document.querySelectorAll("#nsk-body-left *")].find(e=>e.getBoundingClientRect().width>300).getBoundingClientRect(),right=document.querySelector("#nsk-right-panel-container>*").getBoundingClientRect();return{left:Math.round(left.left),top:Math.round(left.top),rightTop:Math.round(right.top)};});assert.deepEqual(errors,[]);return r;}finally{await context.close();}};
  const notif=await box("/notification",P.notificationPage),list=await box("/",P.listPage);
  assert.equal(notif.top,notif.rightTop,JSON.stringify(notif));
  assert.equal(notif.left,list.left,JSON.stringify({notif,list}));
 });
}
