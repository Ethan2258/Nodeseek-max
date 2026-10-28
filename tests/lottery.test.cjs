"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
for(const engine of ["chromium","webkit"]){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 抽奖预览：长网址、三位名额和长倒计时均不撑出卡片`,async()=>{
  for(const width of [1440,820,390,320])for(const dark of [false,true]){
   const phone=width<700,device=phone?{...devices["iPhone 13"],viewport:{width,height:844}}:{};
   const {context,page,errors,calls}=await open(browser,"https://www.nodeseek.com/new-discussion",{html:P.newPostPage({mobile:phone,dark}),viewport:{width,height:900},device,colorScheme:dark?"dark":"light"});
   try{
    await page.locator(".nsmax-lucky-trigger").click();const dialog=page.getByRole("dialog",{name:"一键抽奖",exact:true});
    const prize="https://"+"a".repeat(40)+".example/礼品";
    await dialog.getByRole("textbox",{name:"奖品",exact:true}).fill(prize);
    await dialog.locator('input[type=number]').nth(0).fill("100");await dialog.locator('input[type=number]').nth(1).fill("100000");
    await dialog.locator('input[type=datetime-local]').fill(new Date(Date.now()+400*864e5).toISOString().slice(0,16));
    const state=await dialog.evaluate(el=>{const body=el.querySelector(".nsmax-dialog-body"),preview=el.querySelector(".nsmax-lucky-preview"),card=preview.querySelector(".nsmax-lottery"),table=card.querySelector("table"),clock=card.querySelector(".nsmax-lottery-countdown"),r=card.getBoundingClientRect();return{dialogOverflow:el.scrollWidth>el.clientWidth+1,bodyOverflow:body.scrollWidth>body.clientWidth+1,previewOverflow:preview.scrollWidth>preview.clientWidth+1,clockOverflow:clock.scrollWidth>clock.clientWidth+1,right:table.getBoundingClientRect().right-r.right,left:table.getBoundingClientRect().left-r.left,cells:[...table.querySelectorAll("th,td")].map(c=>({right:c.getBoundingClientRect().right-r.right,text:c.textContent})),prize:card.querySelector(".nsmax-lottery-prize").textContent,count:card.querySelector(".nsmax-lottery-count").textContent,columns:table.querySelectorAll("thead th").length,footRight:el.querySelector(".nsmax-dialog-foot").getBoundingClientRect().right-el.getBoundingClientRect().right};});
    assert.equal(state.dialogOverflow,false,JSON.stringify({width,dark,state}));assert.equal(state.bodyOverflow,false,JSON.stringify({width,dark,state}));assert.equal(state.previewOverflow,false,JSON.stringify({width,dark,state}));assert.equal(state.clockOverflow,false,JSON.stringify({width,dark,state}));
    assert.ok(state.right<=-8&&state.left>=8,JSON.stringify(state));assert.ok(state.cells.every(c=>c.right<=-8),JSON.stringify(state.cells));assert.equal(state.columns,3);assert.equal(state.prize,prize);assert.equal(state.count,"100");assert.ok(state.footRight<=1);assert.equal(calls["/api/content/edit-discussion"]||0,0);
    await dialog.getByRole("button",{name:"取消",exact:true}).click();assert.equal(await page.evaluate(()=>document.body.style.position==="fixed"),false);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 查看开奖：保留原参数，并且只在末尾生成一个 mode=view`,async()=>{
  for(const phone of [false,true]){
  const href="/lucky?post=1000&time="+(Date.now()+864e5)+"&count=3&start=2&duplicate=false&mode=draw&mode=old&extra=keep";
  const html=P.postPage({mobile:phone}).replace("</article>",'<p><a href="'+href+'">查看开奖</a></p></article>');
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,device:phone?{...devices["iPhone 13"]}:{}});
  try{await page.waitForSelector(".nsmax-lottery-view[href]");const generated=await page.locator(".nsmax-lottery-view").first().getAttribute("href"),url=new URL(generated);assert.deepEqual(url.searchParams.getAll("mode"),["view"]);assert.equal(url.searchParams.get("post"),"1000");assert.equal(url.searchParams.get("count"),"3");assert.equal(url.searchParams.get("start"),"2");assert.equal(url.searchParams.get("extra"),"keep");assert.ok(generated.endsWith("&mode=view"));assert.equal(await page.locator("table.nsmax-lottery-table").evaluate(e=>getComputedStyle(e).display),"table");assert.deepEqual(errors,[]);}finally{await context.close();}
  }
 });
}
