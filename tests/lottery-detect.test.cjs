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

// ===== v1.9.94 抽奖帖识别（2026-11-28） =====
// 帖子页：换编号、标题、主帖正文（body 给了就整段换掉），extra 接在主帖正文最后
const postOf = (id, { title, body, extra = "" } = {}) => {
	let html = P.postPage().replace('href="/post-1000-1" class="post-title-link', `href="/post-${id}-1" class="post-title-link`);
	if (title !== undefined) html = html.replace("出一台香港 CN2 GIA 小鸡，年付 99</a></h1>", `${title}</a></h1>`);
	if (body !== undefined) html = html.replace(/<article class="post-content">[\s\S]*?<\/article>/, `<article class="post-content">${body}</article>`);
	if (extra) html = html.replace("</article>", `${extra}</article>`);
	return html;
};
// 列表页：把每一行的标题换掉（titles[i] 对应 /post-(1000+i)-1）
const listWithTitles = (titles) => P.listPage({ count: titles.length }).replace(/(<div role="heading" aria-level="3" class="post-title"><a href="\/post-(\d+)-1"[^>]*>)[^<]*/g, (m, head, id) => head + titles[Number(id) - 1000]);
const NO_PREVIEW = { "nspp:settings:www.nodeseek.com": { "post-preview": { enabled: false } } };
const json = (page, key, fallback) => page.evaluate(([key, fallback]) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }, [key, fallback]);
// 依次直接打开 cases 里的帖子（同一个浏览器上下文，本机记录累积），每篇等「查过」以后读出识别结果
async function visitPosts(cases, viewport = { width: 1280, height: 900 }, init = "") {
	const pages = Object.fromEntries(cases.map((c) => [`/post-${c.id}-1`, c.html]));
	const { context, page, errors } = await open(browser, `https://www.nodeseek.com/post-${cases[0].id}-1`, { html: cases[0].html, viewport, pages, ...(init ? { init } : {}) });
	const results = {};
	try {
		for (const [index, c] of cases.entries()) {
			if (index) await page.goto(`https://www.nodeseek.com/post-${c.id}-1`, { waitUntil: "domcontentloaded" });
			await page.waitForFunction((id) => { try { return id in JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); } catch { return false; } }, String(c.id), { timeout: 8e3 });
			await wait(page, 350);
			results[c.id] = await page.evaluate((id) => {
				const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
				const badge = document.querySelector(".nsk-post .post-title .nsmax-prize-badge");
				return {
					kind: read("nsmax:special-posts", {})[id] ?? null,
					time: read("nsmax:lottery-times", {})[id] ?? null,
					ended: read("nsmax:lottery-ended", []).includes(id),
					badge: !!badge,
					badgeEnded: !!badge?.hasAttribute("data-ended"),
					endedBadge: !!document.querySelector(".nsk-post .post-title .nsmax-ended-badge"),
					cards: document.querySelectorAll(".nsk-post .nsmax-lottery").length,
					count: document.querySelector(".nsk-post .nsmax-lottery-count")?.textContent ?? null
				};
			}, String(c.id));
		}
		return { results, errors };
	} finally { await context.close(); }
}

