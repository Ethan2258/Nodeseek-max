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
		assert.equal(state.count, "2 个名额");
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

test("已开奖的卡片：算不出结果时「中奖」一行指去开奖页，奖品去掉标题里的「抽奖已结束」，「回复参与」收起", async () => {
	for (const width of [1440, 820]) {
		const html = P.postPage().replace("出一台香港 CN2 GIA 小鸡，年付 99</a></h1>", "抽奖已结束【出鸡】溢价2000出Isvoro JP BGP1 39.9/月 特价款</a></h1>")
			.replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${Date.now() - 864e5}&amp;count=1">开奖</a></p></article>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".nsmax-lottery[data-state=done][data-nsmax-result=failed]");
			const state = await page.evaluate(() => {
				const cell = document.querySelector(".nsmax-lottery-winners");
				return {
					prize: document.querySelector(".nsmax-lottery-prize").textContent,
					winners: cell.textContent,
					href: document.querySelector(".nsmax-lottery-view").getAttribute("href"),
					lines: Math.round(cell.getBoundingClientRect().height / parseFloat(getComputedStyle(cell).lineHeight)),
					fits: cell.scrollWidth <= cell.clientWidth + 1,
					state: document.querySelector(".nsmax-lottery-state").textContent,
					join: getComputedStyle(document.querySelector(".nsmax-lottery-actions")).display,
					when: getComputedStyle(document.querySelector(".nsmax-lottery-when")).display,
					overflow: document.querySelector(".nsmax-lottery").scrollWidth > document.querySelector(".nsmax-lottery").clientWidth + 1
				};
			});
			assert.equal(state.prize, "【出鸡】溢价2000出Isvoro JP BGP1 39.9/月 特价款");
			assert.equal(state.winners, "没能算出来，去开奖页看");
			assert.match(state.href, /mode=view$/);
			assert.equal(state.lines, 1, "中奖者一格只占一行：" + JSON.stringify(state));
			assert.equal(state.fits, true, "不出格：" + JSON.stringify(state));
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

test("v1.9.82 列表标题完全不含抽奖关键词（含 /jump 包装、仅评论区有开奖链接）仍自动识别并记入抽奖列表", async () => {
	const titles = ["今天天气真不错", "Lv6 纪念随便聊聊", "随手记一下日常"];
	const html = P.listPage({ count: 3 }).replace(/(<div role="heading" aria-level="3" class="post-title"><a href="\/post-(\d+)-1"[^>]*>)[^<]*/g, (m, head, id) => head + titles[Number(id) - 1000]);
	const future = Date.now() + 2 * 864e5;
	const pages = {
		"/post-1000-1": P.postPage().replace("</article>", `<p><a href="/jump?to=${encodeURIComponent(`https://nodeseek.com/lucky?post=1000&time=${future}&count=1`)}">跳转开奖</a></p></article>`),
		"/post-1001-1": P.postPage().replace("这是一段正文", "如题，一楼见").replace("收了，私信你", `https://www.nodeseek.com/lucky?post=1001&amp;time=${future}&amp;count=2`),
		"/post-1002-1": P.postPage()
	};
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 1280, height: 900 }, pages });
	try {
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return "1000" in c && "1001" in c && "1002" in c; } catch { return false; } }, null, { timeout: 20e3 });
		await wait(page, 200);
		const state = await page.evaluate(() => ({
			badges: Array.from(document.querySelectorAll("ul.post-list > li.post-list-item .post-title"), (t) => [t.querySelector("a").textContent.trim(), !!t.querySelector(".nsmax-prize-badge")]),
			posts: JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}"),
			rows: Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}")).map(([k, v]) => [k, v.t]))
		}));
		assert.deepEqual(state.badges, [["今天天气真不错", true], ["Lv6 纪念随便聊聊", true], ["随手记一下日常", false]]);
		assert.equal(state.posts["1000"], "lottery");
		assert.equal(state.posts["1001"], "lottery");
		assert.equal(state.rows["1000"], "今天天气真不错");
		assert.equal(state.rows["1001"], "Lv6 纪念随便聊聊");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.82 直接打开无「抽奖」标题的帖子详情页会补记列表行，进入「抽奖」分类即可展示且不被搜索空状态误隐藏", async () => {
	const future = Date.now() + 2 * 864e5;
	const postHtml = P.postPage()
		.replace(/href="\/post-1000-1" class="post-title-link[^"]*">[^<]*/g, 'href="/post-1088-1" class="post-title-link nspp-read">回馈坛友随便写两句')
		.replace("</article>", `<p>规则看一楼：<a href="https://www.nodeseek.com/lucky?post=1088&amp;time=${future}&amp;count=2">开奖链接</a></p></article>`);
	const pages = { "/search": P.searchPage({ count: 0 }) };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1088-1", { html: postHtml, viewport: { width: 1280, height: 900 }, pages });
	try {
		await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}")["1088"]; } catch { return false; } }, null, { timeout: 5e3 });
		await page.evaluate(() => localStorage.setItem("nsmax:lottery-index-at", String(Date.now())));
		await page.goto("https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { waitUntil: "domcontentloaded" });
		await page.waitForSelector("li[data-nsmax-lottery-merged][data-nsmax-lottery='yes'] .nsmax-prize-badge", { timeout: 5e3 });
		const merged = await page.evaluate(() => {
			const li = document.querySelector("li[data-nsmax-lottery-merged][data-nsmax-lottery='yes']");
			return li && {
				visible: li.getClientRects().length > 0,
				title: li.querySelector(".post-title a")?.textContent.trim(),
				href: li.querySelector(".post-title a")?.getAttribute("href"),
				category: li.querySelector(".nsmax-inline-category")?.textContent.trim(),
				emptyPanel: !!document.querySelector(".nsmax-search-empty")
			};
		});
		assert.deepEqual(merged, { visible: true, title: "回馈坛友随便写两句", href: "/post-1088-1", category: "交易", emptyPanel: false });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.82 楼主自己在评论区（.is-poster）贴出的纯文本开奖链接（含 /lucky/?…）也能画成抽奖卡片", async () => {
	const future = Date.now() + 2 * 864e5;
	const html = P.postPage()
		.replace('<a href="/space/11" class="author-name">buyer</a>', '<a href="/space/10" class="author-name">seller</a><span class="is-poster role-tag nsk-badge">楼主</span>')
		.replace("收了，私信你", `补一个开奖地址：https://nodeseek.com/lucky/?post=1000&amp;time=${future}&amp;count=2`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForSelector("ul.comments > li[id='1'] .nsmax-lottery", { timeout: 5e3 });
		assert.equal(await page.locator("ul.comments > li[id='1'] .nsmax-lottery-count").textContent(), "2 个名额");
		assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"]), "lottery");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("主帖里只链接 / 引用别的帖子的开奖链接不算抽奖帖（卡片照画、写「见原帖」，不进「抽奖」分类）；本帖的、没写 post 的照算", async () => {
	const future = Date.now() + 2 * 864e5;
	const other = `https://www.nodeseek.com/lucky?post=42&amp;time=${future}&amp;count=1`;
	const cases = [
		["链接别帖开奖", P.postPage().replace("</article>", `<p>推荐一个正在进行的抽奖：<a href="${other}">别人的开奖页</a></p></article>`), false],
		["引用别帖开奖（纯文字）", P.postPage().replace("</article>", `<blockquote><p>楼上那位说：${other}</p></blockquote></article>`), false],
		["本帖开奖链接", P.postPage().replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${future}&amp;count=1">开奖</a></p></article>`), true],
		["没写 post 的开奖链接", P.postPage().replace("</article>", `<p><a href="/lucky?time=${future}&amp;count=1">开奖</a></p></article>`), true]
	];
	for (const [name, html, lottery] of cases) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
		try {
			await page.waitForFunction(() => "1000" in JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"), null, { timeout: 8e3 });
			await wait(page, 300);
			const state = await page.evaluate(() => ({
				kind: JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"] ?? null,
				row: "1000" in JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}"),
				badge: !!document.querySelector(".nsk-post .post-title .nsmax-prize-badge"),
				prize: document.querySelector(".nsk-post .nsmax-lottery-prize")?.textContent || null
			}));
			if (lottery) {
				assert.equal(state.kind, "lottery", name + JSON.stringify(state));
				assert.equal(state.row, true, name + " 记入抽奖分类：" + JSON.stringify(state));
				assert.equal(state.badge, true, name);
			} else {
				assert.equal(state.kind, null, name + JSON.stringify(state));
				assert.equal(state.row, false, name + " 不进抽奖分类：" + JSON.stringify(state));
				assert.equal(state.badge, false, name);
				assert.equal(state.prize, "见原帖", name + " 别帖的卡片照画");
			}
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 普通列表页后台按内容查：主帖只推荐别人抽奖的普通标题帖子不挂「抽奖」，主帖有本帖开奖链接的照挂
	const titles = ["今天天气真不错", "随手记一下日常", "又一篇普通帖"];
	const list = P.listPage({ count: 3 }).replace(/(<div role="heading" aria-level="3" class="post-title"><a href="\/post-(\d+)-1"[^>]*>)[^<]*/g, (m, head, id) => head + titles[Number(id) - 1000]);
	const pages = {
		"/post-1000-1": P.postPage().replace("</article>", `<p>看到个抽奖分享给大家 <a href="${other}">开奖页</a></p></article>`),
		"/post-1001-1": P.postPage().replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=1001&amp;time=${future}&amp;count=1">开奖</a></p></article>`),
		"/post-1002-1": P.postPage()
	};
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: list, viewport: { width: 1280, height: 900 }, pages });
	try {
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return "1000" in c && "1001" in c && "1002" in c; } catch { return false; } }, null, { timeout: 25e3 });
		await wait(page, 300);
		const state = await page.evaluate(() => ({
			badges: Array.from(document.querySelectorAll("ul.post-list > li.post-list-item .post-title"), (t) => !!t.querySelector(".nsmax-prize-badge")),
			posts: JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}"),
			rows: Object.keys(JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}")).sort()
		}));
		assert.deepEqual(state.badges, [false, true, false], JSON.stringify(state));
		assert.equal(state.posts["1000"], undefined);
		assert.equal(state.posts["1001"], "lottery");
		assert.deepEqual(state.rows, ["1001"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("点开抽奖帖不拿帖子页这一页的楼层数、发帖时间覆盖列表上记下的那一行（回复数、最后回复时间不变）", async () => {
	const future = Date.now() + 2 * 864e5;
	const listRow = { t: "回馈坛友随便写两句", u: "10", n: "seller", v: "5000", r: "300", lu: "77", ln: "lastguy", th: "/post-1000-30#300", td: "2026-11-26T04:00:00.000Z", tt: "2026-11-26 12:00:00", c: "/categories/trade", cn: "交易" };
	const init = `if (window.top === window && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nsmax:lottery-rows", ${JSON.stringify(JSON.stringify({ "1000": listRow }))}); localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1000": "lottery" })); }`;
	const html = P.postPage().replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=${future}&amp;count=2">开奖</a></p></article>`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 }, init });
	try {
		await page.waitForSelector(".nsk-post .nsmax-lottery");
		await page.waitForFunction(() => "1000" in JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"), null, { timeout: 8e3 });
		await wait(page, 800);
		const row = await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}")["1000"]);
		assert.equal(row?.r, "300", JSON.stringify(row));
		assert.equal(row?.td, "2026-11-26T04:00:00.000Z", JSON.stringify(row));
		assert.equal(row?.tt, "2026-11-26 12:00:00", JSON.stringify(row));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
