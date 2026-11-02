"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { webkit, devices } = require("playwright");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");
const STATE = "nspp:state:www.nodeseek.com:sb-my-replies";
const SETTINGS = "nspp:settings:www.nodeseek.com";
const ready = page => page.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length && !document.documentElement.hasAttribute("data-nsmax-mounting"));
const state = (posts, joined = {}) => ({ "posts:1": posts, "joined:1": joined, "posts:1:synced": Date.now(), "posts:1:done": true });
const settings = { attendance: { enabled: false }, "modern-theme": { font: "system" } };
const rulesInit = rules => `localStorage.setItem("nsmax:lottery-rules", ${JSON.stringify(JSON.stringify(rules))});`;
const seed = value => ({ [SETTINGS]: settings, [STATE]: value });
const ruleLink = (post, time, start = 1) => `<p><a href="https://www.nodeseek.com/lucky?post=${post}&amp;time=${time}&amp;count=1&amp;start=${start}&amp;duplicate=false">开奖链接</a></p>`;
for (const engine of ["chromium", "webkit"]) {
  let browser;
  test.before(async () => { browser = engine === "webkit" ? await webkit.launch() : await launch(); });
  test.after(async () => { await browser?.close(); });

  test(`${engine} 已回复 / 已参与：首屏即显示，静止时不重写 DOM，也不增加查询`, async () => {
    for (const mobile of [false, true]) for (const dark of [false, true]) {
      const time = Date.now() + 864e5;
      const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
        html: P.listPage({ mobile, dark }), colorScheme: dark ? "dark" : "light",
        device: mobile ? { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } : {},
        manager: mobile ? { type: "userscripts", delay: 10 } : undefined,
        seed: seed(state({ 1000: [3], 1002: [5, 12] })),
        init: rulesInit({ 1000: [{ start: 1, time }] }) + `
          localStorage.setItem("nsmax:special-posts",JSON.stringify({"1000":"lottery"}));
          const mark=performance.mark.bind(performance);
          performance.mark=(name,...args)=>{if(name==="nsmax:primary-ready")window.__replyTagsAtPrimary=document.querySelectorAll(".nsmax-replied-badge").length;return mark(name,...args)};
          window.__markerShifts=[];
          new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)__markerShifts.push({t:e.startTime,v:e.value})}).observe({type:"layout-shift",buffered:true});
        `
      });
      try {
        await ready(page);
        assert.equal(await page.locator(".nsmax-replied-badge").count(), 2);
        assert.equal(await page.locator(".nsmax-joined-badge").count(), 1);
        assert.equal(await page.evaluate(() => __replyTagsAtPrimary), 2);
        const badge = await page.locator(".nsmax-joined-badge").evaluate(e => ({ font: getComputedStyle(e).fontSize, radius: getComputedStyle(e).borderRadius, color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor, border: getComputedStyle(e).borderColor, padding: getComputedStyle(e).padding }));
        assert.equal(badge.font, "11px"); assert.ok(parseFloat(badge.radius) >= 10);
        assert.equal(badge.color, dark ? "rgb(168, 171, 187)" : "rgb(85, 90, 106)");
        assert.equal(badge.background, dark ? "rgb(26, 27, 36)" : "rgb(250, 251, 252)");
        assert.equal(badge.border, dark ? "rgb(42, 44, 56)" : "rgb(224, 226, 232)");
        assert.equal(badge.padding, "1px 8px");
        const labels=await page.locator("li.post-list-item").first().locator(".post-title").evaluate(e=>[...e.children].filter(n=>n.matches(".nsmax-prize-badge,.nsmax-joined-badge,.nsmax-replied-badge")).map(n=>n.textContent));
        assert.deepEqual(labels,["抽奖","已参与","已回复"]);
        await page.waitForTimeout(100);
        await page.evaluate(() => { window.__markerMutations=0;window.__markerObserver=new MutationObserver(rows=>__markerMutations+=rows.length);__markerObserver.observe(document.querySelector("ul.post-list"),{subtree:true,childList:true,attributes:true,characterData:true}); });
        await page.waitForTimeout(650);
        const stable = await page.evaluate(() => { __markerObserver.disconnect(); const fcp=performance.getEntriesByName("first-contentful-paint")[0]?.startTime||0;return{mutations:__markerMutations,shifts:__markerShifts.filter(e=>e.t>fcp).reduce((n,e)=>n+e.v,0),overflow:document.documentElement.scrollWidth>innerWidth+1}; });
        assert.equal(stable.mutations, 0); assert.equal(stable.shifts, 0); assert.equal(stable.overflow, false);
        assert.equal(calls["/api/content/list-comments"], undefined);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });

  test(`${engine} 参与标记按起始楼层与开奖时间判断，未知历史记录保持未确认`, async () => {
    const future = Date.now() + 864e5, past = Date.now() - 864e5;
    for (const [floors, rule, joined, expected] of [
      [[3], { start: 5, time: future }, {}, 0],
      [[5], { start: 5, time: future }, {}, 1],
      [[8], { start: 5, time: past }, {}, 0],
      [[8], { start: 5, time: past }, { [`1000:5:${past}`]: 8 }, 1]
    ]) {
      const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: P.listPage(), seed: seed(state({ 1000: floors }, joined)), init: rulesInit({ 1000: [rule] }) });
      try {
        await ready(page);
        assert.equal(await page.locator(".nsmax-replied-badge").count(), 1);
        assert.equal(await page.locator(".nsmax-joined-badge").count(), expected);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });

  test(`${engine} 真实回帖才记参与：点参与不产生标记，新楼层到达后更新，跨标签页无需轮询`, async () => {
    const time = Date.now() + 864e5;
    const html = P.postPage().replace("<h2>配置说明</h2>", ruleLink(1000, time) + "<h2>配置说明</h2>");
    const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, seed: seed(state({})), pages: { "/": P.listPage() } });
    try {
      await ready(page);
      await page.locator(".nsmax-lottery-join").click();
      assert.equal(await page.locator(".nsmax-replied-badge,.nsmax-joined-badge").count(), 0);
      await page.evaluate(() => {
        const row=document.querySelector("ul.comments>li.content-item").cloneNode(true);
        row.id="9";row.querySelector(".nsmax-author-col")?.remove();
        const name=row.querySelector(".author-info .author-name");name.href="/space/1";name.textContent="tester";
        row.querySelector("time").dateTime=new Date().toISOString();
        document.querySelector("ul.comments").append(row);
      });
      await page.waitForSelector(".nsmax-lottery-head .nsmax-joined-badge");
      await page.locator(".nsmax-lottery-people").getByText("#9 tester", { exact: true }).waitFor();
      assert.equal(await page.locator(".nsk-post .nsmax-replied-badge").count(), 1);
      assert.equal(await page.locator(".nsk-post .post-title .nsmax-joined-badge").count(), 1);
      const second = await context.newPage();
      await second.goto("https://www.nodeseek.com/");
      await ready(second);
      assert.equal(await second.locator(".nsmax-replied-badge").count(), 1);
      await page.evaluate(key => {
        const data=JSON.parse(localStorage.getItem(key));data["posts:1"]["1002"]=[12];localStorage.setItem(key,JSON.stringify(data));
      }, STATE);
      await second.waitForFunction(() => document.querySelectorAll(".nsmax-replied-badge").length === 2);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  test(`${engine} 关闭功能、未登录或切换账号时不出现他人的回复与参与标记`, async () => {
    for (const mode of ["disabled", "guest", "other-account"]) {
      const currentSeed = seed(state({ 1000: [3] }));
      if (mode === "disabled") currentSeed[SETTINGS] = { ...settings, "sb-my-replies": { enabled: false } };
      const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
        html: P.listPage({ guest: mode === "guest" }), seed: currentSeed,
        init: mode === "other-account" ? 'document.addEventListener("DOMContentLoaded",()=>{window.__config__.user.member_id=2;});' : ""
      });
      try { await ready(page);assert.equal(await page.locator(".nsmax-replied-badge,.nsmax-joined-badge,.nsmax-my-replies").count(),0);assert.deepEqual(errors,[]); }
      finally { await context.close(); }
    }
  });

  test(`${engine} 已开奖旧帖以回复原始时间补齐参与证据，开奖后回复不标已参与`, async () => {
    const time = Date.now() - 864e5;
    for (const before of [true, false]) {
      const created = new Date(time + (before ? -36e5 : 36e5)).toISOString();
      const html = P.postPage().replaceAll('href="/space/11"', 'href="/space/1"').replaceAll("2026-10-03T04:00:00.000Z", created).replace("<h2>配置说明</h2>", ruleLink(1000, time) + "<h2>配置说明</h2>");
      const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, seed: seed(state({})) });
      try {
        await ready(page);assert.equal(await page.locator(".nsmax-replied-badge").count(),1);
        assert.equal(await page.locator(".nsmax-lottery-head .nsmax-joined-badge").count(),before?1:0);
        assert.deepEqual(errors,[]);
      } finally { await context.close(); }
    }
  });

  test(`${engine} 抽奖名单按 UID 去重，保留最早楼层并排除截止后的回复`, async () => {
    for (const ended of [false,true]) {
      const time=Date.now()+(ended?-864e5:864e5);
      const html=P.postPage().replace("<h2>配置说明</h2>",ruleLink(1000,time)+"<h2>配置说明</h2>");
      const init=`document.addEventListener("DOMContentLoaded",()=>{
        const rows=[...document.querySelectorAll("ul.comments>li.content-item")];
        for(let i=0;i<3;i++){const a=rows[i].querySelector(".author-info .author-name");a.href="/space/"+(i===2?12:11);a.textContent=i===1?"renamed":"same";rows[i].querySelector("time").dateTime=new Date(${time}-36e5).toISOString();}
        const late=rows[2].cloneNode(true);late.id="4";late.querySelector(".author-name").href="/space/13";late.querySelector("time").dateTime=new Date(${time}+36e5).toISOString();document.querySelector("ul.comments").append(late);
        rows[0].before(rows[1]);
      });`;
      const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,init,seed:seed(state({}))});
      try{
        await ready(page);
        assert.deepEqual(await page.locator(".nsmax-lottery-person").allTextContents(),["#1 same","#3 same"]);
        const person=page.locator(".nsmax-lottery-person").first();
        await person.focus();await page.waitForTimeout(650);
        assert.equal(await person.evaluate(e=>e===document.activeElement),true,"名单没变时不重建或丢失键盘焦点");
        assert.deepEqual(errors,[]);
      }finally{await context.close();}
    }
  });

  test(`${engine} 我的回复按每页楼数跳转，引用其他帖的抽奖前往原帖并保留正确参与状态`, async () => {
    const html=P.postPage().replace("<h2>配置说明</h2>",ruleLink(9999,Date.now()+864e5)+"<h2>配置说明</h2>");
    const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,seed:seed(state({1000:[15]})),init:'document.addEventListener("DOMContentLoaded",()=>{window.__config__.commmentPerPage=4;});',pages:{"/post-9999-1":P.postPage()}});
    try{
      await ready(page);assert.equal(await page.locator(".comment-container .nsmax-my-replies a").getAttribute("href"),"/post-1000-4#15");
      const card=page.locator(".nsmax-lottery");
      assert.equal(await card.locator(".nsmax-lottery-person,[data-nsmax-replies],.nsmax-joined-badge").count(),0);
      await Promise.all([page.waitForURL("**/post-9999-1"),card.getByRole("button",{name:"前往原帖参与",exact:true}).click()]);
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });

  test(`${engine} 开奖链接省略 post 时补齐当前帖，不丢失参与标记或查看模式`, async () => {
    const link=ruleLink(1000,Date.now()+864e5).replace("post=1000&amp;","");
    const html=P.postPage().replaceAll('href="/space/11"','href="/space/1"').replace("<h2>配置说明</h2>",link+"<h2>配置说明</h2>");
    const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,seed:seed(state({}))});
    try{
      await ready(page);
      const card=page.locator(".nsmax-lottery");
      assert.equal(await card.getAttribute("data-nsmax-post"),"1000");
      assert.equal(await card.locator(".nsmax-joined-badge").count(),1);
      const href=new URL(await card.locator(".nsmax-lottery-view").getAttribute("href"));
      assert.equal(href.searchParams.get("post"),"1000");assert.deepEqual(href.searchParams.getAll("mode"),["view"]);
      await card.getByRole("button",{name:"回复参与",exact:true}).click();
      await page.waitForFunction(()=>!!document.activeElement.closest(".md-editor"));
      assert.equal(page.url(),"https://www.nodeseek.com/post-1000-1");assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });

  test(`${engine} 开奖链接的域名别名仅在同一论坛内归一，不套用另一论坛的数据`, async () => {
    const time=Date.now()+864e5;
    for(const [host,href,card,anchorText] of [
      ["www.nodeseek.com",`https://nodeseek.com/lucky?post=1000&time=${time}`,true],
      ["www.deepflood.com",`HTTPS://DEEPFLOOD.COM/lucky?post=1000&time=${time}`,true],
      ["www.deepflood.com",`https://www.nodeseek.com/lucky?post=1000&time=${time}`,false],
      ["www.nodeseek.com",`https://www.deepflood.com/lucky?post=1000&time=${time}`,false],
      ["www.nodeseek.com",`https://www.deepflood.com/lucky?post=1000&time=${time}`,false,`/lucky?post=1000&time=${time}`]
    ]){
      const text=anchorText?`<a href="${href}">${anchorText}</a>`:href;
      const html=P.postPage().replace("<h2>配置说明</h2>",`<p>${text}</p><h2>配置说明</h2>`);
      const {context,page,errors}=await open(browser,`https://${host}/post-1000-1`,{html,seed:seed(state({}))});
      try{
        await ready(page);
        assert.equal(await page.locator(".nsmax-lottery").count(),card?1:0,JSON.stringify({host,href,errors}));
        if(card){const view=new URL(await page.locator(".nsmax-lottery-view").getAttribute("href"));assert.equal(view.host,host);assert.equal(view.searchParams.get("mode"),"view");}
        assert.deepEqual(errors,[]);
      }finally{await context.close();}
    }
  });
}
