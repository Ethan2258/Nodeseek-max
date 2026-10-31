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
 test(`${engine} 手机楼层：时间和正文同一条左边线，操作和楼号对齐正文右边线，楼号和头像同一条中线`,async()=>{
  // 2026-10-31：≥360px 时时间和「回复 引用 点赞 鸡腿 反对」同一行，楼号挪到作者行右边（见 tests/mobile-details.test.cjs）
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...phone(),html:P.postPage({mobile:true})});
  try{
   await ready(page);
   const s=await page.evaluate(()=>{
    const li=document.querySelector("ul.comments>li.content-item"),items=[...li.querySelectorAll(".comment-menu>.menu-item")].filter(e=>e.offsetWidth).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left),last=items[items.length-1],link=li.querySelector(".floor-link"),body=li.querySelector("article.post-content").getBoundingClientRect(),avatar=li.querySelector(".nsmax-author-avatar").getBoundingClientRect();
    const text=(el)=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect();};
    return{timeLeft:text(li.querySelector(".nsk-content-meta-info time")).left,bodyLeft:body.left,lastRight:last.getBoundingClientRect().right-parseFloat(getComputedStyle(last).paddingRight),right:text(link).right,bodyRight:body.right,linkMiddle:(text(link).top+text(link).bottom)/2,avatarMiddle:(avatar.top+avatar.bottom)/2,itemHeight:last.getBoundingClientRect().height};
   });
   assert.ok(near(s.timeLeft,s.bodyLeft,1.5),JSON.stringify(s));
   assert.ok(near(s.lastRight,s.bodyRight,1.5),JSON.stringify(s));
   assert.ok(near(s.right,s.bodyRight,1.5),JSON.stringify(s));
   assert.ok(near(s.linkMiddle,s.avatarMiddle,1.5),JSON.stringify(s));
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
    box.innerHTML='<div class="ip-list" style="background:rgba(0,0,0,.72);color:#fff;padding:10px;border-radius:12px"><div class="ip-item"><a href="#">1.2.3.4</a> <p>3 days ago</p></div><div class="ip-item"><a href="#">5.6.7.8</a> <p>4 days ago</p></div></div><div class="block-list" style="background:rgb(247,248,250);box-shadow:rgba(0,0,0,.1) 4px 4px 8px;padding:15px"><form class="pure-form"><input></form></div><form class="pure-form"><input type="password"><div class="mail-row" style="display:flex"></div></form><div style="text-align:center"><img class="avatar" style="width:320px;height:320px" alt=""><p>name</p></div>';
    // HTML 解析器会丢掉嵌套的 form，真站这层是脚本创建的，这里也用 DOM 接口建
    const nested=document.createElement("form");
    nested.className="pure-form";
    nested.style.width="300px";
    nested.append(Object.assign(document.createElement("input"),{className:"mail"}));
    box.querySelector(".mail-row").append(nested);
    host.append(box);
    const css=(sel)=>getComputedStyle(box.querySelector(sel));
    return{bg:css(".ip-list").backgroundColor,a:css(".ip-item a").color,time:css(".ip-item p").color,text:getComputedStyle(document.body).color,blockShadow:css(".block-list").boxShadow,blockBg:css(".block-list").backgroundColor,password:box.querySelector("input[type=password]").getBoundingClientRect().width,mail:box.querySelector("input.mail").getBoundingClientRect().width,avatar:box.querySelector("img.avatar").getBoundingClientRect().width,left:css("img.avatar + p").textAlign};
   });
   assert.notEqual(s.bg,"rgba(0, 0, 0, 0.72)");
   assert.equal(s.a,s.text,"IP 文字和正文同色");
   assert.notEqual(s.time,"rgb(255, 255, 255)");
   assert.equal(s.blockShadow,"none");
   assert.equal(s.blockBg,"rgba(0, 0, 0, 0)");
   assert.equal(s.mail,s.password,"邮箱框和密码框同宽");
   assert.equal(s.avatar,64);
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
}