test("v1.9.94 开奖链接解析：不带 https:// 的 nodeseek.com / www.nodeseek.com 纯文字网址、/Lucky? 大写、同站 nodeseek.com/jump?to= 包装都算；纯文字网址读到中文标点为止，链接里粘上的 %EF%BC%8C 也照样取开奖时间", async () => {
	const T = Date.now() + 3 * 864e5;
	const cases = [
		// 纯文字、不带 https://、不带 www；time 后面紧跟中文逗号
		{ id: 2001, html: postOf(2001, { extra: `<p>开奖地址：nodeseek.com/lucky?post=2001&amp;count=2&amp;time=${T}，周五晚上开</p>` }), expect: { kind: "lottery", time: T, cards: 1, count: "2 个名额" } },
		// 纯文字、带 www、不带 https://；count 后面紧跟中文句号
		{ id: 2002, html: postOf(2002, { extra: `<p>开奖：www.nodeseek.com/lucky?post=2002&amp;time=${T}&amp;count=3。</p>` }), expect: { kind: "lottery", time: T, cards: 1, count: "3 个名额" } },
		// 站点渲染出来的链接，路径写成大写 /Lucky?
		{ id: 2003, html: postOf(2003, { extra: `<p><a href="https://www.nodeseek.com/Lucky?post=2003&amp;time=${T}&amp;count=1">开奖</a></p>` }), expect: { kind: "lottery", time: T, cards: 1, count: "1 个名额" } },
		// 不带 www 的同站 /jump?to= 跳转包装
		{ id: 2004, html: postOf(2004, { extra: `<p><a href="https://nodeseek.com/jump?to=${encodeURIComponent(`https://www.nodeseek.com/lucky?post=2004&time=${T}&count=2`)}">跳转开奖</a></p>` }), expect: { kind: "lottery", time: T, cards: 1, count: "2 个名额" } },
		// 被渲染成链接时把后面的中文逗号也包进去了（time=…%EF%BC%8C）：只取开头的数字
		{ id: 2005, html: postOf(2005, { extra: `<p><a href="https://www.nodeseek.com/lucky?post=2005&amp;count=1&amp;time=1893456000000%EF%BC%8C">https://www.nodeseek.com/lucky?post=2005&amp;count=1&amp;time=1893456000000，</a></p>` }), expect: { kind: "lottery", time: 1893456000000, cards: 1, count: "1 个名额" } },
		// 不算：别的网站的 /lucky、DeepFlood 的开奖链接（在 NodeSeek 上）、别的网站的 /jump?to= 包装、域名只是以 nodeseek.com 开头的
		{ id: 2006, html: postOf(2006, { extra: `<p><a href="https://example.com/lucky?post=2006&amp;time=${T}&amp;count=1">开奖</a> 以及 https://example.com/lucky?post=2006&amp;time=${T}</p>` }), expect: { kind: null, time: null, cards: 0, count: null } },
		{ id: 2007, html: postOf(2007, { extra: `<p>那边的：https://www.deepflood.com/lucky?post=2007&amp;time=${T}&amp;count=1</p>` }), expect: { kind: null, time: null, cards: 0, count: null } },
		{ id: 2008, html: postOf(2008, { extra: `<p><a href="https://example.com/jump?to=${encodeURIComponent(`https://www.nodeseek.com/lucky?post=2008&time=${T}`)}">外站跳转</a></p>` }), expect: { kind: null, time: null, cards: 0, count: null } },
		{ id: 2009, html: postOf(2009, { extra: `<p>镜像：nodeseek.com.example.org/lucky?post=2009&amp;time=${T}</p>` }), expect: { kind: null, time: null, cards: 0, count: null } }
	];
	const { results, errors } = await visitPosts(cases);
	for (const c of cases) {
		const got = results[c.id];
		assert.deepEqual({ kind: got.kind, time: got.time, cards: got.cards, count: got.count }, c.expect, `帖子 ${c.id}：${JSON.stringify(got)}`);
		assert.equal(got.badge, c.expect.kind === "lottery", `帖子 ${c.id} 标题前的「抽奖」`);
	}
	assert.deepEqual(errors, []);
});

test("v1.9.94 已结束怎么认：标题「抽奖结束时间周五」「活动结束后统一发货」不算，「[已兑奖]」「已发奖」算；正文说上一期的（上期已开奖、恭喜上一期 @… 中奖）和「名额已抽完会补抽」不算；楼主正文写了已开奖不用等开奖时间；过了开奖时间就是已结束", async () => {
	const future = Date.now() + 3 * 864e5, past = Date.now() - 864e5;
	const link = (id, time) => `<p><a href="https://www.nodeseek.com/lucky?post=${id}${time ? `&amp;time=${time}` : ""}&amp;count=1">开奖页</a></p>`;
	const cases = [
		{ id: 2101, html: postOf(2101, { title: "抽奖结束时间周五 送 VPS 一台", extra: link(2101, future) }), ended: false },
		{ id: 2102, html: postOf(2102, { title: "活动结束后统一发货 抽 3 个鸡腿", extra: link(2102, future) }), ended: false },
		{ id: 2103, html: postOf(2103, { title: "[已兑奖] 抽奖送域名", extra: link(2103, future) }), ended: true },
		{ id: 2104, html: postOf(2104, { title: "抽奖送 VPS 已发奖", extra: link(2104, future) }), ended: true },
		// 楼主提前开了奖、正文里写了：不等开奖时间
		{ id: 2105, html: postOf(2105, { extra: `<p>已开奖，恭喜 @buyer 中奖</p>${link(2105, future)}` }), ended: true },
		// 正文说的是上一期 / 补抽：不算（开奖链接里没写开奖时间，只看楼主写的字）
		{ id: 2106, html: postOf(2106, { extra: `<p>上期已开奖，本期继续，回复参与</p>${link(2106)}` }), ended: false },
		{ id: 2107, html: postOf(2107, { extra: `<p>恭喜上一期 @abc 中奖，本期继续</p>${link(2107)}` }), ended: false },
		{ id: 2108, html: postOf(2108, { extra: `<p>名额已抽完会补抽</p>${link(2108)}` }), ended: false },
		{ id: 2109, html: postOf(2109, { extra: `<p>已开奖，恭喜 @abc 中奖</p>${link(2109)}` }), ended: true },
		// 过了开奖时间：标题前就是「已结束」（正文、标题都没写）
		{ id: 2110, html: postOf(2110, { extra: link(2110, past) }), ended: "time" },
		// 复查补的边角：上一期那一句里带逗号、句号后面才说本期；「开奖结束后」「报名已截止」「如果已结束」；「提前一波已开奖」是这一期
		{ id: 2111, html: postOf(2111, { extra: `<p>周五开奖。上期已开奖，恭喜@abc中奖。</p>${link(2111)}` }), ended: false },
		{ id: 2112, html: postOf(2112, { extra: `<p>上期中奖名单见 xx,本期已开奖,恭喜 @a 中奖</p>${link(2112)}` }), ended: true },
		{ id: 2113, html: postOf(2113, { title: "报名已截止，周五开奖", extra: `<p>开奖结束后统一发码，如果已结束请私信</p>${link(2113)}` }), ended: false },
		{ id: 2114, html: postOf(2114, { extra: `<p>提前一波已开奖</p>${link(2114)}` }), ended: true }
	];
	const { results, errors } = await visitPosts(cases);
	for (const c of cases) {
		const got = results[c.id];
		assert.equal(got.kind, "lottery", `帖子 ${c.id} 是抽奖帖：${JSON.stringify(got)}`);
		if (c.ended !== "time") assert.equal(got.ended, c.ended, `帖子 ${c.id} 记下的「已结束」：${JSON.stringify(got)}`);
		const shown = c.ended !== false;
		assert.equal(got.badgeEnded, shown, `帖子 ${c.id}「抽奖」小标的 data-ended：${JSON.stringify(got)}`);
		assert.equal(got.endedBadge, shown, `帖子 ${c.id}「已结束」小标：${JSON.stringify(got)}`);
	}
	assert.deepEqual(errors, []);
});

test("v1.9.94 没有开奖链接、只在帖子里写怎么抽的抽奖帖也算（标题明说在抽/送 + 正文写了开奖/名额/回复参与/按楼层，或者标题写抽奖、正文只有图片）；问问题、汇总、晒中奖、抽奖器、引用里的规则都不算", async () => {
	const image = `<p><img src="https://www.nodeseek.com/avatar/1.png" alt="奖品" width="320" height="200"></p>`;
	const cases = [
		{ id: 2201, html: postOf(2201, { title: "抽奖送 3 个鸡腿", extra: "<p>回复本帖即可参与，周五开奖</p>" }), lottery: true },
		{ id: 2202, html: postOf(2202, { title: "T楼送一台小鸡", extra: "<p>第 50 楼送出，年付到明年</p>" }), lottery: true },
		{ id: 2203, html: postOf(2203, { title: "【抽奖】新年快乐", body: image }), lottery: true },
		// 正文只有图片、标题没写「抽奖 / 开奖」：不算
		{ id: 2204, html: postOf(2204, { title: "速抽 2 个 Plus", body: image }), lottery: false },
		{ id: 2205, html: postOf(2205, { title: "抽奖汇总？", extra: "<p>开奖名单如下</p>" }), lottery: false },
		{ id: 2206, html: postOf(2206, { title: "抽到了！感谢大佬", extra: "<p>中奖了，开心</p>" }), lottery: false },
		{ id: 2207, html: postOf(2207, { title: "抽奖器教程", extra: "<p>怎么开奖：按楼层抽</p>" }), lottery: false },
		// 标题不像在抽 / 送
		{ id: 2208, html: postOf(2208, { extra: "<p>名额有限，回复参与</p>" }), lottery: false },
		// 标题像、正文没写怎么抽
		{ id: 2209, html: postOf(2209, { title: "抽奖送 3 个鸡腿" }), lottery: false },
		// 规则只在引用里
		{ id: 2210, html: postOf(2210, { title: "抽奖送 3 个鸡腿", extra: "<blockquote><p>回复参与，周五开奖</p></blockquote>" }), lottery: false },
		// 复查找出来的误挂：买卖里的附赠、合租、问句、「抽个时间」、标题只是「送 N 台」而正文只有一样对得上
		{ id: 2211, html: postOf(2211, { title: "出 HK 小鸡 送一个月", extra: "<p>有意回复即可，名额只有一个</p>" }), lottery: false },
		{ id: 2212, html: postOf(2212, { title: "转让 Racknerd 送 1U", extra: "<p>按楼层顺序发货</p>" }), lottery: false },
		{ id: 2213, html: postOf(2213, { title: "抽 1 个月 Netflix 合租", extra: "<p>名额 4 个</p>" }), lottery: false },
		{ id: 2214, html: postOf(2214, { title: "今天开奖了吗", extra: "<p>等开奖，看看谁中奖</p>" }), lottery: false },
		{ id: 2215, html: postOf(2215, { title: "抽个时间聊聊", extra: "<p>中奖率这种事</p>" }), lottery: false },
		{ id: 2216, html: postOf(2216, { title: "新用户注册送 5 元余额", extra: "<p>名额有限</p>" }), lottery: false },
		// 标题只是「送 N 台」：正文对上两样（回复参与 + 开奖）就算；「第 N 楼」按楼层送也算
		{ id: 2217, html: postOf(2217, { title: "送 3 台年付小鸡", extra: "<p>回复参与，周五开奖</p>" }), lottery: true }
	];
	const { results, errors } = await visitPosts(cases);
	for (const c of cases) {
		const got = results[c.id];
		// 按文字认的记成 "lottery,text"（以后规则改了、再查不对时能撤掉）
		assert.equal(got.kind, c.lottery ? "lottery,text" : null, `帖子 ${c.id}：${JSON.stringify(got)}`);
		assert.equal(got.badge, c.lottery, `帖子 ${c.id} 标题前的「抽奖」：${JSON.stringify(got)}`);
		assert.equal(got.time, null, `帖子 ${c.id} 没有开奖时间`);
		assert.equal(got.cards, 0, `帖子 ${c.id} 不画倒计时卡片`);
	}
	assert.deepEqual(errors, []);
});

test("v1.9.94 列表后台查帖也认没有开奖链接的文字抽奖帖（只记成抽奖、不记开奖时间），标题是在聊抽奖的、标题不像的不算", async () => {
	const titles = ["抽奖送 3 个鸡腿", "抽奖汇总？", "T楼送一台小鸡", "随便聊聊"];
	const pages = {
		"/post-1000-1": postOf(1000, { title: titles[0], extra: "<p>回复本帖即可参与，周五开奖</p>" }),
		"/post-1001-1": postOf(1001, { title: titles[1], extra: "<p>开奖名单如下</p>" }),
		"/post-1002-1": postOf(1002, { title: titles[2], extra: "<p>按楼层抽，第 50 楼送出</p>" }),
		"/post-1003-1": postOf(1003, { title: titles[3], extra: "<p>周五开奖，名额 3 个</p>" })
	};
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listWithTitles(titles), seed: NO_PREVIEW, viewport: { width: 1440, height: 900 }, pages });
	try {
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return ["1000", "1001", "1002", "1003"].every((id) => id in c); } catch { return false; } }, null, { timeout: 20e3 });
		await wait(page, 300);
		const posts = await json(page, "nsmax:special-posts", {});
		assert.deepEqual({ a: posts["1000"], b: posts["1001"] ?? null, c: posts["1002"], d: posts["1003"] ?? null }, { a: "lottery,text", b: null, c: "lottery,text", d: null });
		const times = await json(page, "nsmax:lottery-times", {});
		assert.equal("1000" in times || "1002" in times, false, "文字抽奖没有开奖时间");
		assert.equal((await json(page, "nsmax:lottery-rows", {}))["1000"]?.t, "抽奖送 3 个鸡腿", "记下列表行，「抽奖」分类里能并进来");
		const badges = await page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item .post-title"), (t) => !!t.querySelector(".nsmax-prize-badge")));
		assert.deepEqual(badges, [true, false, true, false]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.94 悬停预览读到的文字抽奖帖（没有开奖链接）：列表里马上挂上「抽奖」", async () => {
	const titles = ["抽奖送 3 个鸡腿", "求推荐稳定的美西 VPS", "分享一个 Docker 一键部署脚本"];
	const init = `if (window.top === window) localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1000": Date.now(), "1001": Date.now(), "1002": Date.now() }));`;
	const pages = { "/post-1000-1": postOf(1000, { title: titles[0], extra: "<p>回复本帖即可参与，周五开奖</p>" }) };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listWithTitles(titles), viewport: { width: 1440, height: 900 }, pages, init });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		assert.equal(await page.locator(".post-list-item:first-child .nsmax-prize-badge").count(), 0);
		await page.locator(".post-list-item .post-title a").first().hover();
		await page.waitForSelector("dialog.nspp-post-preview article");
		await page.waitForSelector(".post-list-item:first-child .nsmax-prize-badge", { timeout: 3e3 });
		assert.equal((await json(page, "nsmax:special-posts", {}))["1000"], "lottery,text");
		assert.equal((await json(page, "nsmax:lottery-times", {}))["1000"], undefined);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.94 楼主在后面几页评论里（自动接上来的）贴的开奖链接：这一篇也记成抽奖帖，标题前挂上「抽奖」，记下开奖时间和列表行", async () => {
	const future = Date.now() + 2 * 864e5;
	const first = P.postPage().replaceAll("/page-2", "/post-1000-2");
	const second = P.postPage().replace('id="1"', 'id="4"').replace('id="2"', 'id="5"').replace('id="3"', 'id="6"')
		.replaceAll('class="pager-pos pager-cur">1', 'class="pager-pos pager-cur">2').replaceAll('class="pager-next"', 'class="pager-end"')
		.replace('<a href="/space/11" class="author-name">buyer</a>', '<a href="/space/10" class="author-name">seller</a><span class="is-poster role-tag nsk-badge">楼主</span>')
		.replace("收了，私信你", `补一个开奖链接：<a href="/lucky?time=${future}&amp;count=2">开奖页</a>`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: first, viewport: { width: 1280, height: 500 }, pages: { "/post-1000-2": second } });
	try {
		await page.waitForFunction(() => document.readyState === "complete" && "1000" in JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"));
		assert.equal((await json(page, "nsmax:special-posts", {}))["1000"], undefined, "第一页上没有开奖链接");
		await wait(page, 2200);
		await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
		await page.waitForSelector('ul.comments > li[id="4"]', { state: "attached", timeout: 5e3 });
		await page.waitForFunction(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"] === "lottery", null, { timeout: 5e3 });
		await page.waitForSelector('ul.comments > li[id="4"] .nsmax-lottery', { state: "attached", timeout: 5e3 });
		await page.waitForSelector(".nsk-post .post-title .nsmax-prize-badge", { timeout: 3e3 });
		assert.equal((await json(page, "nsmax:lottery-times", {}))["1000"], future);
		assert.ok((await json(page, "nsmax:lottery-rows", {}))["1000"], "记下列表行，「抽奖」分类里能并进来");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.94 发帖不到一天、查过「不是」的帖子记进 nsmax:special-young（发帖时间取自帖子页 date-created）；发了一天以上的不记", async () => {
	const titles = ["随手记一下日常", "Cloudflare Tunnel 踩坑记录", "分享一个 Docker 一键部署脚本"];
	const postAt = new Date(Date.now() - 2 * 36e5);
	postAt.setMilliseconds(0);
	const fresh = postOf(1000, { title: titles[0] }).replace('datetime="2026-10-03T04:00:00.000Z"', `datetime="${postAt.toISOString()}"`);
	const old = postOf(1001, { title: titles[1] }).replace('datetime="2026-10-03T04:00:00.000Z"', `datetime="${new Date(Date.now() - 3 * 864e5).toISOString()}"`);
	const init = `if (window.top === window && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1002": Date.now() })); }`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listWithTitles(titles), seed: NO_PREVIEW, viewport: { width: 1440, height: 900 }, pages: { "/post-1000-1": fresh, "/post-1001-1": old }, init });
	try {
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return "1000" in c && "1001" in c; } catch { return false; } }, null, { timeout: 15e3 });
		await wait(page, 300);
		const young = await json(page, "nsmax:special-young", {});
		assert.deepEqual(young, { "1000": [postAt.getTime(), 0] });
		assert.deepEqual(await json(page, "nsmax:special-posts", {}), {});
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.94 刚发出来就查过「不是」的帖子：过 10 分钟、1 小时、6 小时各再查一次（一页最多 6 篇），楼主后来补上的开奖链接能认出来；还没到点的不查", async () => {
	const titles = Array.from({ length: 9 }, (_, i) => `普通帖子 ${i + 1}`);
	const lucky = postOf(1000, { title: titles[0], extra: '<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=1893456000000&amp;count=1">开奖</a></p>' });
	const pages = Object.fromEntries(titles.map((t, i) => [`/post-${1000 + i}-1`, i === 0 ? lucky : postOf(1000 + i, { title: t })]));
	// 1000–1006：11 分钟前查过、发帖 1 小时、还没再查过（到点了，但一页最多 6 篇）；1007：5 分钟前才查过；1008：已经再查过一次（下一次要过 1 小时）
	const init = `if (window.top === window && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
		const now = Date.now(), checked = {}, young = {};
		for (let i = 0; i < 9; i++) { const id = String(1000 + i); checked[id] = now - (i === 7 ? 5 : 11) * 60e3; young[id] = [now - 36e5, i === 8 ? 1 : 0]; }
		localStorage.setItem("nsmax:special-checked", JSON.stringify(checked)); localStorage.setItem("nsmax:special-young", JSON.stringify(young)); }`;
	const asked = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listWithTitles(titles), seed: NO_PREVIEW, viewport: { width: 1440, height: 900 }, pages, init,
		beforeNavigate: (p) => p.on("request", (request) => { const path = new URL(request.url()).pathname; if (/^\/post-\d+-1$/.test(path)) asked.push(path); }) });
	try {
		await page.waitForFunction(() => JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"] === "lottery", null, { timeout: 15e3 });
		await page.waitForSelector(".post-list-item:first-child .nsmax-prize-badge", { timeout: 3e3 });
		await page.waitForFunction(() => { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return Date.now() - c["1005"] < 60e3; }, null, { timeout: 15e3 });
		await wait(page, 2500);
		assert.deepEqual([...new Set(asked)].sort(), ["/post-1000-1", "/post-1001-1", "/post-1002-1", "/post-1003-1", "/post-1004-1", "/post-1005-1"], "到点的再查一次，一页最多 6 篇：" + asked.join());
		const young = await json(page, "nsmax:special-young", {});
		assert.equal(young["1001"]?.[1], 1, "再查一次还不是：记下查了几次，下一次过 1 小时：" + JSON.stringify(young));
		assert.equal(young["1007"]?.[1], 0, "没到点的不动");
		assert.equal(young["1006"]?.[1], 0, "超出预算的下次再查");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.9.94 「抽奖」分类并入本机记下的抽奖帖：第一页并不比这一页最旧的还旧的、外加还没到开奖时间的（不管多早，标题写了已开奖的除外）；后面几页并编号落在这一页范围里的、不再并还在进行的", async () => {
	const future = Date.now() + 3 * 864e5;
	const row = (t) => ({ t, u: "30", n: "boss", v: "8", r: "2", lu: "", ln: "", th: "", td: "", tt: "", c: "/categories/daily", cn: "日常" });
	const rows = { "1010": row("新的一次"), "900": row("早就开过的一次"), "800": row("很早发的还在进行"), "700": row("【已开奖】很早发的一次"), "530": row("第二页上面一点"), "515": row("第二页范围里还在进行"), "505": row("第二页范围里的一次"), "490": row("第三页的一次") };
	const seed = (extra = "") => `if (window.top === window && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1");
		localStorage.setItem("nsmax:special-posts", JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(rows))}.map((id) => [id, "lottery"]))));
		localStorage.setItem("nsmax:lottery-rows", ${JSON.stringify(JSON.stringify(rows))});
		localStorage.setItem("nsmax:lottery-times", JSON.stringify({ "800": ${future}, "700": ${future}, "515": ${future}, "900": Date.now() - 864e5 }));
		localStorage.setItem("nsmax:special-checked", JSON.stringify(Object.fromEntries(["1000", "1001", "1002", "520", "510", "500", ...${JSON.stringify(Object.keys(rows))}].map((id) => [id, Date.now()]))));
		localStorage.setItem("nsmax:lottery-index-at", String(Date.now())); ${extra} }`;
	const merged = (page) => page.evaluate(() => Array.from(document.querySelectorAll("#nsk-body-left ul.post-list > li[data-nsmax-lottery-merged]"), (li) => [li.querySelector(".post-title a").getAttribute("href"), li.getAttribute("data-nsmax-lottery")]));
	const settle = async (page) => { await page.waitForFunction(() => document.readyState === "complete" && document.documentElement.hasAttribute("data-nsmax-lottery-view")); await wait(page, 800); };
	// 第一页：这一页是 1000–1002
	const one = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { html: P.searchPage({ count: 3 }), viewport: { width: 1280, height: 900 }, init: seed() });
	try {
		await settle(one.page);
		// 1010 在这一页范围里；800、515 很早发的但还没到开奖时间；900 过了开奖时间、700 标题写了已开奖、490 太旧，都不并
		assert.deepEqual(await merged(one.page), [["/post-1010-1", "yes"], ["/post-800-1", "yes"], ["/post-515-1", "yes"]]);
		assert.deepEqual(one.errors, []);
	} finally { await one.context.close(); }
	// 第二页：这一页是 520、510、500
	const ids = { 1000: 520, 1001: 510, 1002: 500 };
	const second = P.searchPage({ count: 3 }).replace(/\/post-(10\d\d)-1/g, (m, id) => `/post-${ids[id]}-1`).replaceAll('class="pager-pos pager-cur">1</span>', 'class="pager-pos pager-cur">2</span>');
	// 直接打开第二页（没翻过第一页）：上界是这一页最新那篇
	const two = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96&page=2", { html: second, viewport: { width: 1280, height: 900 }, init: seed() });
	try {
		await settle(two.page);
		assert.deepEqual(await merged(two.page), [["/post-505-1", "yes"]], "530 比这一页最新的还新，515 还在进行（第一页已经放了）");
		// 从第一页翻过来（第一页最旧的是 600）：上界是 600
		await two.page.evaluate(() => sessionStorage.setItem("nsmax:lottery-page-floors", JSON.stringify({ ...JSON.parse(sessionStorage.getItem("nsmax:lottery-page-floors") || "{}"), 1: 600 })));
		await two.page.reload({ waitUntil: "domcontentloaded" });
		await settle(two.page);
		assert.deepEqual(await merged(two.page), [["/post-530-1", "yes"], ["/post-505-1", "yes"]]);
		assert.deepEqual(await two.page.evaluate(() => Array.from(document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item .post-title a"), (a) => a.getAttribute("href"))), ["/post-530-1", "/post-520-1", "/post-510-1", "/post-505-1", "/post-500-1"], "按编号插进去");
		assert.deepEqual(two.errors, []);
	} finally { await two.context.close(); }
});

test("v1.9.94 后台取帖子页贴着限流走、各标签页共用一个配额（标准每 10 秒 15 篇起、均匀发、最多先连着 3 篇；每 10 秒的篇数记在本机，没被限流慢慢往上调，最多 18）", async () => {
	const pages = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`/post-${1000 + i}-1`, postOf(1000 + i)]));
	const run = async (seedRate) => {
		const starts = [];
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
			html: P.searchPage({ count: 16 }), seed: NO_PREVIEW, viewport: { width: 1280, height: 900 }, pages,
			init: `if (window.top === window) { localStorage.setItem("nsmax:lottery-index-at", String(Date.now())); ${seedRate ? `localStorage.setItem("nsmax:bg-rate", JSON.stringify({ n: ${seedRate}, at: Date.now() }));` : ""} }`,
			beforeNavigate: (p) => p.on("request", (request) => { if (/^\/post-\d+-1$/.test(new URL(request.url()).pathname)) starts.push(Date.now()); })
		});
		try {
			await page.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}")).length >= 16; } catch { return false; } }, null, { timeout: 60e3 });
			assert.equal(starts.length, 16, "每篇取一次");
			const rate = await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:bg-rate") || "null"));
			assert.ok(await page.evaluate(() => Number(localStorage.getItem("nsmax:bg-tat")) > Date.now() - 2e3), "配额记在 localStorage nsmax:bg-tat（各标签页共用）");
			assert.deepEqual(errors, []);
			return { gaps: starts.slice(1).map((at, i) => at - starts[i]), total: starts[15] - starts[0], rate };
		} finally { await context.close(); }
	};
	// 没记过：每 10 秒 15 篇 → 每篇约 667ms；前 3 篇只隔着扫描通道自己的 150ms
	const first = await run(0);
	assert.equal(first.rate?.n, 15, "起步每 10 秒 15 篇，记在本机：" + JSON.stringify(first.rate));
	for (const gap of first.gaps.slice(3)) assert.ok(gap >= 600, "连着的 3 篇以后均匀隔开约 667ms：" + first.gaps.join());
	assert.ok(first.gaps[0] < 500 && first.gaps[1] < 500, "前 3 篇连着取：" + first.gaps.join());
	assert.ok(first.total < 12e3, "16 篇十来秒取完（以前每 1.1 秒一篇要 15 秒以上）：" + first.total);
	// 没被限流、已经调到最多的每 10 秒 18 篇：每篇约 556ms（记下的数比上限大也按 18 算）
	const fast = await run(25);
	for (const gap of fast.gaps.slice(3)) assert.ok(gap >= 500 && gap < 640, "每 10 秒 18 篇时每篇约 556ms：" + fast.gaps.join());
});

