"use strict";
// 2026-11-01：抽奖帖识别改成「只要里面有开奖链接就算」，抽奖卡片中奖者一格不再挤成竖排
const test = require("node:test"), assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs"), P = require("./fixtures/pages.cjs");
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });
const wait = (page, ms) => page.waitForTimeout(ms);

test("纯文字网址、不带 www 的开奖链接也算抽奖帖，主帖里照样画卡片", async () => {
	const time = Date.now() + 2 * 864e5;
	const html = P.postPage().replace("</article>", `<p>开奖地址：https://nodeseek.com/lucky?post=1000&amp;time=${time}&amp;count=2&amp;start=1&amp;duplicate=false</p></article>`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsk-post .nsmax-lottery");
		await wait(page, 300);
		const state = await page.evaluate(() => ({
			kinds: JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"],
			cards: document.querySelectorAll(".nsmax-lottery").length,
			view: document.querySelector(".nsmax-lottery-view").getAttribute("href"),
			count: document.querySelector(".nsmax-lottery-count").textContent,
			badge: !!document.querySelector(".nsk-post .post-title .nsmax-prize-badge")
		}));
		assert.equal(state.kinds, "lottery");
		assert.equal(state.cards, 1);
		assert.match(state.view, /^https:\/\/www\.nodeseek\.com\/lucky\?post=1000&time=\d+&count=2/, "换成当前域名");
		assert.equal(state.count, "2");
		assert.equal(state.badge, true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("评论里没写 post 参数的开奖链接也算；别的帖子的开奖链接不算", async () => {
	const own = P.postPage().replace("收了，私信你", '开奖链接 <a href="/lucky?time=1893456000000&amp;count=1">点这里</a>');
	const other = P.postPage().replace("收了，私信你", '上次的 <a href="/lucky?post=42&amp;time=1893456000000&amp;count=1">开奖</a>');
	for (const [html, expected] of [[own, "lottery"], [other, undefined]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
		try {
			await page.waitForFunction(() => "1000" in JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"), null, { timeout: 5e3 });
			assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"]), expected);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("已开奖的卡片：中奖者一格是一行「查看名单」，奖品去掉标题里的「抽奖已结束」，「回复参与」收起", async () => {
	for (const width of [1440, 820]) {
		const html = P.postPage().replace("出一台香港 CN2 GIA 小鸡，年付 99</a></h1>", "抽奖已结束【出鸡】溢价2000出Isvoro JP BGP1 39.9/月 特价款</a></h1>")
			.replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${Date.now() - 864e5}&amp;count=1">开奖</a></p></article>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".nsmax-lottery[data-state=done] a.nsmax-lottery-result");
			const state = await page.evaluate(() => {
				const cell = document.querySelector(".nsmax-lottery-winners");
				const link = cell.querySelector("a");
				return {
					prize: document.querySelector(".nsmax-lottery-prize").textContent,
					winners: cell.textContent,
					href: cell.querySelector("a").getAttribute("href"),
					lines: new Set(Array.from(link.getClientRects(), (r) => Math.round(r.top))).size,
					fits: link.getBoundingClientRect().right <= cell.getBoundingClientRect().right + 0.5,
					state: document.querySelector(".nsmax-lottery-state").textContent,
					join: getComputedStyle(document.querySelector(".nsmax-lottery-join")).display,
					when: getComputedStyle(document.querySelector(".nsmax-lottery-when")).display,
					overflow: document.querySelector(".nsmax-lottery").scrollWidth > document.querySelector(".nsmax-lottery").clientWidth + 1
				};
			});
			assert.equal(state.prize, "【出鸡】溢价2000出Isvoro JP BGP1 39.9/月 特价款");
			assert.equal(state.winners, "查看名单");
			assert.match(state.href, /mode=view$/);
			assert.equal(state.lines, 1, "中奖者一格只占一行：" + JSON.stringify(state));
			assert.equal(state.fits, true, "「查看名单」不出格：" + JSON.stringify(state));
			assert.equal(state.state, "已开奖");
			assert.equal(state.join, "none");
			assert.equal(state.when, "none", "开奖后右边不再重复写开奖时间");
			assert.equal(state.overflow, false);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("列表里查过「不是」、标题像抽奖的帖子：30 分钟后再查一次，楼主后来补上的开奖链接也能认出来", async () => {
	const lucky = P.postPage().replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1003&amp;time=1893456000000&amp;count=1">开奖</a></p></article>');
	const init = `if (window.top === window && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1003": Date.now() - 3600e3 })); }`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: P.listPage(), viewport: { width: 1440, height: 900 }, pages: { "/post-1003-1": lucky }, init });
	try {
		await page.waitForFunction(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1003"] === "lottery", null, { timeout: 15e3 });
		await page.waitForSelector(".post-list-item .nsmax-prize-badge");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("悬停预览读到开奖链接：列表里马上挂上「抽奖」", async () => {
	const lucky = P.postPage().replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=1893456000000&amp;count=1">开奖</a></p></article>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: P.listPage(), viewport: { width: 1440, height: 900 }, pages: { "/post-1000-1": lucky } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const first = page.locator(".post-list-item .post-title a").first();
		assert.equal(await first.getAttribute("href"), "/post-1000-1");
		await first.hover();
		await page.waitForSelector("dialog.nspp-post-preview article");
		await page.waitForSelector(".post-list-item:first-child .nsmax-prize-badge", { timeout: 3e3 });
		assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"]), "lottery");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
