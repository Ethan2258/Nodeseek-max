"use strict";
// 活跃度标签（融合「NodeSeek 用户发帖与评论频率」）：个人主页日均、名字后面的档位标签、帖子作者栏、悬停资料卡、设置开关
const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { nativeSpacePage, postPage } = require("./fixtures/pages.cjs");
const KEY = "nspp:settings:www.nodeseek.com";
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });
const ready = (page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-theme") && !document.documentElement.hasAttribute("data-nsmax-mounting") && performance.getEntriesByName("nsmax:deferred-start").length);
const days = (n) => new Date(Date.now() - n * 864e5 - 6e5).toISOString();
const tags = (page, selector) => page.evaluate((selector) => Array.from(document.querySelectorAll(selector), (el) => ({ text: el.textContent, tone: el.dataset.tone, title: el.title })), selector);

test("个人主页：主题、回帖下面写日均，名字后面标活跃度档位，悬停看具体数字", async () => {
	// 页面上：加入 659 天、主题 100、评论 873 → 日均 1.48 条，「正常」
	const detail = { member_id: 10, member_name: "Steve", rank: 3, coin: 1257, stardust: 26, nPost: 100, nComment: 873, follows: 11, fans: 155, created_at: days(659) };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage(), api: { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail } }] } });
	try {
		await page.waitForSelector(".nsmax-space-title-row .nsmax-activity-tag");
		const rates = await page.evaluate(() => Array.from(document.querySelectorAll(".head-container > .card-block > .nsmax-user-stat"), (cell) => [cell.querySelector(".nsmax-user-stat-label").textContent, cell.querySelector(".nsmax-user-stat-rate")?.textContent || ""]).filter(([, rate]) => rate));
		assert.deepEqual(rates, [["主题", "日均 0.15 帖"], ["回帖", "日均 1.32 条"]]);
		const shown = await tags(page, ".nsmax-space-title-row .nsmax-activity-tag");
		assert.deepEqual(shown.map(({ text, tone }) => [text, tone]), [["正常", "normal"]]);
		assert.match(shown[0].title, /日均 1\.48 条（主题 0\.15 \+ 回帖 1\.32），注册 659 天/);
		const style = await page.locator(".nsmax-space-title-row .nsmax-activity-tag").evaluate((el) => ({ height: el.getBoundingClientRect().height, background: getComputedStyle(el).backgroundColor }));
		assert.equal(style.height, 18);
		assert.notEqual(style.background, "rgba(0, 0, 0, 0)", "档位有底色");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("帖子作者栏和悬停资料卡：高频账号标「人机」，新号标「新号」，旧缓存没有注册时间时重读一次", async () => {
	// 10 号：注册 600 天、4 万条回帖 → 日均 66.7 条，人机；其余作者：注册 12 天、30 条 → 新号
	const html = postPage();
	const ids = [...new Set(Array.from(html.matchAll(/class="author-info"[\s\S]*?href="\/space\/(\d+)"/g), (m) => m[1]))];
	assert.ok(ids.length >= 2, "帖子里有几位作者");
	const [bot, ...rest] = ids;
	// 作者栏读一次、资料卡再读一次（带 readme），都回同一份
	const botReply = { status: 200, body: { success: true, detail: { member_id: Number(bot), rank: 4, coin: 3000, nPost: 20, nComment: 40000, created_at: days(600) } } };
	const api = { [`/api/account/getInfo/${bot}`]: [botReply, botReply, botReply] };
	for (const id of rest) api[`/api/account/getInfo/${id}`] = [{ status: 200, body: { success: true, detail: { member_id: Number(id), rank: 1, coin: 10, nPost: 2, nComment: 28, created_at: days(12) } } }];
	// 本机记着 bot 的旧资料（没有注册时间）：先按旧的填，不标档位；随后重读补上
	const init = `localStorage.setItem("nsmax:members", JSON.stringify({ ${JSON.stringify(bot)}: { at: Date.now(), rank: 4, coin: 3000, nPost: 20, nComment: 40000 } }));`;
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, api, init, viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		await page.waitForFunction((bot) => document.querySelector(`.nsmax-author-col[data-nsmax-uid="${bot}"] .nsmax-activity-tag`), bot);
		const botTags = await tags(page, `.nsmax-author-col[data-nsmax-uid="${bot}"] .nsmax-activity-tag`);
		assert.equal(botTags[0].text, "人机");
		assert.equal(botTags[0].tone, "bot");
		assert.match(botTags[0].title, /日均 66\.70 条/);
		assert.ok(calls[`/api/account/getInfo/${bot}`] >= 1, "旧记录没有注册时间：重读了一次");
		const other = rest[0];
		await page.waitForFunction((id) => document.querySelector(`.nsmax-author-col[data-nsmax-uid="${id}"] .nsmax-activity-tag`), other);
		assert.deepEqual((await tags(page, `.nsmax-author-col[data-nsmax-uid="${other}"] .nsmax-activity-tag`)).map((tag) => tag.text), ["新号"]);
		// 标签在等级徽章后面、三格数字前面
		const order = await page.evaluate((bot) => Array.from(document.querySelector(`.nsmax-author-col[data-nsmax-uid="${bot}"] .nsmax-author-who`).children, (el) => el.className.split(" ")[0]), bot);
		assert.ok(order.indexOf("nsmax-author-level") < order.indexOf("nsmax-activity-tag") && order.indexOf("nsmax-activity-tag") < order.indexOf("nsmax-author-stats"), order.join(","));
		// 悬停资料卡
		await page.locator(`.nsmax-author-col[data-nsmax-uid="${bot}"] .nsmax-author-name`).first().hover();
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-meta .nsmax-activity-tag");
		assert.equal(await page.locator(".nsmax-person-pop .nsmax-activity-tag").first().textContent(), "人机");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("设置关掉活跃度标签：个人主页不写日均、名字后面和作者栏都不标", async () => {
	const detail = { member_id: 10, member_name: "Steve", rank: 3, coin: 1257, nPost: 100, nComment: 873, created_at: days(659) };
	const seed = { [KEY]: { "sb-activity-tags": { enabled: false } } };
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage(), seed, api: { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail } }] } });
		try {
			await ready(page);
			await page.waitForSelector(".head-container > .card-block > .nsmax-user-stat");
			await page.waitForTimeout(300);
			assert.equal(await page.locator(".nsmax-activity-tag, .nsmax-user-stat-rate").count(), 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), seed, viewport: { width: 1440, height: 900 } });
		try {
			await ready(page);
			await page.waitForSelector(".nsmax-author-col[data-nsmax-filled]");
			assert.equal(await page.locator(".nsmax-activity-tag").count(), 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});
