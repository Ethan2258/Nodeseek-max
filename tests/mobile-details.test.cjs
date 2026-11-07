"use strict";
// 手机细节回归（2026-10-31）：页码、列表行、评论楼层、回复工具条、页脚、页面边距、私信列表、菜单，以及和 sb.sb 圆角手机版对齐的尺寸
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const phone=(width=390,height=844)=>({viewport:{width,height},device:{...devices["iPhone 13"],viewport:{width,height}},seed});
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
const center=r=>r.top+r.height/2;
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 手机旧评论：40 天和跨年完整时间戳可换行，操作仍为单行且保留 44px 点击区`,async()=>{
  for(const width of [390,360])for(const days of [40,400]){
   const created=new Date(Date.now()-days*864e5).toISOString();
   const html=P.postPage({mobile:true}).replaceAll("2026-10-03T04:00:00.000Z",created).replaceAll("2026-10-03 12:00:00",created);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html});
   try{
    await ready(page);
    const state=await page.evaluate(()=>{
     const li=document.querySelector("ul.comments>li.content-item"),head=li.querySelector(".nsmax-author-col").getBoundingClientRect(),body=li.querySelector("article.post-content").getBoundingClientRect(),menu=li.querySelector(".comment-menu"),time=li.querySelector(".date-created time");
     return{text:time.textContent,title:time.title,stamp:time.dateTime,menuHeight:menu.getBoundingClientRect().height,buttons:[...menu.children].map(e=>e.getBoundingClientRect().height),gap:body.top-head.bottom,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.match(state.text,/\d{4}[-/]\d{2}[-/]\d{2}.*\d{2}:\d{2}/);
    assert.equal(state.stamp,created);
    assert.equal(state.menuHeight,44,JSON.stringify({width,days,...state}));
    assert.ok(state.buttons.every(height=>height>=44));
    assert.ok(state.gap<70,JSON.stringify({width,days,...state}));
    assert.equal(state.overflow,false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机页码：标记省掉的页码不显示，帖子底部只有 3 页时不会出现两个 3`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{
   await ready(page);
   const pagers=await page.evaluate(()=>[...document.querySelectorAll("#nsk-body-left .nsk-pager")].map(p=>({skip:[...p.querySelectorAll("[data-nsmax-page-skip]")].filter(e=>e.getClientRects().length).length,pages:[...p.querySelectorAll(".pager-pos")].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim())})));
   assert.ok(pagers.length>0);
   for(const p of pagers){assert.equal(p.skip,0,JSON.stringify(pagers));assert.equal(new Set(p.pages).size,p.pages.length,JSON.stringify(pagers));}
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机列表：信息照 sb.sb 隔 10px，放不下整项换行，名字和时间都不截短`,async()=>{
  for(const width of [390,360,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(width),html:P.listPage({mobile:true})});
   try{
    await ready(page);
    const rows=await page.evaluate(()=>[...document.querySelectorAll(".post-list-item .post-meta")].map(m=>{const r=m.getBoundingClientRect(),t=m.querySelector(".info-last-comment-time").getBoundingClientRect(),c=getComputedStyle(m);return{gap:c.columnGap+"/"+c.rowGap,wrap:c.flexWrap,timeInside:t.right<=r.right+0.5&&t.width>20,cut:[...m.querySelectorAll("a,span")].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=="visible").length};}));
    assert.ok(rows.length>=6);
    for(const row of rows){assert.equal(row.gap,"10px/10px",JSON.stringify(row));assert.equal(row.wrap,"wrap");assert.ok(row.timeInside,JSON.stringify(rows));assert.equal(row.cut,0,`${width}px 名字不截短：${JSON.stringify(rows)}`);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机楼层卡片（2026-11-07 重做）：时间在作者栏名字下面，楼号右上角，正文紧跟作者栏，五个操作胶囊在正文下面靠右一行排下`,async()=>{
  for(const width of [390,320]){
   // 此项检查相对时间的布局，日期随运行时间生成，避免固定日期在 30 天后变成长时间戳。
   const created=new Date(Date.now()-2*36e5).toISOString();
   const html=P.postPage({mobile:true}).replaceAll("2026-10-03T04:00:00.000Z",created).replaceAll("2026-10-03 12:00:00",created);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const li=document.querySelector("ul.comments>li.content-item"),r=e=>e.getBoundingClientRect().toJSON();const items=[...li.querySelectorAll(".comment-menu>.menu-item")].filter(e=>e.getClientRects().length);return{li:r(li),head:r(li.querySelector(".nsmax-author-col")),name:r(li.querySelector(".nsmax-author-name")),avatar:r(li.querySelector(".nsmax-author-avatar")),time:r(li.querySelector(".nsk-content-meta-info>div:not([class])")),floor:r(li.querySelector(".floor-link")),body:r(li.querySelector("article.post-content")),items:items.map(r),order:items.map(e=>e.dataset.nsmaxAction),pill:items.map(e=>{const c=getComputedStyle(e,"::after");return c.boxSizing==="border-box"?parseFloat(c.height):parseFloat(c.height)+parseFloat(c.borderTopWidth)*2;})};});
    assert.ok(s.time.top>=s.head.top&&s.time.bottom<=s.head.bottom+0.5,`时间在作者栏里：${JSON.stringify(s)}`);
    assert.ok(Math.abs(s.time.left-s.name.left)<1,"时间和名字左对齐");assert.ok(s.time.top>=s.name.top+10,"时间在名字下面");
    assert.ok(s.floor.top>=s.head.top&&s.floor.bottom<=s.head.bottom+1&&s.floor.right<=s.li.right,"楼号在作者栏右上角");
    assert.ok(Math.abs(s.body.top-s.head.bottom)<1,"正文紧跟作者栏");
    assert.equal(new Set(s.items.map(i=>Math.round(i.top))).size,1,`${width}px 五个操作排一行：${JSON.stringify(s.items)}`);
    assert.ok(s.items.every(i=>i.top>=s.body.bottom&&i.height>=44),"在正文下面，点按区 44px");
    assert.ok(s.pill.every(h=>Math.abs(h-30)<1),"看得见的胶囊 30px");
    assert.ok(Math.abs(s.items.at(-1).right-s.body.right)<1,"靠右，和正文右边线对齐");assert.equal(s.order.at(-1),"reply","「回复」在最右边");
    if(width>=360)assert.ok(s.head.bottom-s.head.top<=66,`名字和小标一行放得下时作者栏只高 65px：${JSON.stringify(s)}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机回复工具条：「只看楼主 直达底部 简洁模式」照 sb.sb 是 31px 细线胶囊，标题栏独立成卡片，320px 也排在一行`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const b=[...document.querySelectorAll("#nsk-body-left :is(.nsmax-owner-only,.nsmax-jump-reply,.nsmax-layout-toggle)")].filter(e=>e.getClientRects().length);const title=document.querySelector(".nsmax-reply-title"),head=title.parentElement.getBoundingClientRect(),first=document.querySelector("ul.comments>li").getBoundingClientRect();return{head:head.height,gap:first.top-head.bottom,headRadius:getComputedStyle(title.parentElement).borderBottomLeftRadius,size:b.map(e=>getComputedStyle(e).fontSize),pillHeight:b.map(e=>{const c=getComputedStyle(e,"::before");return parseFloat(c.height)+parseFloat(c.borderTopWidth)*2;}),title:title.getBoundingClientRect().height,tops:b.map(e=>Math.round(e.getBoundingClientRect().top)),heights:b.map(e=>e.getBoundingClientRect().height),border:b.map(e=>getComputedStyle(e).borderTopWidth),pill:b.map(e=>getComputedStyle(e,"::before").borderTopLeftRadius)};});
    assert.equal(s.tops.length,3);assert.equal(new Set(s.tops).size,1,JSON.stringify(s));assert.ok(s.title<=24,"标题不折行");
    assert.ok(s.heights.every(h=>h>=44),"保留 44px 点击区");assert.deepEqual(s.border,["0px","0px","0px"]);assert.ok(s.pill.every(r=>parseFloat(r)>=14),JSON.stringify(s));
    assert.ok(Math.abs(s.head-55)<1.5,`标题栏和 sb.sb .reply-head 一样高 55px：${JSON.stringify(s)}`);assert.ok(Math.abs(s.gap-10)<1,"和第一条回复隔 10px");assert.ok(parseFloat(s.headRadius)>=10,"标题栏是独立圆角卡片");
    assert.deepEqual(s.size,["12px","12px","12px"]);assert.ok(s.pillHeight.every(h=>Math.abs(h-31)<1.5),JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机页脚：每组链接一行，整块不超过 460px（以前约 700px），链接仍有 32px 点击高度`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true})});
  try{
   await ready(page);
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(100);
   const s=await page.evaluate(()=>{const f=document.querySelector("body>footer");const links=[...f.querySelectorAll(".contain>.col:not(.social) a")].filter(a=>a.getClientRects().length);return{height:f.getBoundingClientRect().height,count:links.length,small:links.filter(a=>a.getBoundingClientRect().height<32).length,outside:links.filter(a=>a.getBoundingClientRect().right>innerWidth).length,heads:[...f.querySelectorAll(".group-head-link")].filter(h=>h.getClientRects().length).map(h=>{const r=h.getBoundingClientRect(),a=h.parentElement.querySelector("a").getBoundingClientRect();return Math.abs(center(r)-center(a))<3&&a.left>r.right;})};
    function center(r){return r.top+r.height/2;}});
   assert.ok(s.height<460,JSON.stringify(s));assert.ok(s.count>=14);assert.equal(s.small,0);assert.equal(s.outside,0);assert.ok(s.heads.length>=5&&s.heads.every(Boolean),JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机设置页、关注页和列表页卡片对齐两边 12px`,async()=>{
  for(const [url,render,selector] of [["/setting",P.settingPage,"#user-setting-panel .selector > *:not([style*='none'])"],["/fans?type=follow",P.fansPage,".member-list .fans-switcher"],["/",P.listPage,"#nsk-body-left"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...phone(),html:render({mobile:true})});
   try{
    await ready(page);
    const box=await page.evaluate(s=>{const e=[...document.querySelectorAll(s)].find(e=>e.getClientRects().length&&e.getBoundingClientRect().width>200);const r=e.getBoundingClientRect();return{left:r.left,right:innerWidth-r.right,top:r.top};},selector);
    assert.ok(Math.abs(box.left-12)<1&&Math.abs(box.right-12)<1,`${url} ${JSON.stringify(box)}`);assert.ok(box.top<=114,`${url} ${JSON.stringify(box)}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机私信列表：有未读圆点的行和其他行时间右对齐`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/message?mode=list",{...phone(),html:P.nativeMessagePage({mobile:true})});
  try{
   await ready(page);await page.waitForSelector(".nspp-messages-peer .nspp-messages-unread");
   const s=await page.evaluate(()=>[...document.querySelectorAll(".nspp-messages-peer")].map(p=>({time:p.querySelector("time").getBoundingClientRect().right,unread:!!p.querySelector(".nspp-messages-unread"),snippet:p.querySelector(".nspp-messages-snippet").getBoundingClientRect().right,dot:p.querySelector(".nspp-messages-unread")?.getBoundingClientRect().left})));
   assert.ok(s.some(r=>r.unread)&&s.some(r=>!r.unread));
   assert.ok(Math.max(...s.map(r=>r.time))-Math.min(...s.map(r=>r.time))<1,JSON.stringify(s));
   for(const r of s.filter(r=>r.unread))assert.ok(r.dot>=r.time-12,JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机菜单：照 sb.sb 一行一个版块，两边 16px，每行 44px 高`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(width),html:P.listPage({mobile:true})});
   try{
    await ready(page);await page.getByRole("button",{name:"打开菜单",exact:true}).tap();
    const drawer=page.locator("#left-slide-panel");await page.waitForFunction(()=>document.getElementById("left-slide-panel").getBoundingClientRect().left>=-1);
    const s=await drawer.evaluate(el=>{const box=el.getBoundingClientRect(),links=[...el.querySelector(".category-mobile>div").children].filter(a=>a.getClientRects().length).map(a=>a.getBoundingClientRect());return{lefts:[...new Set(links.map(r=>Math.round(r.left-box.left)))],widths:[...new Set(links.map(r=>Math.round(r.width)))],title:el.querySelector(".nsmax-drawer-head strong").getBoundingClientRect().left-box.left,stacked:links.every((r,i)=>!i||r.top>=links[i-1].bottom-0.5),overflow:el.scrollWidth>el.clientWidth+1,small:links.filter(r=>r.height<44).length};});
    assert.deepEqual(s.lefts,[16],JSON.stringify(s));assert.equal(s.widths.length,1,JSON.stringify(s));assert.ok(s.stacked,JSON.stringify(s));assert.ok(Math.abs(s.title-16)<1,JSON.stringify(s));
    assert.equal(s.overflow,false);assert.equal(s.small,0);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机顶栏、列表工具条和主楼按钮的尺寸照 sb.sb`,async()=>{
  for(const width of [390,320]){
   const list=await open(browser,"https://www.nodeseek.com/",{...phone(width),html:P.listPage({mobile:true})});
   try{
    await ready(list.page);
    const s=await list.page.evaluate(()=>{const bar=document.querySelector(".post-list-controler"),filter=bar.querySelector(".nsmax-mobile-filter"),tab=bar.querySelector(".sorter>a"),fb=getComputedStyle(filter,"::before"),hb=getComputedStyle([...document.querySelectorAll("#nsk-head .nsmax-header-action")].find(e=>e.getClientRects().length),"::before");return{bar:bar.getBoundingClientRect().height,tabText:tab.getBoundingClientRect().left+parseFloat(getComputedStyle(tab).paddingLeft)-bar.getBoundingClientRect().left,filter:filter.getBoundingClientRect().toJSON(),filterPill:parseFloat(fb.height)+parseFloat(fb.borderTopWidth)*2,filterIcon:!!filter.querySelector("svg")?.getClientRects().length,head:parseFloat(hb.height)+parseFloat(hb.borderTopWidth)*2,right:bar.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.ok(Math.abs(s.bar-50.5)<1,JSON.stringify(s));assert.ok(Math.abs(s.tabText-19)<1,"第一个标签的字离卡片边 19px（14px 内边距 + 4px + 1px 边）");
    assert.ok(Math.abs(s.filterPill-31)<1.5&&s.filter.height>=44&&!s.filterIcon,JSON.stringify(s));assert.ok(s.filter.right<=s.right-14,JSON.stringify(s));
    assert.ok(Math.abs(s.head-34)<1,`顶栏圆钮 34px：${JSON.stringify(s)}`);assert.equal(s.overflow,false);assert.deepEqual(list.errors,[]);
   }finally{await list.context.close();}
  }
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{
   await ready(post.page);
   const s=await post.page.evaluate(()=>{const items=[...document.querySelectorAll(".nsk-post .comment-menu.topic-actions>.menu-item")].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()),body=document.querySelector(".nsk-post article.post-content").getBoundingClientRect();return{widths:items.map(r=>Math.round(r.width)),first:items[0].left-body.left,gaps:items.slice(1).map((r,i)=>Math.round(r.left-items[i].right)),title:document.querySelector(".nsk-post>.post-title").getBoundingClientRect().height,author:document.querySelector(".nsk-post .nsmax-author-col").getBoundingClientRect().height};});
   // 2026-11-07 重做：点赞一排是一行四个平分的胶囊（以前照 sb.sb 是 66px 宽的两行小方块）；作者栏多了一行时间，高 65px
   assert.ok(s.widths.length===4&&Math.max(...s.widths)-Math.min(...s.widths)<=1,JSON.stringify(s));assert.ok(Math.abs(s.first)<1,"从正文左边线开始");assert.deepEqual(s.gaps,[8,8,8]);
   assert.ok(Math.abs(s.title-83.5)<1.5&&Math.abs(s.author-65)<1.5,JSON.stringify(s));assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
 });
 test(`${engine} 手机帖子页细节照 sb.sb：面包屑 18px、奇数层作者栏深一档、楼主标签和楼号字号、主楼按钮淡灰、列表标题 14.5px`,async()=>{
  for(const dark of [false,true]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true,dark}),colorScheme:dark?"dark":"light"});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const c=(e,p)=>getComputedStyle(e,p),q=x=>document.querySelector(x),li=[...document.querySelectorAll("ul.comments>li.content-item")],probe=document.createElement("i");probe.style.color="var(--text-disabled)";document.body.append(probe);const disabled=c(probe).color;probe.remove();const action=q(".nsk-post .comment-menu.topic-actions>.menu-item:not(.clicked)");return{crumb:c(q(".nsk-post>.nsmax-crumb")).paddingLeft,odd:c(li[0].querySelector(".nsmax-author-col")).backgroundColor,oddBody:c(li[0]).backgroundColor,even:c(li[1].querySelector(".nsmax-author-col")).backgroundColor,tag:c(q(".nsk-post .role-tag.is-poster")).fontSize,floor:c(li[0].querySelector(".floor-link")).fontSize,time:c(q(".nsk-post .nsk-content-meta-info time")).fontSize,action:c(action).color,disabled};});
    assert.equal(s.crumb,"18px");assert.notEqual(s.odd,s.oddBody,JSON.stringify(s));assert.equal(s.even,"rgba(0, 0, 0, 0)");
    assert.equal(s.tag,"10.5px");assert.equal(s.floor,"12px");assert.equal(s.time,"12.5px");assert.equal(s.action,s.disabled,JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  const list=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true})});
  try{await ready(list.page);assert.equal(await list.page.locator(".post-list-item .post-title").first().evaluate(e=>getComputedStyle(e).fontSize),"14.5px");}finally{await list.context.close();}
 });
 test(`${engine} 手机签到排行榜名字和注册页单选、勾选都有 44px 点击区`,async()=>{
  const board=await open(browser,"https://www.nodeseek.com/board",{...phone(),html:P.boardRealPage({})});
  try{
   await ready(board.page);
   const s=await board.page.evaluate(()=>[...document.querySelectorAll(".board .rank-row")].map(r=>({link:r.querySelector(".member-name a").getBoundingClientRect().height,row:r.getBoundingClientRect().height})));
   assert.ok(s.length>=10&&s.every(r=>r.link>=44&&r.row<=46),JSON.stringify(s));
   const href=await board.page.locator(".board .rank-row .member-name a").first().evaluate(a=>{a.scrollIntoView({block:"center",behavior:"instant"});const r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width-4,r.top+3);return hit?.closest("a")?.getAttribute("href");});
   assert.equal(href,"/space/300","名字右上角空白处也算点中名字");assert.deepEqual(board.errors,[]);
  }finally{await board.context.close();}
  const reg=await open(browser,"https://www.nodeseek.com/register.html",{...phone(),html:P.registerPage({})});
  try{
   await ready(reg.page);
   const s=await reg.page.evaluate(()=>({inputs:[...document.querySelectorAll("#register :is(input[type=radio],input[type=checkbox])")].map(e=>e.getBoundingClientRect().width),labels:[...document.querySelectorAll("#register :is(label.pure-radio,label[for=agree-tos])")].map(e=>e.getBoundingClientRect().height),overflow:document.documentElement.scrollWidth>innerWidth+1}));
   assert.ok(s.inputs.length===3&&s.inputs.every(w=>w>=18),JSON.stringify(s));assert.ok(s.labels.length===3&&s.labels.every(h=>h>=44),JSON.stringify(s));assert.equal(s.overflow,false);
   await reg.page.locator("#register label.pure-radio").nth(1).tap();
   assert.equal(await reg.page.locator("#register input[type=radio]").nth(1).isChecked(),true,"点整行标签就能选中");
   await reg.page.locator("#register label[for=agree-tos]").tap();
   assert.equal(await reg.page.locator("#agree-tos").isChecked(),true);assert.deepEqual(reg.errors,[]);
  }finally{await reg.context.close();}
 });
 test(`${engine} 手机简洁模式（2026-11-07 用户截图）：头像、名字、时间、楼号一行，正文不缩进，操作在正文下面，层间细线两头不弯`,async()=>{
  const simple="if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}";
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true}),init:simple});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const r=e=>e.getBoundingClientRect().toJSON();const floors=[...document.querySelectorAll("#nsk-body-left ul.comments>li.content-item")].map(li=>({li:r(li),pad:parseFloat(getComputedStyle(li).paddingLeft),radius:getComputedStyle(li).borderTopLeftRadius,avatar:r(li.querySelector(".avatar-wrapper")),name:r(li.querySelector(".author-name")),time:r(li.querySelector(".date-created")),floor:r(li.querySelector(".floor-link")),body:r(li.querySelector("article.post-content")),menu:r(li.querySelector(".comment-menu")),first:Math.min(...[...li.querySelectorAll(".comment-menu>.menu-item")].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().left))}));const op=document.querySelector("#nsk-body-left .nsk-post>.content-item");const opActions=r(op.querySelector(".nsmax-op-actions")),opName=r(op.querySelector(".author-name")),opBody=r(op.querySelector("article.post-content")),opAvatar=r(op.querySelector(".avatar-wrapper"));const head=document.querySelector(".nsmax-layout-toggle").parentElement;return{floors,opActions,opName,opBody,opAvatar,headOverflow:head.scrollWidth>head.clientWidth+1,toggle:r(document.querySelector(".nsmax-layout-toggle")),headBox:r(head),overflow:document.documentElement.scrollWidth>innerWidth+1};});
    assert.ok(s.floors.length>=3);
    for(const [i,f] of s.floors.entries()){
     const info=JSON.stringify({width,i,...f});
     assert.ok(Math.abs(f.body.left-(f.li.left+f.pad))<1.5,`正文从卡片内边开始、不让出头像栏：${info}`);
     assert.ok(Math.abs(f.body.left-f.avatar.left)<1.5,`正文和头像同一条左边线：${info}`);
     assert.ok(f.name.left>f.avatar.right&&f.name.top<f.avatar.bottom,`名字在头像右边同一行：${info}`);
     assert.ok(f.time.top>=f.name.bottom-1&&f.time.bottom<=f.body.top+1,`时间在名字下面、正文上面：${info}`);
     assert.ok(f.floor.top<f.avatar.bottom&&f.floor.bottom>f.avatar.top&&f.floor.right<=f.li.right,`楼号在头像那一行右边：${info}`);
     assert.ok(f.menu.top>=f.body.bottom-5&&f.menu.top+f.menu.height/2>f.body.bottom,`操作在正文下面（点按区上沿可以压进正文 4px）：${info}`);
     assert.ok(f.menu.height<=44.5,`操作一行：${info}`);
     assert.ok(Math.abs(f.first+8-f.body.left)<1.5,`第一个操作的文字和正文同一条左边线：${info}`);
     if(i>0)assert.equal(f.radius,"0px",`层间细线两头不弯：${info}`);
    }
    assert.ok(Math.abs(s.opBody.left-s.opAvatar.left)<1.5,`主楼正文不缩进：${JSON.stringify(s)}`);
    if(width>=360)assert.ok(s.opActions.top<s.opAvatar.bottom&&s.opActions.left>s.opName.right,`主楼「引用 回复 举报」在名字那一行右边：${JSON.stringify(s)}`);
    assert.ok(s.opActions.bottom<=s.opBody.top+1,"主楼操作在正文上面");
    assert.equal(s.headOverflow,false);assert.ok(s.toggle.right<=s.headBox.right+0.5,`「退出简洁模式」没被切掉：${JSON.stringify(s)}`);
    assert.equal(s.overflow,false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机旧评论（经典排法）：超过 30 天的时间只到分钟，390px 和五个操作排一行，窄屏只在日期和钟点之间换行`,async()=>{
  for(const width of [390,360]){
   const created=new Date(Date.now()-40*864e5).toISOString();
   const html=P.postPage({mobile:true}).replaceAll("2026-10-03T04:00:00.000Z",created).replaceAll("2026-10-03 12:00:00",created);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const li=document.querySelector("ul.comments>li.content-item"),time=li.querySelector(".date-created time");const range=document.createRange();range.selectNodeContents(time);const lines=[...range.getClientRects()].map(r=>Math.round(r.top));return{text:time.textContent,lines:[...new Set(lines)].length,menu:li.querySelector(".comment-menu").getBoundingClientRect().height,buttons:[...li.querySelectorAll(".comment-menu>.menu-item")].map(e=>{const r=e.getBoundingClientRect();return[r.width,r.height]})};});
    assert.match(s.text,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,JSON.stringify(s));
    if(width>=390)assert.equal(s.lines,1,`390px 时间一行：${JSON.stringify(s)}`);
    else{const range=await page.evaluate(()=>{const t=document.querySelector("ul.comments>li.content-item .date-created time"),r=document.createRange();const node=t.firstChild;const out=[];for(let i=0;i<node.length;i++){r.setStart(node,i);r.setEnd(node,i+1);out.push(Math.round(r.getBoundingClientRect().top));}return out;});const breakAt=range.findIndex((t,i)=>i&&t!==range[i-1]);assert.ok(breakAt===-1||s.text[breakAt-1]===" ",`只在空格处换行：${JSON.stringify({s,range})}`);}
    assert.equal(s.menu,44);assert.ok(s.buttons.every(([w,h])=>w>=36&&h>=44),JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 2026-11-07 手机重做：列表不放最后回复人、回顶按钮下翻收起、关键词弹窗居中、菜单登录注册是按钮`,async()=>{
  for(const width of [390,320]){
   // 真站的帖子大多是「N 小时前」这类相对时间：把夹具里 30 天前的日期换成两小时前，免得长日期让信息行换行
   const recent=new Date(Date.now()-2*36e5).toISOString();
   const html=P.listPage({mobile:true}).replace(/2026-10-03T04:0\d:00\.000Z/g,recent).replace(/2026-10-03 12:0\d:00/g,recent);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(width),html});
   try{
    await ready(page);
    const rows=await page.evaluate(()=>[...document.querySelectorAll("ul.post-list>li.post-list-item .post-info")].map(e=>({h:e.getBoundingClientRect().height,last:getComputedStyle(e.querySelector(".info-last-commenter")).display})));
    assert.ok(rows.length&&rows.every(r=>r.last==="none"),`${width}：${JSON.stringify(rows)}`);if(width===390)assert.ok(rows.slice(0,4).every(r=>r.h<=21),`390px 常见的帖子信息排一行：${JSON.stringify(rows)}`);
    await page.locator(".nsmax-mobile-filter").click();
    const pop=await page.locator('.nsmax-pop[data-kind="keywords"]').evaluate(e=>{const r=e.getBoundingClientRect(),b=e.querySelector("form button").getBoundingClientRect(),i=e.querySelector("form input").getBoundingClientRect();return{left:r.left,right:innerWidth-r.right,button:b.height,input:i.height};});
    assert.ok(Math.abs(pop.left-12)<1&&Math.abs(pop.right-12)<1&&pop.button===pop.input&&pop.input>=44,JSON.stringify(pop));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(390,700),html:P.postPage({mobile:true})});
  try{
   await ready(post.page);
   const state=async()=>post.page.evaluate(()=>({down:document.documentElement.hasAttribute("data-nsmax-scroll-down"),opacity:getComputedStyle(document.querySelector("#fast-nav-button-group")).opacity}));
   await post.page.evaluate(()=>scrollTo(0,600));await post.page.waitForTimeout(400);
   const down=await state();
   await post.page.evaluate(()=>scrollTo(0,300));await post.page.waitForTimeout(400);
   const up=await state();
   assert.ok(down.down&&down.opacity==="0",JSON.stringify(down));assert.ok(!up.down&&up.opacity==="1",JSON.stringify(up));
   const buttons=await post.page.evaluate(()=>[...document.querySelectorAll("#fast-nav-button-group>.nav-item-btn")].filter(e=>getComputedStyle(e).display!=="none").map(e=>e.id));
   assert.deepEqual(buttons.filter(id=>id!=="back-to-top"),[],"手机上只留回到顶部");
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
  const guest=await open(browser,"https://www.nodeseek.com/notification",{...phone(),html:P.notificationGuestPage({mobile:true})});
  try{
   await ready(guest.page);
   await guest.page.locator("#toggle-left-panel>a").click();await guest.page.waitForTimeout(300);
   const btns=await guest.page.evaluate(()=>[...document.querySelectorAll("#left-slide-panel .welcome-new a.btn")].map(a=>{const r=a.getBoundingClientRect(),s=getComputedStyle(a);return{top:r.top,left:r.left,width:r.width,height:r.height,bg:s.backgroundColor};}));
   assert.equal(btns.length,2);assert.equal(Math.round(btns[0].top),Math.round(btns[1].top),"登录、注册并排");assert.equal(btns[0].left,16);
   assert.ok(btns.every(b=>b.height>=44&&b.width>=100),JSON.stringify(btns));assert.notEqual(btns[0].bg,"rgba(0, 0, 0, 0)","登录是实心按钮");
   assert.deepEqual(guest.errors,[]);
  }finally{await guest.context.close();}
 });
 test(`${engine} 2026-11-07 对照 sb.sb：版块条只在列表页，访客卡在右栏最上，深浅色菜单 13.5px 正文色`,async()=>{
  for(const [url,html,shown] of [["https://www.nodeseek.com/",P.listPage({mobile:true}),true],["https://www.nodeseek.com/post-1000-1",P.postPage({mobile:true}),false],["https://www.nodeseek.com/board",P.boardPage({mobile:true}),false]]){
   const {context,page,errors}=await open(browser,url,{...phone(),html});
   try{
    await ready(page);
    const visible=await page.evaluate(()=>{const nav=document.querySelector("body>header>ul.mobile-nav");return !!nav&&getComputedStyle(nav).display!=="none";});
    assert.equal(visible,shown,url);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  if(engine!=="chromium")return;
  const desk=await open(browser,"https://www.nodeseek.com/invite",{viewport:{width:1440,height:900},html:P.invitePage(),seed});
  try{
   await ready(desk.page);
   const first=await desk.page.evaluate(()=>{const side=document.querySelector("#nsk-right-panel-container");const top=[...side.children].filter(e=>e.getClientRects().length).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top)[0];return top&&top.querySelector(".btn")?.textContent.trim();});
   assert.equal(first,"登录","访客卡排在右栏最上面");
   await desk.page.locator("#nsk-head [data-nsmax-own-header=colors]").click();
   const item=await desk.page.locator('.nsmax-pop[data-kind="colors"] .nsmax-pop-item').first().evaluate(e=>{const s=getComputedStyle(e);return{size:s.fontSize,weight:s.fontWeight};});
   assert.deepEqual(item,{size:"13.5px",weight:"500"});
   assert.deepEqual(desk.errors,[]);
  }finally{await desk.context.close();}
 });
}
