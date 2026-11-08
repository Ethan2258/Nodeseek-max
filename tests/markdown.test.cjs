"use strict";
// 2026-11-08 正文排版和看大图重做：代码块标题栏、标题分级、引用、表格按内容宽；看图的张数、原图、左右翻页、缩放比例、缩略图条
const test = require("node:test"), assert = require("node:assert/strict");
const { devices } = require("playwright"), { launch, open } = require("./harness.cjs"), P = require("./fixtures/pages.cjs");
const ready = (p) => p.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length && !document.documentElement.hasAttribute("data-nsmax-mounting"));
const pic = (w, h, color) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`);
const body = `<h1>一级</h1><p>段落</p><h2>二级</h2><h3>三级</h3><h4>四级</h4><blockquote><p>引用</p></blockquote>
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
				return {
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
