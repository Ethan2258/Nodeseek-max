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
 test(`${engine} 手机评论：时间和操作同一行，楼号在作者行右边；320px 仍分行`,async()=>{
  for(const width of [390,320]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html:P.postPage({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{const li=document.querySelector("ul.comments>li.content-item"),r=e=>e.getBoundingClientRect().toJSON();return{li:r(li),head:r(li.querySelector(".nsmax-author-col")),time:r(li.querySelector(".nsk-content-meta-info>div:not([class])")),menu:r(li.querySelector(".comment-menu")),floor:r(li.querySelector(".floor-link")),body:r(li.querySelector("article.post-content"))};});
    if(width>=360){
     assert.ok(Math.abs(center(s.time)-center(s.menu))<3,JSON.stringify(s));assert.ok(s.menu.left>s.time.right,JSON.stringify(s));assert.ok(s.menu.right<=s.li.right,JSON.stringify(s));
     assert.ok(s.floor.top>=s.head.top&&s.floor.bottom<=s.head.bottom+1,"楼号在作者行里");assert.ok(s.floor.right<=s.li.right,JSON.stringify(s));
     assert.ok(s.body.top-s.head.bottom<70,`作者行到正文只隔一行：${JSON.stringify(s)}`);
    }else assert.ok(s.menu.top>=s.time.bottom-1,"窄屏操作仍在时间下面");
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
   assert.ok(s.widths.length===4&&s.widths.every(w=>w===66),JSON.stringify(s));assert.ok(Math.abs(s.first)<1,"靠左");assert.deepEqual(s.gaps,[8,8,8]);
   assert.ok(Math.abs(s.title-83.5)<1.5&&Math.abs(s.author-63)<1,JSON.stringify(s));assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
 });
}
