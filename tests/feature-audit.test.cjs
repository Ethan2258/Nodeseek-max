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

// 2026-11-22 排查：两个标签页都开着时，各页拿自己打开时读到的那份设置 / 状态改了整段写回去，后写的把先写的冲掉
const secondTab = async (context, url) => {
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
	await page.goto(url, { waitUntil: "domcontentloaded" });
	return { page, errors };
};
const addKeyword = async (page, word) => {
	await page.getByRole("button", { name: "关键词屏蔽", exact: true }).click();
	const pop = page.locator(".nsmax-pop[data-kind=keywords]");
	await pop.getByRole("textbox", { name: "要屏蔽的关键词" }).fill(word);
	await pop.getByRole("button", { name: "添加", exact: true }).click();
	await page.keyboard.press("Escape");
};
const storedFilter = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem("__gm__:" + key) || "{}")["content-filter"] || {}, KEY);

test("两个标签页各加一个屏蔽词：两个都留下（以前后加的那页拿打开时的旧名单整段写回，先加的被冲掉）", async () => {
	const { context, page: a, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		const { page: b, errors: errorsB } = await secondTab(context, "https://www.nodeseek.com/");
		await ready(a); await ready(b);
		await addKeyword(a, "甲骨文");
		await a.waitForFunction((key) => (JSON.parse(localStorage.getItem("__gm__:" + key) || "{}")["content-filter"]?.keywords || "").includes("甲骨文"), KEY);
		await addKeyword(b, "CN2");
		await b.waitForFunction((key) => (JSON.parse(localStorage.getItem("__gm__:" + key) || "{}")["content-filter"]?.keywords || "").includes("CN2"), KEY);
		assert.deepEqual((await storedFilter(b)).keywords.split("\n").sort(), ["CN2", "甲骨文"]);
		// 删一个也只删那一个：B 页没见过「甲骨文」，删「CN2」时不能连带把「甲骨文」写没
		await b.getByRole("button", { name: "关键词屏蔽", exact: true }).click();
		await b.locator(".nsmax-pop[data-kind=keywords]").getByRole("button", { name: "删除「CN2」" }).click();
		await b.waitForFunction((key) => !(JSON.parse(localStorage.getItem("__gm__:" + key) || "{}")["content-filter"]?.keywords || "").includes("CN2"), KEY);
		assert.equal((await storedFilter(b)).keywords, "甲骨文");
		assert.deepEqual([...errors, ...errorsB], []);
	} finally { await context.close(); }
});

test("签到：别的标签页签过了，这一页回到前台时按钮跟着藏起来，不再重复发签到请求", async () => {
	const seed = { [KEY]: { attendance: { enabled: true, automatic: false } } };
	const { context, page: a, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(), seed,
		api: { "/api/attendance": [{ status: 200, body: { success: true, message: "签到成功，获得 5 个鸡腿", gain: 5 } }] }
	});
	try {
		const { page: b, errors: errorsB } = await secondTab(context, "https://www.nodeseek.com/");
		await ready(a); await ready(b);
		const button = (page) => page.locator("#nspp-tools .nspp-tool-icon[title='签到'], #nspp-tools .nspp-tool-icon[title='已签到']");
		await button(a).dispatchEvent("click");
		await a.waitForFunction(() => Array.from(document.querySelectorAll(".nsmax-toast")).some((toast) => toast.textContent.includes("签到成功")), null, { timeout: 8e3 });
		assert.equal(calls["/api/attendance"], 1);
		await b.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.includes(":lock:")) localStorage.removeItem(key); window.dispatchEvent(new Event("focus")); });
		await b.waitForTimeout(300);
		assert.equal(await button(b).evaluate((el) => el.hidden), true, "B 页的签到按钮跟着藏起来");
		await button(b).dispatchEvent("click");
		await b.waitForTimeout(500);
		assert.equal(calls["/api/attendance"], 1, "B 页没有再发一次签到");
		assert.deepEqual([...errors, ...errorsB], []);
	} finally { await context.close(); }
});

// 中文输入法打字时按 Esc 是收起候选词：以前关键词弹窗、资料卡、脚本设置跟着整个关掉（全局的 Esc 没看 isComposing）
const imeEscape = (locator) => locator.evaluate((el) => {
	el.focus();
	el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 229, isComposing: true, bubbles: true, cancelable: true, composed: true }));
});
test("输入法候选词还开着时按 Esc：关键词弹窗、资料卡备注、脚本设置都不关；不在打字时 Esc 照样关", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		await page.getByRole("button", { name: "关键词屏蔽", exact: true }).click();
		const pop = page.locator(".nsmax-pop[data-kind=keywords]");
		await imeEscape(pop.getByRole("textbox", { name: "要屏蔽的关键词" }));
		assert.equal(await pop.count(), 1, "关键词弹窗还开着");
		await page.keyboard.press("Escape");
		assert.equal(await pop.count(), 0, "真按 Esc 关掉");

		await page.locator("ul.post-list>li .info-author a").first().hover();
		await page.waitForSelector(".nsmax-person-pop dd");
		await page.locator(".nsmax-person-pop .nsmax-person-note").click();
		const note = page.locator(".nsmax-person-pop .nsmax-person-note-form input");
		await imeEscape(note);
		assert.equal(await page.locator(".nsmax-person-pop").count(), 1, "资料卡还开着");
		assert.equal(await note.count(), 1, "备注输入框还在");
		await page.mouse.move(5, 5);

		await page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		const dialog = page.locator("#nspp-settings dialog");
		await dialog.waitFor({ state: "visible" });
		await imeEscape(page.locator("#nspp-settings input[type=search]"));
		assert.equal(await dialog.evaluate((el) => el.open), true, "设置面板还开着");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("资料卡缓存：过期的那些写新的时顺手清掉，不在会话存储里越攒越多", async () => {
	const init = `if (window.top === window && !sessionStorage.getItem("nsmax:test-seeded")) { sessionStorage.setItem("nsmax:test-seeded", "1"); for (let i = 0; i < 300; i++) sessionStorage.setItem("nsmax:person:" + (90000 + i), JSON.stringify({ at: Date.now() - 36e5, data: { member_name: "old" + i } })); sessionStorage.setItem("nsmax:person:777", JSON.stringify({ at: Date.now() - 1000, data: { member_name: "fresh" } })); }`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init, viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		await page.locator("ul.post-list>li .info-author a").first().hover();
		await page.waitForSelector(".nsmax-person-pop dd");
		await page.waitForFunction(() => Object.keys(sessionStorage).filter((key) => key.startsWith("nsmax:person:")).length < 10);
		const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("nsmax:person:")));
		assert.ok(keys.includes("nsmax:person:777"), "没过期的留着");
		assert.equal(keys.some((key) => /:9\d{4}$/.test(key)), false, "过期的清掉");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
