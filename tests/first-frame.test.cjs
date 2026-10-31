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
    assert.equal(state.actionTop>state.tabTop+10,wrapped,JSON.stringify(state));
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
    await page.mouse.move(8,8);
    await page.waitForTimeout(900);
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
