"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { webkit, devices } = require("playwright");
const { launch, open } = require("./harness.cjs");
const { specialPostPage } = require("./fixtures/pages.cjs");

const seed = { "nspp:settings:www.nodeseek.com": { attendance: { enabled: false }, "modern-theme": { font: "system" } } };
const native = `document.addEventListener("DOMContentLoaded", () => {
  window.__pollNative = Array.from(document.querySelectorAll(".vote-panel"), panel => ({panel, form:panel.querySelector("form"), input:panel.querySelector("input")}));
  window.__voteCalls = 0;
  const panel = __pollNative[1].panel, button = panel.querySelector("button");
  button.addEventListener("click", () => {
    __voteCalls++;
    for (const row of panel.querySelectorAll(".vote-stat")) {
      row.classList.add("voted");
      row.querySelector("input").disabled = true;
      const count = row.querySelector("input").checked ? 3 : 0;
      const stat = document.createElement("div");
      stat.className = "vote-stat-count";
      stat.innerHTML = '<div class="vote-stat-count-bar-wrapper"><div class="vote-stat-count-bar" title="'+(count?100:0)+'%" style="width:'+(count?100:0)+'%"></div></div><div class="vote-item-voter"><div class="vote-stat-count-value">'+count+'</div></div>';
      row.querySelector("label").append(stat);
    }
    button.hidden = true;
  });
});`;

for (const engine of (process.env.NSMAX_MOBILE_ENGINES || "chromium,webkit").split(",")) {
  let browser;
  test.before(async () => { browser = engine === "webkit" ? await webkit.launch() : await launch(); });
  test.after(async () => { await browser?.close(); });

  test(`${engine} 投票结果：独立卡片、进度与已选态，公开名单可展开，窄屏长选项不溢出`, async () => {
    for (const width of [1440, 390, 320]) for (const colorScheme of ["light", "dark"]) {
      const mobile = width < 500;
      const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
        html: specialPostPage({ mobile, dark: colorScheme === "dark" }), seed, colorScheme, init: native,
        device: mobile ? { ...devices["iPhone 13"], viewport: { width, height: 844 } } : {},
        viewport: { width, height: 900 }
      });
      try {
        await page.waitForSelector(".vote-panel[data-nsmax-detached] .nsmax-poll-head");
        const card = page.locator(".vote-panel").first();
        assert.equal(await card.locator(".nsmax-poll-total").innerText(), "152 人已参与");
        assert.equal(await card.locator(".nsmax-poll-head strong").innerText(), "投票");
        assert.equal(await page.locator(".nsk-post .post-title .nsmax-poll-badge").innerText(), "投票");
        assert.equal(await card.locator(".voter-avatar-container img").first().isVisible(), false);
        assert.equal(await card.evaluate(e => !!e.closest(".nsk-post")), false);
        assert.equal(await page.evaluate(() => __pollNative.every(({panel,form,input}) => panel.isConnected && panel.querySelector("form") === form && panel.querySelector("input") === input)), true);
        const result = await card.evaluate(e => {
          const mine = e.querySelector("[data-nsmax-mine]");
          const other = e.querySelector(".vote-stat:not([data-nsmax-mine])");
          return {
            mine: mine.querySelector(".vote-item-text").textContent.trim(),
            label: getComputedStyle(mine.querySelector(".vote-item-text"), "::after").content,
            mineColor: getComputedStyle(mine.querySelector(".vote-stat-count-bar")).backgroundColor,
            otherColor: getComputedStyle(other.querySelector(".vote-stat-count-bar")).backgroundColor,
            background: getComputedStyle(e).backgroundColor,
            trackHeight: e.querySelector(".vote-stat-count-bar-wrapper").getBoundingClientRect().height,
            gap: e.getBoundingClientRect().top - document.querySelector(".nsk-post").getBoundingClientRect().bottom
          };
        });
        assert.equal(result.mine, "网页claude max被封号");
        assert.match(result.label, /已选/);
        assert.notEqual(result.mineColor, result.otherColor);
        assert.equal(result.background, colorScheme === "dark" ? "rgb(26, 27, 36)" : "rgb(250, 251, 252)");
        assert.equal(result.trackHeight, 8);
        assert.ok(result.gap >= 10, JSON.stringify(result));
        const toggle = card.locator(".nsmax-poll-voters-toggle");
        if (mobile) assert.ok(await toggle.evaluate(e => e.getBoundingClientRect().height) >= 44);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal(await card.locator(".voter-avatar-container img").first().isVisible(), true);
        assert.equal(await card.locator(".voter-avatar-container img").first().evaluate(e => e.getBoundingClientRect().width), 20);
        await toggle.press("Enter");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await card.locator(".voter-avatar-container img").first().isVisible(), false);
        await card.evaluate(e => {
          e.querySelector(".vote-item-text").firstChild.data = "https://example.com/" + "verylongoption".repeat(18);
          const value = e.querySelector(".vote-stat-count-value");
          value.firstChild.data = "10";
          const bar = e.querySelector(".vote-stat-count-bar");
          bar.title = "7%"; bar.style.width = "7%";
        });
        await page.waitForFunction(() => document.querySelector(".nsmax-poll-total").textContent === "153 人已参与");
        assert.equal(await card.locator(".vote-stat-count-value").first().getAttribute("data-nsmax-pct"), "7%");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });

  test(`${engine} 原生投票：选择与提交事件保留，结果更新；多选票数不冒充人数`, async () => {
    const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
      html: specialPostPage({ mobile: true }), seed, init: native, manager: { type: "userscripts", delay: 10 },
      device: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } }
    });
    try {
      await page.waitForSelector(".vote-panel[data-nsmax-detached] .nsmax-poll-head");
      const card = page.locator(".vote-panel").nth(1);
      assert.equal(await card.locator(".nsmax-poll-total").innerText(), "单选");
      await card.getByRole("radio", { name: "Vultr", exact: true }).check();
      assert.equal(await card.locator("[data-nsmax-mine]").count(), 0, "提交前不冒充已投票");
      await card.getByRole("button", { name: "投票", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll(".nsmax-poll-total")[1].textContent === "3 人已参与");
      assert.equal(await page.evaluate(() => __voteCalls), 1);
      assert.equal((await card.locator("[data-nsmax-mine] .vote-item-text").innerText()).trim(), "Vultr");
      assert.equal(await page.evaluate(() => __pollNative[1].form === document.querySelectorAll(".vote-panel form")[1]), true);
      await card.evaluate(e => {
        for (const input of e.querySelectorAll(".vote-stat > input")) input.type = "checkbox";
        e.querySelector(".vote-stat-count-value").firstChild.data = "3";
      });
      await page.waitForFunction(() => document.querySelectorAll(".nsmax-poll-total")[1].textContent === "6 票");
      assert.equal(await card.getByRole("button", { name: "查看投票人", exact: true }).count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
