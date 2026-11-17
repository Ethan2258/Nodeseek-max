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

  test(`${engine} 异步双投票：未水合占位显示骨架不露空单选，切选项不反复改动开关属性，提交遮罩不被隐藏`, async () => {
    const html = specialPostPage({ mobile: engine !== "chromium" && false })
      .replace(/<p><div class="vote-panel">[\s\S]*?<\/div><\/div><\/p><p>没投过的投票：<\/p><p><div class="vote-panel">[\s\S]*?<\/div><\/div><\/p>/,
        '<p>投票1：</p><p><a data-href="nsapp://vote?id=3599"></a></p><p>投票2：</p><p><a data-href="nsapp://vote?id=3600"></a></p>');
    const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
      html, seed, viewport: { width: 1440, height: 900 }
    });
    try {
      await page.waitForSelector(".nsk-post .post-content");
      const firstFrame = await page.evaluate(() => new Promise((resolve) => {
        const content = document.querySelector(".nsk-post article.post-content");
        const makeUnhydrated = (id) => {
          const panel = document.createElement("div");
          panel.className = "vote-panel";
          panel.innerHTML = `<div class="embed-vote"><form class="pure-form"><h2 style="text-align:center;font-size:1.2rem;"></h2><fieldset class="vote-stat-wrapper"><div class="vote-stat"><input id="v-${id}-1" name="vote-item" type="radio"><label for="v-${id}-1" class="pure-checkbox"><div class="vote-item-text"></div></label></div></fieldset><fieldset class="op-buttons"><button type="button" class="pure-button pure-button-primary">提交投票</button></fieldset><div style="text-align:center;color:gray;font-size:10px;font-weight:300;">nsapp://vote?id=${id} (公开投票)</div><div class="skeleton form-mask"></div></form></div>`;
          return panel;
        };
        const anchors = content.querySelectorAll('a[data-href^="nsapp://vote"]');
        anchors[0].replaceWith(makeUnhydrated(3599));
        anchors[1].replaceWith(makeUnhydrated(3600));
        requestAnimationFrame(() => {
          const panels = Array.from(document.querySelectorAll(".vote-panel"));
          resolve(panels.map((p) => {
            const embed = p.querySelector(".embed-vote");
            const sk = p.querySelector(".nsmax-poll-skeleton");
            return {
              inPost: !!p.closest(".nsk-post"),
              detached: p.hasAttribute("data-nsmax-detached"),
              loading: p.hasAttribute("data-nsmax-poll-loading"),
              total: p.querySelector(".nsmax-poll-total")?.textContent || "",
              embedDisplay: embed ? getComputedStyle(embed).display : "",
              skeletonVisible: !!sk && getComputedStyle(sk).display !== "none" && sk.getBoundingClientRect().height > 20,
            };
          }));
        });
      }));
      assert.equal(firstFrame.length, 2);
      for (const state of firstFrame) {
        assert.equal(state.inPost, false, "Vue 挂载未水合投票应在首帧前移出正文区");
        assert.equal(state.detached, true);
        assert.equal(state.loading, true);
        assert.equal(state.total, "加载中…");
        assert.equal(state.embedDisplay, "none", "未水合表单隐藏，避免露出空白单选圈");
        assert.equal(state.skeletonVisible, true, "加载中显示骨架占位");
      }

      // 投票 1 先完成加载，投票 2 仍处于未水合等待状态
      await page.evaluate(() => {
        const [p1] = document.querySelectorAll(".vote-panel");
        const form = p1.querySelector("form");
        form.querySelector("h2").textContent = "怎么选？";
        form.querySelector("fieldset.vote-stat-wrapper").innerHTML = [
          [1, "200m前置IX", 1, "50%"],
          [2, "300m亚太三网", 1, "50%"]
        ].map(([id, label, cnt, pct]) => `<div class="vote-stat voted"><input id="v-3599-${id}" name="vote-item" type="radio" disabled><label for="v-3599-${id}" class="pure-checkbox"><div class="vote-item-text">${label}</div><div class="vote-stat-count"><div class="vote-stat-count-bar-wrapper"><div class="vote-stat-count-bar" title="${pct}" style="width:${pct}"></div></div><div class="vote-item-voter"><div class="vote-stat-count-value">${cnt}</div></div></div></label></div>`).join("");
        form.querySelector(".form-mask")?.remove();
      });
      await page.waitForFunction(() => {
        const p1 = document.querySelectorAll(".vote-panel")[0];
        return p1 && !p1.hasAttribute("data-nsmax-poll-loading") && p1.querySelector(".nsmax-poll-total")?.textContent === "2 人已参与";
      });
      const mixed = await page.evaluate(() => {
        const [p1, p2] = document.querySelectorAll(".vote-panel");
        const sk1 = p1.querySelector(".nsmax-poll-skeleton");
        return {
          p1Ready: p1.hasAttribute("data-nsmax-poll-ready"),
          p1EmbedDisplay: getComputedStyle(p1.querySelector(".embed-vote")).display,
          p1SkeletonHidden: !sk1 || getComputedStyle(sk1).display === "none",
          p2Loading: p2.hasAttribute("data-nsmax-poll-loading"),
          p2Total: p2.querySelector(".nsmax-poll-total")?.textContent || "",
          p2EmbedDisplay: getComputedStyle(p2.querySelector(".embed-vote")).display,
        };
      });
      assert.deepEqual(mixed, {
        p1Ready: true,
        p1EmbedDisplay: "block",
        p1SkeletonHidden: true,
        p2Loading: true,
        p2Total: "加载中…",
        p2EmbedDisplay: "none",
      });

      // 投票 2 完成加载，测试切选项不产生冗余 hidden 属性变更，以及提交态 .form-mask 可见
      await page.evaluate(() => {
        const p2 = document.querySelectorAll(".vote-panel")[1];
        const form = p2.querySelector("form");
        form.querySelector("h2").textContent = "加个富哥选项？";
        form.querySelector("fieldset.vote-stat-wrapper").innerHTML = [
          [11, "方案 A"],
          [12, "方案 B"]
        ].map(([id, label]) => `<div class="vote-stat"><input id="v-3600-${id}" name="vote-item" type="radio" value="${id}"><label for="v-3600-${id}" class="pure-checkbox"><div class="vote-item-text">${label}</div></label></div>`).join("");
        form.querySelector(".form-mask")?.remove();
      });
      await page.waitForFunction(() => {
        const p2 = document.querySelectorAll(".vote-panel")[1];
        return p2 && !p2.hasAttribute("data-nsmax-poll-loading") && p2.querySelector(".nsmax-poll-total")?.textContent === "单选";
      });

      await page.evaluate(() => {
        const toggle = document.querySelectorAll(".vote-panel")[1].querySelector(".nsmax-poll-voters-toggle");
        window.__toggleHiddenMutations = 0;
        window.__toggleObserver = new MutationObserver((records) => { window.__toggleHiddenMutations += records.length; });
        window.__toggleObserver.observe(toggle, { attributes: true, attributeFilter: ["hidden"] });
      });
      const p2Card = page.locator(".vote-panel").nth(1);
      await p2Card.getByRole("radio", { name: "方案 A", exact: true }).check();
      await p2Card.getByRole("radio", { name: "方案 B", exact: true }).check();
      await page.waitForTimeout(160);
      const hiddenMutations = await page.evaluate(() => {
        window.__toggleObserver?.disconnect();
        return window.__toggleHiddenMutations;
      });
      assert.equal(hiddenMutations, 0, "未投过的单选切换选项时，不再反复写入 hidden 属性");

      const maskState = await page.evaluate(() => {
        const p2 = document.querySelectorAll(".vote-panel")[1];
        const form = p2.querySelector("form");
        const mask = document.createElement("div");
        mask.className = "skeleton form-mask";
        form.append(mask);
        return new Promise((resolve) => setTimeout(() => {
          resolve({
            loading: p2.hasAttribute("data-nsmax-poll-loading"),
            embedDisplay: getComputedStyle(p2.querySelector(".embed-vote")).display,
            maskDisplay: getComputedStyle(mask).display,
          });
        }, 160));
      });
      assert.deepEqual(maskState, {
        loading: false,
        embedDisplay: "block",
        maskDisplay: "block",
      }, "已水合投票点击提交时，原生 .skeleton.form-mask 不被 :empty 规则隐藏");
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
