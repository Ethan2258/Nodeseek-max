"use strict";
// 抽奖卡片（2026-11-23 重做）：参与人数、我在哪一楼、发起人 / 未登录、开奖后直接算出中奖名单（和站点抽奖页同一套算法）。
const test = require("node:test"), assert = require("node:assert/strict");
const { webkit } = require("playwright");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");

// 真站 post-1074328（2026-11-23 开奖，3 个名额、从 1 楼起、楼层去重）：楼层名单和那一轮 drand 随机数；站点抽奖页给出的中奖楼层是 2、7、25
const RAND = "e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6";
const UIDS = "62552,61293,35076,76555,77429,70019,11674,70298,74084,4589,66622,76758,27781,33103,58464,51276,74458,22878,76718,62552,69317,72381,40604,39085,53277,56326,42123,23093,50716,40241,49408,74362,77527,40752,22151,30556,59074,40078,72926,72593,76510,57994,77575,71191,39589,13641,40545,64812,77208,62552,66557,1494,73308".split(",").map(Number);
const floors = ({ me, op = 62552 } = {}) => UIDS.map((uid, i) => ({ member_id: i === 0 ? op : i === me ? 1 : uid, member_name: i === 0 ? "op" : i === me ? "tester" : "m" + i, floor_id: i }));
const floorApi = (data) => ({ "/api/content/floor-data": Array.from({ length: 6 }, () => ({ status: 200, body: { success: true, data } })) });
const link = (time, { count = 3, start = 1, duplicate = "false", post = 1000 } = {}) => `https://www.nodeseek.com/lucky?post=${post}&amp;time=${time}&amp;count=${count}&amp;start=${start}${duplicate === null ? "" : `&amp;duplicate=${duplicate}`}`;
const withLink = (html, body) => html.replace("<h2>配置说明</h2>", () => body + "<h2>配置说明</h2>");
const settle = (page) => page.waitForFunction(() => { const p = document.querySelector(".nsk-post .nsmax-lottery-people"); return p && (p.parentElement.hidden || !/统计中/.test(p.textContent)); }, null, { timeout: 8e3 });

