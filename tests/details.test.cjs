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
 // 2026-11-27：第 9 层以后的楼层先按预留高度占位（content-visibility:auto），空闲时、滚到附近才真排。预留的要和一句话的楼层排出来一样高：
 // 以前经典宽屏每层差 3px、1000px 以下（一列卡片）差 50px 上下、简洁差 43.5px（内边距没算）、手机差 38px，手机页脚差 30px；
 // 屏幕上方没画过的楼层一排好，正在看的内容（回复框、点楼号跳到的那一层）就跟着往上跳
 test(`${engine} 帖子页楼层和页脚的预留高度等于一句话的楼层、页脚实际排出来的高度（经典 / 简洁，宽屏 / 1000px 以下 / 800px 以下 / 手机）`,async()=>{
  const long=(mobile)=>{const html=P.postPage({mobile}),one=html.match(/<li class="content-item" id="3">[\s\S]*?<\/li>/)[0];return html.replace(one,one+Array.from({length:21},(_,i)=>one.replace('id="3"',`id="${i+4}"`).replace(/#3\b/g,"#"+(i+4))).join(""));};
  const slack=engine==="webkit"?4:2,failures=[];
  for(const layout of ["classic","simple"])for(const [label,options] of [["1440",{viewport:{width:1440,height:900},seed}],["900",{viewport:{width:900,height:900},seed}],["760",{viewport:{width:760,height:900},seed}],["手机",phone()]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...options,html:long(!!options.device),init:layout==="simple"?"try{localStorage.setItem('nsmax:post-layout','simple')}catch{}":""});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{
     const measure=e=>{const cv=getComputedStyle(e).contentVisibility,reserved=e.getBoundingClientRect().height;e.style.setProperty("content-visibility","visible","important");const real=e.getBoundingClientRect().height;e.style.removeProperty("content-visibility");return{cv,reserved,real};};
     return{layout:document.documentElement.dataset.nsmaxPostLayout,floor:measure([...document.querySelectorAll("#nsk-body-left ul.comments>li.content-item")].pop()),footer:measure(document.querySelector("body>footer"))};
    });
    assert.equal(s.layout,layout);
    for(const k of ["floor","footer"]){
     assert.equal(s[k].cv,"auto",`${layout} ${label} ${k}`);
     if(Math.abs(s[k].reserved-s[k].real)>slack)failures.push(`${layout} ${label} ${k} 预留 ${s[k].reserved} 实际 ${s[k].real}`);
    }
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  assert.deepEqual(failures,[]);
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

 test(`${engine} v1.9.86 加速与全端细节：缓存抽奖行零阻塞直出、drand 错峰对冲、手机端设置 16px/个人介绍链接/签到居中/抽奖卡片多行顶对齐/非列表隐藏版块条`, async () => {
  const mobileDev={...devices["iPhone 13"],viewport:{width:390,height:844}};
  // 1. 「抽奖」分类页：第 1 条待扫描时，下方已缓存的抽奖行立即 0ms 展示，不再队头阻塞
  {
   const seedCached=`localStorage.setItem("nsmax:special-posts",JSON.stringify({"1002":"lottery","1004":"lottery"}));localStorage.setItem("nsmax:special-checked",JSON.stringify({"1001":Date.now(),"1002":Date.now(),"1003":Date.now(),"1004":Date.now()}));localStorage.setItem("nsmax:lottery-index-at",String(Date.now()));`;
   const cat=await open(browser,"https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96",{
    html:P.searchPage({count:5}),viewport:{width:1280,height:900},seed,init:seedCached,
    beforeNavigate:async p=>{await p.route("**/post-1000-1",async r=>{await new Promise(done=>setTimeout(done,900));try{await r.fulfill({status:200,contentType:"text/html;charset=utf-8",body:P.postPage()});}catch{}});}
   });
   try{
    await ready(cat.page);
    const early=await cat.page.evaluate(()=>Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).map(li=>[li.querySelector(".post-title a").getAttribute("href"),li.getAttribute("data-nsmax-lottery"),getComputedStyle(li).display!=="none"]));
    assert.equal(early[0][1],"wait","首行仍在扫描中");
    assert.equal(early[2][2],true,"第 3 行已缓存抽奖帖立刻可见，不被首行阻塞");
    assert.equal(early[4][2],true,"第 5 行已缓存抽奖帖立刻可见，不被首行阻塞");
    assert.deepEqual(cat.errors,[]);
   }finally{await cat.context.close();}
  }
  // 2. 已开奖卡片：api.drand.sh 慢响应时 450ms 自动错峰对冲 cloudflare 镜像并快速出名单，且多行中奖「中奖」标签与首行胶囊顶对齐
  {
   const past=Date.now()-36e5;
   const lotFloors=Array.from({length:20},(_,i)=>({member_id:100+i,member_name:`win_${i}`,floor_id:i}));
   const lotApi={"/api/content/floor-data":Array.from({length:4},()=>({status:200,body:{success:true,data:lotFloors}}))};
   const lotPost=P.postPage({mobile:true}).replace("<h2>配置说明</h2>",`<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${past}&amp;count=12&amp;start=1&amp;duplicate=false">开奖</a></p><h2>配置说明</h2>`);
   const t0=Date.now();
   const lp=await open(browser,"https://www.nodeseek.com/post-1000-1",{
    html:lotPost,device:mobileDev,manager:{type:"userscripts",delay:10},seed,api:lotApi,
    external:{
     "api.drand.sh":async()=>{await new Promise(r=>setTimeout(r,4500));return {round:1,randomness:"e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6"};},
     "api2.drand.sh":async()=>{await new Promise(r=>setTimeout(r,4500));return {round:1,randomness:"e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6"};},
     "drand.cloudflare.com":()=>({round:1,randomness:"e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6"})
    }
   });
   try{
    await lp.page.waitForSelector(".nsk-post .nsmax-lottery-winner",{timeout:3500});
    assert.ok(Date.now()-t0<3200,`错峰对冲应远快于主节点 4.5s 阻塞：${Date.now()-t0}ms`);
    const align=await lp.page.evaluate(()=>{
     const fact=document.querySelector('.nsmax-lottery-fact[data-nsmax-fact="winners"]');
     const dt=fact.querySelector("dt").getBoundingClientRect();
     const first=fact.querySelector("a.nsmax-lottery-winner").getBoundingClientRect();
     const footerLi=document.querySelector("body > footer .contain li");
     return {dtMid:(dt.top+dt.bottom)/2,firstMid:(first.top+first.bottom)/2,footerTrans:footerLi?getComputedStyle(footerLi).transitionProperty:""};
    });
    assert.ok(Math.abs(align.dtMid-align.firstMid)<=3,`「中奖」标签与首行中奖胶囊齐平：${JSON.stringify(align)}`);
    assert.notEqual(align.footerTrans,"all","页脚 li 不再残留 transition: all");
    assert.deepEqual(lp.errors,[]);
   }finally{await lp.context.close();}
  }
  // 3. 手机端个人主页介绍链接不再泄露原生亮绿 #0dbc79，设置面板输入框 16px 不触发 iOS 缩放
  {
   const sp=await open(browser,"https://www.nodeseek.com/space/10#/general",{
    html:P.spaceGeneralPage('<p>主页链接：<a href="https://example.com/blog">我的博客</a></p>',{mobile:true}),
    device:mobileDev,manager:{type:"userscripts",delay:10},seed
   });
   try{
    await ready(sp.page);
    const linkColor=await sp.page.locator(".selector > .readme a").evaluate(e=>getComputedStyle(e).color);
    assert.notEqual(linkColor,"rgb(13, 188, 121)","手机端个人介绍链接不再是原生低对比度亮绿");
    await sp.page.locator("#nsk-head .nsmax-header-action[data-nsmax-own-header='settings']").click();
    await sp.page.waitForFunction(()=>!!document.querySelector("#nspp-settings")?.shadowRoot?.querySelector("dialog[open]"));
    const inputSizes=await sp.page.evaluate(()=>{
     const sr=document.querySelector("#nspp-settings").shadowRoot;
     return [...sr.querySelectorAll("input:not([type=checkbox]):not([type=file]),select,textarea")].map(el=>parseFloat(getComputedStyle(el).fontSize));
    });
    assert.ok(inputSizes.length>0&&inputSizes.every(fs=>fs>=16),`手机设置面板所有输入框字号 ≥ 16px：${JSON.stringify(inputSizes)}`);
    assert.deepEqual(sp.errors,[]);
   }finally{await sp.context.close();}
  }
  // 4. 手机端 /board 连续签到居中、/lucky 隐藏关键词按钮、/notification 隐藏顶部版块横条
  {
   const bd=await open(browser,"https://www.nodeseek.com/board",{html:P.boardRealPage({mobile:true}),device:mobileDev,manager:{type:"userscripts",delay:10},seed});
   try{
    await ready(bd.page);
    const st=await bd.page.locator(".nsmax-checkin-streak").evaluate(e=>({ai:getComputedStyle(e).alignItems,ta:getComputedStyle(e).textAlign}));
    assert.equal(st.ai,"center",JSON.stringify(st));
    assert.equal(st.ta,"center",JSON.stringify(st));
    assert.deepEqual(bd.errors,[]);
   }finally{await bd.context.close();}
   const lk=await open(browser,"https://www.nodeseek.com/lucky?mode=view",{html:P.luckyPage({view:true}),device:mobileDev,manager:{type:"userscripts",delay:10},seed});
   try{
    await ready(lk.page);
    const lkState=await lk.page.evaluate(()=>{
     const kw=document.querySelector('.nsmax-header-action[data-nsmax-own-header="keywords"]');
     const btn=document.querySelector(".sample-panel > form .pure-button");
     return {kwHidden:!kw||getComputedStyle(kw).display==="none",btnH:btn?Math.round(btn.getBoundingClientRect().height):0};
    });
    assert.equal(lkState.kwHidden,true,JSON.stringify(lkState));
    assert.ok(lkState.btnH>=44,JSON.stringify(lkState));
    assert.deepEqual(lk.errors,[]);
   }finally{await lk.context.close();}
   const nf=await open(browser,"https://www.nodeseek.com/notification#/atMe",{html:P.notificationPage({mobile:true}),device:mobileDev,manager:{type:"userscripts",delay:10},seed});
   try{
    await ready(nf.page);
    const navHidden=await nf.page.evaluate(()=>{const nav=document.querySelector("body > header > ul.mobile-nav");return !nav||getComputedStyle(nav).display==="none";});
    assert.equal(navHidden,true,"手机端通知页不再显示列表版块横条");
    assert.deepEqual(nf.errors,[]);
   }finally{await nf.context.close();}
  }
 });
 test(`${engine} v1.9.87 个人主页切标签与底部分页防抖：标签条零脱节、介绍到达即放开不卡 1.5s、底部分页零上跳、手机端同样稳定`,async()=>{
  const items=(prefix,count,base)=>Array.from({length:count},(_,i)=>`<div class="discussion-item" data-v-18f8c01b><a href="/post-${base+i}-1" data-v-18f8c01b><span data-v-18f8c01b>${prefix} ${i+1} — 测试标题</span><span style="color:rgb(255,152,152)" data-v-18f8c01b><svg class="iconpark-icon"><use href="#lock"></use></svg> 1</span></a><span></span></div>`).join("");
  const mkHtml=(opts={})=>P.spaceTopicsPage(opts).replace(
   /<div class="discussion-wrapper"[\s\S]*?<\/div><\/div><\/div><\/div>/,
   `<div class="discussion-wrapper" data-v-18f8c01b>${items("主题帖",15,4000)}</div></div><div><div class="nsk-pager"><span class="pager-pos pager-cur">1</span><a class="pager-pos" href="#/discussions/2">2</a><a class="pager-next" href="#/discussions/2">下一页</a></div></div></div></div>`
  );
  const infoApi={"/api/account/getInfo/10":[{status:200,body:{success:true,detail:{member_id:10,member_name:"Steve",rank:3,coin:1257,stardust:50,nPost:100,nComment:873,follows:12,fans:34,collectionCount:8,created_at:"2024-01-01T00:00:00Z",readme:"大家好，这是我的个人介绍。"}}}]};
  // 1. 桌面端：主题 → 介绍（异步填充 .readme）+ 底部「下一页」翻页 + Vue 原地复用节点翻页
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{viewport:{width:1440,height:900},seed,html:mkHtml(),api:infoApi});
   try{
    await ready(page);
    await page.waitForSelector('.selector > a.select-item[data-nsmax-tab="general"]:not([hidden])');
    await page.evaluate(()=>{
     const box=document.querySelector(".selector"),rightSide=box.querySelector(".selector-right-side");
     const mountGeneral=()=>{
      rightSide?.remove();
      box.querySelector(":scope > .discussion-wrapper")?.remove();
      box.querySelector(":scope > div[data-nsmax-pagerbox]")?.remove();
      box.querySelector(":scope > .readme")?.remove();
      const r=document.createElement("div");r.className="readme post-content";
      const inner=document.createElement("div");r.append(inner);box.append(r);
      setTimeout(()=>{inner.innerHTML="<p>大家好，这是我的个人介绍。</p>";},180);
     };
     const mountTopics=()=>{
      box.querySelector(":scope > .readme")?.remove();
      box.querySelector(":scope > .discussion-wrapper")?.remove();
      box.querySelector(":scope > div[data-nsmax-pagerbox]")?.remove();
      const w=document.createElement("div");w.className="discussion-wrapper";box.append(w);
      setTimeout(()=>{
       w.innerHTML=Array.from({length:15},(_,i)=>`<div class="discussion-item"><a href="/post-${6000+i}-1"><span>新主题 ${i+1}</span></a><span></span></div>`).join("");
       const pb=document.createElement("div");pb.innerHTML='<div class="nsk-pager"><span class="pager-pos pager-cur">1</span><a class="pager-pos" href="#/discussions/2">2</a><a class="pager-next" href="#/discussions/2">下一页</a></div>';
       box.append(pb);
      },180);
     };
     for(const tab of box.querySelectorAll(":scope > a.select-item")){
      tab.addEventListener("click",(e)=>{
       e.preventDefault();
       const h=tab.getAttribute("href");
       history.pushState(null,"",h);
       window.dispatchEvent(new HashChangeEvent("hashchange"));
       if(h==="#/general"||h==="#/info")mountGeneral();else mountTopics();
      });
     }
    });
    const t0=Date.now();
    await page.locator('.selector > a.select-item[data-nsmax-tab="general"]').click();
    await page.waitForTimeout(60);
    const midGeneral=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),br=box.getBoundingClientRect(),rm=box.querySelector(".readme");
     return {
      ac:getComputedStyle(box).alignContent,
      switching:document.documentElement.hasAttribute("data-nsmax-space-switching"),
      tabTops:[...box.querySelectorAll(":scope > a.select-item")].filter(t=>t.offsetWidth>0).map(t=>Math.round(t.getBoundingClientRect().top-br.top)),
      rmDisplay:rm?getComputedStyle(rm).display:"",
      rmTop:rm?Math.round(rm.getBoundingClientRect().top-br.top):-1,
      rmH:rm?Math.round(rm.getBoundingClientRect().height):0
     };
    });
    assert.match(midGeneral.ac,/^(?:flex|flow)-start$|^start$/,JSON.stringify(midGeneral));
    assert.equal(midGeneral.switching,true,JSON.stringify(midGeneral));
    assert.ok(midGeneral.tabTops.every(y=>Math.abs(y)<=1),`切介绍中标签条不脱节：${JSON.stringify(midGeneral)}`);
    assert.equal(midGeneral.rmDisplay,"block",JSON.stringify(midGeneral));
    assert.ok(Math.abs(midGeneral.rmTop-49)<=2&&midGeneral.rmH>=400,`加载中的介绍卡片紧贴标签条并保住高度：${JSON.stringify(midGeneral)}`);
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:900});
    const elapsed=Date.now()-t0;
    assert.ok(elapsed<900,`介绍到达后应立刻放开，不卡满 1.5s：${elapsed}ms`);
    const postGeneral=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),br=box.getBoundingClientRect(),rm=box.querySelector(".readme");
     return {
      minH:box.style.minHeight,
      tabTops:[...box.querySelectorAll(":scope > a.select-item")].filter(t=>t.offsetWidth>0).map(t=>Math.round(t.getBoundingClientRect().top-br.top)),
      rmTop:Math.round(rm.getBoundingClientRect().top-br.top),
      rmH:Math.round(rm.getBoundingClientRect().height),
      rmText:rm.textContent.trim()
     };
    });
    assert.equal(postGeneral.minH,"");
    assert.ok(postGeneral.tabTops.every(y=>Math.abs(y)<=1),JSON.stringify(postGeneral));
    assert.ok(Math.abs(postGeneral.rmTop-49)<=2&&postGeneral.rmH>40&&postGeneral.rmText.includes("个人介绍"),JSON.stringify(postGeneral));

    // 切回「主题」，再测底部「下一页」按钮：清空列表期间底部页码位置不动、卡片不塌缩
    await page.locator('.selector > a.select-item[data-nsmax-tab="discussions"]').click();
    await page.waitForFunction(()=>document.querySelectorAll(".selector .discussion-wrapper > .discussion-item").length===15&&!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:1200});
    const beforePager=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),br=box.getBoundingClientRect(),list=box.querySelector(".discussion-wrapper"),pg=box.querySelector("[data-nsmax-pagerbox]");
     box.querySelector(".nsk-pager a.pager-next").addEventListener("click",(e)=>{
      e.preventDefault();
      list.replaceChildren();
      setTimeout(()=>{
       list.innerHTML=Array.from({length:15},(_,i)=>`<div class="discussion-item"><a href="/post-${7000+i}-1"><span>第2页 主题 ${i+1}</span></a><span></span></div>`).join("");
      },220);
     });
     return {listH:Math.round(list.getBoundingClientRect().height),pagerTop:Math.round(pg.getBoundingClientRect().top-br.top)};
    });
    await page.locator(".selector .nsk-pager a.pager-next").click();
    await page.waitForTimeout(60);
    const midPager=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),br=box.getBoundingClientRect(),list=box.querySelector(".discussion-wrapper"),pg=box.querySelector("[data-nsmax-pagerbox]");
     return {
      switching:document.documentElement.hasAttribute("data-nsmax-space-switching"),
      tabTops:[...box.querySelectorAll(":scope > a.select-item")].filter(t=>t.offsetWidth>0).map(t=>Math.round(t.getBoundingClientRect().top-br.top)),
      listTop:Math.round(list.getBoundingClientRect().top-br.top),
      listH:Math.round(list.getBoundingClientRect().height),
      pagerTop:Math.round(pg.getBoundingClientRect().top-br.top),
      after:getComputedStyle(list,"::after").content
     };
    });
    assert.equal(midPager.switching,true,JSON.stringify(midPager));
    assert.ok(midPager.tabTops.every(y=>Math.abs(y)<=1),`点下一页时标签条不脱节：${JSON.stringify(midPager)}`);
    assert.ok(Math.abs(midPager.listH-beforePager.listH)<=2,`点下一页时列表卡片不塌缩：${JSON.stringify({beforePager,midPager})}`);
    assert.ok(Math.abs(midPager.pagerTop-beforePager.pagerTop)<=2,`点底部下一页时页码不往上跳：${JSON.stringify({beforePager,midPager})}`);
    assert.ok(!/还没有|暂无/.test(midPager.after),JSON.stringify(midPager));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:1000});

    // Vue 原地复用 DOM 节点（不删节点、只改 href 和文字）翻页也能在 900ms 内立刻放开
    await page.evaluate(()=>{
     const box=document.querySelector(".selector");
     box.querySelector(".nsk-pager a.pager-pos").addEventListener("click",(e)=>{
      e.preventDefault();
      setTimeout(()=>{
       const firstLink=box.querySelector(".discussion-wrapper .discussion-item a");
       firstLink.setAttribute("href","/post-8888-1");
       firstLink.querySelector("span").textContent="第3页 原地复用主题";
      },120);
     });
    });
    const tInPlace=Date.now();
    await page.locator(".selector .nsk-pager a.pager-pos").first().click();
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:900});
    assert.ok(Date.now()-tInPlace<900,"Vue 原地复用节点翻页也应立刻放开");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 2. 手机端 390px：主题 → 介绍零脱节、快速放开、无横向溢出
  {
   const mobileDev={...devices["iPhone 13"],viewport:{width:390,height:844}};
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{viewport:{width:390,height:844},device:mobileDev,seed,html:mkHtml({mobile:true}),api:infoApi});
   try{
    await ready(page);
    await page.waitForSelector('.selector > a.select-item[data-nsmax-tab="general"]:not([hidden])');
    await page.evaluate(()=>{
     const box=document.querySelector(".selector"),rightSide=box.querySelector(".selector-right-side");
     box.querySelector(':scope > a.select-item[data-nsmax-tab="general"]').addEventListener("click",(e)=>{
      e.preventDefault();
      history.pushState(null,"","#/general");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      rightSide?.remove();
      box.querySelector(":scope > div[data-nsmax-pagerbox]")?.remove();
      const r=document.createElement("div");r.className="readme post-content";
      const inner=document.createElement("div");r.append(inner);box.append(r);
      setTimeout(()=>{inner.innerHTML="<p>手机端个人介绍正文。</p>";},160);
     });
    });
    await page.locator('.selector > a.select-item[data-nsmax-tab="general"]').tap();
    await page.waitForTimeout(50);
    const mid=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),br=box.getBoundingClientRect(),rm=box.querySelector(".readme");
     return {
      tabTops:[...box.querySelectorAll(":scope > a.select-item")].filter(t=>t.offsetWidth>0).map(t=>Math.round(t.getBoundingClientRect().top-br.top)),
      rmTop:Math.round(rm.getBoundingClientRect().top-br.top)
     };
    });
    assert.ok(mid.tabTops.every(y=>Math.abs(y)<=1)&&Math.abs(mid.rmTop-49)<=2,JSON.stringify(mid));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:900});
    const end=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,rmH:Math.round(document.querySelector(".selector > .readme").getBoundingClientRect().height)}));
    assert.equal(end.overflow,false,JSON.stringify(end));
    assert.ok(end.rmH>40,JSON.stringify(end));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 个人主页切换防抖补漏：介绍排在列表上面时翻页 / 切标签卡片不撑高、页码不往下推；返回键切回上一页不塌不闪「还没有……」；以「NodeSeek」开头的介绍照常显示`,async()=>{
  const intro="很长的个人介绍。".repeat(120);
  const infoApi=(readme,delay=0)=>({"/api/account/getInfo/10":[{status:200,delay,body:{success:true,detail:{member_id:10,member_name:"Steve",rank:3,coin:1257,stardust:50,nPost:3,nComment:873,follows:12,fans:34,collectionCount:8,created_at:"2024-01-01T00:00:00Z",readme}}}]});
  const rows=(prefix,count,base)=>Array.from({length:count},(_,i)=>`<div class="discussion-item" data-v-18f8c01b><a href="/post-${base+i}-1" data-v-18f8c01b><span data-v-18f8c01b>${prefix} ${i+1}</span></a><span></span></div>`).join("");
  const pager='<div><div class="nsk-pager"><span class="pager-pos pager-cur">1</span><a class="pager-pos" href="#/discussions/2">2</a><a class="pager-next" href="#/discussions/2">下一页</a></div></div>';
  const desk={viewport:{width:1440,height:900},seed};
  // 1. .selector-right-side 结构（站点真实结构）里写了长介绍的人：介绍排在 3 条主题上面。点「下一页」时清空的列表只撑住自己原来的高度
  //    （以前量到的是介绍的高度，套给列表，列表反而从 147px 撑到 442px，页码往下推 300px）
  {
   const html=P.spaceTopicsPage().replace('<div class="readme">没有找到readme 🙄</div>',`<div class="readme post-content"><div><p>${intro}</p></div></div>`)
    .replace(/(<div class="discussion-wrapper" data-v-18f8c01b>)[\s\S]*?<\/div><\/div><\/div><\/div>/,`$1${rows("主题",3,4000)}</div>${pager}</div></div>`);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{...desk,html,api:infoApi(intro)});
   try{
    await ready(page);
    await page.waitForFunction(()=>{const rm=document.querySelector(".selector .readme");return rm&&rm.offsetHeight>200&&!rm.hasAttribute("data-nsmax-empty-readme");});
    const before=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),list=box.querySelector(".discussion-wrapper"),pg=box.querySelector(".nsk-pager");
     pg.querySelector("a.pager-next").addEventListener("click",(e)=>{
      e.preventDefault();
      history.pushState(null,"","#/discussions/2");
      Promise.resolve().then(()=>list.replaceChildren());
      setTimeout(()=>{list.innerHTML='<div class="discussion-item"><a href="/post-5000-1"><span>第2页 主题</span></a><span></span></div>';},300);
     });
     return {listH:Math.round(list.getBoundingClientRect().height),pagerTop:Math.round(pg.getBoundingClientRect().top-box.getBoundingClientRect().top)};
    });
    await page.locator(".selector .nsk-pager a.pager-next").click();
    await page.waitForTimeout(100);
    const mid=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),list=box.querySelector(".discussion-wrapper"),pg=box.querySelector(".nsk-pager");
     return {switching:document.documentElement.hasAttribute("data-nsmax-space-switching"),empty:!list.childElementCount,listH:Math.round(list.getBoundingClientRect().height),pagerTop:Math.round(pg.getBoundingClientRect().top-box.getBoundingClientRect().top)};
    });
    assert.equal(mid.switching,true,JSON.stringify(mid));
    assert.equal(mid.empty,true,JSON.stringify(mid));
    assert.ok(Math.abs(mid.listH-before.listH)<=2,`清空的列表只撑住自己原来的高度：${JSON.stringify({before,mid})}`);
    assert.ok(Math.abs(mid.pagerTop-before.pagerTop)<=2,`点下一页时页码不往下推：${JSON.stringify({before,mid})}`);
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:1200});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 2. 同样的结构在「概况」：介绍（长）和最近回帖（短）同时在，点「主题」时整块不变高（以前回帖卡片被撑成介绍那么高，整块长出 200 多 px）
  {
   const html=P.nativeSpacePage().replace('<div class="readme">没有找到readme 🙄</div>',`<div class="readme post-content"><div><p>${intro}</p></div></div>`);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/info",{...desk,html,api:infoApi(intro)});
   try{
    await ready(page);
    await page.waitForFunction(()=>{const rm=document.querySelector(".selector .readme");return rm&&rm.offsetHeight>200&&!rm.hasAttribute("data-nsmax-empty-readme")&&document.querySelector('.selector > a.select-item[data-nsmax-tab="discussions"]');});
    const before=await page.evaluate(()=>{
     const box=document.querySelector(".selector"),list=box.querySelector(".comments-list");
     box.querySelector(':scope > a.select-item[data-nsmax-tab="discussions"]').addEventListener("click",(e)=>{
      e.preventDefault();
      history.pushState(null,"","#/discussions");
      Promise.resolve().then(()=>list.replaceChildren());
      setTimeout(()=>{list.innerHTML='<div><a href="/post-4100-1">新主题</a><p>摘要</p></div>';},300);
     });
     return {boxH:Math.round(box.getBoundingClientRect().height),listH:Math.round(list.getBoundingClientRect().height)};
    });
    await page.locator('.selector > a.select-item[data-nsmax-tab="discussions"]').click();
    await page.waitForTimeout(100);
    const mid=await page.evaluate(()=>{const box=document.querySelector(".selector"),list=box.querySelector(".comments-list");return {switching:document.documentElement.hasAttribute("data-nsmax-space-switching"),boxH:Math.round(box.getBoundingClientRect().height),listH:Math.round(list.getBoundingClientRect().height)};});
    assert.equal(mid.switching,true,JSON.stringify(mid));
    assert.ok(Math.abs(mid.boxH-before.boxH)<=2,`切标签时整块不变高：${JSON.stringify({before,mid})}`);
    assert.ok(Math.abs(mid.listH-before.listH)<=2,`回帖卡片只撑住自己的高度：${JSON.stringify({before,mid})}`);
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching"),null,{timeout:1200});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 3. 返回键：从第 2 页按返回回到第 1 页，站点（Vue）在 popstate 之后清空列表、0.3 秒后再放新的。没有点击也要撑住：列表不塌、页码不往上跳、不闪「还没有……」
  {
   const html=P.spaceTopicsPage().replace(/(<div class="discussion-wrapper" data-v-18f8c01b>)[\s\S]*?<\/div><\/div><\/div><\/div>/,`$1${rows("主题帖",15,4000)}</div></div>${pager}</div>`);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{...desk,html,api:infoApi("")});
   try{
    await ready(page);
    await page.evaluate(()=>{
     const box=document.querySelector(".selector");
     window.addEventListener("popstate",()=>{
      const list=box.querySelector(".discussion-wrapper");
      Promise.resolve().then(()=>list.replaceChildren());
      setTimeout(()=>{list.innerHTML=Array.from({length:15},(_,i)=>`<div class="discussion-item"><a href="/post-${9000+i}-1"><span>返回后 ${i+1}</span></a><span></span></div>`).join("");},300);
     });
     history.pushState(null,"","#/discussions/2");
    });
    await page.waitForTimeout(200);
    const before=await page.evaluate(()=>{const box=document.querySelector(".selector"),list=box.querySelector(".discussion-wrapper"),pg=box.querySelector(".nsk-pager");return {listH:Math.round(list.getBoundingClientRect().height),pagerTop:Math.round(pg.getBoundingClientRect().top-box.getBoundingClientRect().top)};});
    const sampled=page.evaluate(()=>new Promise((resolve)=>{
     const box=document.querySelector(".selector"),out={listH:[],pagerTop:[],labels:new Set(),emptySeen:false},t0=performance.now();
     const tick=()=>{
      const list=box.querySelector(".discussion-wrapper"),pg=box.querySelector(".nsk-pager");
      out.listH.push(Math.round(list.getBoundingClientRect().height));
      out.pagerTop.push(Math.round(pg.getBoundingClientRect().top-box.getBoundingClientRect().top));
      if(!list.childElementCount)out.emptySeen=true;
      out.labels.add(getComputedStyle(list,"::after").content);
      if(performance.now()-t0<450)requestAnimationFrame(tick);
      else resolve({listH:[Math.min(...out.listH),Math.max(...out.listH)],pagerTop:[Math.min(...out.pagerTop),Math.max(...out.pagerTop)],labels:[...out.labels],emptySeen:out.emptySeen});
     };
     requestAnimationFrame(tick);
    }));
    await page.evaluate(()=>history.back());
    const s=await sampled;
    assert.equal(s.emptySeen,true,JSON.stringify(s));
    assert.ok(s.listH[0]>=before.listH-2,`按返回键时列表不塌：${JSON.stringify({before,s})}`);
    assert.ok(Math.abs(s.pagerTop[0]-before.pagerTop)<=2&&Math.abs(s.pagerTop[1]-before.pagerTop)<=2,`按返回键时页码不跳：${JSON.stringify({before,s})}`);
    assert.ok(s.labels.every(l=>!/还没有|暂无/.test(l)),`按返回键时不闪「还没有……」：${JSON.stringify(s)}`);
    await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-space-switching")&&!document.querySelector(".selector").style.minHeight,null,{timeout:1200});
    assert.equal(await page.evaluate(()=>location.hash),"#/discussions");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 4. 介绍以「NodeSeek」开头（「NodeSeek 老用户……」）是真写了：照常显示、停在「介绍」（以前当成站点占位，介绍藏掉、跳到「主题」）。
  //    接口晚回来时第一帧就要对；只有一个「NodeSeek」字样的水印仍按没写处理
  {
   const text="NodeSeek 老用户，喜欢折腾 VPS 和各种小鸡，欢迎私信交流。";
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/general",{...desk,html:P.spaceGeneralPage(`<p>${text}</p>`),api:infoApi(text,600)});
   try{
    await ready(page);
    const state=()=>page.evaluate(()=>{const rm=document.querySelector(".selector .readme"),tab=document.querySelector('.selector > a.select-item[data-nsmax-tab="general"]');return {hash:location.hash,rmDisplay:getComputedStyle(rm).display,empty:rm.hasAttribute("data-nsmax-empty-readme"),tab:!!tab&&tab.offsetWidth>0&&!tab.hidden,active:!!tab&&tab.classList.contains("active")};});
    const early=await state();
    assert.deepEqual(early,{hash:"#/general",rmDisplay:"block",empty:false,tab:true,active:true},`接口回来前：${JSON.stringify(early)}`);
    await page.waitForTimeout(900);
    const late=await state();
    assert.deepEqual(late,{hash:"#/general",rmDisplay:"block",empty:false,tab:true,active:true},`接口回来后：${JSON.stringify(late)}`);
    assert.ok((await page.locator(".selector .readme").innerText()).includes("NodeSeek 老用户"));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/general",{...desk,html:P.spaceGeneralPage("NodeSeek"),api:infoApi("",3000)});
   try{
    await ready(page);
    await page.waitForFunction(()=>location.hash==="#/discussions",null,{timeout:1500});
    const s=await page.evaluate(()=>{const rm=document.querySelector(".selector .readme"),tab=document.querySelector('.selector > a.select-item[data-nsmax-tab="general"]');return {rmDisplay:getComputedStyle(rm).display,empty:rm.hasAttribute("data-nsmax-empty-readme"),tab:!!tab&&tab.offsetWidth>0};});
    assert.deepEqual(s,{rmDisplay:"none",empty:true,tab:false},JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
