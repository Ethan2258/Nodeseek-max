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
    assert.ok(near(await box(page,".nsmax-password-toggle"),30,.6));
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
      firstTabGap:Math.round(tabs[0].getBoundingClientRect().left-document.querySelector(".selector").getBoundingClientRect().left),gaps:tabs.slice(1).map((t,i)=>Math.round(t.getBoundingClientRect().left-tabs[i].getBoundingClientRect().right)),overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(s.count,9,JSON.stringify(s));
    assert.equal(s.cols,cols,width+JSON.stringify(s));
    assert.equal(s.rows,9/cols,width+JSON.stringify(s));
    assert.equal(s.firstTabGap,14,width+JSON.stringify(s));
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
   await post.page.waitForSelector(".nsk-post > .post-title h1 > .nsmax-prize-badge, .nsk-post > .post-title h1 > .nsmax-poll-badge");
   const s=await post.page.evaluate(()=>{const h=document.querySelector(".nsk-post > .post-title h1"),box=h.getBoundingClientRect(),lh=parseFloat(getComputedStyle(h).lineHeight);
    return{lh,badges:[...h.querySelectorAll(":scope > .nsmax-prize-badge, :scope > .nsmax-poll-badge")].map(e=>{const b=e.getBoundingClientRect();return{h:b.height,line:Math.floor((b.top-box.top)/lh),d:+(((b.top+b.bottom)/2-box.top)%lh-lh/2).toFixed(2)};})};});
   assert.ok(s.badges.length>0&&s.badges.every(b=>b.h===18&&Math.abs(b.d)<=0.5),JSON.stringify(s));
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
}