for (const engine of (process.env.NSMAX_MOBILE_ENGINES || "chromium,webkit").split(",")) {
	let browser;
	test.before(async () => { browser = engine === "webkit" ? await webkit.launch() : await launch(); });
	test.after(async () => { await browser?.close(); });

	test(`${engine} 开奖前：参与人数来自站点楼层名单（按人去重），我在名单里就显示「你已参与 · 第 N 楼」，不再给「回复参与」`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() + 864e5)}">开奖</a></p>`);
		for (const me of [undefined, 37]) {
			const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me })) });
			try {
				await settle(page);
				const card = page.locator(".nsk-post .nsmax-lottery");
				// 1~52 楼 52 层、62552 回复了三次：51 人
				assert.equal(await card.locator(".nsmax-lottery-people").textContent(), "51 人");
				if (me) {
					await page.waitForSelector('.nsmax-lottery-me[data-tone="joined"]');
					assert.match(await card.locator(".nsmax-lottery-me").textContent(), /^你已参与 · 第 37 楼$/);
					assert.equal(await card.locator(".nsmax-lottery-me a").getAttribute("href"), "/post-1000-4#37", "没加载的楼层跳到它那一页");
					assert.equal(await card.getByRole("button", { name: "回复参与" }).count(), 0);
				} else {
					assert.equal(await card.getByRole("button", { name: "回复参与", exact: true }).isVisible(), true);
					assert.equal(await card.locator(".nsmax-lottery-me").isVisible(), false);
				}
				assert.equal(calls["/api/content/floor-data"], 1, "一张卡片只取一次楼层名单");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 未登录给「登录后参与」，发起人看到「你发起的抽奖」，帖子锁了不给回复按钮`, async () => {
		const time = Date.now() + 864e5;
		const cases = [
			["guest", { html: withLink(P.postPage({ guest: true }), `<p><a href="${link(time)}">开奖</a></p>`) }],
			["op", { html: withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p>`), api: floorApi(floors({ op: 1 })) }],
			["locked", { html: withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p>`), init: 'document.addEventListener("DOMContentLoaded",()=>{window.__config__.postData={...(window.__config__.postData||{}),locked:1};});' }]
		];
		for (const [kind, options] of cases) {
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { viewport: { width: 1440, height: 900 }, ...options });
			try {
				await settle(page);
				const card = page.locator(".nsk-post .nsmax-lottery");
				if (kind === "guest") {
					assert.equal(await card.getByRole("link", { name: "登录后参与", exact: true }).getAttribute("href"), "/signIn.html");
					assert.equal(await card.getByRole("button", { name: "回复参与" }).isVisible(), false);
				} else {
					await page.waitForFunction(() => !document.querySelector(".nsk-post .nsmax-lottery-me").hidden);
					assert.equal(await card.locator(".nsmax-lottery-me").textContent(), kind === "op" ? "你发起的抽奖" : "帖子已锁定，不能再回复");
					assert.equal(await card.locator(".nsmax-lottery-actions").isVisible(), false);
				}
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 开奖后：用楼层名单 + drand 随机数算出和站点抽奖页一样的中奖楼层，自己中了标绿，结果记在本机`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
		for (const me of [7, 9]) {
			let drand = 0;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me })), external: { "api.drand.sh": () => { drand++; return { round: 1, randomness: RAND }; } } });
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
				const card = page.locator(".nsk-post .nsmax-lottery");
				assert.deepEqual(await card.locator(".nsmax-lottery-winner .nsmax-lottery-floor").allTextContents(), ["#2", "#7", "#25"]);
				assert.equal(await card.locator(".nsmax-lottery-winner[data-nsmax-me]").count(), me === 7 ? 1 : 0);
				assert.match(await card.locator(".nsmax-lottery-me").textContent(), me === 7 ? /^恭喜，你中奖了 · 第 7 楼$/ : /^这次没中，谢谢参与 · 第 9 楼$/);
				assert.equal(await card.getAttribute("data-nsmax-result"), "ok");
				assert.equal(await card.locator(".nsmax-lottery-view").textContent(), "查看开奖");
				assert.notEqual(await card.locator(".nsmax-lottery-view").evaluate(e => getComputedStyle(e).backgroundColor), "rgb(28, 28, 30)", "算出结果后「查看开奖」只是一个弱化的链接");
				assert.equal(drand, 1);
				// 再打开：直接用记下的结果，不再取 drand
				await page.reload();
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
				assert.equal(drand, 1, "开过的奖记在本机");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 开奖后拿不到随机数：不瞎猜，「查看开奖」变成主按钮；参与过的照样写「你已参与」`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me: 9 })) });
		try {
			await page.waitForFunction(() => document.querySelector(".nsk-post .nsmax-lottery")?.getAttribute("data-nsmax-result") === "failed", null, { timeout: 8e3 });
			const card = page.locator(".nsk-post .nsmax-lottery");
			assert.equal(await card.locator(".nsmax-lottery-winner").count(), 0);
			assert.match(await card.locator(".nsmax-lottery-winners").textContent(), /去开奖页看/);
			await page.waitForFunction(() => getComputedStyle(document.querySelector(".nsk-post .nsmax-lottery-view")).backgroundColor === "rgb(28, 28, 30)", null, { timeout: 3e3 });
			assert.match(await card.locator(".nsmax-lottery-me").textContent(), /^你已参与 · 第 9 楼$/);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} 链接细节：没写 duplicate 就是可以重复中奖；「奖品：」只取那一行；一键抽奖那种带名目的列表项整行收起、卡片放在列表后面；不足一小时不写「时」`, async () => {
		const html = withLink(P.postPage(), `<p>奖品：一台小鸡<br>开奖时间：今晚</p><ul><li><strong>中奖人数</strong>：1 人</li><li><strong>开奖链接</strong>：<a href="${link(Date.now() + 30 * 6e4, { count: 1, duplicate: null })}">查看开奖</a></li></ul>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-post .nsmax-lottery");
			const state = await page.evaluate(() => {
				const card = document.querySelector(".nsk-post .nsmax-lottery");
				const li = [...document.querySelectorAll(".nsk-post article li")].find((el) => /开奖链接/.test(el.textContent));
				return {
					rules: card.querySelector(".nsmax-lottery-rules").textContent,
					prize: card.querySelector(".nsmax-lottery-prize").textContent,
					liHidden: getComputedStyle(li).display,
					inList: !!card.closest("ul, ol"),
					afterList: card.previousElementSibling?.tagName,
					segs: [...card.querySelectorAll(".nsmax-lottery-seg")].filter((s) => getComputedStyle(s).display !== "none").map((s) => s.querySelector("i").textContent)
				};
			});
			assert.match(state.rules, /可以重复中奖/);
			assert.equal(state.prize, "一台小鸡");
			assert.equal(state.liHidden, "none", "「开奖链接：」那一行整行收起，不留一个空名目");
			assert.equal(state.inList, false);
			assert.equal(state.afterList, "UL");
			assert.deepEqual(state.segs, ["分", "秒"]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} 只画一张：同一个抽奖贴两次只画一张，别人回复里转贴的开奖链接不画卡片`, async () => {
		const time = Date.now() + 864e5;
		const html = withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p><p>再贴一次：<a href="${link(time)}">开奖</a></p>`).replace("线路怎么样？晚高峰丢包吗？", `<a href="${link(time + 1000)}">我也贴一个</a>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-post .nsmax-lottery");
			await page.waitForTimeout(400);
			assert.equal(await page.locator(".nsmax-lottery").count(), 1);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});
}
