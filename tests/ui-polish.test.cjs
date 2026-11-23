"use strict";
// 全站 UI 走查修下来的细节：对齐、间距、触控区、对比度
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const phone=(width=390,height=844)=>({viewport:{width,height},device:{...devices["iPhone 13"],viewport:{width,height}},seed});
const desk={viewport:{width:1280,height:900},seed};
const near=(a,b,d=1)=>Math.abs(a-b)<=d;
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 手机楼层：时间贴正文左边线，楼号贴正文右边线，最后一个胶囊在楼号左边，三者同一条中线`,async()=>{
  // 2026-11-08 照原版：时间、操作胶囊、楼号排在头像下面一行（见 tests/mobile-details.test.cjs）；相对时间（超过 30 天的长日期胶囊另起一行）
  const created=new Date(Date.now()-2*36e5).toISOString();
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true}).replaceAll("2026-10-03T04:00:00.000Z",created).replaceAll("2026-10-03 12:00:00",created)});
  try{
   await ready(page);
   const s=await page.evaluate(()=>{
    const li=document.querySelector("ul.comments>li.content-item"),items=[...li.querySelectorAll(".comment-menu>.menu-item")].filter(e=>e.offsetWidth).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left),last=items[items.length-1],link=li.querySelector(".floor-link"),body=li.querySelector("article.post-content").getBoundingClientRect();
    const text=(el)=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect();};
    const name=text(li.querySelector(".nsmax-author-name"));
    const time=text(li.querySelector(".nsk-content-meta-info time")),lr=last.getBoundingClientRect();
    return{timeLeft:time.left,bodyLeft:body.left,lastRight:lr.right,lastMiddle:(lr.top+lr.bottom)/2,linkLeft:text(link).left,right:text(link).right,bodyRight:body.right,linkMiddle:(text(link).top+text(link).bottom)/2,timeMiddle:(time.top+time.bottom)/2,itemHeight:lr.height,name:name.width};
   });
   assert.ok(near(s.timeLeft,s.bodyLeft,1.5),JSON.stringify(s));
   assert.ok(s.lastRight<=s.linkLeft,JSON.stringify(s));
   assert.ok(near(s.right,s.bodyRight,1.5),JSON.stringify(s));
   assert.ok(near(s.linkMiddle,s.timeMiddle,2)&&near(s.lastMiddle,s.timeMiddle,2),JSON.stringify(s));
   assert.ok(s.itemHeight>=44,JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑端当按钮用的 div / 无 href 链接：双击不选中字（楼主行「回复」、楼层操作、列表排序）；固定高度的胶囊和按钮按雅黑 UI 度量字不被裁；页脚 1024px「Premium Providers」不省略`,async()=>{
  // 2026-11-22 Yiheng：搜索浮层胶囊「曝光」双击后一块亮黄（主题的 ::selection）、「搜索」按钮的字像被裁了。逐页走查同类问题
  if(engine!=="chromium")return;
  const FONT=`@font-face{font-family:"FakeUI";src:local("WenQuanYi Zen Hei");ascent-override:101.56%;descent-override:25.44%}
html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*):is(#x,#y,#z,*), html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*) body:is(#x,#y,#z,*) { --font-sans: "FakeUI", sans-serif !important; }`;
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,css:FONT,html:P.postPage()});
  try{
   await ready(post.page);
   await post.page.evaluate(()=>document.fonts.load('17px "FakeUI"',"国"));
   const us=await post.page.evaluate(()=>[".nsk-post .nsmax-op-actions > .nsmax-op-reply","#nsk-body-left .comment-menu > .menu-item","#nsk-body-left .comment-menu > .menu-item span"].map(s=>getComputedStyle(document.querySelector(s)).userSelect));
   assert.deepEqual(us,["none","none","none"]);
   // 真双击一下（拦住点击，不跳去回复）：什么都没选中
   await post.page.evaluate(()=>{for(const t of ["click","dblclick"])window.addEventListener(t,e=>{e.stopImmediatePropagation();e.preventDefault();},true);});
   const reply=post.page.locator(".nsk-post .nsmax-op-actions > .nsmax-op-reply");
   await reply.scrollIntoViewIfNeeded();
   const b=await reply.boundingBox();
   await post.page.mouse.dblclick(b.x+b.width/2,b.y+b.height/2);
   assert.equal(await post.page.evaluate(()=>getSelection().toString()),"","双击「回复」不选中字");
   // 帖子正文照样能选
   assert.notEqual(await post.page.evaluate(()=>getComputedStyle(document.querySelector(".nsk-post article.post-content p")).userSelect),"none");
   // 固定高度的控件：字（含下伸部分，按雅黑 UI 0.215em 算）在边框以内
   const cut=await post.page.evaluate(()=>{
    const cv=document.createElement("canvas").getContext("2d"),out=[];
    for(const el of document.querySelectorAll(".nsk-post .nsmax-op-action, .nsmax-editor-controls > button, .comment-container .nsmax-owner-only, .comment-container .nsmax-layout-toggle")){
     const cs=getComputedStyle(el),box=el.getBoundingClientRect(),fs=parseFloat(cs.fontSize);
     cv.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;const m=cv.measureText("国jgyp");
     const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())&&!n.data.trim());if(!n)continue;
     const r=document.createRange();r.selectNodeContents(n);const rect=[...r.getClientRects()].find(x=>x.width>0.5);if(!rect)continue;
     const base=rect.top+Math.round(m.fontBoundingBoxAscent),top=base-m.actualBoundingBoxAscent,bottom=base+Math.max(m.actualBoundingBoxDescent,fs*0.215);
     const c=Math.max(box.top+el.clientTop-top,bottom-(box.top+el.clientTop+el.clientHeight),box.left-rect.left,rect.right-box.right);
     if(c>0.5)out.push(`${n.data.trim()} ${c.toFixed(2)}px`);
    }
    return out;
   });
   assert.ok(/FakeUI/.test(await post.page.evaluate(()=>getComputedStyle(document.body).fontFamily)),"字体模拟生效");
   assert.deepEqual(cut,[],"固定高度控件里被裁的字");
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
  const list=await open(browser,"https://www.nodeseek.com/",{...desk,viewport:{width:1024,height:900},css:FONT,html:P.listPage({count:4})});
  try{
   await ready(list.page);
   assert.equal(await list.page.evaluate(()=>getComputedStyle(document.querySelector("#nsk-body-left > .post-list-controler > .sorter > a")).userSelect),"none");
   const foot=await list.page.evaluate(()=>{const a=[...document.querySelectorAll("body > footer .col a")].find(x=>/Premium/.test(x.textContent));return[a.scrollWidth,a.clientWidth];});
   assert.ok(foot[0]<=foot[1],`「Premium Providers」被省略：要 ${foot[0]}px，只有 ${foot[1]}px`);
   assert.deepEqual(list.errors,[]);
  }finally{await list.context.close();}
 });
 test(`${engine} 页脚：版权文字对比度够，手机上社交图标和标志同一行、贴齐右边线，链接点按范围够大`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:4})});
  try{
   await ready(page);
   await page.evaluate(()=>{document.querySelector("body > footer").scrollIntoView();});
   await page.waitForTimeout(200);
   const s=await page.evaluate(()=>{
    const logo=document.querySelector(".nsmax-footer-logo").getBoundingClientRect(),icons=[...document.querySelectorAll(".nsmax-footer-social svg")].map(e=>e.getBoundingClientRect()),about=document.querySelector(".nsmax-footer-about").getBoundingClientRect(),link=document.querySelector("body > footer .footer-links a"),foot=document.querySelector("body > footer .foot > div");
    const box=link.getBoundingClientRect(),last=icons[icons.length-1];
    return{logoMiddle:(logo.top+logo.bottom)/2,iconMiddle:(last.top+last.bottom)/2,iconRight:last.right,aboutRight:about.right,linkHeight:box.height,color:foot?getComputedStyle(foot).color:""};
   });
   // 2026-10-31：手机页脚压缩后，社交图标和标志同一行、放在右边（图标本身有内边距，右边留几像素）
   assert.ok(near(s.logoMiddle,s.iconMiddle,2.5),JSON.stringify(s));
   assert.ok(s.iconRight<=s.aboutRight+1&&s.iconRight>=s.aboutRight-14,JSON.stringify(s));
   assert.ok(s.linkHeight>=32,JSON.stringify(s));
   assert.notEqual(s.color,"rgb(153, 153, 153)");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机设置页、注册页和别的页面同一条边线，注册页密码框和其他输入框一样宽`,async()=>{
  for(const [url,render,selector] of [["/setting",P.settingPage,"#user-setting-panel"],["/register.html",P.registerPage,"#nsk-frame-block"],["/providers",P.providersPage,".nsk-providers"],["/friends",P.friendsPage,".nsk-friends"],["/setting",P.settingGuestPage,".nsmax-guest-empty"],["/notification",P.notificationGuestPage,".nsmax-guest-empty"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...phone(),html:render({mobile:true})});
   try{
    await ready(page);
    const s=await page.evaluate((sel)=>{
     const card=sel==="#user-setting-panel"?document.querySelector(".selector-right-side"):document.querySelector(sel);
     const box=card.getBoundingClientRect(),inputs=[...document.querySelectorAll("#register input:is([type=text],[type=password],[type=email])")].filter(e=>e.offsetWidth).map(e=>[e.type,e.getBoundingClientRect().width]);
     return{left:box.left,right:box.right,width:innerWidth,inputs};
    },selector);
    assert.ok(near(s.left,12),JSON.stringify(s));
    assert.ok(near(s.right,s.width-12),JSON.stringify(s));
    const password=s.inputs.find(([type])=>type==="password"),text=s.inputs.find(([type])=>type==="text");
    if(password&&text)assert.ok(near(password[1],text[1]),JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 邮箱登录：验证码输入框和登录按钮一样宽，不给空列留间距`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/signIn.html",{...phone(),html:P.emailSignInPage({mobile:true})});
  try{
   await ready(page);
   const s=await page.evaluate(()=>({input:document.querySelector('input[placeholder="Verification Code"]').getBoundingClientRect().right,button:[...document.querySelectorAll("fieldset button")].at(-1).getBoundingClientRect().right}));
   assert.ok(near(s.input,s.button),JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 签到页：手机上按钮和说明居中，电脑上日历一屏看得完`,async()=>{
  const mobile=await open(browser,"https://www.nodeseek.com/board",{...phone(),html:P.boardRealPage({mobile:true})});
  try{
   await ready(mobile.page);
   await mobile.page.waitForSelector(".nsmax-checkin-button");
   const s=await mobile.page.evaluate(()=>{const middle=(sel)=>{const r=document.querySelector(sel).getBoundingClientRect();return(r.left+r.right)/2;};return{button:middle(".nsmax-checkin-button"),note:middle(".nsmax-checkin-note"),streak:middle(".nsmax-checkin-streak")};});
   assert.ok(near(s.button,s.note,2),JSON.stringify(s));
   assert.ok(near(s.button,s.streak,2),JSON.stringify(s));
   assert.deepEqual(mobile.errors,[]);
  }finally{await mobile.context.close();}
  const wide=await open(browser,"https://www.nodeseek.com/board",{...desk,html:P.boardRealPage({})});
  try{
   await ready(wide.page);
   await wide.page.waitForSelector(".nsmax-checkin-day");
   const height=await wide.page.evaluate(()=>document.querySelector(".nsmax-checkin-day").getBoundingClientRect().height);
   assert.equal(height,64);
   assert.deepEqual(wide.errors,[]);
  }finally{await wide.context.close();}
 });
 test(`${engine} 320px 登录页不横向滚动，发帖页没有等级数据时不显示空徽章`,async()=>{
  const small=await open(browser,"https://www.nodeseek.com/signIn.html",{...phone(320,640),html:P.signInPage({mobile:true})});
  try{
   await ready(small.page);
   assert.equal(await small.page.evaluate(()=>document.documentElement.scrollWidth),320);
   assert.deepEqual(small.errors,[]);
  }finally{await small.context.close();}
  const editor=await open(browser,"https://www.nodeseek.com/new-discussion",{...desk,html:P.newPostPage({})});
  try{
   await ready(editor.page);
   const rank=await editor.page.evaluate(()=>{const el=document.querySelector("a.nsmax-account-rank");return el?{text:el.textContent,display:getComputedStyle(el).display}:null;});
   if(rank&&!rank.text)assert.equal(rank.display,"none");
   assert.deepEqual(editor.errors,[]);
  }finally{await editor.context.close();}
 });
 test(`${engine} 手机横屏：版块条和竖屏一样是胶囊`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(844,390),html:P.postPage({mobile:true})});
  try{
   await ready(page);
   const pill=await page.evaluate(()=>{const s=getComputedStyle(document.querySelector("body>header>ul.mobile-nav>li>a"),"::before");return{display:s.display,border:s.borderTopWidth};});
   assert.deepEqual(pill,{display:"block",border:"1px"});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机回复框：标题和内容同一条左边线，四个工具按钮文字同一条中线`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{
   await ready(page);
   const s=await page.evaluate(()=>{
    const ed=document.querySelector(".md-editor"),labels=[...ed.querySelectorAll(".nsmax-editor-controls>button .nsmax-action-label")];
    return{heading:ed.querySelector(".nsmax-editor-heading").getBoundingClientRect().left,first:ed.querySelector(".nsmax-editor-controls>button").getBoundingClientRect().left,tops:labels.map(l=>l.getBoundingClientRect().top),heights:labels.map(l=>l.getBoundingClientRect().height)};
   });
   assert.ok(near(s.heading,s.first),JSON.stringify(s));
   assert.ok(s.tops.every(t=>near(t,s.tops[0],.5)),JSON.stringify(s));
   assert.ok(s.heights.every(h=>h===s.heights[0]),JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机私信页：一行放得下时「全部已读」和标签同一条中线`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/message?mode=talk&to=7",{...phone(),html:P.nativeTalkPage({mobile:true})});
  try{
   await ready(page);
   await page.waitForSelector(".nsmax-message-tabs .nspp-messages-count");
   const s=await page.evaluate(()=>{const middle=(e)=>{const r=e.getBoundingClientRect();return(r.top+r.bottom)/2;};const button=[...document.querySelectorAll(".nspp-messages-top-actions button")].find(e=>e.offsetWidth);return button?{button:middle(button),tab:middle(document.querySelector(".nsmax-message-tabs"))}:null;});
   assert.ok(s&&near(s.button,s.tab,2),JSON.stringify(s));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 设置页子页：登录 IP 看得清，屏蔽列表没有灰底阴影，邮箱表单和密码框同宽，Telegram 头像是小头像`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/setting",{...desk,html:P.settingPage({})});
  try{
   await ready(page);
   const s=await page.evaluate(()=>{
    const host=document.querySelector(".selector-right-side");
    const box=document.createElement("div");
    // 内联样式照抄真站这几处的计算值：不修的话黑底、灰底阴影、大头像都会留下来
    box.innerHTML='<div class="ip-list" style="background:rgba(0,0,0,.72);color:#fff;padding:10px;border-radius:12px"><div class="ip-item"><a href="#">1.2.3.4</a> <p>3 days ago</p></div><div class="ip-item"><a href="#">5.6.7.8</a> <p>4 days ago</p></div></div><div class="block-list" style="background:rgb(247,248,250);box-shadow:rgba(0,0,0,.1) 4px 4px 8px;padding:15px"><form class="pure-form"><input></form></div><form class="pure-form"><input type="password"><div class="mail-row" style="display:flex"></div></form><div style="text-align:center"><img class="avatar" style="width:320px;height:320px" alt=""><p>name</p></div><label class="switch"><input type="checkbox" checked><span class="slider"><span class="circle"></span></span></label>';
    // HTML 解析器会丢掉嵌套的 form，真站这层是脚本创建的，这里也用 DOM 接口建
    const nested=document.createElement("form");
    nested.className="pure-form";
    nested.style.width="300px";
    nested.append(Object.assign(document.createElement("input"),{className:"mail"}));
    box.querySelector(".mail-row").append(nested);
    host.append(box);
    const css=(sel)=>getComputedStyle(box.querySelector(sel));
    return{bg:css(".ip-list").backgroundColor,a:css(".ip-item a").color,time:css(".ip-item p").color,text:getComputedStyle(document.body).color,blockShadow:css(".block-list").boxShadow,blockBg:css(".block-list").backgroundColor,password:box.querySelector("input[type=password]").getBoundingClientRect().width,mail:box.querySelector("input.mail").getBoundingClientRect().width,avatar:box.querySelector("img.avatar").getBoundingClientRect().width,left:css("img.avatar + p").textAlign,track:[box.querySelector("label.switch").offsetWidth,box.querySelector("label.switch").offsetHeight],knob:box.querySelector(".circle").offsetWidth,on:css(".slider").backgroundColor};
   });
   assert.notEqual(s.bg,"rgba(0, 0, 0, 0.72)");
   assert.equal(s.a,s.text,"IP 文字和正文同色");
   assert.notEqual(s.time,"rgb(255, 255, 255)");
   assert.equal(s.blockShadow,"none");
   assert.equal(s.blockBg,"rgba(0, 0, 0, 0)");
   assert.equal(s.mail,s.password,"邮箱框和密码框同宽");
   assert.equal(s.avatar,64);
   assert.deepEqual(s.track,[40,23],"开关和 sb.sb 一样 40×23");
   assert.equal(s.knob,15);
   assert.equal(s.on,"rgb(28, 28, 30)");
   assert.equal(s.left,"left");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机按下反馈：没有系统蓝色高亮，按钮和列表行按下时有变化`,async()=>{
  const init=`window.__touchListeners=0;{const add=document.addEventListener;document.addEventListener=function(type,...rest){if(type==="touchstart")window.__touchListeners++;return add.call(this,type,...rest);};}`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:6}),init});
  try{
   await ready(page);
   // Windows 版 WebKit 没有这个属性，只在支持它的引擎上比
   const tap=await page.evaluate(()=>getComputedStyle(document.documentElement).webkitTapHighlightColor);
   if(tap!==undefined)assert.equal(tap,"rgba(0, 0, 0, 0)");
   assert.ok(await page.evaluate(()=>window.__touchListeners)>=1,"iOS Safari 需要 touchstart 才会触发 :active");
   const row=page.locator("#nsk-body-left ul.post-list>li.post-list-item").nth(1);
   const box=await row.boundingBox();
   const before=await row.evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.mouse.move(box.x+box.width-30,box.y+box.height-12);
   await page.mouse.down();
   await page.waitForTimeout(100);
   const during=await row.evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.mouse.move(2,2);
   await page.mouse.up();
   assert.notEqual(during,before);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑尺寸和 sb.sb 现版一致：工具条、列表行、回复头、登录页`,async()=>{
  const site={...desk,seed:{"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system",fontSize:"site"}}}};
  const box=(page,sel)=>page.locator(sel).first().evaluate(e=>e.getBoundingClientRect().height);
  const css=(page,sel,prop)=>page.locator(sel).first().evaluate((e,prop)=>getComputedStyle(e)[prop],prop);
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...site,html:P.listPage({count:4})});
   try{
    await ready(page);
    assert.ok(near(await box(page,".post-list-controler"),50.5,.6));
    assert.ok(near(await box(page,"li.post-item:nth-child(2)"),72.25,.6));
    assert.equal(await css(page,".nsk-pager.pager-bottom .nsmax-pager-ellipsis","letterSpacing"),"normal");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...site,html:P.postPage({})});
   try{
    await ready(page);
    assert.ok(near(await box(page,".nsmax-owner-only"),28,.6),"回复栏开关和楼层操作一样 28px（2026-11-09 电脑端统一）");
    assert.ok(near(await box(page,".comment-container > div:first-child"),51,.6),"回复头 51px，和列表工具条、通知标签栏一样高");
    assert.equal(await css(page,".nsk-post article.post-content p","marginBottom"),"12.75px");
    assert.equal(await css(page,".nsk-post > .post-title h1 a","letterSpacing"),"-0.21px");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/signIn.html",{...site,html:P.signInPage({})});
   try{
    await ready(page);
    assert.equal(await css(page,".nsmax-auth-tabs a","lineHeight"),"26.25px");
    assert.equal(await css(page,"#login-panel label","lineHeight"),"22.75px");
    assert.equal(await css(page,"#stacked-email","paddingLeft"),"12px");
    assert.equal(await css(page,"#stacked-email","paddingTop"),"0px");
    assert.equal(await css(page,"#stacked-password","paddingRight"),"56px");
    assert.ok(near(await box(page,".nsmax-password-toggle"),28,.6));
    assert.equal(await css(page,".nsmax-password-toggle","fontSize"),"12px");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 深色下列表标题悬停变链接色`,async()=>{
  const dark={...desk,colorScheme:"dark",seed:{"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system",colorMode:"dark"}}}};
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...dark,html:P.listPage({count:4})});
  try{
   await ready(page);
   const title=page.locator("#nsk-body-left .post-title > a").first();
   await title.hover();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector("#nsk-body-left .post-title > a")).color==="rgb(255, 217, 119)",null,{timeout:2500}).catch(()=>{});
   assert.equal(await title.evaluate(e=>getComputedStyle(e).color),"rgb(255, 217, 119)");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑悬停和 sb.sb 一致：元信息和右栏链接下划线，楼号变正文色，帖子标题和版块胶囊不加下划线`,async()=>{
  const list=P.listPage({count:4}),post=P.postPage({});
  const cases=[
   ["/",list,"#nsk-body-left .post-meta .info-author a","textDecorationLine","underline"],
   ["/",list,"#nsk-body-left .post-meta .post-forum-badge","textDecorationLine","none"],
   ["/",list,".nsmax-sb-account .nsmax-account-name","textDecorationLine","underline"],
   ["/",list,".nsmax-sb-account .nsmax-account-stat","textDecorationLine","underline"],
   // 今日热门：线只画在标题下面，整条链接（名次、浏览数）不画（v1.9.49）
   ["/",list,".nsmax-hot-list a .nsmax-hot-text","textDecorationLine","underline"],
   ["/",list,".nsmax-hot-list a","textDecorationLine","none"],
   ["/",list,"#nsk-right-panel-container a[href*='new-discussion']","textDecorationLine","none"],
   ["/post-1000-1",post,"ul.comments .floor-link","color","rgb(28, 28, 30)"],
   ["/post-1000-1",post,"ul.comments .floor-link","textDecorationLine","none"],
   ["/post-1000-1",post,".post-title-link","textDecorationLine","none"]
  ];
  for(const [url,html,selector,prop,value] of cases){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    const target=page.locator(selector+":visible").first();
    // 右栏会在未读数回来后重画一次，重画时悬停状态会丢，多悬停几次
    let got;
    for(let i=0;i<8&&got!==value;i++){await target.hover();await page.waitForTimeout(120);got=await target.evaluate((el,prop)=>getComputedStyle(el)[prop],prop);}
    assert.equal(got,value,selector);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机分页：三位数页码的小胶囊不挤，面包屑和小页码的点按范围够大`,async()=>{
  const credit=await open(browser,"https://www.nodeseek.com/credit",{...phone(),html:P.creditPage({mobile:true})});
  try{
   await ready(credit.page);
   const s=await credit.page.evaluate(()=>{const last=[...document.querySelectorAll(".nsk-pager a")].find(a=>/\d{3,}$/.test(a.textContent.trim()));if(!last)return null;const r=document.createRange();r.selectNodeContents(last);return{box:last.getBoundingClientRect().width,text:r.getBoundingClientRect().width};});
   assert.ok(s,"有三位数页码");
   assert.ok(s.box-12-s.text>=8,`胶囊比文字至少宽 8px：${JSON.stringify(s)}`);
   assert.deepEqual(credit.errors,[]);
  }finally{await credit.context.close();}
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{
   await ready(post.page);
   assert.ok(await post.page.evaluate(()=>document.querySelector(".nsmax-crumb>a").getBoundingClientRect().height)>=36);
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
  const list=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:8})});
  try{
   await ready(list.page);
   const hit=await list.page.evaluate(()=>{const a=document.querySelector(".nsmax-topic-pages>a"),b=getComputedStyle(a,"::after");return{height:a.getBoundingClientRect().height+2*Math.abs(parseFloat(b.top)),position:b.position};});
   assert.equal(hit.position,"absolute");
   assert.ok(hit.height>=40,JSON.stringify(hit));
   assert.deepEqual(list.errors,[]);
  }finally{await list.context.close();}
 });
 test(`${engine} 交易小标已去掉（2026-11-09 用户：「出击呀收机呀那些我都不要了」）：标题开头的【出】【收】【求】[已出] 原样显示，不画小标`,async()=>{
  for(const [label,opts,url,html] of [["电脑",desk,"https://www.nodeseek.com/",P.listPage({count:6})],["手机",phone(),"https://www.nodeseek.com/",P.listPage({mobile:true,count:6})]]){
   const marked=html.replace("求推荐稳定的美西 VPS","【出】 美西 VPS 2C4G").replace("分享一个 Docker 一键部署脚本","[已出] 分享一个 Docker").replace("Cloudflare Tunnel 踩坑记录","[车找人1/2] Gemini 家庭组");
   const {context,page,errors}=await open(browser,url,{...opts,html:marked});
   try{
    await ready(page);
    const s=await page.evaluate(()=>[...document.querySelectorAll(".post-list-item .post-title > a")].map(a=>({text:a.textContent,shown:a.innerText.trim(),spans:a.querySelectorAll("span").length})));
    const by=t=>s.find(x=>x.text.includes(t));
    assert.equal(by("美西").shown,"【出】 美西 VPS 2C4G",label);
    assert.equal(by("Docker").shown,"[已出] 分享一个 Docker",label);
    assert.equal(by("Gemini").shown,"[车找人1/2] Gemini 家庭组",label);
    assert.equal(by("日本原生").shown,"【收】日本原生 IP 机器",label);
    assert.ok(s.every(x=>x.spans===0),JSON.stringify(s));
    assert.equal(await page.locator(".nsmax-mk").count(),0,label);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 最近浏览标出正在看的这篇；手机未读通知整行直角；手机热榜数字列等宽`,async()=>{
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,viewport:{width:1440,height:1400},html:P.postPage()});
  try{
   await ready(post.page);
   await post.page.waitForSelector(".nsmax-recent-panel a");
   const s=await post.page.evaluate(()=>[...document.querySelectorAll(".nsmax-recent-panel a")].map(a=>({href:a.getAttribute("href"),current:a.getAttribute("aria-current"),color:getComputedStyle(a).color,subtle:getComputedStyle(document.documentElement).getPropertyValue("--text-subtle").trim()})));
   const current=s.find(x=>x.href==="/post-1000-1");
   assert.equal(current?.current,"page",JSON.stringify(s));
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
  const notice=await open(browser,"https://www.nodeseek.com/notification",{...phone(),html:P.notificationPage({mobile:true})});
  try{
   await ready(notice.page);
   await notice.page.waitForSelector(".nsmax-notice-row[data-unread]");
   assert.equal(await notice.page.locator(".nsmax-notice-row[data-unread]").first().evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"0px");
   assert.deepEqual(notice.errors,[]);
  }finally{await notice.context.close();}
  const home=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:4})});
  try{
   await ready(home.page);
   await home.page.getByRole("button",{name:"打开菜单",exact:true}).tap();
   await home.page.locator("#left-slide-panel").getByRole("button",{name:"热榜",exact:true}).tap();
   await home.page.waitForSelector("#left-slide-panel .nsmax-hot-list a");
   const widths=await home.page.evaluate(()=>[...document.querySelectorAll("#left-slide-panel .nsmax-hot-text")].map(e=>Math.round(e.getBoundingClientRect().width)));
   assert.ok(widths.length>=10,JSON.stringify(widths));
   assert.ok(Math.max(...widths)-Math.min(...widths)<=1,`标题列一样宽：${JSON.stringify(widths)}`);
   assert.deepEqual(home.errors,[]);
  }finally{await home.context.close();}
 });
 test(`${engine} 设置搜索：挂在开关上的选项和选项名也能搜到，多个词同时匹配并标出命中处；Esc 先清空搜索再关闭`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage({count:4})});
  try{
   await ready(page);
   await page.getByRole("button",{name:"NodeSeek Max 设置",exact:true}).click();
   const host=page.locator("#nspp-settings"),search=host.getByRole("searchbox",{name:"搜索设置"});
   const modules=()=>host.locator(".module").evaluateAll(list=>list.map(m=>m.dataset.feature));
   await search.fill("热榜");
   await page.waitForTimeout(300);
   assert.ok((await modules()).includes("hot-rankings"),JSON.stringify(await modules()));
   assert.ok(await host.locator(".module mark").count()>=1);
   await search.fill("深色 inter");
   await page.waitForTimeout(300);
   assert.deepEqual(await modules(),["modern-theme"]);
   const marks=await host.locator(".module mark").allTextContents();
   assert.ok(marks.length>=2&&marks.every(t=>/^(深色|inter)$/i.test(t))&&marks.some(t=>/inter/i.test(t)),JSON.stringify(marks));
   assert.equal(await host.locator('.module[data-feature="modern-theme"] .module-title').textContent(),"主题样式");
   await search.fill("zz不存在");
   await page.waitForTimeout(300);
   assert.match(await host.locator(".empty").textContent(),/zz不存在/);
   await search.press("Escape");
   assert.equal(await search.inputValue(),"");
   assert.equal(await host.locator("dialog").isVisible(),true,"第一次 Esc 只清空搜索");
   assert.ok(await host.locator(".module").count()>1);
   await search.press("Escape");
   await page.waitForTimeout(200);
   assert.equal(await host.locator("dialog").isVisible(),false,"第二次 Esc 关闭设置");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 最近浏览：手机菜单里列表有排版（无圆点、44px 点按区、标题和热榜同字号），「清空」要点两次才清掉`,async()=>{
  const recs=JSON.stringify(Array.from({length:4},(_,i)=>({path:`/post-${70+i}-1`,title:`之前看过的帖子 ${i+1}`})));
  const init=`for(const k of ["1","10","guest"])localStorage.setItem("nsmax:recent:"+k,${JSON.stringify(recs)})`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true}),init});
  try{
   await ready(page);
   await page.getByRole("button",{name:"打开菜单",exact:true}).tap();
   await page.locator("#left-slide-panel").getByRole("button",{name:"最近浏览",exact:true}).tap();
   const panel=page.locator("#left-slide-panel .nsmax-recent-panel");
   await panel.locator("a").first().waitFor();
   const s=await panel.evaluate(p=>({list:getComputedStyle(p.querySelector("ul")).listStyleType,h2:getComputedStyle(p.querySelector("h2")).fontSize,heights:[...p.querySelectorAll("a")].map(a=>a.getBoundingClientRect().height),clear:p.querySelector(".nsmax-recent-clear").getBoundingClientRect().height,count:p.querySelectorAll("a").length}));
   assert.equal(s.list,"none",JSON.stringify(s));
   assert.equal(s.h2,"15px",JSON.stringify(s));
   assert.ok(s.heights.every(h=>h>=44)&&s.clear>=44,JSON.stringify(s));
   assert.equal(s.count,5,JSON.stringify(s));
   const clear=panel.locator(".nsmax-recent-clear");
   await clear.tap();
   assert.equal(await clear.textContent(),"确认清空");
   assert.equal(await panel.locator("a").count(),5,"点一次不清");
   await clear.tap();
   await page.waitForFunction(()=>!document.querySelector("#left-slide-panel .nsmax-recent-panel"));
   assert.equal(await page.locator("#left-slide-panel .nsmax-drawer-empty").isVisible(),true);
   const stored=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("nsmax:recent:")).map(k=>JSON.parse(localStorage.getItem(k)).length));
   assert.ok(stored.includes(0),JSON.stringify(stored));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 关键词屏蔽：大小写不同的同一个词不重复添加，已有的标签闪一下并清空输入框；输入框只有一圈黄色焦点`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage({count:4})});
  try{
   await ready(page);
   await page.getByRole("button",{name:"关键词屏蔽"}).click();
   const input=page.locator(".nsmax-pop[data-kind=keywords] input[type=text]");
   await input.fill("VPS");await input.press("Enter");
   await page.locator(".nsmax-pop-chips li").first().waitFor();
   await input.fill("vps");await input.press("Enter");
   assert.deepEqual(await page.locator(".nsmax-pop-chips li").allTextContents(),["VPS"]);
   assert.equal(await input.inputValue(),"");
   assert.equal(await page.locator(".nsmax-pop-chips li[data-flash]").count(),1);
   await input.fill("/VPS/");await input.press("Enter");
   await page.waitForFunction(()=>document.querySelectorAll(".nsmax-pop-chips li").length===2);
   assert.equal(await input.evaluate(e=>getComputedStyle(e).outlineStyle),"none");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 资料卡备注：直接写本机备注，名字后马上出现；移出卡片不收起，Esc 只取消编辑，清空即删除这一行`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage({count:4}),seed:{...seed,"nspp:settings:www.nodeseek.com":{...seed["nspp:settings:www.nodeseek.com"],"user-notes":{notes:"# 备注\nuser1=老朋友"}}}});
  try{
   await ready(page);
   const badges=()=>page.evaluate(()=>[...document.querySelectorAll(".nspp-user-note")].map(e=>e.previousElementSibling?.textContent.trim()+"="+e.textContent));
   assert.deepEqual(await badges(),["user1=老朋友"]);
   await page.locator('.post-list-item .info-author a[href="/space/10"]').hover();
   const note=page.locator(".nsmax-person-pop .nsmax-person-note");
   await note.waitFor();
   assert.equal(await note.textContent(),"备注");
   await note.click();
   const input=page.locator(".nsmax-person-note-form input");
   assert.equal(await input.evaluate(e=>e===document.activeElement),true);
   await page.keyboard.type("  卖鸡的  大佬 ");
   await page.mouse.move(1200,880);await page.waitForTimeout(400);
   assert.equal(await input.count(),1,"正在写备注时鼠标移出不收起卡片");
   await input.press("Enter");
   assert.equal(await note.textContent(),"卖鸡的 大佬");
   assert.deepEqual((await badges()).sort(),["user0=卖鸡的 大佬","user1=老朋友"]);
   await note.click();await input.press("Escape");
   assert.equal(await page.locator(".nsmax-person-pop").count(),1,"Esc 只关输入框");
   assert.equal(await page.locator(".nsmax-person-foot").isVisible(),true);
   await page.keyboard.press("Escape");
   assert.equal(await page.locator(".nsmax-person-pop").count(),0);
   await page.locator('.post-list-item .info-author a[href="/space/10"]').hover();
   await note.waitFor();await note.click();await input.fill("");await input.press("Enter");
   assert.equal(await note.textContent(),"备注");
   assert.deepEqual(await badges(),["user1=老朋友"]);
   await page.keyboard.press("Escape");
   await page.locator('.post-list-item .info-author a[href="/space/11"]').hover();
   await page.waitForFunction(()=>document.querySelector(".nsmax-person-pop .nsmax-person-note")?.textContent==="老朋友");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 手机楼中楼：时间和「#楼号 回复 引用…」同一行同一条中线，时间贴内容左边线、操作靠右；外层楼号在头像下面那一行`,async()=>{
  // 2026-11-06 用户截图：时间单独在左上，操作行低半行、缩进一大截，一条回复占三行高
  const recent=`datetime="${new Date(Date.now()-3e4).toISOString()}"`;
  const html=P.postPage({mobile:true}).replace(/datetime="[^"]+"/g,recent)
   .replace("<p>价格不错，帮顶</p>",'<p><a href="/member?t=buyer">@buyer</a> <a href="/post-1000-1#1" target="_self">#1</a> 价格不错，帮顶</p>');
  for(const width of [390,340]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(width),html});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-floor-box>.nsmax-nested-replies>li.content-item .nsmax-floor-actions");
    const s=await page.evaluate(()=>{
     const li=document.querySelector(".nsmax-floor-box>.nsmax-nested-replies>li.content-item");
     const box=(e)=>e.getBoundingClientRect();
     const text=(e)=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect();};
     const time=text(li.querySelector(".content-info time")),article=box(li.querySelector("article.post-content")),actions=box(li.querySelector(".nsmax-floor-actions")),item=li.querySelector(".nsmax-floor-actions .menu-item"),liBox=box(li);
     const outer=document.querySelector("ul.comments>li.content-item"),link=box(outer.querySelector(".floor-link")),col=box(outer.querySelector(".nsmax-author-col")),menu=box(outer.querySelector(".nsmax-floor-actions>.comment-menu"));
     return{timeMid:(time.top+time.bottom)/2,actMid:(actions.top+actions.bottom)/2,timeLeft:time.left,articleLeft:article.left,actRight:actions.right,liRight:liBox.right,itemHeight:box(item).height,overlap:actions.left<time.right,actTop:actions.top+5,timeBottom:time.bottom,linkInHead:link.top>=col.bottom-1&&link.bottom<=box(outer.querySelector('article.post-content')).top+1,linkAboveMenu:Math.abs((link.top+link.bottom)/2-(menu.top+menu.bottom)/2)<2||text(outer.querySelector('.floor-link')).bottom<=menu.top+1};
    });
    // 390px 放得下：同一行同一条中线；340px 放不下时操作整排换到下一行，不压住时间
    if(width>=360){assert.ok(near(s.timeMid,s.actMid,2),JSON.stringify(s));assert.equal(s.overlap,false,JSON.stringify(s));}
    else assert.ok(near(s.timeMid,s.actMid,2)&&!s.overlap||s.actTop>=s.timeBottom-1,JSON.stringify(s));
    assert.ok(near(s.timeLeft,s.articleLeft,1.5),JSON.stringify(s));
    assert.ok(s.actRight<=s.liRight+6.5,JSON.stringify(s));
    assert.ok(s.itemHeight>=44,JSON.stringify(s));
    assert.equal(s.linkInHead,true,`${width}px 外层楼号在作者栏下面、正文上面 ${JSON.stringify(s)}`);
    assert.equal(s.linkAboveMenu,true,JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机主帖：站点把空占位换成「点赞 加鸡腿…」那一刻，正文宽度和作者行不变（不再跳一下）`,async()=>{
  // 2026-11-06 真站逐帧：空的 .comment-menu-mount 排在第 2 列，一列的网格多出 40px 隐形列，换成真按钮时正文变宽重排
  const html=P.postPage({mobile:true}).replace(/<div class="topic-warning"><\/div> (<div class="comment-menu">[\s\S]*?<\/div><\/div>)<\/div><\/div>/,(all,menu)=>`<div class="topic-warning"></div> <div class="comment-menu-mount"></div><template id="real-menu">${menu}</template></div></div>`);
  assert.match(html,/comment-menu-mount/);
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html});
  try{
   await ready(page);
   const measure=()=>page.evaluate(()=>{const item=document.querySelector(".nsk-post>.content-item"),article=item.querySelector("article.post-content").getBoundingClientRect(),col=item.querySelector(".nsmax-author-col")?.getBoundingClientRect();return{columns:getComputedStyle(item).gridTemplateColumns.split(" ").length,width:Math.round(article.width),top:Math.round(article.top),col:col&&Math.round(col.height)};});
   const before=await measure();
   await page.evaluate(()=>{const mount=document.querySelector(".nsk-post .comment-menu-mount");mount.replaceWith(document.getElementById("real-menu").content.cloneNode(true));});
   await page.waitForTimeout(300);
   const after=await measure();
   assert.equal(before.columns,3,JSON.stringify(before));
   assert.deepEqual(after,before);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 表情贴图：最高 64px、和文字竖直居中，单独一段也不当成大图；深色模式垫浅色底，透明线稿看得清`,async()=>{
  // 2026-11-06 用户截图：透明底黑线稿贴图在深色卡片上几乎看不见，按原图一百多像素排在基线上，一句话上下撑出两大块空白
  const svg=encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><circle cx='80' cy='70' r='45' fill='none' stroke='black' stroke-width='3'/></svg>");
  const st=`<img src="data:image/svg+xml,${svg}#/static/image/sticker/test/1.png" alt="sticker">`;
  for(const dark of [true,false]){
   const html=P.postPage({mobile:true,dark}).replace("<p>收了，私信你</p>",`<p>闲鱼上有卖这个的吗${st}</p><p>${st}</p>`);
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html,colorScheme:dark?"dark":"light"});
   try{
    await ready(page);
    const s=await page.evaluate(()=>[...document.querySelectorAll('ul.comments article.post-content img[src*="/static/image/sticker/"]')].map(i=>{const st=getComputedStyle(i);return{h:i.getBoundingClientRect().height,va:st.verticalAlign,bg:st.backgroundColor,big:i.classList.contains("nsmax-post-image")};}));
    assert.equal(s.length,2);
    for(const one of s){
     assert.ok(one.h<=68&&one.h>=40,JSON.stringify(s));
     assert.equal(one.va,"middle");
     assert.equal(one.big,false,"单独一段的贴图不当大图");
     if(dark)assert.notEqual(one.bg,"rgba(0, 0, 0, 0)");else assert.equal(one.bg,"rgba(0, 0, 0, 0)");
    }
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 个人空间主题 / 回帖列表：包在 .selector-right-side 里也接进标签条的卡片（边框、下圆角），阅读权限标记是标题前面的浅红「Lv1」小标（2026-11-13 和首页列表统一：以前跟在标题后面、只有一个「1」）`,async()=>{
  for(const [name,html,url] of [["主题",P.spaceTopicsPage({mobile:true}),"/space/10#/discussions"],["回帖",P.spaceCommentsPage({mobile:true}),"/space/10#/comments"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...phone(),html});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{
     const w=document.querySelector(".selector-right-side > .discussion-wrapper"),cw=getComputedStyle(w);
     const first=w.querySelector(":scope > div.discussion-item > a, :scope > a.discussion-item");
     const mark=first.querySelector(":scope > span[data-nsmax-lock]"),title=first.querySelector(":scope > span:not([data-nsmax-lock])");const ct=getComputedStyle(title),cm=getComputedStyle(mark),ca=getComputedStyle(mark,"::after");
     const bar=document.querySelector(".selector > a.select-item.active, .selector > a.select-item.router-link-active").getBoundingClientRect();
     return{border:cw.borderLeftWidth+" "+cw.borderBottomWidth,radius:parseFloat(cw.borderBottomLeftRadius),left:w.getBoundingClientRect().left,right:w.getBoundingClientRect().right,vw:innerWidth,
      titleSize:parseFloat(ct.fontSize),markSize:parseFloat(ca.fontSize),label:ca.content,first:first.firstElementChild===mark,gap:title.getBoundingClientRect().left-mark.getBoundingClientRect().right,markBorder:cm.borderTopWidth,markBg:cm.backgroundColor,markColor:cm.color,titleColor:ct.color,
      markMiddle:(mark.getBoundingClientRect().top+mark.getBoundingClientRect().bottom)/2,titleMiddle:(title.getBoundingClientRect().top+title.getBoundingClientRect().bottom)/2,below:w.getBoundingClientRect().top>=bar.bottom-1};
    });
    assert.equal(s.border,"1px 1px",name+JSON.stringify(s));
    assert.ok(s.radius>=8&&s.below&&s.left>=0&&s.right<=s.vw,name+JSON.stringify(s));
    assert.ok(s.markSize<s.titleSize&&s.markBorder==="0px"&&s.markBg!=="rgba(0, 0, 0, 0)"&&s.markColor!==s.titleColor,name+JSON.stringify(s));
    assert.ok(near(s.markMiddle,s.titleMiddle,2.5),name+JSON.stringify(s));
    assert.ok(s.first&&/Lv/.test(s.label)&&/1/.test(s.label)&&near(s.gap,6,1),name+" 锁在标题前面、写成 Lv1、和标题隔 6px："+JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑个人主页：1200px 以上九格数据排一行、窄一些三列；「介绍」标签藏起来时「主题」不再多空 14px`,async()=>{
  for(const [width,cols] of [[1440,9],[1100,3]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{viewport:{width,height:900},seed,html:P.spaceTopicsPage()});
   try{
    await ready(page);
    const s=await page.evaluate(()=>{
     const cells=[...document.querySelectorAll(".head-container > .card-block > .nsmax-user-stat")].filter(c=>c.offsetWidth);
     const tabs=[...document.querySelectorAll(".selector > a.select-item")].filter(t=>t.offsetWidth);
     return{cols:new Set(cells.map(c=>Math.round(c.getBoundingClientRect().left))).size,rows:new Set(cells.map(c=>Math.round(c.getBoundingClientRect().top))).size,count:cells.length,
      firstTabGap:Math.round(tabs[0].getBoundingClientRect().left-document.querySelector(".selector").getBoundingClientRect().left),gaps:tabs.slice(1).map((t,i)=>Math.round(t.getBoundingClientRect().left-tabs[i].getBoundingClientRect().right)),overflow:document.documentElement.scrollWidth-Math.round(document.documentElement.getBoundingClientRect().width)};
    });
    assert.equal(s.count,9,JSON.stringify(s));
    assert.equal(s.cols,cols,width+JSON.stringify(s));
    assert.equal(s.rows,9/cols,width+JSON.stringify(s));
    assert.equal(s.firstTabGap,15,width+JSON.stringify(s));
    assert.ok(s.gaps.every(g=>g===14),width+JSON.stringify(s));
    assert.equal(s.overflow,0);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑通知页未读：左边 2px 黄线，底色比品牌浅底淡（深色下不再一整块土黄）`,async()=>{
  for(const dark of [false,true]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{viewport:{width:1440,height:900},seed,colorScheme:dark?"dark":"light",html:P.notificationPage({dark})});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-notice-row[data-unread]");
    const s=await page.evaluate(()=>{
     const row=document.querySelector(".nsmax-notice-row[data-unread]"),c=getComputedStyle(row);
     const probe=document.createElement("i");probe.style.color="var(--brand-soft)";document.body.append(probe);const soft=getComputedStyle(probe).color;probe.remove();
     return{bg:c.backgroundColor,shadow:c.boxShadow,soft};
    });
    assert.match(s.shadow,/inset/,JSON.stringify(s));
    assert.notEqual(s.bg,s.soft,JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 个人主页切标签：新列表到之前卡片撑住原来的高度，不先闪「还没有……」，到了就放开`,async()=>{
  // 2026-11-09 在用户 Chrome 里录的：站点先清空旧列表、0.3–0.4 秒后才放新的，中间卡片缩成一行「还没有发过主题」，页脚和右栏跟着跳
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/collections",{...desk,html:P.spaceCollectionsPage()});
  try{
   await ready(page);
   await page.evaluate(()=>{
    const box=document.querySelector(".selector"),list=box.querySelector(".discussion-wrapper"),tab=[...box.querySelectorAll("a.select-item")].find(a=>a.textContent==="主题");
    window.__space={before:box.offsetHeight,min:Infinity,labels:new Set()};
    const sample=()=>{if(window.__space.done)return;window.__space.min=Math.min(window.__space.min,box.offsetHeight);window.__space.labels.add(getComputedStyle(list,"::after").content);requestAnimationFrame(sample);};
    tab.addEventListener("click",(event)=>{
     event.preventDefault();
     list.replaceChildren();
     for(const a of box.querySelectorAll("a.select-item"))a.classList.toggle("active",a===tab);
     requestAnimationFrame(sample);
     setTimeout(()=>{window.__space.gap=box.style.getPropertyValue("min-height");window.__space.done=true;list.innerHTML=Array.from({length:3},(_,i)=>`<a class="discussion-item" href="/post-${6000+i}-1"><span>新主题 ${i+1}</span></a>`).join("");setTimeout(()=>{window.__space.after=true;},120);},400);
    });
   });
   await page.locator(".selector a.select-item",{hasText:"主题"}).click();
   await page.waitForFunction(()=>window.__space.after);
   const s=await page.evaluate(()=>({before:window.__space.before,min:window.__space.min,labels:[...window.__space.labels],gap:window.__space.gap,hold:document.querySelector(".selector").style.minHeight,switching:document.documentElement.hasAttribute("data-nsmax-space-switching")}));
   assert.ok(s.min>=s.before-1&&s.gap===s.before+"px",JSON.stringify(s));
   assert.ok(s.labels.every(l=>!/还没有|暂无/.test(l)),JSON.stringify(s));
   assert.deepEqual({hold:s.hold,switching:s.switching},{hold:"",switching:false});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 点了站内链接、新页面还没回来：顶上出一条进度条；换到新页面后就没有了`,async()=>{
  // 2026-11-10 在用户 Chrome 里测：换页要等 0.8–2 秒，旧页面一动不动像没点到。旧页面上看到进度条时记进 sessionStorage（跨页还在）
  const watch=`addEventListener("DOMContentLoaded",()=>{if(location.pathname!=="/")return;new MutationObserver(()=>{const b=document.getElementById("nsmax-nav-progress");if(b&&b.hasAttribute("data-on")){const r=b.getBoundingClientRect();sessionStorage.setItem("__bar",JSON.stringify({top:r.top,h:r.height}));}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-on"]});});`;
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage(),init:watch,beforeNavigate:p=>p.route("**/post-1000-1",async route=>{await new Promise(r=>setTimeout(r,900));await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:P.postPage()});})});
  try{
   await ready(page);
   // 用脚本点（不移鼠标、不按下）：鼠标停上去 / 按下时脚本会先取这一篇，这里的响应故意晚 0.9 秒，取到一半被跳转打断，
   // WebKit 会把被打断的请求报成页面错误（「… due to access control checks」），和进度条无关。
   // 同理先等页面自己的请求走完再点：脚本一启动就查未读数（/api/notification/unread-count），点得太快它还在路上，
   // 一跳页就被打断，报的是同一种错（2026-11-11 主干 CI 上撞到一次）
   await page.waitForLoadState("networkidle");
   await page.evaluate(()=>document.querySelector('ul.post-list .post-title > a[href="/post-1000-1"]').click());
   await page.waitForURL("**/post-1000-1");
   await ready(page);
   assert.deepEqual(JSON.parse(await page.evaluate(()=>sessionStorage.getItem("__bar"))),{top:0,h:2},"旧页面上出过进度条");
   assert.equal(await page.locator("#nsmax-nav-progress").count(),0,"新页面上没有");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 标题前后的小标和标题字同一条中线：标题链接按基线排，行框不被撑高（Windows 微软雅黑下以前小标比字高 2px）`,async()=>{
  // 2026-11-11 Yiheng 截图：等级锁「不在中间」。标题链接以前是 vertical-align: middle，字被往下推 (升部−降部)/2 − x 高/2
  // （微软雅黑 UI 17px 下 1.9px，测试机字体 0.6px），行框跟着撑高，按「行高正中」摆的小标就比字高。和字体无关的判据：链接的基线 = 这一行的基线
  const html=P.listPage().replace('求推荐稳定的美西 VPS</a>','求推荐稳定的美西 VPS</a> <span style="color: rgb(255, 152, 152);"><svg class="iconpark-icon"><use href="#lock"></use></svg> 1</span>')
   .replace("出一台香港 CN2 GIA 小鸡，年付 99</a>",'出一台香港 CN2 GIA 小鸡，年付 99</a> <!----> <a href="/award" title="推荐阅读"><svg class="iconpark-icon award" style="width:15px;height:15px"><use href="#diamonds"></use></svg></a> <span title="置顶"><svg class="iconpark-icon pined circle-icon" style="width:15px;height:15px"><use href="#pin"></use></svg></span> <!---->');
  for(const fontSize of ["site","large"]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{viewport:desk.viewport,seed:{"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system",fontSize}}},html});
   try{
    await ready(page);
    await page.waitForSelector(".post-title > span[data-nsmax-lock][data-nsmax-lock-level]");
    const s=await page.evaluate(()=>[...document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item .post-title")].map(t=>{
     const a=t.querySelector(':scope > a[href]:not([href="/award"])'),box=t.getBoundingClientRect(),lh=parseFloat(getComputedStyle(t).lineHeight);
     // 链接里的基线和标题这一行自己的基线：各插一个 0 尺寸的行内块量底边
     const base=(host)=>{const p=document.createElement("span");p.style.cssText="display:inline-block;width:0;height:0;vertical-align:baseline";host.prepend(p);const y=p.getBoundingClientRect().bottom;p.remove();return y;};
     return{va:getComputedStyle(a).verticalAlign,pushed:+(base(a)-base(t)).toFixed(2),badges:[...t.children].filter(e=>e!==a&&e.offsetWidth).map(e=>{const b=e.getBoundingClientRect();return +((b.top+b.bottom)/2-(box.top+lh/2)).toFixed(2);})};
    }));
    assert.ok(s.length>=5&&s.some(r=>r.badges.length),JSON.stringify(s));
    for(const row of s){
     assert.equal(row.va,"baseline",JSON.stringify(row));
     assert.ok(Math.abs(row.pushed)<=0.05,`${fontSize}：标题字没有被往下推 ${JSON.stringify(row)}`);
     assert.ok(row.badges.every(d=>Math.abs(d)<=0.5),`${fontSize}：小标在这一行正中 ${JSON.stringify(row)}`);
    }
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 帖子页大标题后的小标在标题那一行正中；通知里的「未读」和这一行的字按基线排`,async()=>{
  const post=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html:P.specialPostPage({})});
  try{
   await ready(post.page);
   await post.page.waitForSelector(".nsk-post > .post-title h1 > .nsmax-prize-badge");
   const s=await post.page.evaluate(()=>{const h=document.querySelector(".nsk-post > .post-title h1"),box=h.getBoundingClientRect(),lh=parseFloat(getComputedStyle(h).lineHeight);
    return{lh,pollCount:h.querySelectorAll(":scope > .nsmax-poll-badge").length,badges:[...h.querySelectorAll(":scope > .nsmax-prize-badge")].map(e=>{const b=e.getBoundingClientRect();return{h:b.height,line:Math.floor((b.top-box.top)/lh),d:+(((b.top+b.bottom)/2-box.top)%lh-lh/2).toFixed(2)};})};});
   assert.ok(s.pollCount===0&&s.badges.length>0&&s.badges.every(b=>b.h===18&&Math.abs(b.d)<=0.5),JSON.stringify(s));
   assert.deepEqual(post.errors,[]);
  }finally{await post.context.close();}
  const notice=await open(browser,"https://www.nodeseek.com/notification",{...desk,html:P.notificationPage({})});
  try{
   await ready(notice.page);
   await notice.page.waitForSelector(".nsmax-notice-unread");
   const s=await notice.page.evaluate(()=>{const p=document.querySelector(".nsmax-notice-unread"),row=p.parentElement.getBoundingClientRect(),b=p.getBoundingClientRect();return{self:getComputedStyle(p).alignSelf,inside:b.top>=row.top-0.5&&b.bottom<=row.bottom+0.5};});
   assert.deepEqual(s,{self:"baseline",inside:true});
   assert.deepEqual(notice.errors,[]);
  }finally{await notice.context.close();}
 });
 test(`${engine} 未读数照 sb.sb 的 .notify-badge：右栏「我的通知」排在文字后面，一位数、两位数都是 16px 正圆，过百写「99+」才是胶囊；通知页标签后面也是 16px；深色粉底深字，浅色红底白字`,async()=>{
  // 2026-11-11 Yiheng：「旁边的通知数字圆点，你给我看看原版是怎么做的」；11-12 看了 v1.9.45 压在图标右上角的小点：「怎么都跑到这里了……扁扁的」
  for(const [scheme,bg,fg] of [["dark","rgb(255, 153, 153)","rgb(20, 21, 28)"],["light","rgb(207, 43, 43)","rgb(255, 255, 255)"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{...desk,colorScheme:scheme,html:P.notificationPage({dark:scheme==="dark"})});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-account-menu .nsmax-account-unread");
    await page.waitForSelector(".nsmax-message-tabs .nspp-messages-count");
    const measure=()=>page.evaluate(()=>{
     const dot=document.querySelector(".nsmax-account-menu .nsmax-account-unread"),link=dot.parentElement,row=link.getBoundingClientRect(),icon=link.querySelector("svg, .nsmax-icon").getBoundingClientRect(),b=dot.getBoundingClientRect(),c=getComputedStyle(dot);
     const label=document.createRange();label.selectNodeContents([...link.childNodes].find(n=>n.nodeType===3&&n.nodeValue.trim()));const text=label.getBoundingClientRect();
     const above=link.parentElement.children[[...link.parentElement.children].indexOf(link)-2]?.getBoundingClientRect();
     return{dot:[b.width,b.height,c.fontSize,c.backgroundColor,c.color,c.boxShadow,c.position],radius:parseFloat(c.borderTopLeftRadius)>=8||c.borderTopLeftRadius==="50%",
      after:+(b.left-text.right).toFixed(1),clearOfIcon:b.left>=icon.right,mid:+((b.top+b.bottom)/2-(row.top+row.bottom)/2).toFixed(1),inside:b.top>=row.top&&b.bottom<=row.bottom&&b.right<=row.right,
      clearOfAbove:!above||b.top>=above.bottom,row:row.height,text:dot.textContent};
    });
    // 夹具里是一位数（@我 5 + 回复 1 + 私信 1）
    let s=await measure();
    assert.deepEqual(s.dot,[16,16,"10px",bg,fg,"none","static"],JSON.stringify(s));
    assert.ok(s.radius,"是圆的");
    assert.ok(s.after>=4&&s.after<=8&&s.clearOfIcon,`排在文字后面，不压图标：${JSON.stringify(s)}`);
    assert.ok(Math.abs(s.mid)<=0.5&&s.inside&&s.clearOfAbove,`在这一行正中，不顶到上一行：${JSON.stringify(s)}`);
    assert.equal(s.row,32,"这一行还是 32px");
    // 两位数还是正圆，不是扁胶囊
    await page.evaluate(()=>{document.querySelector(".nsmax-account-menu .nsmax-account-unread").textContent="15";});
    s=await measure();
    assert.deepEqual(s.dot.slice(0,2),[16,16],`两位数也是 16×16：${JSON.stringify(s)}`);
    assert.ok(await page.evaluate(()=>{const dot=document.querySelector(".nsmax-account-menu .nsmax-account-unread"),r=document.createRange();r.selectNodeContents(dot);const t=r.getBoundingClientRect(),b=dot.getBoundingClientRect();return t.left>=b.left+1&&t.right<=b.right-1;}),"两位数的字在圆里面，左右各留至少 1px");
    const tab=await page.evaluate(()=>{const el=document.querySelector(".nsmax-message-tabs .nspp-messages-count");el.hidden=false;el.textContent="15";const t=getComputedStyle(el),tb=el.getBoundingClientRect();return [tb.width,tb.height,t.fontSize,t.backgroundColor,t.color];});
    assert.deepEqual(tab,[16,16,"10px",bg,fg],"通知页标签后面的未读数两位数也是 16×16 的圆");
    // 2026-11-13 Yiheng：「数字要在中间」。量数字本身（墨迹）的中心和圆心差多少：以前居中的是字体的行框，测试机上数字高 1.5px
    const ink=await page.evaluate(()=>{
     if(!CSS.supports("text-box","trim-both cap alphabetic"))return null;
     const cv=document.createElement("canvas").getContext("2d");
     return [".nsmax-account-menu .nsmax-account-unread",".nsmax-message-tabs .nspp-messages-count"].flatMap(sel=>["3","15"].map(text=>{
      const el=document.querySelector(sel);el.textContent=text;
      const r=document.createRange();r.selectNodeContents(el);const t=r.getBoundingClientRect(),b=el.getBoundingClientRect(),c=getComputedStyle(el);
      cv.font=`${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;const f=cv.measureText(text);
      const base=t.top+t.height*f.fontBoundingBoxAscent/(f.fontBoundingBoxAscent+f.fontBoundingBoxDescent);
      return{sel,text,dy:+((base-f.actualBoundingBoxAscent+base+f.actualBoundingBoxDescent)/2-(b.top+b.bottom)/2).toFixed(2),dx:+(t.left-f.actualBoundingBoxLeft+t.left+f.actualBoundingBoxRight)/2-(b.left+b.right)/2};
     }));
    });
    if(ink)for(const one of ink)assert.ok(Math.abs(one.dy)<=0.6&&Math.abs(one.dx)<=0.75,`数字在圆的正中：${JSON.stringify(one)}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 过百：写成「99+」，这时才是胶囊
  const many=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage().replace('<span class="notify-count">5</span>','<span class="notify-count">230</span>')});
  try{
   await ready(many.page);
   await many.page.waitForSelector(".nsmax-account-menu .nsmax-account-unread");
   const s=await many.page.evaluate(()=>{const dot=document.querySelector(".nsmax-account-menu .nsmax-account-unread"),b=dot.getBoundingClientRect();return{text:dot.textContent,wide:dot.hasAttribute("data-nsmax-wide"),size:[b.width>16,b.height],title:dot.title};});
   assert.deepEqual([s.text,s.wide,s.size],["99+",true,[true,16]],JSON.stringify(s));
   assert.ok(/23\d/.test(s.title),`悬停提示里是准确数字：${s.title}`);
   assert.deepEqual(many.errors,[]);
  }finally{await many.context.close();}
 });
 test(`${engine} 电脑端第三轮（2026-11-13「继续优化各个地方」）：管理记录表头和内容对齐；个人主页的等级锁和首页一样；卡片之间都是 20px`,async()=>{
  // 管理记录：五个表头的字和各自那一列内容的字左边对齐（以前表头居中、内容靠左）
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/ruling",{...desk,html:P.rulingPage()});
  try{
   await ready(page);
   const s=await page.evaluate(()=>{
    const left=(cell)=>{const r=document.createRange();r.selectNodeContents(cell);return r.getBoundingClientRect().left;};
    const heads=[...document.querySelectorAll(".ruling-log table thead th")],cells=[...document.querySelectorAll(".ruling-log table tbody tr:first-child td")];
    return{d:heads.map((h,i)=>+(left(h)-left(cells[i])).toFixed(1)),lines:heads.map(h=>Math.round(h.getBoundingClientRect().height))};
   });
   assert.equal(s.d.length,5);
   assert.ok(s.d.every(d=>Math.abs(d)<=1),`表头和内容左边对齐：${JSON.stringify(s)}`);
   assert.ok(s.lines.every(h=>h===s.lines[0]),`表头不折行：${JSON.stringify(s)}`);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 个人主页主题 / 回帖：锁在标题前面、「Lv1」、站点的图标藏掉、在标题那一行正中；列表重画（翻页）以后还是这样
  for(const [name,html,url] of [["主题",P.spaceTopicsPage(),"/space/10#/discussions"],["回帖",P.spaceCommentsPage(),"/space/10#/comments"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    const read=()=>page.evaluate(()=>{
     const link=document.querySelector(".discussion-wrapper > div.discussion-item > a, .discussion-wrapper > a.discussion-item"),mark=link.querySelector(":scope > span[data-nsmax-lock]"),title=link.querySelector(":scope > span:not([data-nsmax-lock])");
     if(!mark)return null;
     const m=mark.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(title);const t=r.getBoundingClientRect(),after=getComputedStyle(mark,"::after"),head=document.querySelector(".head-container").getBoundingClientRect(),list=document.querySelector(".selector").getBoundingClientRect();
     return{first:link.firstElementChild===mark,label:after.content,h:m.height,gap:+(t.left-m.right).toFixed(1),dy:+((m.top+m.bottom)/2-(t.top+t.bottom)/2).toFixed(1),svg:getComputedStyle(mark.querySelector("svg")).display,tip:mark.title,titleBg:getComputedStyle(title).backgroundColor,cardGap:Math.round(list.top-head.bottom)};
    });
    const s=await read();
    assert.ok(s&&s.first&&/^"Lv/.test(s.label),name+JSON.stringify(s));
    assert.ok(s.h===18&&near(s.gap,6,1)&&Math.abs(s.dy)<=1.5&&s.svg==="none"&&s.titleBg==="rgba(0, 0, 0, 0)",name+JSON.stringify(s));
    assert.equal(s.tip,"等级 Lv1 及以上才能看");
    assert.equal(s.cardGap,20,name+" 资料卡和列表卡片相隔 20px（以前 14px）");
    // 站点重画这一行（锁又回到标题后面）
    await page.evaluate(()=>{const link=document.querySelector(".discussion-wrapper > div.discussion-item > a, .discussion-wrapper > a.discussion-item");const fresh=document.createElement("span");fresh.setAttribute("style","color:rgb(255,152,152)");fresh.innerHTML='<svg class="iconpark-icon"><use href="#lock"></use></svg> 2';link.querySelector("span[data-nsmax-lock]").remove();link.append(fresh);});
    await page.waitForFunction(()=>document.querySelector(".discussion-wrapper span[data-nsmax-lock-level='2']"));
    const again=await read();
    assert.ok(again.first&&near(again.gap,6,1),name+" 重画后："+JSON.stringify(again));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 帖子页：投票卡片之间、投票和评论区之间都是 20px（以前 40px）；投票卡片上下留白一样；页码上下都是 16px（以前下面 36px）
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html:P.specialPostPage()});
  try{
   await ready(page);
   await page.waitForSelector(".vote-panel[data-nsmax-detached]");
   const s=await page.evaluate(()=>{
    const kids=[...document.querySelector("#nsk-body-left > .nsk-post-wrapper").children].filter(e=>e.getBoundingClientRect().height>0),gaps=[];
    for(let i=1;i<kids.length;i++)gaps.push([String(kids[i].className).split(" ")[0]||kids[i].tagName,Math.round(kids[i].getBoundingClientRect().top-kids[i-1].getBoundingClientRect().bottom)]);
    const panel=document.querySelector(".vote-panel[data-nsmax-detached]"),p=panel.getBoundingClientRect(),head=panel.querySelector(".nsmax-poll-head").getBoundingClientRect(),foot=panel.querySelector("fieldset.op-buttons").getBoundingClientRect();
    return{gaps,top:Math.round(head.top-p.top),bottom:Math.round(p.bottom-foot.bottom),radius:getComputedStyle(panel).borderTopLeftRadius,post:getComputedStyle(document.querySelector(".nsk-post .content-item")).borderBottomLeftRadius};
   });
   const of=(cls)=>s.gaps.filter(g=>g[0]===cls).map(g=>g[1]);
   assert.deepEqual(of("vote-panel"),[20,20],JSON.stringify(s));
   assert.deepEqual(of("comment-container"),[20],JSON.stringify(s));
   assert.deepEqual([of("nsmax-detached-pager"),of("md-editor")],[[16],[16]],JSON.stringify(s));
   assert.ok(near(s.top,s.bottom,1),`投票卡片上下留白一样：${JSON.stringify(s)}`);
   assert.equal(s.radius,s.post,"单独成卡片的投票和帖子卡片同一种圆角");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 私信页：外壳不涂底色（以前两栏之间、栏和标签栏之间是一片卡片色），标签栏、左右两栏之间都是 20px
  for(const dark of [false,true]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/message?mode=list",{...desk,colorScheme:dark?"dark":"light",html:P.messageCenterPage({dark})});
   try{
    await ready(page);
    await page.waitForSelector(".nspp-messages-sidebar");
    const s=await page.evaluate(()=>{
     const shell=getComputedStyle(document.querySelector(".nspp-messages-container")),top=document.querySelector(".nspp-messages-top").getBoundingClientRect(),side=document.querySelector(".nspp-messages-sidebar").getBoundingClientRect(),chat=document.querySelector(".nspp-messages-chat").getBoundingClientRect();
     return{bg:shell.backgroundColor,border:shell.borderTopWidth,v:Math.round(side.top-top.bottom),h:Math.round(chat.left-side.right)};
    });
    assert.deepEqual(s,{bg:"rgba(0, 0, 0, 0)",border:"0px",v:20,h:20});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 粉丝 / 关注：标签栏和成员卡片相隔 20px
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/fans?type=fans",{...desk,html:P.fansPage()});
  try{
   await ready(page);
   await page.waitForSelector(".nsmax-member");
   const gap=await page.evaluate(()=>{const grid=document.querySelector(".member-list > .user-card-wrapper-container"),prev=grid.previousElementSibling;return Math.round(grid.getBoundingClientRect().top-prev.getBoundingClientRect().bottom);});
   assert.equal(gap,20);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
 });
 test(`${engine} 电脑端第四轮（2026-11-14「继续」）：Markdown 工具栏和「一键抽奖」是线条图标；今日热门悬停只给标题画线、预览卡片标题只有帖子标题；访客欢迎卡的字号和按钮在档位上`,async()=>{
  // 发帖页：11 个工具按钮都是 28×28、里面一个 16px 的图标、没有文字符号和表情；「一键抽奖」前面是图标不是 🎁
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/new-discussion",{...desk,html:P.newPostPage()});
  try{
   await ready(page);
   await page.locator(".nsmax-editor-controls").getByRole("button",{name:"Markdown",exact:true}).click();
   await page.waitForSelector(".md-editor .nsmax-custom-mde-toolbar > .nsmax-mde-btn");
   const s=await page.evaluate(()=>{
    const box=(e)=>{const r=e.getBoundingClientRect();return[r.width,r.height];};
    const buttons=[...document.querySelectorAll(".md-editor .nsmax-custom-mde-toolbar > .nsmax-mde-btn")],lucky=document.querySelector(".nsmax-lucky-trigger");
    return{tools:buttons.map(b=>{const svg=b.querySelector(":scope > svg"),r=b.getBoundingClientRect(),g=svg&&svg.getBoundingClientRect();return{box:box(b),svg:svg?box(svg):null,text:b.textContent,label:b.getAttribute("aria-label"),dx:g?+((g.left+g.right)/2-(r.left+r.right)/2).toFixed(1):null,dy:g?+((g.top+g.bottom)/2-(r.top+r.bottom)/2).toFixed(1):null};}),
     lucky:{text:lucky.textContent,svg:lucky.querySelector(":scope > svg")?box(lucky.querySelector(":scope > svg")):null}};
   });
   assert.equal(s.tools.length,11);
   assert.deepEqual(s.tools.map(t=>t.label),["粗体","斜体","标题","引用","代码","链接","图片","无序列表","有序列表","表格","分割线"]);
   for(const t of s.tools){
    assert.deepEqual(t.box,[28,28],JSON.stringify(t));
    assert.deepEqual(t.svg,[16,16],JSON.stringify(t));
    assert.equal(t.text,"",JSON.stringify(t));
    assert.ok(Math.abs(t.dx)<=0.5&&Math.abs(t.dy)<=0.5,"图标在按钮正中："+JSON.stringify(t));
   }
   assert.equal(s.lucky.text,"一键抽奖");
   assert.deepEqual(s.lucky.svg,[16,16]);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 首页右栏：悬停今日热门的一行，下划线只在标题下面（以前连名次和浏览数一起划）；预览卡片的标题就是帖子标题（以前是「3……960」）
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage(),pages:{"/post-3002-1":P.postPage()}});
  try{
   await ready(page);
   await page.waitForSelector(".nsmax-hot-panel:not([data-nsmax-hot-early]) .nsmax-hot-list > li:nth-child(3) > a .nsmax-hot-text");
   const row=page.locator(".nsmax-hot-list > li:nth-child(3) > a[data-nsmax-preview]");
   // 右栏会在未读数回来后重画一次，重画时悬停状态会丢（新的那一行没收到鼠标进入）：鼠标挪开再停上去，多试几次
   let shown=false;
   for(let i=0;i<6&&!shown;i++){
    await page.mouse.move(300,300);
    await row.hover();
    shown=await page.waitForSelector("dialog.nspp-post-preview[open] header > a",{timeout:3000}).then(()=>true,()=>false);
   }
   assert.ok(shown,"悬停今日热门的一行会弹出预览卡片");
   const s=await row.evaluate((a)=>{
    const line=(e)=>getComputedStyle(e).textDecorationLine;
    return{link:line(a),rank:line(a.querySelector(".nsmax-hot-rank")),text:line(a.querySelector(".nsmax-hot-text")),count:line(a.querySelector(".nsmax-hot-count")),title:a.querySelector(".nsmax-hot-text").textContent,card:document.querySelector("dialog.nspp-post-preview header > a").textContent,all:a.textContent};
   });
   assert.deepEqual([s.link,s.rank,s.text,s.count],["none","none","underline","none"],JSON.stringify(s));
   assert.equal(s.card,s.title);
   assert.notEqual(s.card,s.all.trim());
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 没登录时右栏的欢迎卡：说明 13px / 22px（以前 15px / 26px），「登录 / 注册」34px 高、13px（以前 37.6px、13.5px）
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/invite",{...desk,html:P.invitePage()});
  try{
   await ready(page);
   await page.waitForSelector("#nsk-right-panel-container > .nsk-panel[data-nsmax-btnpanel] [data-nsmax-btnrow] > .btn");
   const s=await page.evaluate(()=>{
    const panel=document.querySelector("#nsk-right-panel-container > .nsk-panel[data-nsmax-btnpanel]"),note=getComputedStyle(panel.querySelector(":scope > h4 + div"));
    return{note:[note.fontSize,note.lineHeight],buttons:[...panel.querySelectorAll("[data-nsmax-btnrow] > .btn")].map(b=>[b.getBoundingClientRect().height,getComputedStyle(b).fontSize])};
   });
   assert.deepEqual(s.note,["13px","22px"]);
   assert.deepEqual(s.buttons,[[34,"13px"],[34,"13px"]]);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
 });
 test(`${engine} 预览卡片底下的「打开原帖」不抢眼（2026-11-14 用户：「有点太明显」）：和浏览 / 回复数同一个弱化色、常规字重、没有箭头，底栏和卡片同色`,async()=>{
  for(const dark of [false,true]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,colorScheme:dark?"dark":"light",html:P.listPage({dark,count:4}),pages:{"/post-1000-1":P.postPage({dark})}});
   try{
    await ready(page);
    let shown=false;
    for(let i=0;i<6&&!shown;i++){
     await page.mouse.move(600,860);
     await page.locator(".post-list-item .post-title a").first().hover();
     shown=await page.waitForSelector("dialog.nspp-post-preview[open] article",{timeout:3000}).then(()=>true,()=>false);
    }
    assert.ok(shown,"悬停标题弹出预览卡片");
    const s=await page.evaluate(()=>{
     const view=document.querySelector("dialog.nspp-post-preview"),foot=view.querySelector(":scope > footer"),link=foot.querySelector("a.nspp-preview-open"),stats=foot.querySelector(".nspp-preview-stats");
     const ls=getComputedStyle(link);
     return{link:ls.color,stats:getComputedStyle(stats).color,weight:ls.fontWeight,after:getComputedStyle(link,"::after").content,deco:ls.textDecorationLine,foot:getComputedStyle(foot).backgroundColor,text:link.textContent};
    });
    assert.equal(s.text,"打开原帖");
    assert.equal(s.link,s.stats,JSON.stringify(s));
    assert.equal(s.weight,"400");
    assert.ok(s.after==="none"||s.after==="normal",JSON.stringify(s));
    assert.equal(s.deco,"none");
    assert.equal(s.foot,"rgba(0, 0, 0, 0)");
    // 鼠标停上去：变亮、加下划线
    await page.locator("dialog.nspp-post-preview > footer > a.nspp-preview-open").hover();
    await page.waitForTimeout(400);
    const h=await page.locator("dialog.nspp-post-preview > footer > a.nspp-preview-open").evaluate(a=>({c:getComputedStyle(a).color,d:getComputedStyle(a).textDecorationLine}));
    assert.notEqual(h.c,s.link);
    assert.equal(h.d,"underline");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑端第五轮（2026-11-14「继续」）：各页的字号和按钮高度都在档位上（没有 11.5 / 13.5 / 14.5 的字，按钮 28 / 34 / 40）`,async()=>{
  const pages=[
   ["/new-discussion",P.newPostPage(),[".md-editor > .topic-select > div > label",".md-editor .nsmax-editor-heading"]],
   ["/setting",P.settingPage({}),["#user-setting-panel form fieldset > h2","#user-setting-panel form > div > button.btn"]],
   ["/credit",P.creditPage(),[".credit-table table td"]],
   ["/ruling",P.rulingPage(),[".ruling-log table td"]],
   ["/notification#/message?mode=list",P.messageCenterPage(),[".nspp-messages-conversations > .nspp-messages-peer:not(.nsmax-notice-row) .nspp-messages-peer-title > strong"]],
   ["/friends",P.friendsPage(),[".nsk-friends .friends-container > div > a > p"]],
   ["/space/10#/comments",P.spaceCommentsPage(),[".discussion-wrapper > a:not(.discussion-item) > p"]],
   ["/board",P.boardPage(),[".nsmax-board-banner-actions > .nsmax-board-btn"]],
   ["/post-1000-1",P.specialPostPage(),[".nsmax-lottery dd",".nsmax-lottery-unit",".nsmax-lottery-join",".vote-panel .pure-button",".nsmax-poll-voters-toggle"]],
  ];
  for(const [url,html,selectors] of pages){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    await page.waitForSelector(selectors[0]);
    const s=await page.evaluate((selectors)=>{
     const found={},bad=[];
     for(const sel of selectors){
      const list=[...document.querySelectorAll(sel)].filter(e=>e.getBoundingClientRect().height>0);
      found[sel]=list.length;
      for(const e of list){
       const st=getComputedStyle(e),h=Math.round(e.getBoundingClientRect().height*100)/100;
       if(["11.5px","13.5px","14.5px"].includes(st.fontSize))bad.push(sel+" 字号 "+st.fontSize);
       if(/button|btn|join|view|toggle/.test(sel)&&![28,34,40].includes(h))bad.push(sel+" 高 "+h);
      }
     }
     return{found,bad};
    },selectors);
    assert.ok(Object.values(s.found).every(n=>n>0),url+" "+JSON.stringify(s.found));
    assert.deepEqual(s.bad,[],url);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 帖子页回复框搭好前就按搭好后的样子占位（2026-11-16「每进到一个新帖子都会闪一下」）：标题行、输入框、按钮位置前后一样，按钮和输入框对齐`,async()=>{
  // 真站结构的回复框；先不放输入框（站点还没建好 CodeMirror），脚本就搭不起精简回复框，停在「搭好之前」
  const html=P.postPage({editorMode:"real"}).replace(/<textarea placeholder="鼓励友善发言[^>]*><\/textarea>/,'<div class="cm-pending"></div>');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html});
  try{
   await ready(page);
   await page.waitForSelector(".md-editor .content-area");
   const measure=()=>page.evaluate(()=>{
    const e=document.querySelector(".md-editor"),top=e.getBoundingClientRect().top,body=e.querySelector("#editor-body");
    const box=x=>{const r=x.getBoundingClientRect();return[Math.round(r.left),Math.round(r.top-top),Math.round(r.width),Math.round(r.height)]};
    const shown=sel=>[...e.querySelectorAll(sel)].some(x=>x.offsetWidth||x.offsetHeight);
    const prev=document.querySelector("#editor").previousElementSibling;
    return{compact:e.classList.contains("nsmax-compact-reply"),editor:Math.round(e.getBoundingClientRect().height),gap:Math.round(e.getBoundingClientRect().top-prev.getBoundingClientRect().bottom),area:box(e.querySelector(".content-area")),submit:box(e.querySelector("button.submit")),
     native:shown(".tab-select, .expression"),head:getComputedStyle(body,"::before").content,headH:Math.round(parseFloat(getComputedStyle(body,"::before").height)||0),
     controls:e.querySelector(".nsmax-editor-controls")&&box(e.querySelector(".nsmax-editor-controls")),realHead:e.querySelector(".nsmax-editor-head")&&box(e.querySelector(".nsmax-editor-head"))};
   });
   const pre=await measure();
   assert.equal(pre.compact,false);
   assert.equal(pre.native,false,"站点原样的页签、表情条不该露出来："+JSON.stringify(pre));
   assert.equal(pre.head,'"发表回复"');
   // 脚本还没给外层 #editor 标上 data-nsmax-editor-box 的那一下，外层也不画成第二层框
   const outer=await page.evaluate(()=>{const box=document.querySelector("#editor");box.removeAttribute("data-nsmax-editor-box");const c=getComputedStyle(box),e=box.querySelector(".md-editor");return[c.borderTopWidth,c.backgroundColor,c.paddingTop,Math.round(e.getBoundingClientRect().top-box.previousElementSibling.getBoundingClientRect().bottom)];});
   assert.deepEqual(outer,["0px","rgba(0, 0, 0, 0)","0px",pre.gap]);
   await page.evaluate(()=>{const t=document.createElement("textarea");t.placeholder="鼓励友善发言，禁止人身攻击";document.querySelector(".cm-pending").replaceWith(t);});
   await page.waitForSelector(".md-editor.nsmax-compact-reply");
   await page.waitForTimeout(300);
   const post=await measure();
   assert.equal(post.editor,pre.editor,"搭好前后整块一样高："+JSON.stringify({pre,post}));
   assert.ok(post.gap===pre.gap&&post.gap>=16,"和上面楼层隔开的距离不变："+JSON.stringify({pre:pre.gap,post:post.gap}));
   assert.deepEqual(post.area,pre.area,"输入框位置大小不变");
   assert.deepEqual(post.submit,pre.submit,"按钮不动");
   assert.equal(post.realHead[3],pre.headH,"标题行一样高");
   assert.equal(post.submit[0],post.controls[0],"「回复楼主」和上面的工具按钮左边对齐");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑端第九轮（2026-11-15「再看看每个细节」）：帖子列表 / 通知 / 个人主页列表每行左边 18px，和标签条的字对齐；回复框标题栏和内容区 18px`,async()=>{
  const txt=e=>{const r=document.createRange();r.selectNodeContents(e);return Math.round(r.getBoundingClientRect().left);};
  for(const [url,html,rowSel,tabSel] of [
   ["/",P.listPage({count:5}),"#nsk-body-left .post-list-item","#nsk-body-left a.selected"],
   ["/space/1#/discussions",P.spaceTopicsPage({}),".discussion-wrapper > div.discussion-item",".selector > a.select-item"],
   ["/space/1#/comments",P.spaceCommentsPage({}),".discussion-wrapper > a.discussion-item",".selector > a.select-item"],
   ["/space/1#/collections",P.spaceCollectionsPage({}),".discussion-wrapper > a.discussion-item",".selector > a.select-item"],
  ]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    await page.waitForSelector(rowSel);
    const s=await page.evaluate(([rowSel,tabSel,txtSrc])=>{
     const txt=eval(txtSrc),rows=[...document.querySelectorAll(rowSel)].filter(e=>e.offsetWidth);
     const firstLeft=e=>Math.round(e.getBoundingClientRect().left+parseFloat(getComputedStyle(e).paddingLeft));
     return{pad:[...new Set(rows.map(e=>getComputedStyle(e).paddingLeft))],tab:txt([...document.querySelectorAll(tabSel)].find(e=>e.offsetWidth)),row:firstLeft(rows[0])};
    },[rowSel,tabSel,txt.toString()]);
    assert.deepEqual(s.pad,["18px"],url);
    assert.ok(Math.abs(s.row-s.tab)<=1,url+" "+JSON.stringify(s));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification",{...desk,html:P.notificationPage({})});
   try{
    await ready(page);
    await page.waitForSelector(".nspp-messages-conversations > .nsmax-notice-row");
    const pads=await page.evaluate(()=>[...new Set([...document.querySelectorAll(".nspp-messages-conversations > .nsmax-notice-row")].map(e=>getComputedStyle(e).paddingLeft))]);
    assert.deepEqual(pads,["18px"]);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html:P.postPage({})});
   try{
    await ready(page);
    await page.waitForSelector(".md-editor.nsmax-compact-reply > #editor-body");
    const s=await page.evaluate(()=>{const st=e=>e&&getComputedStyle(e);const b=st(document.querySelector(".md-editor.nsmax-compact-reply > #editor-body")),h=st(document.querySelector(".md-editor.nsmax-compact-reply .nsmax-editor-head"));
     return{body:[b.paddingLeft,b.paddingRight],head:h?[h.paddingLeft,h.paddingRight]:null};});
    assert.deepEqual(s.body,["18px","18px"]);
    if(s.head)assert.deepEqual(s.head,["18px","18px"]);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑端第八轮（2026-11-15 真站核对）：登录后的签到页排行榜标题 17px、用户名 14px、鸡腿数 12px、日历「+5」11px、签到按钮 40px`,async()=>{
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/board",{...desk,html:P.boardRealPage({})});
  try{
   await ready(page);
   await page.waitForSelector(".nsmax-checkin .nsmax-checkin-button");
   const s=await page.evaluate(()=>{
    const q=x=>document.querySelector(x),fs=e=>e?getComputedStyle(e).fontSize:null;
    return{h1:fs(q(".board h1")),title:fs(q(".nsmax-checkin-title")),name:fs(q(".board .rank-row .member-name a")),coins:fs(q(".board .rank-row .coins")),day:fs(q(".nsmax-checkin-day > i")),btn:q(".nsmax-checkin .nsmax-checkin-button").getBoundingClientRect().height};
   });
   assert.deepEqual(s,{h1:"17px",title:"17px",name:"14px",coins:"12px",day:s.day===null?null:"11px",btn:40});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑端第七轮（2026-11-15「继续」）：抽奖工具页卡片内边距 18、字号和输入框归档，设置 / 发帖标题输入框整 40px，「去登录」34px`,async()=>{
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/lucky",{...desk,html:P.luckyPage()});
   try{
    await ready(page);
    await page.waitForSelector(".sample-panel > form .pure-g label");
    const s=await page.evaluate(()=>{
     const form=document.querySelector(".sample-panel > form").getBoundingClientRect(),inset=e=>Math.round(e.getBoundingClientRect().left-form.left-1);
     const label=document.querySelector(".sample-panel > form .pure-g label"),box=document.querySelector(".sample-panel > form > fieldset > .pure-checkbox"),btn=document.querySelector(".sample-panel > form .pure-button"),legend=document.querySelector(".sample-panel > form > fieldset > legend");
     return{label:inset(label),box:inset(box),btn:inset(btn),legend:getComputedStyle(legend).paddingLeft,labelSize:getComputedStyle(label).fontSize,boxSize:getComputedStyle(box).fontSize,intro:getComputedStyle(document.querySelector(".sample-panel > header > .intro")).fontSize,
      inputs:[...document.querySelectorAll('.sample-panel > form :is(input[type="number"], input.mx-input)')].filter(e=>e.offsetWidth).map(e=>e.getBoundingClientRect().height)};
    });
    assert.ok(s.inputs.length>=3&&s.inputs.every(h=>h===40),JSON.stringify(s.inputs));
    delete s.inputs;
    assert.deepEqual(s,{label:18,box:18,btn:18,legend:"18px",labelSize:"14px",boxSize:"14px",intro:"13px"});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  for(const [url,html,sel] of [["/setting",P.settingPage({}),"#user-setting-panel form fieldset > input"],["/new-discussion",P.newPostPage(),".md-editor > .title-input input"]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    await page.waitForSelector(sel);
    const hs=await page.evaluate((sel)=>[...document.querySelectorAll(sel)].filter(e=>e.offsetWidth&&e.type!=="file").map(e=>e.getBoundingClientRect().height),sel);
    assert.ok(hs.length>0&&hs.every(h=>h===40),url+" "+JSON.stringify(hs));
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/invite",{...desk,html:P.invitePage()});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-site-error-login");
    const s=await page.evaluate(()=>{const e=document.querySelector(".nsmax-site-error-login");return{h:e.getBoundingClientRect().height,size:getComputedStyle(e).fontSize};});
    assert.deepEqual(s,{h:34,size:"13px"});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑端第六轮（2026-11-14「继续」）：签到页卡片、成员卡片和别的页面对齐，登录页控件 40px`,async()=>{
  {
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/board",{...desk,html:P.boardPage()});
   try{
    await ready(page);
    await page.waitForSelector(".board-container .nsmax-board-title-text");
    const s=await page.evaluate(()=>{
     const card=document.querySelector("#nsk-body-left > .board-container"),title=document.querySelector(".board-container .nsmax-board-title"),text=title.querySelector(".nsmax-board-title-text").getBoundingClientRect(),rank=document.querySelector(".board-list .nsmax-board-rank").getBoundingClientRect(),bar=title.querySelector(".nsmax-board-title-bar");
     const st=getComputedStyle(title);
     return{pad:getComputedStyle(card).paddingLeft,size:st.fontSize,weight:st.fontWeight,bar:bar?bar.getBoundingClientRect().width:0,dx:Math.round(rank.left-text.left),inset:Math.round(text.left-card.getBoundingClientRect().left-parseFloat(getComputedStyle(card).borderLeftWidth))};
    });
    assert.deepEqual(s,{pad:"18px",size:"17px",weight:"600",bar:0,dx:0,inset:18});
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  for(const [url,html,ref] of [["/fans?type=fans",P.fansPage(),".fans-switcher > a"],["/member?q=a",P.findUserPage(),null]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    await page.waitForSelector(".nsmax-member .nsmax-member-avatar");
    const s=await page.evaluate((ref)=>{
     const m=document.querySelector(".nsmax-member"),av=m.querySelector(".nsmax-member-avatar").getBoundingClientRect();
     let refLeft=null;
     if(ref){const r=document.createRange();r.selectNodeContents(document.querySelector(ref));refLeft=Math.round(r.getBoundingClientRect().left);}
     return{pad:getComputedStyle(m).paddingLeft,dx:refLeft==null?0:Math.round(av.left)-refLeft};
    },ref);
    assert.deepEqual(s,{pad:"18px",dx:0},url);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  for(const [url,html] of [["/signIn.html",P.signInPage({})],["/register.html",P.registerPage({})]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,html});
   try{
    await ready(page);
    await page.waitForSelector("input[data-nsmax-password]");
    const s=await page.evaluate(()=>{
     const app=document.querySelector("[data-nsmax-auth-app]"),bad=[];
     for(const e of app.querySelectorAll("input:is([type=text],[type=password],[type=email]), button")){
      const b=e.getBoundingClientRect();if(!b.height)continue;
      const want=e.classList.contains("nsmax-password-toggle")?28:40;
      if(Math.round(b.height)!==want)bad.push((e.id||e.className||e.type)+" "+b.height);
     }
     const f=document.querySelector("input[data-nsmax-password]").getBoundingClientRect(),t=document.querySelector(".nsmax-password-toggle").getBoundingClientRect();
     return{bad,dy:Math.abs((t.top+t.height/2)-(f.top+f.height/2))<=1};
    });
    assert.deepEqual(s,{bad:[],dy:true},url);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 页面切换丝滑度：右栏视图过渡固定、分页点击即时高亮与 pagehide 还原、设置/空间切页零延迟整理`,async()=>{
  const list=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage({count:4}),beforeNavigate:async(p)=>{
   await p.route("**/page-2",async(route)=>{
    await new Promise(r=>setTimeout(r,800));
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:P.listPage({count:4})});
   });
  }});
  try{
   await ready(list.page);
   const cssText=await list.page.evaluate(()=>[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n"));
   assert.ok(cssText.includes("view-transition-name:nsmax-side")&&cssText.includes("html::view-transition-group(nsmax-side)"));
   if(engine==="chromium"){
    assert.equal(await list.page.evaluate(()=>getComputedStyle(document.getElementById("nsk-right-panel-container")).viewTransitionName),"nsmax-side");
   }
   await list.page.waitForLoadState("networkidle");
   await list.page.evaluate(()=>{
    const snap=()=>({
     p1:[...document.querySelectorAll(".nsk-pager .pager-pos:not([href])")].map(el=>el.classList.contains("pager-cur")),
     p2:[...document.querySelectorAll('.nsk-pager a.pager-pos[href="/page-2"]')].map(el=>[el.classList.contains("pager-cur"),el.hasAttribute("data-nsmax-pg-cur"),el.getAttribute("aria-current")]),
     bar:!!document.querySelector("#nsmax-nav-progress[data-on]"),
     barEl:!!document.getElementById("nsmax-nav-progress")
    });
    const host=window.navigation||window,ev=window.navigation?"navigate":"click";
    host.addEventListener(ev,()=>{
     const at0=snap();
     sessionStorage.setItem("__nsmax_nav_test",JSON.stringify({at0}));
     setTimeout(()=>{
      const at140=snap();
      window.dispatchEvent(new Event("pagehide"));
      const afterHide=snap();
      sessionStorage.setItem("__nsmax_nav_test",JSON.stringify({at0,at140,afterHide}));
     },140);
    });
    document.querySelector('.nsk-pager.pager-bottom a.pager-pos[href="/page-2"]').click();
   });
   await list.page.waitForURL("**/page-2");
   await ready(list.page);
   const navRes=await list.page.evaluate(()=>JSON.parse(sessionStorage.getItem("__nsmax_nav_test")||"null"));
   assert.ok(navRes&&navRes.at140&&navRes.afterHide,JSON.stringify(navRes));
   assert.ok(navRes.at0.p1.every(v=>v===false),JSON.stringify(navRes.at0));
   assert.ok(navRes.at0.p2.length>=2&&navRes.at0.p2.every(([c,a,cur])=>c&&a&&cur==="page"),JSON.stringify(navRes.at0));
   assert.equal(navRes.at140.bar,true,JSON.stringify(navRes.at140));
   assert.equal(navRes.afterHide.barEl,false,JSON.stringify(navRes.afterHide));
   assert.ok(navRes.afterHide.p1.every(v=>v===true),JSON.stringify(navRes.afterHide));
   assert.ok(navRes.afterHide.p2.every(([c,a])=>!c&&!a),JSON.stringify(navRes.afterHide));
   assert.deepEqual(list.errors,[]);
  }finally{await list.context.close();}
  const setting=await open(browser,"https://www.nodeseek.com/setting",{...desk,html:P.settingPage({})});
  try{
   await ready(setting.page);
   const s=await setting.page.evaluate(()=>new Promise(resolve=>{
    const tabs=[...document.querySelectorAll("#user-setting-panel .selector-left-side a.select-item")];
    for(const t of tabs)t.classList.toggle("selected",t.getAttribute("href")==="#security");
    const right=document.querySelector("#user-setting-panel .selector-right-side");
    right.innerHTML='<form class="pure-form"><fieldset><h2>Readme</h2><textarea></textarea></fieldset></form>';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     const h2=right.querySelector("fieldset > h2");
     resolve({title:right.getAttribute("data-nsmax-setting-title"),heading:h2?.textContent.trim(),hint:!!h2?.nextElementSibling?.classList.contains("nsmax-setting-hint")});
    }));
   }));
   assert.deepEqual(s,{title:"安全",heading:"主页介绍",hint:true});
   assert.deepEqual(setting.errors,[]);
  }finally{await setting.context.close();}
  const space=await open(browser,"https://www.nodeseek.com/space/1#discussions",{...desk,html:P.spaceTopicsPage({})});
  try{
   await ready(space.page);
   const s=await space.page.evaluate(()=>new Promise(resolve=>{
    const wrap=document.querySelector(".discussion-wrapper");
    wrap.innerHTML='<div class="discussion-item"><a href="/post-4999-1"><span>动态加载主题</span><span style="color:rgb(255,152,152)"><svg class="iconpark-icon"><use href="#lock"></use></svg> 3</span></a><span></span></div>';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     const a=wrap.querySelector(".discussion-item > a"),lock=a?.querySelector("span[data-nsmax-lock]");
     resolve({hasLock:!!lock,level:lock?.getAttribute("data-nsmax-lock-level"),first:a?.firstElementChild===lock});
    }));
   }));
   assert.deepEqual(s,{hasLock:true,level:"3",first:true});
   assert.deepEqual(space.errors,[]);
  }finally{await space.context.close();}
 });
 test(`${engine} v1.9.59 页面切换进阶：手机顶栏与侧栏导航过渡固定、过渡不挡点击、中文时间零多余属性与搜索预加载`,async()=>{
  const mob=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:6})});
  try{
   await ready(mob.page);
   const mobState=await mob.page.evaluate(()=>{
    const css=[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n");
    return{
     mhead:document.documentElement.hasAttribute("data-nsmax-mhead"),
     headCss:css.includes("[data-nsmax-mhead] #nsk-head{view-transition-name:nsmax-head}"),
     noBlockCss:css.includes("html::view-transition{pointer-events:none}"),
     vtHead:getComputedStyle(document.getElementById("nsk-head")).viewTransitionName,
     origAttrs:document.querySelectorAll("[data-nsmax-time-orig]").length,
     doneTimes:document.querySelectorAll("time[data-nsmax-time-done]").length
    };
   });
   assert.equal(mobState.mhead,true);
   assert.equal(mobState.headCss,true);
   assert.equal(mobState.noBlockCss,true);
   assert.equal(mobState.origAttrs,0);
   assert.ok(mobState.doneTimes>=6);
   if(engine==="chromium")assert.equal(mobState.vtHead,"nsmax-head");
   assert.deepEqual(mob.errors,[]);
  }finally{await mob.context.close();}
  const sidebarSeed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system",navPosition:"sidebar"}}};
  const deskNav=await open(browser,"https://www.nodeseek.com/",{...desk,seed:sidebarSeed,html:P.listPage({count:8}),beforeNavigate:async(p)=>{
   await p.route("**/categories/tech",async(route)=>{
    await new Promise(r=>setTimeout(r,250));
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:P.listPage({count:8})});
   });
   await p.route("**/post-1000-1",async(route)=>{
    await new Promise(r=>setTimeout(r,250));
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:P.postPage()});
   });
  }});
  try{
   await ready(deskNav.page);
   const s=await deskNav.page.evaluate(()=>{
    const left=document.getElementById("nsk-left-panel-container");
    return{navAttr:document.documentElement.dataset.nsmaxNav,vtNav:left?getComputedStyle(left).viewTransitionName:null};
   });
   assert.equal(s.navAttr,"sidebar");
   if(engine==="chromium")assert.equal(s.vtNav,"nsmax-nav");
   await deskNav.page.evaluate(()=>{
    const leftLink=document.querySelector('#nsk-left-panel-container a[href="/categories/tech"]');
    const host=window.navigation||window,ev=window.navigation?"navigate":"click";
    host.addEventListener(ev,()=>{
     const activeNow=leftLink.hasAttribute("data-nsmax-header-cat-on")&&leftLink.getAttribute("aria-current")==="page";
     window.dispatchEvent(new Event("pagehide"));
     const reverted=!leftLink.hasAttribute("data-nsmax-header-cat-on")&&leftLink.getAttribute("aria-current")!=="page";
     sessionStorage.setItem("__nsmax_v59_nav",JSON.stringify({activeNow,reverted}));
    },{once:true});
    leftLink.click();
   });
   await deskNav.page.waitForURL("**/categories/tech");
   await ready(deskNav.page);
   const navRes=await deskNav.page.evaluate(()=>JSON.parse(sessionStorage.getItem("__nsmax_v59_nav")||"null"));
   assert.deepEqual(navRes,{activeNow:true,reverted:true});
   if(engine==="chromium"){
    await deskNav.page.evaluate(()=>{
     const a=document.createElement("a");a.id="nsmax-search-prefetch";a.href="/search?q=test";a.textContent="搜索";
     document.querySelector("#nsk-head").append(a);
     a.dispatchEvent(new PointerEvent("pointerover",{bubbles:true}));
    });
    await deskNav.page.waitForTimeout(80);
    const hasSearchRule=await deskNav.page.evaluate(()=>[...document.querySelectorAll("script[type=speculationrules]")].some(s=>s.textContent.includes("/search?q=test")));
    assert.equal(hasSearchRule,true);
   }
   await deskNav.page.evaluate(()=>{
    const postLink=document.querySelector('#nsk-body-left .post-list-item .post-title > a[href="/post-1000-1"]');
    const host=window.navigation||window,ev=window.navigation?"navigate":"click";
    host.addEventListener(ev,()=>{
     const pendingPost=postLink.hasAttribute("data-nsmax-nav-pending");
     window.dispatchEvent(new Event("pagehide"));
     sessionStorage.setItem("__nsmax_v59_post",JSON.stringify({pendingPost,cleared:!postLink.hasAttribute("data-nsmax-nav-pending")}));
    },{once:true});
    postLink.click();
   });
   await deskNav.page.waitForURL("**/post-1000-1");
   await ready(deskNav.page);
   const postPending=await deskNav.page.evaluate(()=>JSON.parse(sessionStorage.getItem("__nsmax_v59_post")||"null"));
   assert.deepEqual(postPending,{pendingPost:true,cleared:true});
   assert.deepEqual(deskNav.errors,[]);
  }finally{await deskNav.context.close();}
 });
 test(`${engine} v1.9.63 流畅度与样式净化：零 :has()、桌面不加载触控规则、真站时间结构刷新零 batch、离页不拆毁主题 DOM`,async()=>{
  const twoDaysIso=new Date(Date.now()-2*864e5).toISOString();
  const listHtml=P.listPage({count:4}).replace(
   `<a href="/post-1000-1#0" class="info-item info-last-comment-time"><time title="2026-10-03 12:00:00" datetime="2026-10-03T04:00:00.000Z">1 分钟前</time></a>`,
   `<a href="/post-1000-1#0" class="info-item info-last-comment-time"><time title="2026-10-01 12:00:00" datetime="${twoDaysIso}">2days ago</time></a>`
  );
  const deskList=await open(browser,"https://www.nodeseek.com/",{...desk,html:listHtml,beforeNavigate:async(p)=>{
   await p.route("**/page-2",async(route)=>{
    await new Promise(r=>setTimeout(r,1200));
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:P.listPage({count:4})});
   });
  }});
  try{
   await ready(deskList.page);
   await deskList.page.waitForTimeout(200);
   const listState=await deskList.page.evaluate(()=>{
    const cssText=[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n");
    const firstTimeAnchor=document.querySelector('.post-list-item a[href^="/post-1000-1"].info-last-comment-time');
    const innerTime=firstTimeAnchor?.querySelector("time");
    return{
     hasPseudoCss:cssText.includes(":has("),
     hasTouchRule:cssText.replace(/:not\(\[data-nsmax-touch\]\)/g,"").includes("[data-nsmax-touch]"),
     hasTimeTag:!!innerTime,
     timeText:innerTime?.textContent||"",
     toolsDisplay:getComputedStyle(document.getElementById("nspp-tools")).display,
     toolsHasAttr:document.getElementById("nspp-tools")?.hasAttribute("data-nsmax-has-tools"),
     rootBgAttr:document.documentElement.hasAttribute("data-nspp-background")
    };
   });
   assert.equal(listState.hasPseudoCss,false,"桌面列表页样式不应包含 :has()");
   assert.equal(listState.hasTouchRule,false,"桌面列表页样式不应注入触控专属规则");
   assert.equal(listState.hasTimeTag,true,"保留原生 <time> 节点");
   assert.equal(listState.timeText,"2 天前",JSON.stringify(listState));
   assert.equal(listState.toolsDisplay,"none","#nspp-tools 无可见按钮时应隐藏");
   assert.equal(listState.toolsHasAttr,false);
   assert.equal(listState.rootBgAttr,false);
   const batchRes=await deskList.page.evaluate(()=>new Promise(resolve=>{
    const before=performance.getEntriesByName("nsmax:batch").length;
    const t=document.querySelector('.post-list-item a[href^="/post-1000-1"].info-last-comment-time time');
    if(t?.firstChild)t.firstChild.data="刚刚";
    Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});
    document.dispatchEvent(new Event("visibilitychange"));
    const bgOnHidden=document.documentElement.hasAttribute("data-nspp-background");
    Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});
    document.dispatchEvent(new Event("visibilitychange"));
    const bgOnVisible=document.documentElement.hasAttribute("data-nspp-background");
    setTimeout(()=>resolve({before,afterTimeAndVis:performance.getEntriesByName("nsmax:batch").length,bgOnHidden,bgOnVisible,timeTextAfterVis:t?.textContent||""}),250);
   }));
   assert.equal(batchRes.bgOnHidden,false,"切后台不再给 html 挂 data-nspp-background");
   assert.equal(batchRes.bgOnVisible,false);
   assert.equal(batchRes.afterTimeAndVis,batchRes.before,"<time> 刷新与回前台唤醒不触发 nsmax:batch");
   assert.equal(batchRes.timeTextAfterVis,"2 天前","listInteractions 绑定内部 <time> 并在回前台时刷新相对时间");
   await deskList.page.evaluate(()=>{
    const before=performance.getEntriesByName("nsmax:batch").length;
    const host=window.navigation||window,ev=window.navigation?"navigate":"click";
    host.addEventListener(ev,()=>{
     setTimeout(()=>{
      const duringBatches=performance.getEntriesByName("nsmax:batch").length;
      const barPresent=!!document.querySelector("#nsmax-nav-progress[data-on]");
      const themeBefore=document.documentElement.hasAttribute("data-nsmax-theme");
      window.dispatchEvent(new Event("pagehide"));
      const barAfterHide=!!document.getElementById("nsmax-nav-progress");
      const themeAfterHide=document.documentElement.hasAttribute("data-nsmax-theme");
      const headerKept=!!document.querySelector("[data-nsmax-header]");
      const p1Restored=[...document.querySelectorAll(".nsk-pager .pager-pos:not([href])")].every(el=>el.classList.contains("pager-cur"));
      sessionStorage.setItem("__nsmax_v63_nav",JSON.stringify({before,duringBatches,barPresent,barAfterHide,themeBefore,themeAfterHide,headerKept,p1Restored}));
     },240);
    },{once:true});
    document.querySelector('.nsk-pager.pager-bottom a.pager-pos[href="/page-2"]').click();
   });
   await deskList.page.waitForURL("**/page-2");
   await ready(deskList.page);
   const navState=await deskList.page.evaluate(()=>JSON.parse(sessionStorage.getItem("__nsmax_v63_nav")||"null"));
   assert.ok(navState,"应记录页面切换瞬间状态");
   assert.equal(navState.barPresent,true);
   assert.equal(navState.duringBatches,navState.before,"#nsmax-nav-progress 插入不触发 nsmax:batch");
   assert.equal(navState.barAfterHide,false,"pagehide 清除进度条");
   assert.equal(navState.p1Restored,true,"pagehide 还原待跳转分页高亮");
   assert.equal(navState.themeBefore&&navState.themeAfterHide&&navState.headerKept,true,"非 bfcache 离页不拆毁主题 DOM");
   assert.deepEqual(deskList.errors,[]);
  }finally{await deskList.context.close();}
  const deskPost=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html:P.postPage({comments:4})});
  try{
   await ready(deskPost.page);
   const postCss=await deskPost.page.evaluate(()=>[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n"));
   assert.equal(postCss.includes(":has("),false,"桌面帖子页样式不应包含 :has()");
   assert.equal(postCss.replace(/:not\(\[data-nsmax-touch\]\)/g,"").includes("[data-nsmax-touch]"),false,"桌面帖子页样式不应注入触控专属规则");
   assert.deepEqual(deskPost.errors,[]);
  }finally{await deskPost.context.close();}
  const mobList=await open(browser,"https://www.nodeseek.com/",{...phone(),html:P.listPage({mobile:true,count:4})});
  try{
   await ready(mobList.page);
   const mobCss=await mobList.page.evaluate(()=>[...document.querySelectorAll("style")].map(s=>s.textContent).join("\n"));
   assert.equal(mobCss.includes(":has("),false,"手机列表页样式不应包含 :has()");
   assert.equal(mobCss.includes("[data-nsmax-touch]"),true,"手机触控页正常加载 [data-nsmax-touch] 规则");
   assert.deepEqual(mobList.errors,[]);
  }finally{await mobList.context.close();}
 });
 test(`${engine} 电脑端第十轮：滚动条留位、发帖页内容框不缩进、没有工具条的页面不漏设置按钮、签到页今天看得出`,async()=>{
  if(engine!=="chromium")return;
  // 发帖页：「内容」那块（编辑器）和「板块 / 标题 / 阅读限制」左右边对齐
  const np=await open(browser,"https://www.nodeseek.com/new-discussion",{...desk,html:P.newPostPage()});
  try{
   await ready(np.page);
   const s=await np.page.evaluate(()=>{const box=e=>{const r=document.querySelector(e).getBoundingClientRect();return[Math.round(r.left),Math.round(r.right)];};return{title:box(".md-editor > .title-input"),area:box("#editor-body .content-area"),category:box("select#category"),gutter:getComputedStyle(document.documentElement).scrollbarGutter};});
   assert.deepEqual(s.area,s.title,JSON.stringify(s));
   assert.deepEqual(s.area,s.category,JSON.stringify(s));
   assert.equal(s.gutter,"stable","电脑端给滚动条留位，长页短页顶栏不左右跳");
   assert.deepEqual(np.errors,[]);
  }finally{await np.context.close();}
  // 站点设置页没有浮动工具条：打开再关上设置面板后，页面上不留没样式的按钮
  const st=await open(browser,"https://www.nodeseek.com/setting",{...desk,html:P.settingPage()});
  try{
   await ready(st.page);
   await st.page.locator(".nsmax-settings-button").click();
   await st.page.locator("#nspp-settings").evaluate(h=>new Promise(r=>{const t=()=>h.shadowRoot?.querySelector("dialog[open]")?r():requestAnimationFrame(t);t();}));
   await st.page.keyboard.press("Escape");
   assert.equal(await st.page.evaluate(()=>document.querySelectorAll("body > .nspp-tool-icon, body > [data-nspp-settings-launcher]").length),0);
   assert.deepEqual(st.errors,[]);
  }finally{await st.context.close();}
  // 签到页：签过以后今天那格里面一圈黄色；「今日已签到」不再半透明
  const bd=await open(browser,"https://www.nodeseek.com/board",{...desk,html:P.boardRealPage()});
  try{
   await bd.page.waitForSelector(".nsmax-checkin-day[data-today][data-signed]");
   const b=await bd.page.evaluate(()=>({ring:getComputedStyle(document.querySelector(".nsmax-checkin-day[data-today][data-signed]")).boxShadow,opacity:getComputedStyle(document.querySelector(".nsmax-checkin-button:disabled")).opacity}));
   assert.match(b.ring,/inset/,JSON.stringify(b));
   assert.equal(b.opacity,"1",JSON.stringify(b));
  }finally{await bd.context.close();}
 });
 test(`${engine} 离页不留请求：停在标题上马上按下不再取卡片正文；pagehide 时还没回来的读取请求都取消（带着请求进往返缓存会被赶出来，后退变整页重载）`,async()=>{
  // 记下脚本发的每个 fetch 和它的中止信号
  const init="window.__fetches=[];const f=window.fetch;window.fetch=function(input,options){window.__fetches.push({url:String(input&&input.url||input),signal:options&&options.signal||null});return f.apply(this,arguments);};";
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage({count:6}),init,api:{"/api/account/getInfo/11":[{delay:3000,status:200,body:{success:true,detail:{member_id:11,member_name:"user1"}}}]}});
  try{
   await ready(page);
   await page.evaluate(()=>addEventListener("click",(e)=>e.preventDefault(),{capture:true,once:true}));
   const title=page.locator(".post-list-item:nth-child(1) .post-title a");
   const box=await title.boundingBox();
   await page.mouse.move(box.x+10,box.y+box.height/2,{steps:2});
   await page.waitForTimeout(120);
   await page.mouse.down();
   // 不按下时 0.3 秒开始取正文、0.5 秒弹卡片；按下去了就都不要
   await page.waitForTimeout(700);
   const pressed=await page.evaluate(()=>({posts:window.__fetches.filter(x=>/\/post-1000-1/.test(x.url)).length,open:!!document.querySelector("dialog.nspp-post-preview[open]")}));
   await page.mouse.up();
   assert.deepEqual(pressed,{posts:0,open:false});
   // 停在名字上：资料卡开始读资料（接口 3 秒才回），这时离页
   const author=page.locator(".post-list-item:nth-child(2) .info-author a");
   await author.hover();
   await page.waitForFunction(()=>window.__fetches.some(x=>x.url.includes("/api/account/getInfo/11")));
   const before=await page.evaluate(()=>window.__fetches.filter(x=>x.url.includes("/api/account/getInfo/11")).map(x=>!!x.signal?.aborted));
   assert.deepEqual(before,[false]);
   await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));});
   const after=await page.evaluate(()=>window.__fetches.filter(x=>x.url.includes("/api/account/getInfo/11")).map(x=>!!x.signal?.aborted));
   assert.deepEqual(after,[true],"离页时还在路上的资料请求要取消");
   // 回来后的新请求照常（不沿用已经中止的信号）
   await page.mouse.move(5,5);
   await page.locator(".post-list-item:nth-child(3) .info-author a").hover();
   await page.waitForFunction(()=>window.__fetches.some(x=>x.url.includes("/api/account/getInfo/12")));
   assert.equal(await page.evaluate(()=>window.__fetches.find(x=>x.url.includes("/api/account/getInfo/12")).signal?.aborted),false);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 滚动跟手（2026-11-20）：电脑上长帖第 9 层以后的楼层空闲时提前排好；右栏滚到头以后接着滚页面`,async()=>{
  const base=P.postPage(),third=base.match(/<li class="content-item" id="3">[\s\S]*?<\/li>/)[0];
  const extra=Array.from({length:21},(_,i)=>third.replace('id="3"',`id="${i+4}"`).replace(/#3\b/g,"#"+(i+4))).join("");
  const html=base.replace(third,third+extra);
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html});
  try{
   await ready(page);
   assert.equal(await page.evaluate(()=>document.querySelectorAll("ul.comments>li.content-item").length),24);
   await page.waitForFunction(()=>[...document.querySelectorAll("ul.comments>li.content-item")].every(li=>li.hasAttribute("data-nsmax-cv-done")),null,{timeout:15000});
   const s=await page.evaluate(()=>{const li=document.querySelectorAll("ul.comments>li.content-item")[20],side=document.getElementById("nsk-right-panel-container");return{cv:getComputedStyle(li).contentVisibility,side:side&&getComputedStyle(side).overscrollBehaviorY,sideOverflow:side&&getComputedStyle(side).overflowY};});
   assert.deepEqual(s,{cv:"visible",side:"auto",sideOverflow:"auto"});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 test(`${engine} 电脑端对比度走查（2026-11-22）：消息里的链接认得出（下划线）、个人介绍链接不是站点绿、占位字够深、消息搜索框聚焦看得见、Lv5 标够清楚`,async()=>{
  // 浅色主题 --link 是墨色，和正文同色：正文、签名靠 2px 黄色下划线区分；私信气泡、系统消息、个人介绍以前没有这道线，看不出能点
  const S="https://www.nodeseek.com",now=Date.now();
  const msg=(id,sender,content,ago)=>({id,sender_id:sender,receiver_id:1,content,is_markdown:1,viewed:1,created_at:new Date(now-ago).toISOString()});
  const sys=[msg(91,5230,`你关注的用户[stgunner](${S}/space/1001)发布了一篇[新的帖子](${S}/post-1055945-1)`,5e6),msg(92,5230,`站点维护通知：详见 [公告](${S}/post-1-1)`,4e6)];
  const list={success:true,msgArray:[{receiver_id:1,sender_id:5230,max_id:92,content:sys[1].content,created_at:sys[1].created_at,viewed:1,sender_name:"系统通知",receiver_name:"tester"}]};
  // 页面里算对比度：颜色先画到 1×1 画布上取像素（color-mix / color() 都能换成 rgb），往上找第一层不透明底色
  const lib=()=>{const cv=document.createElement("canvas");cv.width=cv.height=1;const cx=cv.getContext("2d",{willReadFrequently:true});
   const rgba=s=>{cx.clearRect(0,0,1,1);cx.fillStyle="#000";cx.fillStyle=s;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;return[d[0],d[1],d[2],d[3]/255];};
   const over=(t,b)=>t.map((v,i)=>i<3?v*t[3]+b[i]*(1-t[3]):1);
   const bg=el=>{const st=[];for(let e=el;e;e=e.parentElement){const c=rgba(getComputedStyle(e).backgroundColor);if(c[3]>0){st.push(c);if(c[3]>.999)break;}}return st.reverse().reduce((b,c)=>over(c,b),[255,255,255,1]);};
   const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);};
   window.__contrast=(el,pseudo)=>{const b=bg(el),f=over(rgba(getComputedStyle(el,pseudo).color),b),x=lum(f),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   window.__deco=el=>{const cs=getComputedStyle(el);return{line:cs.textDecorationLine,alpha:rgba(cs.textDecorationColor)[3],thick:cs.textDecorationThickness};};
   window.__rgb=s=>rgba(s).slice(0,3).join(",");};
  for(const dark of [false,true]){
   const theme={colorScheme:dark?"dark":"light",...desk};
   {const {context,page,errors}=await open(browser,`${S}/notification#/message?mode=talk&to=5230`,{...theme,html:P.nativeTalkPage({dark}),api:{"/api/notification/message/with/5230":[{status:200,body:{success:true,talkTo:{member_id:5230,member_name:"系统通知"},msgArray:sys}}],"/api/notification/message/list":[{status:200,body:list}]}});
    try{
     await ready(page);
     await page.waitForSelector(".is-system-thread .is-system .nspp-messages-system-target");
     await page.evaluate(lib);
     const s=await page.evaluate(()=>{const t=[...document.querySelectorAll(".is-system-thread .nspp-messages-system-target")];const input=document.querySelector(".nspp-messages-sidebar .nspp-messages-search input");
      return{targets:t.map(a=>({text:a.textContent,...__deco(a)})),neutral:__rgb(getComputedStyle(t[1]).textDecorationColor),linkLine:__rgb(getComputedStyle(document.documentElement).getPropertyValue("--link-line")),placeholder:__contrast(input,"::placeholder")};});
     for(const t of s.targets)assert.ok(t.line.includes("underline")&&t.alpha>=.4&&t.thick==="2px",`系统消息要点链接有下划线（${dark?"深色":"浅色"}）：${JSON.stringify(t)}`);
     assert.equal(s.neutral,s.linkLine,"「通知」类没有小标色，链接用正文链接那道黄色下划线");
     assert.ok(s.placeholder>=4.5,`消息搜索框占位字对比度 ${s.placeholder.toFixed(2)}（以前浏览器默认灰，深色底上 3.7）`);
     const input=page.locator(".nspp-messages-sidebar .nspp-messages-search input");
     const idle=await input.evaluate(e=>getComputedStyle(e).borderTopColor);
     await input.focus();
     await page.waitForTimeout(200);
     const f=await input.evaluate(e=>({border:__rgb(getComputedStyle(e).borderTopColor),focus:__rgb(getComputedStyle(document.documentElement).getPropertyValue("--field-focus"))}));
     assert.notEqual(f.border,__rgbNode(idle),"消息搜索框聚焦后边框要变");
     assert.equal(f.border,f.focus,"聚焦是发帖标题框那种黄边");
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
   {const {context,page,errors}=await open(browser,`${S}/notification#/message?mode=talk&to=7`,{...theme,html:P.nativeTalkPage({dark}),api:{"/api/notification/message/with/7":[{status:200,body:{success:true,talkTo:{member_id:7,member_name:"friend"},msgArray:[msg(21,7,`看看 [这个帖子](${S}/post-1-1) 再说`,36e5)]}}]}});
    try{
     await ready(page);
     await page.waitForSelector(".nspp-messages-thread .nspp-messages-bubble a");
     await page.evaluate(lib);
     const d=await page.locator(".nspp-messages-thread .nspp-messages-message:not(.is-mine) .nspp-messages-bubble a").first().evaluate(a=>__deco(a));
     assert.ok(d.line.includes("underline")&&d.alpha>.9&&d.thick==="2px",`别人私信里的链接和正文链接一样有黄色下划线：${JSON.stringify(d)}`);
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
   {const {context,page,errors}=await open(browser,`${S}/space/10`,{...theme,html:P.spaceGeneralPage(`<p>见 <a href="https://example.com/">我的博客</a> 吧</p>`,{dark})});
    try{
     await ready(page);
     await page.waitForSelector(".selector > .readme a");
     await page.evaluate(lib);
     const r=await page.locator(".selector > .readme a").evaluate(a=>({color:__rgb(getComputedStyle(a).color),...__deco(a),contrast:__contrast(a)}));
     assert.notEqual(r.color,"13,188,121","个人介绍链接不再是站点的 #0dbc79 绿");
     assert.ok(r.line.includes("underline")&&r.contrast>=4.5,JSON.stringify(r));
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
   {const {context,page,errors}=await open(browser,`${S}/fans?type=follow`,{...theme,html:P.fansPage({dark})});
    try{
     await ready(page);
     await page.waitForSelector('[data-nsmax-level="5"]');
     await page.evaluate(lib);
     const c=await page.locator('[data-nsmax-level="5"]').first().evaluate(e=>__contrast(e));
     assert.ok(c>=4.5,`Lv5 橙色等级标对比度 ${c.toFixed(2)}（以前浅色 3.9）`);
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
  }
 });
 test(`${engine} 私信输入区重做（2026-11-22「私信这个地方的 ui 也不搭配」）：框线只画在一个元素上、聚焦黄框 + 光圈；没写字时「发送」是弱底弱字不透明；别处主按钮不能点时同一个样子`,async()=>{
  if(engine!=="chromium")return;
  for(const dark of [false,true]){
   const theme={...desk,viewport:{width:1440,height:900},colorScheme:dark?"dark":"light"};
   {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/message?mode=talk&to=7",{...theme,html:P.nativeTalkPage({dark})});
    try{
     await ready(page);
     await page.waitForSelector(".nspp-messages-composer textarea:visible");
     const read=()=>page.evaluate(()=>{const cs=s=>getComputedStyle(document.querySelector(s));const c=cs(".nspp-messages-composer"),e=cs(".nspp-message-editor"),a=cs(".nspp-messages-compose-actions"),t=cs(".nspp-messages-composer textarea"),b=cs(".nspp-messages-send"),root=getComputedStyle(document.documentElement);
      return {box:[c.borderTopWidth,c.borderRightWidth,c.borderBottomWidth,c.borderLeftWidth],boxColor:c.borderTopColor,boxRight:c.borderRightColor,boxBottom:c.borderBottomColor,shadow:c.boxShadow,inner:[e.borderTopWidth,e.borderRightWidth,e.borderLeftWidth,a.borderRightWidth,a.borderBottomWidth,a.borderLeftWidth,t.borderTopWidth,t.borderRightWidth],innerBg:[e.backgroundColor,a.backgroundColor],send:{h:b.height,opacity:b.opacity,bg:b.backgroundColor,color:b.color,disabled:document.querySelector(".nspp-messages-send").disabled},tool:document.querySelector(".nspp-message-editor-toolbar > button").getBoundingClientRect().height,lineStrong:root.getPropertyValue("--line-strong").trim(),action:root.getPropertyValue("--action").trim()};});
     const idle=await read();
     assert.deepEqual(idle.box,["1px","1px","1px","1px"],"输入盒一圈 1px 线");
     assert.ok(idle.inner.every(w=>w==="0px"),`里面的上下两半和文本框都不画线：${idle.inner}`);
     assert.deepEqual(idle.innerBg,["rgba(0, 0, 0, 0)","rgba(0, 0, 0, 0)"],"里面不再铺一层底色");
     assert.equal(idle.send.disabled,true);
     assert.equal(idle.send.opacity,"1","不能点的「发送」不靠透明度");
     assert.equal(idle.send.h,"28px");assert.equal(idle.tool,28,"「发送」和「附件」「预览」同一档");
     await page.locator(".nspp-messages-composer textarea").fill("你好");
     await page.waitForTimeout(250);
     const focus=await read();
     assert.equal(focus.boxColor,focus.boxRight);assert.equal(focus.boxColor,focus.boxBottom,"聚焦时四条边同一个颜色（以前上下两半各一截，对不齐）");
     assert.notEqual(focus.boxColor,idle.boxColor,"聚焦框线变色");
     assert.ok(/ 0px 0px 0px 3px/.test(focus.shadow),`聚焦有 3px 光圈：${focus.shadow}`);
     assert.equal(focus.send.disabled,false);
     assert.notEqual(focus.send.bg,idle.send.bg,"写了字「发送」变成墨色实底");
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
   {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...theme,html:P.postPage({dark,editorMode:"real"})});
    try{
     await ready(page);
     const btn=page.locator(".md-editor .topic-select > button.submit");
     await btn.waitFor();
     const s=await btn.evaluate(b=>{b.style.setProperty("transition","none","important");const before=getComputedStyle(b).backgroundColor,cursor=getComputedStyle(b).cursor;b.disabled=true;const c=getComputedStyle(b);const r={before,cursor,after:c.backgroundColor,opacity:c.opacity,cursorOff:c.cursor};b.disabled=false;return r;});
     assert.equal(s.cursor,"pointer","回复按钮是手形");
     assert.notEqual(s.after,s.before,"「回复楼主」不能点时换成次底色");
     assert.equal(s.opacity,"1");assert.equal(s.cursorOff,"not-allowed");
     assert.deepEqual(errors,[]);
    }finally{await context.close();}}
  }
 });
 test(`${engine} 电脑端横排放不下（2026-11-22）：窄屏通知标题栏的标签不被挤进看不见的横向滚动，筛选框和按钮换到第二行；页脚链接不被省略`,async()=>{
  // 页面里量：横向放不下又藏着的容器（里面有链接 / 按钮），露半个的胶囊 / 按钮 / 标签，被省略的页脚链接
  const clipped=()=>{
   const out=[],shown=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.checkVisibility();};
   const all=[...document.querySelectorAll("body *")].filter(e=>!e.closest(".search-overlay,script,style,svg,template")&&shown(e));
   for(const e of all){
    const cs=getComputedStyle(e);
    if(/auto|scroll|hidden|clip/.test(cs.overflowX)&&e.scrollWidth>e.clientWidth+1&&e.querySelector("a,button,[role=tab]")&&e.getBoundingClientRect().height<120)out.push(`放不下：${e.className} ${e.scrollWidth}/${e.clientWidth}`);
    if(!e.matches("a,button,[role=tab]"))continue;
    const r=e.getBoundingClientRect();
    for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){
     if(getComputedStyle(a).overflowX==="visible")continue;
     const b=a.getBoundingClientRect(),left=b.left+a.clientLeft,right=left+a.clientWidth;
     if((left-r.left>1&&r.right>left+1)||(r.right-right>1&&r.left<right-1))out.push(`露半个：「${e.textContent.trim().slice(0,10)}」在 ${a.className} 边上`);
     break;
    }
   }
   for(const a of document.querySelectorAll("body > footer .contain > .col a"))if(shown(a)&&a.scrollWidth>a.clientWidth+0.5)out.push(`页脚省略：${a.textContent.trim()}`);
   return out;
  };
  for(const width of [801,860,900,1024,1100]){
   for(const [url,html] of [["/notification#/atMe",P.notificationPage({})],["/",P.listPage()]]){
    const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,viewport:{width,height:900},html});
    try{
     await ready(page);
     if(url!=="/")await page.waitForFunction(()=>[...document.querySelectorAll(".nsmax-message-tabs .nspp-messages-count")].filter(e=>!e.hidden&&e.textContent).length===3);
     await page.waitForTimeout(300);
     assert.deepEqual(await page.evaluate(clipped),[],`${width}px ${url}`);
     assert.deepEqual(errors,[]);
    }finally{await context.close();}
   }
  }
  // 通知标题栏（三个标签都带未读数）：801px 一行放不下时两行、筛选框换到第二行撑满；1024px 还是一行、高度和以前一样（标签 49px + 上下 1px 边）
  for(const [width,rows] of [[801,2],[1024,1]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/notification#/atMe",{...desk,viewport:{width,height:900},html:P.notificationPage({})});
   try{
    await ready(page);
    await page.waitForSelector(".nspp-messages-top .nsmax-notice-tools > input");
    await page.waitForFunction(()=>[...document.querySelectorAll(".nsmax-message-tabs .nspp-messages-count")].filter(e=>!e.hidden&&e.textContent).length===3);
    const r=await page.evaluate(()=>{const top=document.querySelector(".nspp-messages-top"),tabs=top.querySelector(".nsmax-message-tabs"),input=top.querySelector(".nsmax-notice-tools > input"),t=tabs.getBoundingClientRect(),i=input.getBoundingClientRect();return{height:top.offsetHeight,tabs:[tabs.scrollWidth,tabs.clientWidth],below:i.top>=t.bottom-1,input:i.width};});
    assert.equal(r.tabs[0],r.tabs[1],`${width}px 标签栏不横向滚动 ${r.tabs}`);
    if(rows===2){assert.ok(r.below&&r.input>200,`801px 筛选框在第二行、撑开 ${JSON.stringify(r)}`);assert.ok(near(r.height,99,2),`两行高 ${r.height}`);}
    else{assert.ok(!r.below&&near(r.input,200,0.5),`1024px 一行、筛选框 200px ${JSON.stringify(r)}`);assert.equal(r.height,51);}
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 电脑端第十三轮：短页面页脚铺到窗口底、资料卡按钮 28px、预览卡片正文顶上不空一截、登录 / 注册卡片离顶栏 20px、管理记录数字等宽、签到排行前三看得清`,async()=>{
  // 2026-11-22 第十三轮逐页走查（1440 / 1100px、浅色深色、微软雅黑 UI 度量）找到的几类问题，每类在所有同类页面上量
  if(engine!=="chromium")return;
  const lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};const [r,g,b]=c.match(/[\d.]+/g).map(Number);return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  // 1. 内容少的页面：页脚下面以前露出一截灰色画布。页脚同色的投影铺到窗口底，可滚动高度不变（不多出空白）
  for(const [url,html,dark] of [["/credit",P.creditPage(),false],["/credit",P.creditPage({dark:true}),true],["/member?q=abc",P.findUserPage(),false],["/invite",P.invitePage(),true]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,viewport:{width:1440,height:1000},html,colorScheme:dark?"dark":"light"});
   try{
    await ready(page);
    await page.waitForTimeout(300);
    const r=await page.evaluate(()=>{const f=document.querySelector("body > footer"),cs=getComputedStyle(f),b=f.getBoundingClientRect();const m=cs.boxShadow.match(/^(rgba?\([^)]*\)) (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px (-?[\d.]+)px$/);
     return{bottom:b.bottom,top:b.top,vh:innerHeight,bg:cs.backgroundColor,shadow:m&&{color:m[1],y:+m[3],spread:+m[5]},scroll:document.documentElement.scrollHeight};});
    assert.ok(r.bottom<r.vh,`${url} 是短页面 ${JSON.stringify(r)}`);
    assert.ok(r.shadow,`${url} 页脚下面有延伸 ${JSON.stringify(r)}`);
    assert.equal(r.shadow.color,r.bg,`${url} 延伸部分和页脚同色`);
    assert.ok(r.shadow.y-r.shadow.spread<=0&&r.bottom+r.shadow.y+r.shadow.spread>=r.vh,`${url} 从页脚铺到窗口底 ${JSON.stringify(r)}`);
    assert.ok(r.scroll<=r.vh,`${url} 不多出可滚动的空白 ${r.scroll}`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...desk,html:P.postPage()});
  try{
   await ready(page);
   await page.waitForTimeout(300);
   const r=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight,footer:document.querySelector("body > footer").getBoundingClientRect().bottom+scrollY}));
   assert.ok(near(r.scroll,r.footer,1),`长页面滚到底就是页脚底 ${JSON.stringify(r)}`);
   // 2. 资料卡「关注 / 私信 / 主页」：卡片内胶囊一档 28px / 12px（以前 32.75px / 13px，和关注页卡片上同样的按钮不一样高）
   await page.locator(".nsmax-author-col .nsmax-author-name").first().hover();
   await page.waitForSelector(".nsmax-person-pop dd",{timeout:5000});
   const pop=await page.evaluate(()=>{const items=[...document.querySelectorAll(".nsmax-person-pop .nsmax-person-actions > :is(a, button)")];const f=document.querySelector(".nsmax-person-pop .nsmax-person-follow");
    f.style.setProperty("transition","none","important");f.disabled=true;const cs=getComputedStyle(f);
    return{sizes:[...new Set(items.map(e=>Math.round(e.getBoundingClientRect().height*4)/4+"/"+getComputedStyle(e).fontSize))],disabled:{opacity:cs.opacity,bg:cs.backgroundColor,cursor:cs.cursor},panelAlt:getComputedStyle(document.body).getPropertyValue("--panel-alt").trim()};});
   assert.deepEqual(pop.sizes,["28/12px"],JSON.stringify(pop));
   // 「关注」状态读回来之前不能点：不再整块打六折透明，和别的主按钮不能点时一样
   assert.equal(pop.disabled.opacity,"1");
   assert.equal(pop.disabled.cursor,"not-allowed");
   assert.notEqual(pop.disabled.bg,"rgb(28, 28, 30)",JSON.stringify(pop.disabled));
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 3. 悬停预览卡片：正文第一块是标题时，以前标题的 1.5em 上边距留在卡片里（正文外面包着 article，只去掉了直接子元素的上边距），顶上空一截
  {const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...desk,html:P.listPage(),pages:{"/post-1000-1":P.postPage()}});
  try{
   await ready(page);
   let shown=false;
   for(let i=0;i<6&&!shown;i++){await page.mouse.move(5,5);await page.locator(".post-list-item .post-title a").first().hover();shown=await page.waitForSelector("dialog.nspp-post-preview[open] article h2",{timeout:2500}).then(()=>true,()=>false);}
   assert.ok(shown);
   const r=await page.evaluate(()=>{const d=document.querySelector("dialog.nspp-post-preview"),c=d.querySelector(".nspp-preview-content"),h=c.querySelector("article > :first-child");return{tag:h.tagName,gap:h.getBoundingClientRect().top-c.getBoundingClientRect().top,pad:parseFloat(getComputedStyle(c).paddingTop)};});
   assert.equal(r.tag,"H2");
   assert.ok(near(r.gap,r.pad,0.5),`标题紧挨卡片内边距 ${JSON.stringify(r)}`);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 4. 登录（含邮箱 / 短信登录）、注册：卡片离顶栏都是 20px（以前登录 48px、注册 28px，别的页面都是 20px）；5. 注册页单选 13px
  for(const [url,html] of [["/signIn.html",P.signInPage()],["/emailSignIn.html",P.emailSignInPage()],["/smsSignIn.html",P.smsSignInPage()],["/register.html",P.registerPage()]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com"+url,{...desk,viewport:{width:1440,height:900},html});
   try{
    await ready(page);
    await page.waitForSelector("[data-nsmax-auth-card]");
    const r=await page.evaluate(()=>({gap:document.querySelector("[data-nsmax-auth-card]").getBoundingClientRect().top-document.querySelector("body > header").getBoundingClientRect().bottom,radios:[...document.querySelectorAll("[data-nsmax-auth-app] .pure-radio")].filter(e=>e.offsetWidth).map(e=>getComputedStyle(e.querySelector("span")||e).fontSize)}));
    assert.ok(near(r.gap,20,0.5),`${url} 卡片离顶栏 ${r.gap}`);
    if(url==="/register.html")assert.deepEqual(r.radios,["13px","13px"]);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
  // 6. 管理记录：编号、时间和账簿表格一样用等宽数字，时间弱化色
  {const credit=await open(browser,"https://www.nodeseek.com/credit",{...desk,html:P.creditPage()});
  let ref;
  try{await ready(credit.page);ref=await credit.page.evaluate(()=>{const td=document.querySelector(".credit-table tbody tr > td:nth-child(4)"),cs=getComputedStyle(td);return{font:cs.fontFamily,color:cs.color};});}finally{await credit.context.close();}
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/ruling",{...desk,html:P.rulingPage()});
  try{
   await ready(page);
   const r=await page.evaluate(()=>{const row=document.querySelector(".ruling-log tbody tr");const f=(e)=>getComputedStyle(e).fontFamily;return{id:f(row.querySelector("td:first-child a")||row.firstElementChild),time:f(row.lastElementChild),timeColor:getComputedStyle(row.lastElementChild).color,name:f(row.children[1])};});
   assert.equal(r.id,ref.font,"编号等宽");
   assert.equal(r.time,ref.font,"时间等宽");
   assert.equal(r.timeColor,ref.color,"时间弱化色和账簿一样");
   assert.notEqual(r.name,ref.font,"用户名不变");
   assert.deepEqual(errors,[]);
  }finally{await context.close();}}
  // 7. 签到排行榜前三名：红 / 橙 / 黄字对比度够 4.5:1（以前浅色 3.2 / 2.5 / 1.8、深色红字 4.3）
  for(const dark of [false,true]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/board",{...desk,html:P.boardPage({dark}),colorScheme:dark?"dark":"light"});
   try{
    await ready(page);
    await page.waitForSelector('.nsmax-board-row[data-rank="3"] .nsmax-board-rank');
    const ranks=await page.evaluate(()=>[1,2,3].map(n=>{const e=document.querySelector(`.nsmax-board-row[data-rank="${n}"] .nsmax-board-rank`);const c=document.createElement("canvas").getContext("2d");
     // 胶囊底色是半透明的：叠到卡片底色上再算
     const bgOf=(el)=>{for(let a=el.parentElement;a;a=a.parentElement){const b=getComputedStyle(a).backgroundColor;if(!/rgba\(0, 0, 0, 0\)|transparent/.test(b)&&!/, 0\.\d+\)$/.test(b))return b;}return getComputedStyle(document.body).backgroundColor;};
     const base=bgOf(e),own=getComputedStyle(e).backgroundColor;c.fillStyle=base;c.fillRect(0,0,1,1);c.fillStyle=own;c.fillRect(0,0,1,1);const [r,g,b]=c.getImageData(0,0,1,1).data;
     return{color:getComputedStyle(e).color,bg:`rgb(${r}, ${g}, ${b})`};}));
    for(const [i,r] of ranks.entries())assert.ok(ratio(r.color,r.bg)>=4.5,`${dark?"深色":"浅色"}第 ${i+1} 名 ${ratio(r.color,r.bg).toFixed(2)} ${JSON.stringify(r)}`);
    if(dark)assert.deepEqual(ranks.map(r=>r.color),["rgb(248, 113, 113)","rgb(249, 115, 22)","rgb(234, 179, 8)"],"深色橙、黄不动，红提亮一点");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
// 在 Node 这边把 rgb() 字符串换成「r,g,b」（和页面里 __rgb 的输出一样）
function __rgbNode(s){const m=s.match(/[\d.]+/g)||[];return m.slice(0,3).map(Number).join(",");}
