"use strict";
// 2026-11-08 正文排版和看大图重做：代码块标题栏、标题分级、引用、表格按内容宽；看图的张数、原图、左右翻页、缩放比例、缩略图条
const test = require("node:test"), assert = require("node:assert/strict");
const { devices } = require("playwright"), { launch, open } = require("./harness.cjs"), P = require("./fixtures/pages.cjs");
const ready = (p) => p.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length && !document.documentElement.hasAttribute("data-nsmax-mounting"));
const pic = (w, h, color) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`);
const body = `<h1>一级</h1><p id="nsmax-del-probe">段落 <del>删掉的话</del> <strong>加粗</strong></p><h2>二级</h2><h3>三级</h3><h4>四级</h4><blockquote><p>引用</p></blockquote>
<pre><code class="language-bash">@Impart_VIP_Bot</code></pre><pre><code>no language</code></pre>
<table><thead><tr><th>套餐</th><th>价格</th></tr></thead><tbody><tr><td>1C1G</td><td>¥99/年</td></tr></tbody></table>
<p><img class="sticker" src="${pic(40, 40, "#f59e0b")}" alt="表情"> <img src="/nsmax-missing-image.png" alt="坏图"> <img src="${pic(1600, 1000, "#4f7cff")}" alt="第一张" width="320" height="200"> <img src="${pic(900, 1400, "#22c55e")}" alt="第二张" width="200" height="300"></p>`;
const html = (options) => P.postPage(options).replace("</article>", body + "</article>");
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });

test("正文：代码块顶上是标题栏（语言名 + 常显的「复制」），一行代码不再空出一大块；标题一级比一级小；引用有底色；表格按内容宽", async () => {
	for (const colorScheme of ["light", "dark"]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html({ dark: colorScheme === "dark" }), colorScheme, viewport: { width: 1440, height: 900 } });
		try {
			await ready(page);
			await page.waitForSelector(".nsk-post .nsmax-code > [data-nspp-copy]");
			const s = await page.evaluate(() => {
				const art = document.querySelector(".nsk-post article.post-content");
				const [bash, plain] = [...art.querySelectorAll(".nsmax-code")].slice(-2);
				const r = (el) => el.getBoundingClientRect();
				const pre = bash.querySelector("pre"), copy = bash.querySelector("[data-nspp-copy]"), code = pre.querySelector("code");
				const head = getComputedStyle(bash, "::before");
				const size = (sel) => parseFloat(getComputedStyle(art.querySelector(sel)).fontSize);
				const quote = getComputedStyle(art.querySelector("blockquote"));
				const probe = art.querySelector("#nsmax-del-probe");
				const del = getComputedStyle(probe.querySelector("del")), para = getComputedStyle(probe);
				return {
					del: [del.color === para.color, del.textDecorationLine, getComputedStyle(probe.querySelector("strong")).color === para.color],
					labels: [bash.getAttribute("data-nsmax-lang"), plain.getAttribute("data-nsmax-lang")],
					head: [head.content, head.height],
					copyOpacity: getComputedStyle(copy).opacity,
					copyAbovePre: r(copy).bottom <= r(pre).top + 0.5 && r(copy).top >= r(bash).top,
					// 一行代码：外框高 = 1 + 36 标题栏 + 12 + 一行 + 12 + 1，不再是 38px 空条再加一行
					oneLine: Math.round(r(bash).height - r(code).height),
					sizes: ["h1", "h2", "h3", "h4"].map(size),
					quote: [quote.borderLeftWidth, quote.backgroundColor !== "rgba(0, 0, 0, 0)"],
					table: r(art.querySelector("table")).width < r(art).width / 2
				};
			});
			assert.deepEqual(s.del, [true, "line-through", true], "删除线和加粗只改线和字重，字色跟正文一样");
			assert.deepEqual(s.labels, ["Bash", "代码"]);
			assert.equal(s.head[1], "36px", "标题栏 36px");
			assert.notEqual(s.head[0], "none", "标题栏有内容");
			assert.equal(s.copyOpacity, "1", "「复制」常显");
			assert.ok(s.copyAbovePre, "「复制」在标题栏里，不压代码");
			assert.ok(s.oneLine <= 64, `一行代码的外框只多出标题栏和上下留白：${s.oneLine}`);
			assert.ok(s.sizes[0] > s.sizes[1] && s.sizes[1] > s.sizes[2] && s.sizes[2] > s.sizes[3], `标题一级比一级小：${s.sizes}`);
			assert.deepEqual(s.quote, ["3px", true]);
			assert.ok(s.table, "两列小表格按内容宽");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("看大图：图集只收正文配图（表情包、裂图不算），左上张数和尺寸、右上「原图」和关闭；电脑上左右大箭头翻页，工具栏有缩放比例（点了切原始大小），缩略图条没有黑底；图片不压顶栏", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(), viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		await page.locator(".nsk-post article.post-content img[alt='第一张']").click();
		await page.waitForSelector("dialog.nspp-image-preview .viewer-canvas img");
		await page.waitForFunction(() => /^1 \/ 2/.test(document.querySelector(".nspp-image-preview .viewer-title")?.textContent || ""));
		await page.waitForTimeout(400);
		const read = () => page.evaluate(() => {
			const d = document.querySelector("dialog.nspp-image-preview");
			const r = (el) => el.getBoundingClientRect();
			const title = d.querySelector(".viewer-title"), link = d.querySelector(".nsmax-viewer-open"), img = d.querySelector(".viewer-canvas img");
			const next = d.querySelector(".viewer-navigation .viewer-next");
			return {
				title: title.textContent,
				link: !!link && link.target === "_blank" && link.href === img.src,
				zoom: d.querySelector(".viewer-toolbar .nsmax-viewer-zoom")?.textContent,
				toolbarArrows: d.querySelectorAll('.viewer-toolbar [data-viewer-action="next"]').length,
				side: !!next && next.getClientRects().length > 0 && r(next).width >= 48 && next.getAttribute("aria-label") === "下一张",
				navbar: getComputedStyle(d.querySelector(".viewer-navbar")).backgroundColor,
				belowTop: r(img).top >= r(title).bottom + 8
			};
		});
		const s = await read();
		assert.match(s.title, /^1 \/ 2　·　1600 × 1000$/);
		assert.equal(s.link, true, "「原图」新标签页打开当前这张");
		assert.match(s.zoom, /^\d+%$/);
		assert.equal(s.toolbarArrows, 0, "电脑上翻页在左右两边，不在工具栏");
		assert.equal(s.side, true);
		assert.equal(s.navbar, "rgba(0, 0, 0, 0)", "缩略图条没有黑底");
		assert.equal(s.belowTop, true, "图片在张数那一行下面");
		await page.locator(".nspp-image-preview .nsmax-viewer-zoom").click();
		await page.waitForFunction(() => document.querySelector(".nspp-image-preview .nsmax-viewer-zoom")?.textContent === "100%");
		await page.locator(".nspp-image-preview .viewer-navigation .viewer-next").click();
		await page.waitForFunction(() => /^2 \/ 2　·　900 × 1400$/.test(document.querySelector(".nspp-image-preview .viewer-title")?.textContent || ""));
		await page.keyboard.press("Escape");
		await page.waitForSelector("dialog.nspp-image-preview", { state: "detached" });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-11-20 看大图更顺：从帖子里那张图放大出来、Esc 缩回去；滚轮按滚动量缩放（触控板一抹不再飞到几百倍），比例实时跟着变；长截图按宽度铺开从顶上看、滚轮上下滚；遮罩不用毛玻璃", async () => {
	const tallBody = `<p><img src="${pic(1600, 1000, "#4f7cff")}" alt="横图" width="320" height="200"></p><p><img src="${pic(1080, 6000, "#94a3b8")}" alt="长图" width="200" height="1111"></p>`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: P.postPage().replace("</article>", tallBody + "</article>"), viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		const thumb = await page.locator(".nsk-post article.post-content img[alt='横图']").boundingBox();
		await page.evaluate(() => {
			window.__first = null;
			const tick = () => {
				const img = document.querySelector("dialog.nspp-image-preview .viewer-canvas img");
				if (img && img.getBoundingClientRect().width) window.__first = img.getBoundingClientRect().toJSON();
				else requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		await page.locator(".nsk-post article.post-content img[alt='横图']").click();
		await page.waitForFunction(() => window.__first);
		const first = await page.evaluate(() => window.__first);
		assert.ok(Math.abs(first.width - thumb.width) < thumb.width * .35, `第一帧接近缩略图大小：${first.width} vs ${thumb.width}`);
		await page.waitForTimeout(450);
		const read = () => page.evaluate(() => {
			const d = document.querySelector("dialog.nspp-image-preview"), img = d.querySelector(".viewer-canvas img"), r = img.getBoundingClientRect();
			return { x: r.x, y: r.y, w: r.width, h: r.height, zoom: d.querySelector(".nsmax-viewer-zoom").textContent, ratio: Math.round(r.width / 16) + "%" };
		});
		const fit = await read();
		assert.ok(fit.w > 900 && fit.y >= 72, `横图铺开在顶栏下面：${JSON.stringify(fit)}`);
		assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("dialog.nspp-image-preview"), "::backdrop").backdropFilter), "none", "遮罩不用毛玻璃（大页面上每一帧都要重算模糊）");
		await page.mouse.move(720, 400);
		for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -4);
		await page.waitForTimeout(100);
		const pad = await read();
		assert.ok(pad.w / fit.w > 1.1 && pad.w / fit.w < 1.5, `触控板细滚 30 下只放大一点：${fit.w} → ${pad.w}`);
		assert.equal(pad.zoom, pad.ratio, "比例跟着实际大小走");
		await page.locator(".nspp-image-preview .viewer-toolbar [data-viewer-action=reset]").click();
		await page.waitForTimeout(350);
		const back = await read();
		assert.equal(back.zoom, back.ratio, "「适应窗口」后比例也对");
		assert.ok(Math.abs(back.w - fit.w) < 1, "回到铺开的大小");
		await page.keyboard.press("ArrowRight");
		await page.waitForFunction(() => /^2 \/ 2/.test(document.querySelector(".nspp-image-preview .viewer-title")?.textContent || ""));
		await page.waitForTimeout(250);
		const tall = await page.evaluate(() => document.querySelector("dialog.nspp-image-preview .viewer-canvas img").getBoundingClientRect().toJSON());
		assert.ok(tall.width >= 700 && tall.width <= 880 && Math.round(tall.y) === 72, `长图按宽度铺开、顶端在顶栏下面：${JSON.stringify(tall)}`);
		for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 100);
		await page.waitForTimeout(100);
		const scrolled = await page.evaluate(() => document.querySelector("dialog.nspp-image-preview .viewer-canvas img").getBoundingClientRect().toJSON());
		assert.ok(Math.abs(scrolled.y - (tall.y - 300)) < 1 && scrolled.width === tall.width, `长图滚轮往下滚、不缩放：${tall.y} → ${scrolled.y}`);
		await page.keyboard.press("Escape");
		await page.waitForTimeout(60);
		assert.equal(await page.locator("dialog.nspp-image-preview").count(), 1, "Esc 后先播关闭动画");
		await page.waitForSelector("dialog.nspp-image-preview", { state: "detached", timeout: 1e3 });
		assert.equal(await page.evaluate(() => document.documentElement.classList.contains("nsmax-viewing")), false);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-11-21 看大图收回不闪：主题的弹窗进场动画不套在看图层上；缩回去时帖子里那张图先藏起来（同时只露一张），落地后再露出来；遮罩跟大图同时淡完", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(), viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		const thumb = page.locator(".nsk-post article.post-content img[alt='第一张']");
		await thumb.click();
		await page.waitForSelector("dialog.nspp-image-preview .viewer-canvas img");
		await page.waitForTimeout(500);
		assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("dialog.nspp-image-preview")).animationName), "none", "看图层整层不再淡入、下移");
		assert.equal(await thumb.evaluate((el) => getComputedStyle(el).visibility), "visible", "打开动画结束后原图露出来（在遮罩下面）");
		await page.mouse.click(120, 200);
		await page.waitForTimeout(80);
		const mid = await page.evaluate(() => ({
			thumb: getComputedStyle(document.querySelector(".nsk-post article.post-content img[alt='第一张']")).visibility,
			backdrop: Number(getComputedStyle(document.querySelector("dialog.nspp-image-preview"), "::backdrop").opacity)
		}));
		assert.equal(mid.thumb, "hidden", "缩回去的过程中原图藏着，不叠两张");
		assert.ok(mid.backdrop > .05 && mid.backdrop < 1, `遮罩在淡出：${mid.backdrop}`);
		await page.waitForSelector("dialog.nspp-image-preview", { state: "detached", timeout: 1500 });
		assert.equal(await thumb.evaluate((el) => getComputedStyle(el).visibility), "visible", "落地后原图露出来");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("手机：代码块标题栏 44px，「复制」触控区就是标题栏；看大图翻页还在工具栏（44px），张数和原图在顶上", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(), viewport: { width: 390, height: 844 }, device: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } });
	try {
		await ready(page);
		await page.waitForSelector(".nsk-post .nsmax-code > [data-nspp-copy]");
		const code = await page.evaluate(() => {
			const wrap = document.querySelector(".nsk-post .nsmax-code"), pre = wrap.querySelector("pre"), copy = wrap.querySelector("[data-nspp-copy]");
			const r = (el) => el.getBoundingClientRect();
			return { head: getComputedStyle(wrap, "::before").height, copy: r(copy).height, inHead: r(copy).bottom <= r(pre).top + 0.5, pad: getComputedStyle(pre).paddingTop };
		});
		assert.deepEqual(code, { head: "44px", copy: 44, inHead: true, pad: "12px" });
		await page.locator(".nsk-post article.post-content img[alt='第一张']").tap();
		await page.waitForSelector("dialog.nspp-image-preview .viewer-canvas img");
		await page.waitForTimeout(300);
		const v = await page.evaluate(() => {
			const d = document.querySelector("dialog.nspp-image-preview"), r = (el) => el.getBoundingClientRect();
			const next = d.querySelector('.viewer-toolbar [data-viewer-action="next"]'), close = d.querySelector(".viewer-button"), link = d.querySelector(".nsmax-viewer-open"), title = d.querySelector(".viewer-title");
			return { next: r(next).height, close: r(close).height, sideHidden: !d.querySelector(".viewer-navigation")?.getClientRects().length, apart: r(link).right <= r(close).left && r(title).right <= r(link).left };
		});
		assert.deepEqual(v, { next: 44, close: 44, sideHidden: true, apart: true });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-11-23 电脑端阅读舒适度：无序列表里套有序列表时数字上不再叠站点的「•」；表格有一格长内容时别的列不被挤成「280Mb / ps」「正 / 常」；
// 段落照旧占满整列（2026-11-23 Yiheng 选「保持占满整列」，不限 750px）
test("2026-11-23 电脑端正文：嵌套有序列表没有多余圆点；表格短格子不从词中间断开；段落和代码块都占整栏", async () => {
	const hash = "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a089f86d081884c7d659a2feaa0c55ad015";
	const long = "说一下这台机器的情况：香港 CN2 GIA 线路，晚高峰到电信移动联通三网延迟都在 40ms 左右，基本不丢包。".repeat(4);
	const extra = `<p id="nsmax-long-p">${long}</p><ul><li>一<ol><li id="nsmax-nested-ol">有序</li></ol></li></ul>
<table id="nsmax-wide-table"><thead><tr>${["地区", "线路", "延迟", "丢包", "上行", "下行", "晚高峰", "备注"].map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody><tr>${["上海电信", "CN2 GIA", "32ms", "0%", "280Mbps", "300Mbps", "正常", hash].map((t) => `<td>${t}</td>`).join("")}</tr></tbody></table>`;
	const page1 = (options) => P.postPage(options).replace("</article>", extra + "</article>");
	// 按 Windows 微软雅黑 UI 的度量量（同 glyph-align.test.cjs）：测试机默认的西文字体比雅黑宽一截
	const css = `@font-face{font-family:"FakeUI";src:local("WenQuanYi Zen Hei");ascent-override:101.56%;descent-override:25.44%}
html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*):is(#x,#y,#z,*), html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*) body:is(#x,#y,#z,*) { --font-sans: "FakeUI", sans-serif !important; }`;
	for (const width of [1280, 1767]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: page1({ dark: true }), css, colorScheme: "dark", viewport: { width, height: 1000 } });
		try {
			await ready(page);
			await page.evaluate(() => document.fonts.load('14px "FakeUI"', "国"));
			await page.waitForTimeout(300);
			const s = await page.evaluate(() => {
				const art = document.querySelector(".nsk-post article.post-content");
				const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top))).size; };
				const table = document.getElementById("nsmax-wide-table");
				const cells = [...table.querySelectorAll("tbody td, thead th")].slice(0, 15).filter((c) => c.textContent.length < 12);
				return {
					bullet: getComputedStyle(document.getElementById("nsmax-nested-ol"), "::before").content,
					broken: cells.filter((c) => lines(c) > 1 && !/\s/.test(c.textContent.trim())).map((c) => c.textContent),
					tableInside: table.getBoundingClientRect().right <= art.getBoundingClientRect().right + 1,
					article: art.getBoundingClientRect().width,
					para: document.getElementById("nsmax-long-p").getBoundingClientRect().width,
					code: art.querySelector(".nsmax-code, pre").getBoundingClientRect().width
				};
			});
			assert.equal(s.bullet, "none", "有序列表的数字上不叠「•」");
			assert.deepEqual(s.broken, [], `${width}：短格子不从中间断开`);
			assert.ok(s.tableInside, "表格不超出正文");
			assert.ok(s.para >= s.article - 1, `${width}：段落占满整列 ${s.para} / ${s.article}`);
			if (s.article > 760) assert.ok(s.code > 760, `${width}：代码块占整栏（${s.code} / ${s.article}）`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 个人主页「介绍」也带站点 .post-content：无序列表里的有序列表照样是 1. 2.，不是「•」
	const readme = "<ul><li>常用系统<ol><li id=\"nsmax-readme-ol\">第一步</li></ol></li></ul>";
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10#/general", { html: P.spaceGeneralPage(readme), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("#nsmax-readme-ol");
		await ready(page);
		const li = await page.evaluate(() => { const el = document.getElementById("nsmax-readme-ol"); return [getComputedStyle(el).listStyleType, getComputedStyle(el, "::before").content]; });
		assert.deepEqual(li, ["decimal", "none"], "介绍里嵌套的有序列表");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
