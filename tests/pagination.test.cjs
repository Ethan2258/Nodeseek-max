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
for (const engine of ["chromium", "webkit"]) {
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
}