test("v1.9.94 按文字认的抽奖帖记成 \"lottery,text\"：再打开时规则已经不认了就撤掉（按开奖链接认的不动）；开奖时间写成日期（time=2026-11-28）的不当成 1970 年", async () => {
	const init = `if (window.top === window) localStorage.setItem("nsmax:special-posts", JSON.stringify({ "2301": "lottery,text", "2302": "lottery", "2303": "lottery,text" }));`;
	const cases = [
		// 以前按文字认成抽奖的「出鸡送一个月」：这次再看不算了 → 撤掉
		{ id: 2301, html: postOf(2301, { title: "出 HK 小鸡 送一个月", extra: "<p>有意回复即可，名额只有一个</p>" }) },
		// 按开奖链接认的：不动
		{ id: 2302, html: postOf(2302, { extra: '<p><a href="https://www.nodeseek.com/lucky?post=2302&amp;count=1">开奖页</a></p>' }) },
		// 后来补上了开奖链接：去掉 text，留下 lottery
		{ id: 2303, html: postOf(2303, { title: "抽奖送 3 个鸡腿", extra: `<p><a href="https://www.nodeseek.com/lucky?post=2303&amp;time=${Date.now() + 864e5}&amp;count=1">开奖页</a></p>` }) },
		{ id: 2304, html: postOf(2304, { extra: '<p><a href="https://www.nodeseek.com/lucky?post=2304&amp;time=2026-11-28%2020:00&amp;count=1">开奖页</a></p>' }) }
	];
	const { results, errors } = await visitPosts(cases, undefined, init);
	assert.equal(results[2301].kind, null, JSON.stringify(results[2301]));
	assert.equal(results[2301].badge, false);
	assert.equal(results[2302].kind, "lottery");
	assert.equal(results[2303].kind, "lottery");
	assert.ok(results[2303].time > Date.now());
	assert.equal(results[2304].kind, "lottery", "参数不全也算抽奖帖");
	assert.equal(results[2304].time, null, "日期写法不当成毫秒时间戳");
	assert.equal(results[2304].ended, false);
	assert.equal(results[2304].badgeEnded, false, "不显示成已结束");
	assert.deepEqual(errors, []);
});
