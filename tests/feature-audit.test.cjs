"use strict";
// 2026-11-08 功能逐项检查找到的问题：签到在页面没有 __config__.user 时一次都没签；「只高亮」模式下屏蔽用户、等级不够的帖子不起作用
// （2026-11-09「只高亮」去掉了，旧值按「折叠」处理）；2026-11-09：签到请求没成时不再记成今天已签。
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

test("签到：请求没成（站点出错）时不记成今天已签，按钮留着，点一下重试能签上", async () => {
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		api: { "/api/attendance": [{ status: 502, body: {} }, { status: 200, body: { success: true, message: "签到成功，获得 3 个鸡腿", gain: 3 } }] }
	});
	try {
		await ready(page);
		await page.waitForFunction(() => Array.from(document.querySelectorAll(".nsmax-toast")).some((toast) => toast.textContent.includes("签到没成功")), null, { timeout: 8e3 });
		// 主题下工具条本身不显示（签到入口在资料卡），这里只看按钮没被标成 hidden（以前当天就藏起来）
		const button = page.locator("#nspp-tools .nspp-tool-icon[title='签到']");
		await button.waitFor({ state: "attached", timeout: 3e3 });
		assert.equal(await button.evaluate((el) => el.hidden), false, "按钮还在");
		const first = calls["/api/attendance"];
		// 签到请求跨标签页 10 秒内只发一次（withTabLock）：测试里不等这 10 秒，清掉锁再点
		await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.includes(":lock:") && key.includes("attendance")) localStorage.removeItem(key); });
		await button.dispatchEvent("click");
		await page.waitForFunction(() => Array.from(document.querySelectorAll(".nsmax-toast")).some((toast) => toast.textContent.includes("签到成功")), null, { timeout: 8e3 });
		assert.equal(calls["/api/attendance"], first + 1, "点按钮又发了一次");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("关键词屏蔽：以前存的「只高亮」（已去掉）按「折叠」处理，命中的帖子和屏蔽的用户都收起来", async () => {
	const seed = { [KEY]: { "content-filter": { enabled: true, keywords: "VPS", users: "user2", mode: "highlight" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	try {
		await ready(page);
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-filtered").length >= 2);
		const state = await page.evaluate(() => {
			const item = (id) => document.querySelector(`a[href="/post-${id}-1"]`).closest(".post-list-item");
			return { keyword: item(1001).hidden, user: item(1002).hidden, other: item(1000).hidden };
		});
		assert.deepEqual(state, { keyword: true, user: true, other: false });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
