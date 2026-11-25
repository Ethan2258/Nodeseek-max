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
 test(`${engine} 手机主楼（2026-11-08 照原版）：头像名字下面一行是「楼主 时间」和「举报 引用 回复」胶囊，正文上面一条虚线，点赞一排一行平分；代码块不再空出一整行`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const r=e=>e.getBoundingClientRect(),head=r(document.querySelector(".nsk-post .nsmax-author-col")),meta=document.querySelector(".nsk-post .nsk-content-meta-info>div:not([class])"),ops=[...document.querySelectorAll(".nsk-post .nsmax-op-actions>a")].map(e=>r(e)),sig=r(document.querySelector(".nsk-post .signature")),body=r(document.querySelector(".nsk-post article.post-content")),pre=document.querySelector(".post-content .nsmax-code>pre"),copy=document.querySelector(".nsmax-code>[data-nspp-copy]"),items=[...document.querySelectorAll(".nsk-post .topic-actions>.menu-item")].map(e=>r(e));return{head,meta:r(meta),ops,sig,body,pre:r(pre).height,code:r(pre.querySelector("code")).top-r(pre).top,copy:r(copy),preTop:r(pre).top,items:items.map(i=>({w:Math.round(i.width),h:Math.round(i.height),top:Math.round(i.top)})),menu:r(document.querySelector(".nsk-post .topic-actions")),overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.ok(s.meta.top>=s.head.bottom-0.5&&s.meta.bottom<=s.body.top+0.5,`「楼主 时间」在作者栏下面、正文上面：${JSON.stringify(s)}`);
    assert.ok(Math.abs(s.meta.left-s.body.left)<1,"和正文左边线对齐");
    assert.equal(new Set(s.ops.map(o=>Math.round(o.top))).size,1,"三个按钮一行");assert.ok(s.ops.every(o=>o.top>=s.head.bottom-0.5&&o.bottom<=s.body.top+0.5&&o.height>=44),JSON.stringify(s));
    assert.ok(s.ops.every(o=>Math.abs((o.top+o.bottom)/2-(s.meta.top+s.meta.bottom)/2)<2),`和「楼主 时间」同一条中线：${JSON.stringify(s)}`);
    assert.ok(Math.abs(Math.max(...s.ops.map(o=>o.right))-s.body.right)<1,"靠右，和正文右边线对齐");
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector(".nsk-post article.post-content")).borderTopStyle),"dashed","正文上面一条虚线");
    assert.ok(s.copy.height>=43&&s.copy.width>=44,"复制按钮保留 44px 触控区");assert.ok(s.code<=46,JSON.stringify(s));assert.ok(s.copy.top-s.preTop<2,JSON.stringify(s));
    assert.equal(s.items.length,4);assert.equal(new Set(s.items.map(i=>i.top)).size,1,"点赞一排不折行");assert.ok(s.items.every(i=>i.h===36),JSON.stringify(s.items));
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
 test(`${engine} v1.9.83 帖子详情页等级限制标签与首页一致：移至标题前方渲染为 18px 浅红「Lv4」胶囊并对齐标题中线`,async()=>{
  const lock=` <span style="margin-left:5px;color: rgb(255 152 152);"><svg class="iconpark-icon" style="width: 14px;height: 14px;vertical-align: baseline;"><use href="#lock"></use></svg> <span style="font-size: 14px;font-family: sans-serif;">\n                            4\n                        </span></span>`;
  for(const options of [{viewport:{width:1440,height:900},seed},{...phone(),mobile:true}]){
   const html=P.postPage({mobile:!!options.mobile}).replace(/(class="post-title-link[^"]*">[^<]*<\/a>)/,`$1${lock}`);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,...options});
   try{
    await ready(page);
    await page.waitForSelector(".nsk-post > .post-title h1 > span[data-nsmax-lock][data-nsmax-lock-level='4']");
    const state=await page.evaluate(()=>{
     const h1=document.querySelector(".nsk-post > .post-title h1");
     const badge=h1.querySelector("span[data-nsmax-lock]");
     const link=h1.querySelector("a.post-title-link");
     const svg=badge.querySelector("svg");
     const inner=badge.querySelector("span");
     const cs=getComputedStyle(badge);
     const br=badge.getBoundingClientRect();
     const lr=link.getClientRects()[0];
     return {
      isFirst:h1.firstElementChild===badge,
      beforeLink:badge.nextElementSibling===link,
      level:badge.getAttribute("data-nsmax-lock-level"),
      title:badge.title,
      svgDisplay:getComputedStyle(svg).display,
      innerDisplay:inner?getComputedStyle(inner).display:null,
      afterContent:getComputedStyle(badge,"::after").content,
      height:Math.round(br.height),
      radius:parseFloat(cs.borderTopLeftRadius),
      centerDiff:Math.abs((br.top+br.bottom)/2-(lr.top+lr.bottom)/2)
     };
    });
    assert.equal(state.isFirst,true,JSON.stringify(state));
    assert.equal(state.beforeLink,true,JSON.stringify(state));
    assert.equal(state.level,"4");
    assert.equal(state.title,"等级 Lv4 及以上才能看");
    assert.equal(state.svgDisplay,"none");
    assert.equal(state.innerDisplay,"none");
    assert.match(state.afterContent,/^(?:"Lv4"|"Lv"\s*"4")$/);
    assert.equal(state.height,18,JSON.stringify(state));
    assert.ok(state.radius>=9,JSON.stringify(state));
    assert.ok(state.centerDiff<=4,JSON.stringify(state));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} v1.9.84 全站克制顺滑动效：高频控件统一微过渡、悬停卡进场与新接续条目渐显、列表行保持零过渡且减弱动态效果下全停`,async()=>{
  const list=await open(browser,"https://www.nodeseek.com/",{viewport:{width:1440,height:900},seed,html:P.listPage({count:6})});
  try{
   await ready(list.page);
   await list.page.waitForSelector(".nsmax-hot-slider",{state:"attached"});
   const s=await list.page.evaluate(()=>{
    const info=sel=>{const el=document.querySelector(sel);if(!el)return null;const cs=getComputedStyle(el);return {prop:cs.transitionProperty,dur:cs.transitionDuration,anim:cs.animationName};};
    const vt=[...document.querySelectorAll("style")].map(n=>n.textContent).join("\n");
    return {
     nav:info('#nsk-head ul.nav-menu > li > a:not([aria-current="page"]):not([data-nsmax-header-cat-on])'),
     action:info("#nsk-head .color-theme-switcher"),
     search:info("#nsk-head form.search-box"),
     sorter:info("#nsk-body-left > .post-list-controler > .sorter > a"),
     pager:info(".nsk-pager a.pager-pos"),
     row:info("#nsk-body-left ul.post-list > li.post-list-item"),
     hotSlider:info(".nsmax-hot-slider"),
     vtOk:vt.includes("animation-duration:160ms")&&vt.includes("html::view-transition{pointer-events:none}")
    };
   });
   for(const [k,v] of [["nav",s.nav],["action",s.action],["search",s.search],["sorter",s.sorter],["pager",s.pager],["hotSlider",s.hotSlider]]){
    assert.ok(v&&v.prop!=="none"&&!v.prop.includes("all"),`${k}: ${JSON.stringify(v)}`);
    assert.ok(v.dur.split(",").some(d=>parseFloat(d)>0&&parseFloat(d)<=0.25),`${k}: ${JSON.stringify(v)}`);
   }
   assert.ok(s.row&&(s.row.prop==="none"||s.row.dur==="0s"),`列表整行保持无背景过渡：${JSON.stringify(s.row)}`);
   assert.equal(s.vtOk,true);
   await list.page.locator("ul.post-list > li.post-list-item .info-author a").first().hover();
   await list.page.waitForSelector(".nsmax-person-pop");
   const popAnim=await list.page.evaluate(()=>getComputedStyle(document.querySelector(".nsmax-person-pop")).animationName);
   assert.equal(popAnim,"nsmax-sb-enter");
   const appendAnim=await list.page.evaluate(()=>{const li=document.querySelector("#nsk-body-left ul.post-list > li.post-list-item");li.setAttribute("data-nsmax-append-in","");return getComputedStyle(li).animationName;});
   assert.equal(appendAnim,"nsmax-append-in");
   await list.page.emulateMedia({reducedMotion:"reduce"});
   const reduced=await list.page.evaluate(()=>({
    navDur:getComputedStyle(document.querySelector('#nsk-head ul.nav-menu > li > a:not([aria-current="page"]):not([data-nsmax-header-cat-on])')).transitionDuration,
    popAnim:getComputedStyle(document.querySelector(".nsmax-person-pop")).animationName,
    appendAnim:getComputedStyle(document.querySelector("#nsk-body-left ul.post-list > li.post-list-item[data-nsmax-append-in]")).animationName
   }));
   assert.equal(reduced.navDur,"0s",JSON.stringify(reduced));
   assert.equal(reduced.popAnim,"none",JSON.stringify(reduced));
   assert.equal(reduced.appendAnim,"none",JSON.stringify(reduced));
   assert.deepEqual(list.errors,[]);
  }finally{await list.context.close();}
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{viewport:{width:1440,height:900},seed,html:P.postPage()});
  try{
   await ready(post.page);
   const ps=await post.page.evaluate(()=>({
    fastNav:getComputedStyle(document.querySelector("#fast-nav-button-group .nav-item-btn")).transitionDuration,
    commentMenu:getComputedStyle(document.querySelector("ul.comments .menu-item")).transitionDuration
   }));
   assert.ok(ps.fastNav.split(",").some(d=>parseFloat(d)>0&&parseFloat(d)<=0.2),JSON.stringify(ps));
   assert.ok(ps.commentMenu.includes("0.12s"),JSON.stringify(ps));
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
 });
 test(`${engine} v1.9.85 全站细节巡检：手机标题徽章齐平、窄屏通知零跳动、表单与搜索浮层过渡统一、未定义变量修复、设置页标签不下沉且抽奖无障碍与减弱动态生效`,async()=>{
  // 1. 手机端 390px 帖子标题里的「精华」「Lv4」「已回复」统一 18px 顶对齐到首行中线，.nsmax-tg 基础底色生效
  const lock=` <span style="margin-left:5px;color: rgb(255 152 152);"><svg class="iconpark-icon" style="width: 14px;height: 14px;vertical-align: baseline;"><use href="#lock"></use></svg> <span style="font-size: 14px;font-family: sans-serif;">4</span></span>`;
  const mobileHtml=P.postPage({mobile:true,award:true})
   .replace(/(class="post-title-link[^"]*">[^<]*<\/a>)/,`$1${lock}`);
  const repliedSeed={...seed,"nspp:state:www.nodeseek.com:sb-my-replies":{"posts:1":{1000:[3]},"joined:1":{},"posts:1:synced":Date.now(),"posts:1:done":true}};
  const mob=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(390),seed:repliedSeed,html:mobileHtml});
  try{
   await ready(mob.page);
   await mob.page.waitForSelector(".nsk-post > .post-title h1 > span[data-nsmax-lock][data-nsmax-lock-level='4']");
   await mob.page.waitForSelector(".nsk-post > .post-title h1 > .nsmax-replied-badge");
   const m=await mob.page.evaluate(()=>{
    const h1=document.querySelector(".nsk-post > .post-title h1");
    const lockEl=h1.querySelector("span[data-nsmax-lock]");
    const repEl=h1.querySelector(".nsmax-replied-badge");
    const linkEl=h1.querySelector("a.post-title-link");
    const tg=document.createElement("span");
    tg.className="nsmax-tg";
    document.body.append(tg);
    const tgBg=getComputedStyle(tg).backgroundColor;
    tg.remove();
    const lcs=getComputedStyle(lockEl),rcs=getComputedStyle(repEl),bcs=getComputedStyle(h1,"::before");
    const lr=lockEl.getBoundingClientRect(),rr=repEl.getBoundingClientRect(),tr=linkEl.getClientRects()[0];
    return {
     lock:{h:Math.round(lr.height),va:lcs.verticalAlign,mt:parseFloat(lcs.marginTop),mid:(lr.top+lr.bottom)/2},
     replied:{h:Math.round(rr.height),fs:rcs.fontSize,va:rcs.verticalAlign,mt:parseFloat(rcs.marginTop),mid:(rr.top+rr.bottom)/2},
     award:{content:bcs.content,h:parseFloat(bcs.height),va:bcs.verticalAlign,mt:parseFloat(bcs.marginTop)},
     linkMid:(tr.top+tr.bottom)/2,
     tgBg
    };
   });
   assert.equal(m.lock.h,18,JSON.stringify(m));
   assert.equal(m.lock.va,"top",JSON.stringify(m));
   assert.equal(m.replied.h,18,JSON.stringify(m));
   assert.equal(m.replied.fs,"11px",JSON.stringify(m));
   assert.equal(m.replied.va,"top",JSON.stringify(m));
   assert.equal(m.award.h,18,JSON.stringify(m));
   assert.equal(m.award.va,"top",JSON.stringify(m));
   assert.ok(Math.abs(m.award.mt-m.lock.mt)<=0.5,JSON.stringify(m));
   assert.ok(Math.abs(m.replied.mt-m.lock.mt)<=0.5,JSON.stringify(m));
   assert.ok(Math.abs(m.replied.mid-m.lock.mid)<=1.5,JSON.stringify(m));
   assert.ok(Math.abs(m.replied.mid-m.linkMid)<=4,JSON.stringify(m));
   assert.ok(m.tgBg&&m.tgBg!=="rgba(0, 0, 0, 0)"&&m.tgBg!=="transparent",`签名 TG 胶囊底色生效：${m.tgBg}`);
   assert.deepEqual(mob.errors,[]);
  }finally{await mob.context.close();}
  // 2. 窄桌端 820px 通知页：未读数到达时保持两行稳定、不产生整页跳动（CLS < 0.01）
  const clsInit="window.__shift=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__shift+=e.value}).observe({type:'layout-shift',buffered:true});";
  const notif=await open(browser,"https://www.nodeseek.com/notification#/atMe",{viewport:{width:820,height:900},seed,init:clsInit,html:P.notificationPage({})});
  try{
   await ready(notif.page);
   await notif.page.waitForSelector(".nspp-messages-top .nsmax-notice-tools > input");
   await notif.page.waitForFunction(()=>[...document.querySelectorAll(".nsmax-message-tabs .nspp-messages-count")].filter(e=>!e.hidden&&e.textContent).length===3);
   await notif.page.waitForTimeout(300);
   const nr=await notif.page.evaluate(()=>{
    const top=document.querySelector(".nspp-messages-top"),tabs=top.querySelector(".nsmax-message-tabs"),input=top.querySelector(".nsmax-notice-tools > input");
    const tb=tabs.getBoundingClientRect(),ib=input.getBoundingClientRect(),ics=getComputedStyle(input);
    return {shift:window.__shift,h:top.offsetHeight,tabs:[tabs.scrollWidth,tabs.clientWidth],below:ib.top>=tb.bottom-1,inputW:ib.width,inputProp:ics.transitionProperty,inputDur:ics.transitionDuration};
   });
   assert.equal(nr.tabs[0],nr.tabs[1],JSON.stringify(nr));
   assert.ok(nr.below&&nr.inputW>200&&Math.abs(nr.h-99)<=2,JSON.stringify(nr));
   if(engine==="chromium")assert.ok(nr.shift<0.01,`820px 通知页 CLS ${nr.shift}`);
   assert.ok(nr.inputProp.includes("border-color")&&!nr.inputProp.includes("all")&&nr.inputDur.includes("0.14s"),JSON.stringify(nr));
   assert.deepEqual(notif.errors,[]);
  }finally{await notif.context.close();}
  // 3. 表单聚焦过渡、设置面板标签不下沉、抽奖展开 aria-expanded 与减弱动态下跳过平滑滚动
  const future=Date.now()+864e5,past=Date.now()-36e5;
  const lotFloors=Array.from({length:18},(_,i)=>({member_id:100+i,member_name:`u${i}`,floor_id:i}));
  const lotApi={"/api/content/floor-data":Array.from({length:4},()=>({status:200,body:{success:true,data:lotFloors}}))};
  const lotPost=P.postPage({editorMode:"edit-discussion"}).replace("<h2>配置说明</h2>",`<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${future}&amp;count=1&amp;start=1&amp;duplicate=false">开奖</a></p><h2>配置说明</h2>`);
  const lp=await open(browser,"https://www.nodeseek.com/post-1000-1",{viewport:{width:1440,height:900},seed,html:lotPost,api:lotApi});
  try{
   await ready(lp.page);
   await lp.page.waitForSelector(".nsk-post .nsmax-lottery-join");
   const ui=await lp.page.evaluate(()=>{
    const sel=document.querySelector("#rank"),ta=document.querySelector(".md-editor .nsmax-editor-surface > :is(textarea, [data-nsmax-editor-pane])"),own=document.querySelector(".nsmax-owner-only");
    const info=el=>el&&{prop:getComputedStyle(el).transitionProperty,dur:getComputedStyle(el).transitionDuration};
    return {sel:info(sel),ta:info(ta),own:info(own)};
   });
   for(const [k,v] of [["sel",ui.sel],["ta",ui.ta],["own",ui.own]]){
    assert.ok(v&&v.prop.includes("border-color")&&!v.prop.includes("all")&&v.dur.includes("0.14s"),`${k}: ${JSON.stringify(v)}`);
   }
   // 打开设置面板：确认 .tab 不被通用 :active 规则压低，.link 具备柔和过渡
   await lp.page.getByRole("button",{name:"NodeSeek Max 设置",exact:true}).click();
   await lp.page.waitForFunction(()=>!!document.querySelector("#nspp-settings")?.shadowRoot?.querySelector("dialog[open]"));
   const setInfo=await lp.page.evaluate(()=>{
    const sr=document.querySelector("#nspp-settings").shadowRoot;
    const css=[...sr.querySelectorAll("style")].map(s=>s.textContent).join("\n");
    const link=sr.querySelector(".link");
    return {hasGlobalBtnActive:/(?:^|[},])button:not\(:disabled\):active/.test(css),linkProp:getComputedStyle(link).transitionProperty,linkDur:getComputedStyle(link).transitionDuration};
   });
   assert.equal(setInfo.hasGlobalBtnActive,false,JSON.stringify(setInfo));
   assert.ok(setInfo.linkProp.includes("color")&&setInfo.linkDur.includes("0.14s"),JSON.stringify(setInfo));
   await lp.page.locator("#nspp-settings").getByRole("button",{name:"关闭"}).click();
   // 点击「回复参与」：正常模式下平滑滚，开启 prefers-reduced-motion 后改为 instant
   await lp.page.evaluate(()=>{window.__scrolls=[];const orig=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(arg){window.__scrolls.push(arg?.behavior??null);return orig.apply(this,arguments);};});
   await lp.page.locator(".nsk-post .nsmax-lottery-join").click();
   await lp.page.emulateMedia({reducedMotion:"reduce"});
   await lp.page.locator(".nsk-post .nsmax-lottery-join").click();
   assert.deepEqual(await lp.page.evaluate(()=>window.__scrolls),["smooth","instant"]);
   assert.deepEqual(lp.errors,[]);
  }finally{await lp.context.close();}
  // 4. 超过 12 位中奖者的折叠按钮带 aria-expanded 并随展开/收起同步
  const manyPost=P.postPage().replace("<h2>配置说明</h2>",`<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${past}&amp;count=15&amp;start=1&amp;duplicate=false">开奖</a></p><h2>配置说明</h2>`);
  const mp=await open(browser,"https://www.nodeseek.com/post-1000-1",{viewport:{width:1440,height:900},seed,html:manyPost,api:lotApi,external:{"api.drand.sh":()=>({round:1,randomness:"e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6"})}});
  try{
   await ready(mp.page);
   const btn=mp.page.locator(".nsk-post .nsmax-lottery-winners-toggle");
   await btn.waitFor({state:"visible",timeout:8000});
   assert.equal(await btn.getAttribute("aria-expanded"),"false");
   await btn.click();
   assert.equal(await btn.getAttribute("aria-expanded"),"true");
   await btn.click();
   assert.equal(await btn.getAttribute("aria-expanded"),"false");
   assert.deepEqual(mp.errors,[]);
  }finally{await mp.context.close();}
 });
}
