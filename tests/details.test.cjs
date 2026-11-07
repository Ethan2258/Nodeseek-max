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
 test(`${engine} 手机主楼（2026-11-07 重做）：楼主和时间收进作者栏，「举报 引用 回复」胶囊在签名下面靠右，点赞一排一行平分；代码块不再空出一整行`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const r=e=>e.getBoundingClientRect(),head=r(document.querySelector(".nsk-post .nsmax-author-col")),meta=document.querySelector(".nsk-post .nsk-content-meta-info>div:not([class])"),ops=[...document.querySelectorAll(".nsk-post .nsmax-op-actions>a")].map(e=>r(e)),sig=r(document.querySelector(".nsk-post .signature")),body=r(document.querySelector(".nsk-post article.post-content")),pre=document.querySelector(".post-content .nsmax-code>pre"),copy=document.querySelector(".nsmax-code>[data-nspp-copy]"),items=[...document.querySelectorAll(".nsk-post .topic-actions>.menu-item")].map(e=>r(e));return{head,meta:r(meta),ops,sig,body,pre:r(pre).height,code:r(pre.querySelector("code")).top-r(pre).top,copy:r(copy),preTop:r(pre).top,items:items.map(i=>({w:Math.round(i.width),h:Math.round(i.height),top:Math.round(i.top)})),menu:r(document.querySelector(".nsk-post .topic-actions")),overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.ok(s.meta.top>=s.head.top&&s.meta.bottom<=s.head.bottom,`时间在作者栏里：${JSON.stringify(s)}`);
    assert.ok(Math.abs(s.body.top-s.head.bottom)<1,"正文紧跟作者栏");
    assert.equal(new Set(s.ops.map(o=>Math.round(o.top))).size,1,"三个按钮一行");assert.ok(s.ops.every(o=>o.top>=s.sig.bottom-1&&o.height>=44),JSON.stringify(s));
    assert.ok(Math.abs(Math.max(...s.ops.map(o=>o.right))-s.body.right)<1,"靠右，和正文右边线对齐");
    assert.ok(s.copy.height>=43&&s.copy.width>=44,"复制按钮保留 44px 触控区");assert.ok(s.code<=46,JSON.stringify(s));assert.ok(s.copy.top-s.preTop<2,JSON.stringify(s));
    assert.equal(s.items.length,4);assert.equal(new Set(s.items.map(i=>i.top)).size,1,"点赞一排不折行");assert.ok(s.items.every(i=>i.h===40),JSON.stringify(s.items));
    assert.ok(Math.max(...s.items.map(i=>i.w))-Math.min(...s.items.map(i=>i.w))<=1,"四个平分");assert.ok(s.menu.right<=s.body.right+0.5,JSON.stringify(s));
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
 test(`${engine} 未读数（上游 NodeSeek++ 26.1030）：先用页面自带的未读数；别的标签页在消息中心标完已读，资料卡角标马上跟着变`,async()=>{
  const html=P.listPage({}).replace('member_name: "tester" }','member_name: "tester", unViewedCount: { reply: 2, atMe: 0, message: 5 } }');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html,viewport:{width:1440,height:900},seed,api:{"/api/notification/unread-count":[{status:200,body:{success:true,unreadCount:{reply:2,atMe:0,message:5}}}]}});
  try{
   await ready(page);
   // 按链接指向的分类读数字（三个链接分在资料卡的两列里，文档顺序不是回复、@我、私信）
   const counts=()=>page.evaluate(()=>["reply","atMe","message"].map(k=>document.querySelector(`.nspp-notification-link[href*="/notification#/${k}"]`)?.lastElementChild.textContent));
   await page.waitForFunction(()=>document.querySelectorAll(".nspp-notification-link").length===3,null,{timeout:5000});
   assert.deepEqual(await counts(),["2","0","5"],"回复、@我、私信");
   // 另一个标签页的消息中心读完未读数后发到同名频道（同一页面里另开一个频道对象，效果一样）
   await page.evaluate(()=>{const channel=new BroadcastChannel("nspp:unread:www.nodeseek.com:1");channel.postMessage({counts:{reply:0,atMe:0,message:1}});channel.close();});
   await page.waitForFunction(()=>["reply","atMe","message"].map(k=>document.querySelector(`.nspp-notification-link[href*="/notification#/${k}"]`)?.lastElementChild.textContent).join()==="0,0,1",null,{timeout:3000});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 通知链接按站点设置的每页楼数（__config__.commmentPerPage）跳到那一楼所在的页`,async()=>{
  const atList=[{id:51,post_id:4201,floor_id:9,commenter_id:7,commenter_name:"friend",post_title:"每页 4 楼",content:"<p>@tester 第 9 楼</p>",viewed:1,created_at:new Date().toISOString()}];
  for(const [perPage,href] of [[4,"/post-4201-3#9"],[0,"/post-4201-1#9"]]){
   const html=P.nativeTalkPage({}).replace(/member_name: "tester" \}/,perPage?`member_name: "tester" }, commmentPerPage: ${perPage}`:'member_name: "tester" }');
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/atMe",{html,viewport:{width:1440,height:900},seed,api:{"/api/notification/at-me/list":[{status:200,body:{success:true,atList}}]}});
   try{
    await page.waitForSelector(".nsmax-notice-main",{timeout:8000});
    assert.equal(await page.locator(".nsmax-notice-main").first().getAttribute("href"),href,perPage?"每页 4 楼：第 9 楼在第 3 页":"没设置时按每页 10 楼");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
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
 test(`${engine} 个人主页主题帖的浏览 / 评论胶囊：一开始就占好位，数字到了行不变高、各行一样宽，看得见的几行一起取`,async()=>{
  const KEY="nspp:settings:www.nodeseek.com",started=[];
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{viewport:{width:1440,height:900},html:P.spaceTopicsPage(),seed:{[KEY]:{...seed[KEY],"discussion-stats":{enabled:true}}},
   beforeNavigate:p=>p.route(/\/post-\d+-\d+$/,async route=>{
    const id=Number(new URL(route.request().url()).pathname.match(/post-(\d+)/)[1]);started.push(Date.now());
    await new Promise(r=>setTimeout(r,400));
    const data={postData:{postId:id,postPage:1,postPageCount:1,views:[7,1328,286,42,508,96][id%6],comments:[{floorIndex:[0,120,4,3,14,1][id%6]}]}};
    await route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><html><head><script id="temp-script" type="application/json">${Buffer.from(JSON.stringify(data)).toString("base64")}</script></head><body>${"<p>正文</p>".repeat(200)}</body></html>`});
   })});
  try{
   await page.waitForSelector(".nspp-discussion-stats");
   const measure=()=>page.evaluate(()=>[...document.querySelectorAll(".discussion-wrapper > .discussion-item")].map(row=>{const stats=row.querySelector(".nspp-discussion-stats");return{row:Math.round(row.getBoundingClientRect().height*10)/10,width:Math.round(stats.getBoundingClientRect().width),state:stats.dataset.state,text:stats.innerText.replace(/\s+/g," ").trim()};}));
   const before=await measure();
   assert.ok(before.every(r=>r.state==="loading"&&/–/.test(r.text)),JSON.stringify(before));
   await page.waitForFunction(()=>[...document.querySelectorAll(".nspp-discussion-stats")].every(s=>s.dataset.state==="done"),null,{timeout:8000});
   const after=await measure();
   assert.deepEqual(after.map(r=>r.row),before.map(r=>r.row),"数字到了行高不变");
   assert.equal(new Set(after.map(r=>r.width)).size,1,`各行胶囊一样宽：${JSON.stringify(after)}`);
   assert.equal(new Set(before.map(r=>r.width)).size,1);
   assert.ok(after.some(r=>/1328.*120/.test(r.text)),JSON.stringify(after));
   // 看得见的六行不是一个接一个、隔 600 毫秒取的
   assert.ok(started.length>=6&&started[3]-started[0]<300,JSON.stringify(started.map(t=>t-started[0])));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 发帖页、个人主页打开时右栏一开始就是完整的，页脚预留高度等于实际高度：整页不会突然变长`,async()=>{
  const init="window.__heights=[];const tick=()=>{if(document.documentElement)window.__heights.push(document.documentElement.scrollHeight);if(performance.now()<3500)requestAnimationFrame(tick);};requestAnimationFrame(tick);";
  const hot={"nspp:state:www.nodeseek.com:hot-rankings":{"snapshot:daily":{fetched:Date.now(),posts:Array.from({length:10},(_,i)=>({id:900+i,title:`热门帖子 ${i+1}`,views:100+i,comments:i}))}}};
  for(const [url,render] of [["/new-discussion",P.newPostPage],["/space/10#/discussions",P.spaceTopicsPage]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{html:render(),viewport:{width:1440,height:900},seed:{...seed,...hot},init});
   try{
    await ready(page);await page.waitForTimeout(600);
    const heights=await page.evaluate(()=>window.__heights.filter(h=>h>0));
    const first=heights.find(h=>h>900)??heights[0],last=heights.at(-1);
    assert.ok(Math.abs(last-first)<=2,`${url} 整页高度 ${first} → ${last}`);
    const footer=await page.evaluate(()=>{const f=document.querySelector("body > footer");const placeholder=parseFloat(getComputedStyle(f).containIntrinsicHeight.replace(/^auto\s+/,""));f.style.setProperty("content-visibility","visible","important");return{placeholder,real:f.getBoundingClientRect().height};});
    assert.ok(Math.abs(footer.placeholder-footer.real)<=2,JSON.stringify(footer));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
