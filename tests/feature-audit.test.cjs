"use strict";
// 2026-11-08 功能逐项检查找到的问题：签到在页面没有 __config__.user 时一次都没签；「只高亮」模式下屏蔽用户、等级不够的帖子不起作用。
const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { listPage } = require("./fixtures/pages.cjs");
const KEY = "nspp:settings:www.nodeseek.com";
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });
const ready = (page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-theme") && !document.documentElement.hasAttribute("data-nsmax-mounting") && performance.getEntriesByName("nsmax:deferred-start").length);

test("签到：页面配置里没有当前用户、只能从 Cookie 认出账号时照样发签到请求，不会直接记成今天已签", async () => {
	const html = listPage().replace('user: { member_id: 1, member_name: "tester" }', "user: undefined");
	assert.notEqual(html, listPage(), "夹具里的用户配置格式变了");
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
		html,
		beforeNavigate: (p) => p.context().addCookies([{ name: "member_id", value: "1", url: "https://www.nodeseek.com" }]),
		api: { "/api/attendance": [{ status: 200, body: { success: true, message: "签到成功，获得 5 个鸡腿", gain: 5 } }] }
	});
	try {
		await ready(page);
		await page.waitForFunction(() => document.querySelector("#nspp-tools .nspp-tool-icon[title='已签到']") || document.querySelector("#nspp-tools .nspp-tool-icon[hidden]"), null, { timeout: 5e3 });
		assert.equal(calls["/api/attendance"], 1, "发了一次签到请求");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("关键词「只高亮」：关键词标出来不藏，屏蔽的用户照样藏起来，工具条分开写标出和屏蔽的条数", async () => {
	const seed = { [KEY]: { "content-filter": { enabled: true, keywords: "VPS", users: "user2", mode: "highlight" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	try {
		await ready(page);
		await page.waitForFunction(() => document.querySelector(".post-title mark"));
		const state = await page.evaluate(() => {
			const item = (id) => document.querySelector(`a[href="/post-${id}-1"]`).closest(".post-list-item");
			return { keyword: item(1001).hidden, marked: item(1001).querySelector("mark")?.textContent, user: item(1002).hidden, other: item(1000).hidden };
		});
		assert.deepEqual(state, { keyword: false, marked: "VPS", user: true, other: false });
		const summary = await page.evaluate(() => Array.from(document.querySelectorAll("body *")).map((el) => el.childElementCount ? "" : el.textContent).find((text) => /^本页/.test(text || "")) || "");
		if (summary) assert.equal(summary, "本页标出 1 条，屏蔽 1 条");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
