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
 test(`${engine} 手机圆角设计：52px 顶栏、12px 卡片、紧凑视觉与完整触控区`,async()=>{
  for(const [kind,url,render] of [["list","/",P.listPage],["post","/post-1000-1",P.postPage],["new","/new-discussion",P.newPostPage],["space","/space/10",P.nativeSpacePage],["fans","/fans?type=follow",P.fansPage],["notification","/notification",P.notificationPage],["talk","/notification#/message?mode=talk&to=10",P.nativeTalkPage],["signin","/signIn.html",P.signInPage]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...mobile(),html:render({mobile:true})});
   try{await ready(page);const layout=await page.evaluate(()=>{const h=document.getElementById("nsk-head"),s=getComputedStyle(h);return{height:h.getBoundingClientRect().height,position:s.position,overflow:document.documentElement.scrollWidth>innerWidth+1,radius:getComputedStyle(document.body).getPropertyValue("--r").trim(),fields:[...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]),select,textarea")].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden").map(e=>parseFloat(getComputedStyle(e).fontSize))};});assert.equal(layout.height,52,kind);assert.equal(layout.position,"fixed",kind);assert.equal(layout.overflow,false,kind);assert.equal(layout.radius,"12px",kind);assert.ok(layout.fields.every(size=>size>=16),JSON.stringify({kind,layout}));
    if(kind==="list"){assert.equal(await page.locator(".post-title>a").first().evaluate(e=>getComputedStyle(e).fontSize),"15px");const a=await page.locator(".post-list-item>a:first-child img").first().boundingBox();assert.equal(a.width,24);assert.equal(await page.locator(".post-list-controler").evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"12px");assert.equal(await page.locator("#nsk-head .nsmax-header-action").last().evaluate(e=>getComputedStyle(e,"::before").borderTopWidth),"1px");}
    if(kind==="post"){assert.equal(await page.locator(".nsk-post h1").evaluate(e=>getComputedStyle(e).fontSize),"19px");assert.equal((await page.locator(".nsmax-author-col img").first().boundingBox()).width,40);assert.equal(await page.locator(".nsmax-editor-surface>[data-nsmax-editor-pane]").evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"8px");}
    if(kind==="new"){const aligned=await page.evaluate(()=>{const title=document.querySelector(".title-input input").getBoundingClientRect(),surface=document.querySelector(".nsmax-editor-surface").getBoundingClientRect();return Math.abs(title.left-surface.left)<2;});assert.equal(aligned,true,"标题与编辑区采用同一条左边线");}
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机隐藏入口：原关键词按钮可用，切换宽屏与手机不丢功能`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(375),html:P.listPage({mobile:true,count:30})});
  try{await ready(page);const button=page.locator(".post-list-controler .nsmax-mobile-filter");await button.tap();const pop=page.locator('.nsmax-pop[data-kind=keywords]');await pop.getByRole("textbox",{name:"要屏蔽的关键词",exact:true}).fill("香港");await pop.getByRole("button",{name:"添加",exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.querySelector(".post-list-item")).display==="none");await page.keyboard.press("Escape");
   await page.setViewportSize({width:1100,height:900});await page.waitForFunction(()=>document.querySelector('#nsk-head [data-nsmax-own-header=keywords]')&&!document.documentElement.hasAttribute("data-nsmax-touch"));
   await page.setViewportSize({width:375,height:844});await page.waitForSelector(".post-list-controler .nsmax-mobile-filter");await button.tap();assert.equal(await pop.isVisible(),true);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} iPhone 侧栏：两列版块导航与当前版块，大触控区，脚本设置入口可用`,async()=>{
  for(const guest of [false,true]) {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/categories/tech",{...mobile(320),html:P.listPage({mobile:true,guest})});
   try {await ready(page);await page.getByRole("button",{name:"打开菜单",exact:true}).tap();const drawer=page.locator("#left-slide-panel");
    const layout=await drawer.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,display:getComputedStyle(el.querySelector(".category-mobile > div")).display,small:[...el.querySelectorAll(".nsmax-account-menu > a,.nsmax-account-compose,.welcome-new a.btn,.category-mobile a")].filter(a=>a.getClientRects().length&&a.getBoundingClientRect().height<43).map(a=>a.textContent)}));
    assert.equal(layout.overflow,false);assert.equal(layout.display,"grid");assert.deepEqual(layout.small,[]);
    assert.equal(await drawer.locator('a[href="/categories/tech"]').getAttribute("aria-current"),"page");
    assert.equal(await drawer.locator('a[href="/"]').count(),1);
    await drawer.getByRole("button",{name:"脚本设置",exact:true}).tap();assert.equal(await drawer.getAttribute("aria-modal"),"false");
    assert.equal(await page.locator("#nspp-settings").locator("dialog").isVisible(),true);
    await page.locator("#nspp-settings").getByRole("button",{name:"关闭",exact:true}).tap();assert.equal(await page.evaluate(()=>document.body.style.position),"");assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} iPhone 侧栏：热榜按需加载，切换视图不重复请求`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true})});
  try {await ready(page);const requests=()=>page.evaluate(()=>window.__gmRequests.filter(url=>url.includes("api.bimg.eu.org")).length);
   assert.equal(await requests(),0);await page.getByRole("button",{name:"打开菜单",exact:true}).tap();const drawer=page.locator("#left-slide-panel");
   await page.waitForTimeout(100);assert.equal(await requests(),0);
   await drawer.getByRole("button",{name:"热榜",exact:true}).tap();await page.waitForSelector("#left-slide-panel .nsmax-hot-list a");
   assert.equal(await requests(),1);assert.equal(await drawer.locator(".nsmax-hot-list a").count(),10);assert.equal(await drawer.locator(".category-mobile").first().isVisible(),false);
   await drawer.getByRole("button",{name:"导航",exact:true}).tap();await drawer.getByRole("button",{name:"热榜",exact:true}).tap();await page.waitForTimeout(100);assert.equal(await requests(),1);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} iPhone 侧栏：最近浏览真实记录、空状态与功能关闭`,async()=>{
  for(const enabled of [true,false]) {
   const options=mobile();options.seed["nspp:settings:www.nodeseek.com"]["sb-recent-visits"]={enabled};options.seed["nspp:settings:www.nodeseek.com"]["hot-rankings"]={enabled};
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...options,html:P.listPage({mobile:true})});
   try {await ready(page);await page.getByRole("button",{name:"打开菜单",exact:true}).tap();const drawer=page.locator("#left-slide-panel");
    if(enabled){await drawer.getByRole("button",{name:"最近浏览",exact:true}).tap();assert.equal(await drawer.locator(".nsmax-drawer-empty").isVisible(),true);}
    else {assert.equal(await drawer.getByRole("button",{name:"最近浏览",exact:true}).count(),0);assert.equal(await drawer.getByRole("button",{name:"热榜",exact:true}).count(),0);}
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true}),init:'localStorage.setItem("nsmax:recent:1",JSON.stringify([{path:"/post-42-1",title:"本机浏览记录"}]));'});
  try{await ready(page);await page.getByRole("button",{name:"打开菜单",exact:true}).tap();const drawer=page.locator("#left-slide-panel");await drawer.getByRole("button",{name:"最近浏览",exact:true}).tap();const link=drawer.getByRole("link",{name:"本机浏览记录",exact:true});assert.equal(await link.getAttribute("href"),"/post-42-1");assert.equal(await drawer.locator(".nsmax-drawer-empty").isVisible(),false);await page.evaluate(()=>{localStorage.removeItem("nsmax:recent:1");window.dispatchEvent(new StorageEvent("storage",{key:"nsmax:recent:1",newValue:null}));});assert.equal(await drawer.getByRole("link",{name:"本机浏览记录",exact:true}).count(),0);assert.equal(await drawer.locator(".nsmax-drawer-empty").isVisible(),true);assert.deepEqual(errors,[]);}finally{await context.close();}
 });
 test(`${engine} iPhone 侧栏：键盘循环、Esc 和横向收起不干扰纵向滚动`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30})});
  try{await ready(page);await scrollTo(page,400);await tapVisible(page,page.getByRole("button",{name:"打开菜单",exact:true}));const drawer=page.locator("#left-slide-panel");
   await page.keyboard.press("Tab");assert.equal(await drawer.getByRole("button",{name:"关闭菜单",exact:true}).evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press("Shift+Tab");assert.equal(await drawer.getByRole("button",{name:"脚本设置",exact:true}).evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press("Escape");assert.equal(await drawer.getAttribute("aria-modal"),"false");
   await tapVisible(page,page.getByRole("button",{name:"打开菜单",exact:true}));
   await drawer.dispatchEvent("touchstart",{touches:[{identifier:0,clientX:200,clientY:300}]});await drawer.dispatchEvent("touchend",{changedTouches:[{identifier:0,clientX:190,clientY:100}]});assert.equal(await drawer.getAttribute("aria-modal"),"true");
   await drawer.dispatchEvent("touchstart",{touches:[{identifier:0,clientX:200,clientY:300}]});await drawer.dispatchEvent("touchend",{changedTouches:[{identifier:0,clientX:80,clientY:310}]});await page.waitForFunction(()=>document.body.style.position!=="fixed");assert.ok(Math.abs(await page.evaluate(()=>scrollY)-400)<3);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} iPhone：正文与输入区可读，主要操作 44px，编辑工具一行排开`,async()=>{
  for(const width of [390,320]) {
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile(width),html:P.postPage({mobile:true})});
  try {
   await ready(page);
   const sizes=await page.evaluate(()=>({touch:matchMedia("(pointer: coarse)").matches,body:parseFloat(getComputedStyle(document.querySelector(".nsk-post article.post-content")).fontSize),input:parseFloat(getComputedStyle(document.querySelector(".md-editor textarea")).fontSize),buttons:[...document.querySelectorAll("#nsk-head > .nsmax-header-action,.nsmax-editor-controls button,.nsmax-op-actions a,.nsmax-owner-only,.nsmax-layout-toggle,.nsmax-jump-reply,.nsmax-code>[data-nspp-copy]")].filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute("aria-label")||e.textContent.trim(),height:e.getBoundingClientRect().height})),rows:[...document.querySelectorAll(".nsmax-editor-controls button")].map(e=>Math.round(e.getBoundingClientRect().top)),clipped:[...document.querySelectorAll(".nsmax-editor-controls button")].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),overflow:document.documentElement.scrollWidth>innerWidth+1}));
   assert.equal(sizes.touch,true);assert.ok(sizes.body>=16,JSON.stringify(sizes));assert.ok(sizes.input>=16);
   assert.equal(await page.locator(".md-editor .nsmax-editor-surface > [data-nsmax-editor-pane]").evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"8px");
   assert.equal(await page.locator(".md-editor .nsmax-editor-surface textarea:not(.CodeMirror textarea)").evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"0px");
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
   assert.equal(await input.evaluate(e=>getComputedStyle(e,"::placeholder").opacity),"1","像参照站一样保留紧凑搜索输入");
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
   const save=await host.getByRole("button",{name:"刷新应用设置",exact:true}).boundingBox();assert.ok(save.y+save.height<=431,JSON.stringify(save));
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
 test(`${engine} iPhone：列表按参照站显示元信息，点整行空白也能进入帖子`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true}),pages:{"/post-1000-1":P.postPage({mobile:true})}});
  try {
   await ready(page);const row=page.locator("ul.post-list > li.post-list-item").first();
   const fonts=await page.evaluate(()=>{const root=document.documentElement,old=root.getAttribute('data-nsmax-size');const sizes=['standard','large','xlarge'].map(size=>{root.setAttribute('data-nsmax-size',size);return parseFloat(getComputedStyle(document.querySelector('.post-title > a')).fontSize);});root.setAttribute('data-nsmax-size',old);return sizes;});
   assert.deepEqual(fonts,[15,17,18],'手机列表的标准、大、特大字号均真实生效');
   assert.equal(await row.locator(".info-last-commenter").isVisible(),true);assert.equal(await row.locator(".info-views").isVisible(),true);
   // 点行里离所有链接都最远的空白处（2026-10-31：≥360px 信息排成一行后，右下角紧挨着时间链接，触摸会被吸附到链接上）
   const blank=await row.evaluate(li=>{const r=li.getBoundingClientRect(),links=[...document.querySelectorAll("a,button")].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());let best={x:0,y:0,d:-1};
    for(let x=r.left+4;x<r.right-4;x+=4)for(let y=r.top+4;y<r.bottom-4;y+=2){const d=Math.min(...links.map(b=>Math.hypot(Math.max(b.left-x,0,x-b.right),Math.max(b.top-y,0,y-b.bottom))));if(d>best.d)best={x,y,d};}return best;});
   assert.ok(blank.d>=16,JSON.stringify(blank));await page.touchscreen.tap(blank.x,blank.y);await page.waitForURL(/\/post-1000-1$/);assert.deepEqual(errors,[]);
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
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile(),html:P.listPage({mobile:true,count:30}),pages:{"/post-1000-1":P.postPage({mobile:true})}}); try {await ready(page);for(const y of [600,1200]){await page.keyboard.press("Shift");await scrollTo(page,y);await page.goto("https://www.nodeseek.com/post-1000-1");await ready(page);await page.goBack({waitUntil:"domcontentloaded"});await page.waitForLoadState("load");await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await ready(page);await page.waitForFunction(y=>Math.abs(scrollY-y)<4,y);assert.equal(await page.evaluate(()=>document.body.style.position),"");}assert.deepEqual(errors,[]);}finally{await context.close();}
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
