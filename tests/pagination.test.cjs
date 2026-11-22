"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { webkit } = require("playwright");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");
const seed = {"nspp:settings:www.nodeseek.com":{"infinite-scroll":{posts:true},attendance:{enabled:false}}};
const ready = page => page.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length && !document.documentElement.hasAttribute("data-nsmax-mounting"));
const render = (current, count) => {
 const prev = current > 1 ? `<a class="pager-prev" href="/page-${current-1}">上一页</a>` : `<span class="pager-prev" aria-disabled="true">上一页</span>`;
 const pager = prev + [1,2,3,4].map(n => n === current ? `<span class="pager-pos pager-cur" aria-current="page">${n}</span>` : `<a class="pager-pos" href="/page-${n}">${n}</a>`).join("") + `<a class="pager-next" href="/page-${current+1}">下一页</a>`;
 let html = P.listPage({count}).replace(/<div class="nsk-pager (pager-top|pager-bottom)">[\s\S]*?<\/div><\/div>/g, (_,side) => `<div class="nsk-pager ${side}">${pager}</div>`);
 if (current > 1) html = html.replace(/\/post-(\d+)-/g, (_,id) => `/post-${Number(id)+1000*(current-1)}-`);
 return html;
};
for (const engine of (process.env.NSMAX_MOBILE_ENGINES || "chromium,webkit").split(",")) {
 let browser;
 test.before(async () => { browser = engine === "webkit" ? await webkit.launch() : await launch(); });
 test.after(async () => { await browser?.close(); });
 test(`${engine} 列表末页：成功返回空列表后只留真实两页，不显示错误或继续请求占位页`, async () => {
  const asked=[];
  const {context,page,errors} = await open(browser,"https://www.nodeseek.com/",{seed,html:render(1,6),pages:{"/page-2":render(2,1),"/page-3":render(3,0)},beforeNavigate:p=>p.on("request",r=>asked.push(new URL(r.url()).pathname))});
  try {
   await ready(page); await page.locator("button.nspp-action").filter({hasText:"加载下一页"}).click({force:true});
   await page.waitForSelector('.pager-bottom[data-nsmax-last-page="2"]');
   assert.deepEqual(await page.locator(".pager-bottom .pager-pos:visible").allTextContents(),["1","2"]);
   assert.equal(await page.locator(".pager-bottom a.pager-next[href]").count(),0);
   assert.equal(await page.locator("button.nspp-action").isVisible(),false);
   assert.equal(await page.locator("ul.post-list>.post-list-item").count(),7);
   assert.equal(asked.filter(p=>p==="/page-3").length,1);assert.equal(asked.includes("/page-4"),false);assert.deepEqual(errors,[]);
  } finally { await context.close(); }
 });
 test(`${engine} 列表请求失败：保留合法分页和重试，重试成功后仍能识别末页`, async () => {
  let allow = false, failures = 0;
  const {context,page,errors} = await open(browser,"https://www.nodeseek.com/",{seed,html:render(1,6),pages:{"/page-3":render(3,0)},beforeNavigate:p=>p.route("**/page-2",async route=>{ if(!allow){failures++;await route.abort();}else await route.fulfill({status:200,contentType:"text/html",body:render(2,1)}); })});
  try {
   await ready(page); const more=page.locator("button.nspp-action"); await more.click({force:true});
   await page.waitForFunction(()=>document.querySelector("button.nspp-action")?.textContent.includes("加载失败"));
   assert.ok(failures>0); assert.equal(await page.locator(".pager-bottom[data-nsmax-last-page]").count(),0);
   assert.equal(await page.locator('.pager-bottom a[href="/page-3"]').isVisible(),true);
   allow=true; await more.click({force:true}); await page.waitForSelector('.pager-bottom[data-nsmax-last-page="2"]');
   assert.equal(await page.locator("ul.post-list>.post-list-item").count(),7); assert.deepEqual(errors,[]);
  } finally { await context.close(); }
 });
 test(`${engine} 标题小页码：随标题字号居中，保持标题和分页各自的点击链接`, async () => {
  for(const size of ["site","large","xlarge"]){
   const html=P.listPage().replace('title="0 comments" class="info-item info-comments-count"','title="726 comments" class="info-item info-comments-count"');
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html,viewport:{width:1440,height:900},seed:{"nspp:settings:www.nodeseek.com":{"modern-theme":{font:"system",fontSize:size}}}});
   try {
    await ready(page);const state=await page.locator(".post-list-item").first().evaluate(row=>{const title=row.querySelector(".post-title>a"),pages=row.querySelector(".nsmax-topic-pages"),a=title.getBoundingClientRect(),b=pages.getBoundingClientRect();return {delta:(b.top+b.height/2)-(a.top+a.height/2),title:title.getAttribute("href"),pages:[...pages.querySelectorAll("a")].map(a=>a.getAttribute("href"))};});
    assert.ok(Math.abs(state.delta)<2.5,JSON.stringify({size,...state}));assert.equal(state.title,"/post-1000-1");assert.equal(state.pages.at(-1),"/post-1000-73");assert.deepEqual(errors,[]);
   } finally {await context.close();}
  }
 });
 // 2026-11-22：账簿等站点（Vue）画的页码翻页时在原处换页码节点，上一轮插的「…」以前留在原位，翻到中间页成了「1 … … 49 50 51 … 100」
 test(`${engine} 站点前端画的页码翻页后：省略号按新页码重放，不留旧的`, async () => {
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/credit#/p-1",{html:P.creditPage(),viewport:{width:1440,height:900}});
  try {
   await ready(page);
   const nav=".credit-table .nsk-pager [role=navigation]";
   const shown=()=>page.evaluate(sel=>[...document.querySelector(sel).children].filter(el=>el.getClientRects().length&&/pager-pos|nsmax-pager-ellipsis/.test(el.className)).map(el=>el.classList.contains("nsmax-pager-ellipsis")?"…":el.textContent.replace(/\.\./,"").trim()).join(" "),nav);
   await page.waitForFunction(sel=>document.querySelector(sel+" .nsmax-pager-ellipsis"),nav);
   assert.equal(await shown(),"1 2 3 … 100");
   // 模拟站点按页码做 key 重画到第 50 页：2–5 拿掉，48–52 插在「100」前面
   await page.evaluate(sel=>{
    const box=document.querySelector(sel),link=n=>Object.assign(document.createElement("a"),{className:"pager-pos",href:`#/p-${n}`,textContent:String(n)});
    const last=[...box.querySelectorAll(".pager-pos")].find(el=>/100$/.test(el.textContent.trim()));
    for(const el of [...box.querySelectorAll(".pager-pos")]){const n=Number(el.textContent.trim());if(n>=2&&n<=5)el.remove();}
    box.querySelector(".pager-cur").replaceWith(link(1));
    for(let n=48;n<=52;n++)box.insertBefore(n===50?Object.assign(document.createElement("span"),{className:"pager-pos pager-cur",textContent:"50"}):link(n),last);
   },nav);
   await page.waitForFunction(sel=>document.querySelector(sel+" .pager-pos[data-nsmax-page-skip]")&&[...document.querySelectorAll(sel+" .pager-pos")].some(el=>el.textContent.trim()==="48"&&el.hasAttribute("data-nsmax-page-skip")),nav);
   await page.waitForTimeout(200);
   assert.equal(await shown(),"1 … 49 50 51 … 100");
   assert.deepEqual(errors,[]);
  } finally {await context.close();}
 });
}
