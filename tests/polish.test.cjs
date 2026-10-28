"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {webkit,devices}=require("playwright"),{launch,open,ROOT}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
for(const engine of ["chromium","webkit"]){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 手机弹窗：窄屏和横屏操作可点，快捷时间真实生效且关闭后解锁`,async()=>{
  for(const [width,height] of [[320,844],[844,390]]){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/new-discussion",{html:P.newPostPage({mobile:true}),seed,device:{...devices["iPhone 13"],viewport:{width,height}}});
   try{
    await ready(page);await page.locator(".nsmax-lucky-trigger").tap();const dialog=page.getByRole("dialog",{name:"一键抽奖",exact:true});
    const controls=await dialog.locator(".nsmax-dialog-close,.nsmax-dialog-button,.nsmax-lucky-chip,.nsmax-lucky-input:not([type=checkbox]),.nsmax-lucky-check").evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute("aria-label")||e.textContent.trim()||e.type,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
    assert.ok(controls.length>=10);assert.ok(controls.every(e=>e.height>=44&&e.width>=44),JSON.stringify({width,height,controls}));
    const value=await dialog.locator('input[type="datetime-local"]').inputValue();await dialog.getByRole("button",{name:"48 小时后",exact:true}).tap();
    const changed=await dialog.locator('input[type="datetime-local"]').inputValue();assert.notEqual(changed,value);const time=await page.evaluate(value=>({wait:new Date(value).getTime()-Date.now(),minute:new Date(value).getMinutes()}),changed);assert.ok(time.wait>=48*3600e3-120e3&&time.wait<=49*3600e3+120e3,JSON.stringify(time));assert.equal(time.minute,0,"快捷时间按下一个整点计算");
    const bounds=await dialog.evaluate(e=>({overflow:e.scrollWidth>e.clientWidth+1,foot:e.querySelector(".nsmax-dialog-foot").getBoundingClientRect().bottom,head:e.querySelector(".nsmax-dialog-close").getBoundingClientRect().top}));assert.equal(bounds.overflow,false);assert.ok(bounds.foot<=height+1);assert.ok(bounds.head>=0);
    await dialog.getByRole("button",{name:"关闭",exact:true}).tap();await page.waitForFunction(()=>document.body.style.position!=="fixed");assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 手机提示：键盘弹出和视口平移后仍可见，长网址完整换行`,async()=>{
  let source=fs.readFileSync(process.env.NSMAX_SCRIPT_PATH?path.resolve(process.env.NSMAX_SCRIPT_PATH):path.join(ROOT,"nodeseek-max.user.js"),"utf8");
  const end=source.lastIndexOf("})();");assert.ok(end>0);source=source.slice(0,end)+";window.__detailToast=nsmaxToast;\n"+source.slice(end);
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:P.listPage({mobile:true}),seed,device:{...devices["iPhone 13"],viewport:{width:390,height:844}},scriptSource:source,init:`window.__detailViewport=Object.assign(new EventTarget(),{height:844,width:390,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,"visualViewport",{configurable:true,value:window.__detailViewport});`});
  try{
   await ready(page);const message="保存失败，请检查连接： https://example.com/"+"longpath".repeat(24);
   for(const toastFirst of [false,true]){
   await page.evaluate(({message,toastFirst})=>{if(toastFirst)__detailToast(message,{error:true});__detailViewport.height=430;__detailViewport.offsetTop=90;__detailViewport.dispatchEvent(new Event("resize"));if(!toastFirst)__detailToast(message,{error:true});},{message,toastFirst});
   await page.waitForSelector(".nsmax-toast[data-nsmax-shown]");const toast=page.locator(".nsmax-toast");await toast.evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
   const state=await toast.evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,overflow:e.scrollWidth>e.clientWidth+1,text:e.textContent};});
   assert.ok(state.top>=90&&state.bottom<=520,JSON.stringify(state));assert.ok(state.left>=12&&state.right<=378,JSON.stringify(state));assert.equal(state.overflow,false);assert.equal(state.text,message);assert.notEqual(await page.evaluate(()=>document.body.style.position),"fixed","提示条不锁住页面滚动");
   await page.evaluate(()=>{__detailViewport.height=844;__detailViewport.offsetTop=0;__detailViewport.dispatchEvent(new Event("resize"));});await page.waitForFunction(()=>document.querySelector(".nsmax-toast").getBoundingClientRect().bottom>800);
   }assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
}
