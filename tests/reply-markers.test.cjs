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
        const badge = await page.locator(".nsmax-joined-badge").evaluate(e => ({ font: getComputedStyle(e).fontSize, radius: getComputedStyle(e).borderRadius, color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor }));
        assert.equal(badge.font, "11px"); assert.ok(parseFloat(badge.radius) >= 10);
        assert.equal(badge.color, dark ? "rgb(79, 220, 167)" : "rgb(0, 122, 78)");
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
}
