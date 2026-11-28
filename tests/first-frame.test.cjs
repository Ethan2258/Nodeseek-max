"use strict";
// 首帧性能相关的行为回归：列表行分档、主题分段、图标雪碧图、页脚
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const phone=(width=390,height=844)=>({viewport:{width,height},device:{...devices["iPhone 13"],viewport:{width,height}},seed});
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
// 记下 data-nsmax-cv-hold 什么时候撤掉、撤掉时已经过了几帧
const holdLog=`window.__frames=0;window.__hold={};(()=>{const tick=()=>{window.__frames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);const watch=()=>{const root=document.documentElement;if(!root)return setTimeout(watch,0);let seen=root.hasAttribute("data-nsmax-cv-hold");new MutationObserver(()=>{const now=root.hasAttribute("data-nsmax-cv-hold");if(now&&!seen)window.__hold.on=true;if(!now&&seen)window.__hold.offFrames=window.__frames;seen=now;}).observe(root,{attributes:true,attributeFilter:["data-nsmax-cv-hold"]});if(seen)window.__hold.on=true;};watch();})();`;
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 首帧只算屏幕上的行：一屏放得下的行直接画，后面的行第一帧之后才交回 auto，滚动后行高不跳`,async()=>{
  for(const options of [phone(),{viewport:{width:1440,height:900},seed}]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...options,html:P.listPage({mobile:!!options.device,count:60}),init:holdLog});
   try{
    await ready(page);
    const state=await page.evaluate(()=>{
     const rows=[...document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item")];
     return{fold:document.documentElement.dataset.nsmaxFold,holding:document.documentElement.hasAttribute("data-nsmax-cv-hold"),hold:window.__hold,first:getComputedStyle(rows[0]).contentVisibility,firstSize:getComputedStyle(rows[0]).containIntrinsicHeight,last:getComputedStyle(rows[11]).contentVisibility,next:getComputedStyle(rows[12]).contentVisibility,rows:rows.length,tidied:rows.filter(row=>row.classList.contains("post-item")&&row.hasAttribute("data-nsmax-meta-ordered")&&row.querySelector("time")?.hasAttribute("data-nsmax-time-done")).length};
    });
    assert.equal(state.fold,"s",JSON.stringify(state));
    assert.equal(state.holding,false,"第一帧之后撤掉");
    assert.equal(state.hold.on,true,"页面解析时就挡着");
    assert.ok(state.hold.offFrames>=1,`撤掉时已经画过帧：${JSON.stringify(state.hold)}`);
    assert.equal(state.first,"visible");
    assert.equal(state.firstSize,"none");
    assert.equal(state.last,"visible","一屏放得下的最后一行");
    assert.equal(state.next,"auto","下一行交回 auto");
    assert.equal(state.tidied,state.rows,"第一帧之后屏幕外的行也整理好了");
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#nsk-body-left ul.post-list > li.post-list-item").last().locator(".post-title a").first().isVisible(),true,"滚到底能看到最后一行");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机搜索：首页点开搜索框也有关闭按钮，收起后恢复`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:6})});
  try{
   await ready(page);
   const close=page.locator(".nsmax-search-close");
   assert.equal(await close.isVisible(),false,"平时不显示");
   await page.locator("#search-site2").tap();
   await page.waitForSelector("html[data-nsmax-search-open]");
   assert.equal(await close.isVisible(),true,"搜索打开时显示关闭按钮");
   const box=await close.boundingBox();
   assert.ok(box.width>=44&&box.height>=44,JSON.stringify(box));
   await close.tap();
   await page.waitForFunction(()=>!document.documentElement.hasAttribute("data-nsmax-search-open"));
   assert.equal(await close.isVisible(),false,"关闭后收起");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 列表小页码单独折到下一行时和标题左对齐，同一行时和标题隔 6px`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(320,640),html:P.listPage({mobile:true,count:12})});
  try{
   await ready(page);
   const rows=await page.evaluate(()=>[...document.querySelectorAll("#nsk-body-left .post-title")].filter(title=>title.querySelector(":scope > .nsmax-topic-pages")).map(title=>{const link=title.querySelector(":scope > a"),pages=title.querySelector(":scope > .nsmax-topic-pages"),rects=[...link.getClientRects()],text=rects.at(-1),box=pages.getBoundingClientRect(),start=rects[0].left;return{wrapped:box.top>=text.bottom-2,left:box.left-start,gap:box.left-text.right,padding:getComputedStyle(pages).paddingLeft};}));
   assert.ok(rows.length,"有带小页码的行");
   for(const row of rows){
    assert.equal(row.padding,"0px",JSON.stringify(row));
    if(row.wrapped)assert.ok(Math.abs(row.left)<=1,JSON.stringify(row));else assert.ok(Math.abs(row.gap-6)<=1,JSON.stringify(row));
   }
   assert.ok(rows.some(row=>row.wrapped),`窄屏上至少有一行折下去：${JSON.stringify(rows)}`);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机消息中心：放到第二行的「刷新」「全部已读」和卡片底边留出空隙，放得下时标签下划线仍贴底`,async()=>{
  for(const [width,wrapped] of [[390,true],[600,false]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{...phone(width,844),html:P.notificationPage({mobile:true})});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-message-tabs .nspp-messages-count");
    const state=await page.evaluate(()=>{const top=document.querySelector(".nspp-messages-top").getBoundingClientRect(),tabs=document.querySelector(".nsmax-message-tabs").getBoundingClientRect(),actions=document.querySelector(".nspp-messages-top-actions").getBoundingClientRect();return{top:top.bottom,tabs:tabs.bottom,actions:actions.bottom,actionTop:actions.top,tabTop:tabs.top};});
    assert.equal(state.actionTop>(state.tabTop+state.tabs)/2,wrapped,JSON.stringify(state));
    assert.ok(state.top-state.actions>=7,`按钮离卡片底边至少 7px：${JSON.stringify(state)}`);
    if(!wrapped)assert.ok(Math.abs(state.top-state.tabs)<=2,`一行放得下时下划线贴底：${JSON.stringify(state)}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 窗口特别高时不分档；刷新时不用分档（要按原来的位置恢复）`,async()=>{
  const tall=await open(browser,"https://www.nodeseek.com/",{viewport:{width:1600,height:2000},seed,html:P.listPage({count:30}),init:holdLog});
  try{
   await ready(tall.page);
   assert.deepEqual(await tall.page.evaluate(()=>[document.documentElement.dataset.nsmaxFold??null,window.__hold.on??null]),[null,null]);
   assert.deepEqual(tall.errors,[]);
  }finally{await tall.context.close();}
  const normal=await open(browser,"https://www.nodeseek.com/",{viewport:{width:1440,height:900},seed,html:P.listPage({count:30})});
  try{
   await ready(normal.page);
   await normal.page.reload({waitUntil:"domcontentloaded"});
   await normal.page.waitForSelector("html[data-nsmax-theme]");
   await ready(normal.page);
   assert.deepEqual(await normal.page.evaluate(()=>[document.documentElement.hasAttribute("data-nsmax-cv"),document.documentElement.hasAttribute("data-nsmax-cv-hold"),document.documentElement.dataset.nsmaxFold??null]),[false,false,null]);
   assert.deepEqual(normal.errors,[]);
  }finally{await normal.context.close();}
 });
 test(`${engine} 图标雪碧图不参与样式计算：svg 不显示，<use> 照样画得出来`,async()=>{
  const sprite=`<svg aria-hidden="true" style="position: absolute; width: 0px; height: 0px; overflow: hidden;"><symbol id="test-sprite" viewBox="0 0 48 48" fill="none"><path d="M0 0h48v48H0z" fill="#f00"/></symbol></svg>`;
  const html=P.listPage({count:4}).replace(/<body[^>]*>/,(tag)=>tag+sprite).replace("</body>",`<svg id="test-use" width="24" height="24" viewBox="0 0 24 24" style="position:fixed;left:0;top:0;z-index:99999;display:block!important;width:24px;height:24px"><use href="#test-sprite" width="24" height="24"></use></svg></body>`);
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html,viewport:{width:1280,height:800},seed});
  try{
   await ready(page);
   const state=await page.evaluate(()=>{const sprite=document.querySelector("#test-sprite").closest("svg"),use=document.querySelector("#test-use use").getBBox();return{parent:sprite.parentElement.localName,display:getComputedStyle(sprite).display,width:use.width,height:use.height};});
   assert.equal(state.parent,"body");
   assert.equal(state.display,"none");
   assert.equal(state.width,24,"<use> 引用雪碧图里的图标仍有尺寸");
   assert.equal(state.height,24);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机侧栏抽屉：第一次搭侧栏不写 scrollTop（不逼整页排版），切换标签仍回到顶部`,async()=>{
  // 记下每次给 #left-slide-panel 写 scrollTop
  const init=`window.__panelScrollWrites=0;(()=>{const d=Object.getOwnPropertyDescriptor(Element.prototype,"scrollTop");Object.defineProperty(Element.prototype,"scrollTop",{configurable:true,get(){return d.get.call(this);},set(v){if(this.id==="left-slide-panel")window.__panelScrollWrites++;d.set.call(this,v);}});})();`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:20}),init});
  try{
   await ready(page);
   await page.waitForSelector("#left-slide-panel .nsmax-drawer-tabs button");
   assert.equal(await page.evaluate(()=>window.__panelScrollWrites),0,"搭侧栏时不写 scrollTop");
   await page.getByRole("button",{name:"打开菜单",exact:true}).tap();
   const drawer=page.locator("#left-slide-panel");
   await drawer.getByRole("button",{name:"最近浏览",exact:true}).tap();
   await page.waitForFunction(()=>document.getElementById("left-slide-panel").dataset.nsmaxDrawerView==="recent");
   assert.equal(await page.evaluate(()=>window.__panelScrollWrites),1,"切换标签时回到顶部");
   assert.equal(await page.evaluate(()=>document.getElementById("left-slide-panel").scrollTop),0);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 第一帧画出来之前鼠标就动了：浮层样式等第一帧之后才注入，不压在第一帧上`,async()=>{
  // 一有 body 就发一个 pointermove（鼠标本来就停在窗口里），页面一开始就排一个 rAF：它在第一帧里跑，看那时浮层样式在不在页面里。
  // 以前在 readyState 变 interactive 时才发、看那之后的第一个 rAF，可浏览器有时在解析完之前就画过一帧，那个 rAF 已经不是第一帧
  const init=`window.__overlayFirstFrame=null;(()=>{const has=()=>[...document.querySelectorAll("style")].some(n=>(n.textContent||"").includes(".search-overlay{--bg-overlay"));requestAnimationFrame(()=>{window.__overlayFirstFrame=has();});const move=()=>document.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,clientX:20,clientY:20}));if(document.body)move();else new MutationObserver((list,observer)=>{if(!document.body)return;observer.disconnect();move();}).observe(document,{childList:true,subtree:true});})();`;
  for(const options of [phone(),{viewport:{width:1440,height:900},seed}]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...options,html:P.listPage({mobile:!!options.device,count:20}),init});
   try{
    await ready(page);
    assert.equal(await page.evaluate(()=>window.__overlayFirstFrame),false,"第一帧时还没注入");
    await page.waitForFunction(()=>[...document.querySelectorAll("style")].some(n=>(n.textContent||"").includes(".search-overlay{--bg-overlay")),null,{timeout:5000});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 页脚屏幕外不算，滚到附近正常显示`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:40})});
  try{
   await ready(page);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector("body > footer")).contentVisibility),"auto");
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
   await page.waitForTimeout(400);
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
   await page.waitForTimeout(200);
   const footer=await page.evaluate(()=>{const box=document.querySelector("body > footer").getBoundingClientRect();return{bottom:Math.round(box.bottom),height:Math.round(box.height),inner:innerHeight,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});
   assert.ok(footer.height>100,JSON.stringify(footer));
   assert.ok(Math.abs(footer.bottom-footer.inner)<=2,`页脚贴着视口底：${JSON.stringify(footer)}`);
   assert.equal(footer.overflow,false);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机首页：版块那一排的「全部」第一帧就是黑色胶囊，不等手机模块启动；搜索框提示字不来回换`,async()=>{
  // 2026-11-06 真站逐帧：「全部」要到 1.3 秒后才变黑，搜索框提示字「搜索关键词 → 搜索 → 搜索关键词」跳两次
  const watch=`(()=>{window.__all=null;window.__ph=[];const seen=()=>{const a=[...document.querySelectorAll("body>header>ul.mobile-nav a")].find(x=>x.textContent.trim()==="全部");if(a&&window.__all===null&&(a.hasAttribute("aria-current")||a.hasAttribute("data-nsmax-header-cat-on")))window.__all=performance.now();const i=document.getElementById("search-site2");if(i&&window.__ph.at(-1)!==i.placeholder)window.__ph.push(i.placeholder);};new MutationObserver(seen).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-current","data-nsmax-header-cat-on","placeholder"]});})();`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true}),init:watch});
  try{
   await ready(page);
   await page.waitForTimeout(600);
   const s=await page.evaluate(()=>({all:window.__all,fcp:performance.getEntriesByName("first-contentful-paint")[0]?.startTime,deferred:performance.getEntriesByName("nsmax:deferred-start")[0]?.startTime,ph:window.__ph,bg:(()=>{const a=[...document.querySelectorAll("body>header>ul.mobile-nav a")].find(x=>x.textContent.trim()==="全部");return getComputedStyle(a,"::before").backgroundColor;})()}));
   assert.ok(s.all!==null&&s.all<=s.fcp,JSON.stringify(s));
   assert.notEqual(s.bg,"rgba(0, 0, 0, 0)",JSON.stringify(s));
   assert.deepEqual(s.ph.filter(t=>t==="搜索"),[],JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 // 挂载期间（后台模块开始挂载前）站点新加的楼层：撤掉 data-nsmax-mounting 的那一刻必须已经整理好，不能等之后那一轮 100ms + 空闲的整理。
 // 空闲回调压到 3 秒后，确保这一刻之前没有别的整理轮次替它做掉
 test(`${engine} 挂载期间站点新加的楼层：撤掉 data-nsmax-mounting 的那一刻已经整理好`,async()=>{
  const html=P.postPage();
  const raw=html.match(/<li class="content-item" id="3">[\s\S]*?<\/li>/)[0].replace('id="3"','id="9"').replaceAll("#3","#9").replaceAll("curious","latecomer");
  const init=`(()=>{window.requestIdleCallback=fn=>setTimeout(()=>fn({didTimeout:true,timeRemaining:()=>0}),3000);window.cancelIdleCallback=clearTimeout;
   let seen=false;window.__atUnmount=null;
   new MutationObserver(()=>{if(document.documentElement.hasAttribute("data-nsmax-mounting")){seen=true;return;}if(!seen||window.__atUnmount)return;const late=document.getElementById("9");window.__atUnmount={late:!!late,actions:!!late?.querySelector(":scope > .nsmax-floor-actions > .comment-menu"),menu:!!late?.querySelector(":scope > .comment-menu")};}).observe(document,{attributes:true,subtree:true,attributeFilter:["data-nsmax-mounting"]});
   const mark=performance.mark.bind(performance);
   performance.mark=(name,...args)=>{if(name==="nsmax:primary-ready"&&!window.__appended){window.__appended=true;document.querySelector("ul.comments").insertAdjacentHTML("beforeend",${JSON.stringify(raw)});}return mark(name,...args);};})();`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,seed,viewport:{width:1440,height:900},init});
  try{
   await ready(page);
   assert.equal(await page.evaluate(()=>window.__appended),true);
   assert.deepEqual(await page.evaluate(()=>window.__atUnmount),{late:true,actions:true,menu:false},"撤掉挂载标记时新楼层的操作区已经收好");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 整页最后一个页码条被拿掉时，外层的页码标记跟着撤掉`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:P.listPage(),seed,viewport:{width:1440,height:900}});
  try{
   await ready(page);
   assert.equal(await page.locator("#nsk-body-left > div[data-nsmax-pagerbox]").count(),1,"底部页码外层有标记");
   await page.evaluate(()=>{for(const pager of document.querySelectorAll(".nsk-pager"))pager.remove();});
   await page.waitForFunction(()=>!document.querySelector(".nsk-pager")&&!document.querySelector("[data-nsmax-pagerbox]"),null,{timeout:3000});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
}
// 分段只比 Chromium：每种页面跑两遍，WebKit 上时间太长，样式分段本身和引擎无关
test("主题分段：手机、深色下也和整份注入逐元素一致，手机上遇到带右栏的网页时把右栏段补上",async()=>{
 const browser=await launch();
 try{
  // 整份注入用 localStorage 打开：地址带参数时站点的「当前版块」判断会变
  const snapshot=async(path,render,options,full)=>{
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+path,{...options,html:render});
   try{
    await ready(page);
    // 两边都打开两次：第一次打开时写下的热榜、未读数缓存会改变第二次的页面内容
    if(full)await page.evaluate(()=>localStorage.setItem("nsmax:all-css","1"));
    await page.goto("https://www.nodeseek.com"+path,{waitUntil:"domcontentloaded"});
    await ready(page);
    // 通知入口要等未读数请求回来才换成带角标的链接，CI 上 900ms 不一定够，两边都等到这一步再比
    await page.waitForFunction(()=>!document.querySelector(".user-stat")||document.querySelector(".nspp-notification-link"),null,{timeout:8000}).catch(()=>{});
    await page.mouse.move(8,8);
    await page.waitForTimeout(900);
    // 页脚在屏幕外时高度取占位值，排过版才是实际值，两次打开可能差这一步
    await page.addStyleTag({content:"body > footer{content-visibility:visible!important}"});
    const state=await page.evaluate(()=>{
     // 带参数打开时站点把当前版块的链接标成别的类，只比标签和 ID
     const label=el=>`${el.tagName.toLowerCase()}${el.id?"#"+el.id:""}`;
     // 相对时间的文字两次打开之间可能变（刚刚 → 1 分钟前），宽度跟着变，不比
     const styles=[...document.body.querySelectorAll("*")].filter(el=>!el.closest("#nspp-tools")&&!el.closest("time")&&!el.querySelector(":scope > time")).map(el=>{const s=getComputedStyle(el);return[label(el),s.display,s.position,s.color,s.backgroundColor,s.borderTopWidth,s.borderRadius,s.padding,s.margin,s.fontSize,s.fontWeight,s.lineHeight,s.height,s.width,s.overflow,s.boxShadow,s.gap,s.flexDirection,s.visibility].join("|");});
     const theme=[...document.querySelectorAll("style")].map(tag=>tag.textContent||"").filter(text=>text.includes("data-nsmax-theme"));
     return{styles,bytes:theme.reduce((n,text)=>n+text.length,0),tokens:theme.some(text=>/[§¶¤`]/.test(text.replace(/"[^"]*"/g,""))),right:theme.join("").split("#nsk-right-panel-container").length};
    });
    assert.deepEqual(errors,[]);
    return state;
   }finally{await context.close();}
  };
  const dark={...seed,"nspp:settings:www.nodeseek.com":{...seed["nspp:settings:www.nodeseek.com"],"modern-theme":{font:"system",colorMode:"dark"}}};
  for(const [name,path,render,options,expectRight] of [
   ["手机列表","/",P.listPage({mobile:true,count:20}),phone(),false],
   ["手机帖子","/post-1000-1",P.postPage({mobile:true}),phone(),false],
   ["手机通知","/notification",P.notificationPage({mobile:true}),phone(),false],
   ["手机带右栏","/",P.listPage({count:20}),phone(),true],
   ["深色列表","/",P.listPage({count:20}),{viewport:{width:1280,height:900},seed:dark,colorScheme:"dark"},true],
   ["窄窗口列表","/",P.listPage({count:20}),{viewport:{width:760,height:900},seed},true]
  ]){
   const chunked=await snapshot(path,render,options);
   const full=await snapshot(path,render,options,true);
   assert.equal(chunked.tokens,false,`${name}：压缩用的字符都还原了`);
   if(expectRight!==undefined)assert.equal(chunked.right>full.right*0.9,expectRight,`${name}：右栏段 ${chunked.right} / ${full.right}`);
   assert.ok(chunked.bytes<full.bytes,`${name}：${chunked.bytes} / ${full.bytes}`);
   assert.equal(chunked.styles.length,full.styles.length,`${name}：元素数量一致`);
   const diff=full.styles.findIndex((style,index)=>style!==chunked.styles[index]);
   assert.equal(diff,-1,`${name} 第 ${diff} 个元素和整份注入不一致：\n分段 ${chunked.styles[diff]}\n整份 ${full.styles[diff]}`);
  }
 }finally{await browser.close();}
});
// 跳楼层（2026-11-23）：主题给 html 设了 scroll-behavior: smooth，带 #楼号 打开帖子、点本页 #楼号 时浏览器也慢慢滑，路上的楼层和图片一层层
// 变高，动画停在出发时算好的位置，要找的那一层不在屏幕里（测试页落点差 1600 多像素）。现在一步到位，上面的图片晚到也钉在顶栏下面。
// 正文配图下好过一次就记下尺寸，再打开时没下完也占好位置（不再整段往下推）
{
 const IMG=(w,h)=>`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='#c9a'/></svg>`;
 const longPost=()=>{
  let html=P.postPage();
  const base=html.match(/<li class="content-item" id="1">[\s\S]*?<\/li>/)[0];
  const body=i=>`<p>第 ${i} 楼。${"这是一行很长的回复文字用来撑开楼层。".repeat(3)}</p>${i%3===0?`<p><img src="https://img.test/${i}.svg?w=800&h=450" alt="图${i}"></p>`:""}`;
  const items=Array.from({length:30},(_,k)=>{const f=k+1;return base.replace(/id="1"/,`id="${f}"`).replace(/href="#1"/,`href="#${f}"`).replace(/>#1</,`>#${f}<`).replace(/<article class="post-content">[\s\S]*?<\/article>/,`<article class="post-content">${body(f)}</article>`);}).join("");
  return html.replace(/<ul class="comments">[\s\S]*?<\/ul>/,`<ul class="comments">${items}</ul>`).replace(/<article class="post-content">/,`<article class="post-content"><p><img src="https://img.test/100.svg?w=1200&h=800" alt="首图"></p><p><a id="jump25" href="#25">#25</a></p>`);
 };
 // 图片晚到：每张 600ms 起、按编号错开
 const slowImages=async(page)=>page.context().route("https://img.test/**",async(route)=>{const url=new URL(route.request().url());await new Promise(r=>setTimeout(r,600+Number(url.pathname.replace(/\D/g,""))%7*250));route.fulfill({status:200,contentType:"image/svg+xml",body:IMG(url.searchParams.get("w"),url.searchParams.get("h"))});});
 // noAnchor：关掉浏览器自带的滚动锚定（Safari 没有这个功能），看脚本自己能不能钉住
 const noAnchor=`(()=>{const add=()=>document.documentElement.appendChild(Object.assign(document.createElement("style"),{textContent:"*{overflow-anchor:none!important}"}));if(document.documentElement)add();else new MutationObserver((r,o)=>{if(document.documentElement){o.disconnect();add();}}).observe(document,{childList:true});})();`;
 const top=(page,id)=>page.evaluate(id=>Math.round(document.getElementById(id).getBoundingClientRect().top),id);
 for(const anchor of [true,false]) test(`带 #楼号 打开帖子一步到位、停在顶栏下面，上面的图片晚到也不挪走${anchor?"":"（没有滚动锚定）"}`,async()=>{
  const browser=await launch();
  try{
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1#20",{html:longPost(),seed,viewport:{width:1440,height:900},init:anchor?"":noAnchor,beforeNavigate:slowImages});
   try{
    await page.waitForFunction(()=>document.getElementById("20"));
    await page.waitForFunction(()=>performance.getEntriesByName("first-contentful-paint").length);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.ok(Math.abs(await top(page,"20")-72)<=2,`第一帧就在目标上：${await top(page,"20")}`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(600);
    assert.ok(Math.abs(await top(page,"20")-72)<=2,`图片都下好以后还在：${await top(page,"20")}`);
    assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue("scroll-behavior")),"","加载完撤掉临时的 scroll-behavior");
    // 点本页的 #25：一步到位；落地后上面（第 10 层）又冒出一张晚到的图，照样钉住
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await page.locator("#jump25").click();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    assert.ok(Math.abs(await top(page,"25")-72)<=2,`点了马上到：${await top(page,"25")}`);
    await page.evaluate(()=>{const p=document.createElement("p");p.innerHTML=`<img src="https://img.test/200.svg?w=800&h=600" alt="晚到">`;document.getElementById("10").querySelector("article.post-content").append(p);});
    await page.waitForTimeout(2500);
    assert.ok(await page.evaluate(()=>document.querySelector("img[alt='晚到']").complete),"晚到的图下好了");
    assert.ok(Math.abs(await top(page,"25")-72)<=2,`图片下好以后还在：${await top(page,"25")}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }finally{await browser.close();}
 });
 test("正文配图下好过一次就记下尺寸：再打开时没下完也占好位置，正文不被往下推",async()=>{
  const browser=await launch();
  try{
   const init=`window.__shift=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__shift+=e.value}).observe({type:"layout-shift",buffered:true});`;
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html:longPost(),seed,viewport:{width:1440,height:900},init,beforeNavigate:slowImages});
   try{
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);
    assert.ok(await page.evaluate(()=>window.__shift)>0.05,"第一次打开：图片没记过，下好时正文被推下去");
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem("nsmax:image-sizes")||"{}")["https://img.test/100.svg?w=1200&h=800"]==="1200x800"),"记下了首图尺寸");
    await page.goto("https://www.nodeseek.com/post-1000-1",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>performance.getEntriesByName("first-contentful-paint").length);
    const box=await page.evaluate(()=>{const img=document.querySelector(".nsk-post article.post-content img");return{complete:img.complete,width:Math.round(img.getBoundingClientRect().width),height:Math.round(img.getBoundingClientRect().height)};});
    assert.equal(box.complete,false,"图片还没下完");
    assert.ok(box.height>300&&Math.abs(box.width/box.height-1.5)<0.02,`没下完就按 3:2 占好：${JSON.stringify(box)}`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    const after=await page.evaluate(()=>{const img=document.querySelector(".nsk-post article.post-content img");return{width:Math.round(img.getBoundingClientRect().width),height:Math.round(img.getBoundingClientRect().height),shift:window.__shift};});
    assert.deepEqual([after.width,after.height],[box.width,box.height],"下好以后尺寸不变");
    assert.ok(after.shift<0.01,`第二次打开不跳：${after.shift}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }finally{await browser.close();}
 });
}
