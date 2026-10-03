"use strict";
// 冒烟测试：node --test tests/  （需要 playwright 与 Chromium）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launch, open, ROOT } = require("./harness.cjs");
const { listPage, postPage, notificationPage, messageCenterPage, settingPage, newPostPage } = require("./fixtures/pages.cjs");

const SHOTS = process.env.NSMAX_SCREENSHOTS;
let browser;

test.before(async () => {
	browser = await launch();
});
test.after(async () => {
	await browser?.close();
});

const settle = (page, ms = 600) => page.waitForTimeout(ms);
// 设计风格选 sb.sb：沿用原有的 sb.sb 断言，确认切回 sb.sb 风格时外观不变（默认 Claude 风格另有测试）。
const SBSB = { "nspp:settings:www.nodeseek.com": { "modern-theme": { palette: "sbsb" } } };
const shot = async (page, name) => {
	if (!SHOTS) return;
	fs.mkdirSync(SHOTS, { recursive: true });
	await page.evaluate(() => {
		const toast = document.getElementById("nspp-settings")?.shadowRoot?.querySelector(".toast");
		toast?.hidePopover?.();
		toast?.setAttribute("hidden", "");
	});
	await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
};

test("外链跳转：知乎中转页直达目标地址", async () => {
	const { context, page, errors } = await open(browser, "https://link.zhihu.com/?target=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1");
	await page.waitForURL("https://example.com/path?a=1", { timeout: 5e3 });
	assert.deepEqual(errors, []);
	await context.close();
});

test("外链跳转：NodeSeek /jump 展开嵌套跳转", async () => {
	const { context, page } = await open(browser, "https://www.nodeseek.com/jump?to=%2Fjump%3Fto%3Dhttps%253A%252F%252Fexample.org%252F", { html: "<!doctype html><title>jump</title>" });
	await page.waitForURL("https://example.org/", { timeout: 5e3 });
	await context.close();
});

test("外链跳转：关闭「外链直达」后 NodeSeek /jump 不跳转", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "reading-content": { enabled: true, cleanLinks: false } } };
	const { context, page } = await open(browser, "https://www.nodeseek.com/jump?to=https%3A%2F%2Fexample.org%2F", { html: "<!doctype html><title>jump</title><p>jump page</p>", seed });
	await settle(page, 800);
	assert.equal(new URL(page.url()).hostname, "www.nodeseek.com");
	await context.close();
});

test("首页：主题在渲染前生效，侧栏热榜与工具栏正常，无报错", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage(), viewport: { width: 1440, height: 900 } });
	const early = await page.evaluate(() => ({
		theme: document.documentElement.hasAttribute("data-nsmax-theme"),
		accent: document.documentElement.dataset.nsmaxAccent,
		page: document.documentElement.dataset.nsmaxPage
	}));
	assert.deepEqual(early, { theme: true, accent: "mono", page: "list" });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	const hot = await page.evaluate(() => {
		const panel = document.querySelector(".nsmax-hot-panel");
		return {
			beforeQuickAccess: panel.nextElementSibling?.classList.contains("quick-access"),
			rows: panel.querySelectorAll(".nsmax-hot-list li").length,
			toggle: panel.querySelector(".nsmax-hot-toggle").textContent,
			canvas: getComputedStyle(document.body).backgroundColor,
			layout: document.documentElement.dataset.nsmaxList,
			rowRadius: getComputedStyle(document.querySelector(".post-list-item")).borderTopLeftRadius,
			grid: getComputedStyle(document.body).backgroundImage,
			header: document.querySelector("#nsk-head").hasAttribute("data-nsmax-header"),
			sticky: getComputedStyle(document.querySelector("#nsk-head")).position,
			tools: !!document.getElementById("nspp-tools"),
			settingsGlass: document.getElementById("nspp-settings")?.hasAttribute("data-nsmax-glass")
		};
	});
	assert.equal(hot.beforeQuickAccess, true);
	assert.equal(hot.rows, 10);
	assert.equal(hot.toggle, "展开全部 15");
	assert.equal(hot.canvas, "rgb(247, 248, 250)");
	assert.equal(hot.layout, "rows");
	assert.equal(hot.rowRadius, "0px");
	assert.equal(hot.grid, "none");
	assert.equal(hot.header, true);
	assert.equal(hot.sticky, "sticky");
	assert.equal(hot.tools, true);
	assert.equal(hot.settingsGlass, true);
	await page.waitForSelector("[data-nsmax-cta]", { timeout: 5e3 });
	const card = await page.evaluate(() => ({
		stat: getComputedStyle(document.querySelector(".user-stat")).backgroundColor,
		cta: getComputedStyle(document.querySelector("[data-nsmax-cta]"), "::before").backgroundColor,
		badge: getComputedStyle(document.querySelector(".notify-count")).backgroundColor,
		quickReply: Array.from(document.querySelectorAll("button, a")).some((element) => element.textContent.trim() === "快速回复"),
		ai: !!document.querySelector("[data-nspp-ai-launcher]"),
		readTitle: (() => {
			const title = document.querySelector(".post-list-item .post-title a");
			title.classList.add("nspp-read");
			return getComputedStyle(title).opacity;
		})(),
		headerBlur: getComputedStyle(document.querySelector("[data-nsmax-header]"), "::before").backdropFilter,
		toolsBlur: getComputedStyle(document.getElementById("nspp-tools")).backdropFilter
	}));
	assert.equal(card.stat, "rgb(250, 251, 252)");
	assert.equal(card.cta, "rgb(28, 28, 30)");
	assert.equal(card.badge, "rgb(28, 28, 30)");
	assert.equal(card.quickReply, false);
	assert.equal(card.ai, false);
	assert.equal(card.readTitle, "0.6");
	assert.equal(card.headerBlur, "none");
	assert.equal(card.toolsBlur, "none");
	// 悬浮工具栏停靠到内容区外侧，不再压住右侧栏。
	const overlap = await page.evaluate(() => {
		const tools = document.getElementById("nspp-tools").getBoundingClientRect();
		const sidebar = document.getElementById("nsk-right-panel-container").getBoundingClientRect();
		return tools.left < sidebar.right && tools.right > sidebar.left;
	});
	assert.equal(overlap, false);
	await page.click(".nsmax-hot-toggle");
	assert.equal(await page.locator(".nsmax-hot-panel .nsmax-hot-list li").count(), 15);
	await page.click(".nsmax-hot-toggle");
	await page.click(".nsmax-hot-tabs button[data-ranking=daily]");
	await page.waitForFunction(() => document.querySelector(".nsmax-hot-text")?.textContent.startsWith("日榜"));
	await page.click(".nsmax-hot-tabs button[data-ranking=hot]");
	await settle(page, 700);
	await shot(page, "list-light");
	// 工具栏热榜弹窗与侧栏共用缓存：打开弹窗不应再次请求实时榜。
	const before = await page.evaluate(() => window.__gmRequests.filter((url) => url.includes("/hot.json")).length);
	await page.click("[data-nspp-hot-launcher]");
	await page.waitForSelector(".nspp-hot-rankings[open] ol li");
	const after = await page.evaluate(() => window.__gmRequests.filter((url) => url.includes("/hot.json")).length);
	assert.equal(after, before);
	await page.keyboard.press("Escape");
	assert.deepEqual(errors, []);
	await context.close();
});

test("帖子页：卡片、正文排版、阅读进度条与侧栏热榜", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	const info = await page.evaluate(() => ({
		page: document.documentElement.dataset.nsmaxPage,
		progress: !!document.getElementById("nsmax-progress"),
		commentDivider: getComputedStyle(document.querySelector("ul.comments > li.content-item")).borderBottomStyle,
		lineHeight: getComputedStyle(document.querySelector(".nsk-post .post-content")).lineHeight,
		floorPill: getComputedStyle(document.querySelector("a.floor-link")).backgroundColor,
		cleanLink: document.querySelector(".post-content a").getAttribute("href"),
		hotInSidebar: !!document.querySelector("#nsk-right-panel-container .nsmax-hot-panel"),
		titleOpacity: (() => {
			const title = document.querySelector(".nsk-post-wrapper .post-title a");
			title.classList.add("nspp-read");
			return getComputedStyle(title).opacity;
		})()
	}));
	assert.equal(info.titleOpacity, "1");
	assert.equal(info.page, "post");
	assert.equal(info.progress, true);
	assert.equal(info.commentDivider, "solid");
	assert.notEqual(info.lineHeight, "normal");
	assert.equal(info.floorPill, "rgba(0, 0, 0, 0)");
	assert.equal(info.cleanLink, "https://example.com/docs");
	assert.equal(info.hotInSidebar, true);
	await settle(page, 700);
	await shot(page, "post-light");
	await page.evaluate(() => window.scrollTo(0, 400));
	await settle(page, 300);
	const scaled = await page.evaluate(() => getComputedStyle(document.getElementById("nsmax-progress")).transform);
	assert.notEqual(scaled, "none");
	assert.deepEqual(errors, []);
	await context.close();
});

test("帖子页（深色）：主题跟随站点深色模式", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { seed: SBSB, html: postPage({ dark: true }), colorScheme: "dark" });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	const colors = await page.evaluate(() => ({
		canvas: getComputedStyle(document.body).backgroundColor,
		text: getComputedStyle(document.body).color
	}));
	assert.equal(colors.canvas, "rgb(13, 14, 20)");
	assert.equal(colors.text, "rgb(231, 232, 239)");
	await settle(page, 700);
	await shot(page, "post-dark");
	assert.deepEqual(errors, []);
	await context.close();
});

test("主题可关闭：关闭后不注入任何主题属性", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: false } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	await settle(page, 500);
	const state = await page.evaluate(() => ({
		theme: document.documentElement.hasAttribute("data-nsmax-theme"),
		header: !!document.querySelector("[data-nsmax-header]")
	}));
	assert.deepEqual(state, { theme: false, header: false });
	assert.deepEqual(errors, []);
	await context.close();
});

test("字体：伪造的字体数据会被签名与哈希校验拒绝", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await settle(page, 800);
	const state = await page.evaluate(() => ({
		requested: window.__gmRequests.filter((url) => url.startsWith("https://cdn.jsdelivr.net/")).length,
		cached: Object.keys(localStorage).filter((key) => key.startsWith("__gm__:nsmax:font:") && localStorage.getItem(key) !== "\"\"").length,
		families: Array.from(document.fonts, (face) => face.family)
	}));
	assert.equal(state.requested, 2);
	assert.equal(state.cached, 0);
	assert.ok(!state.families.some((family) => /Inter Variable/.test(family)));
	assert.deepEqual(errors, []);
	await context.close();
});

test("字体：真实字体校验通过后缓存，下次直接从本地注册不再联网", { skip: !process.env.NSMAX_FONT_DIR && "设置 NSMAX_FONT_DIR 指向 @fontsource-variable 字体文件目录以运行" }, async () => {
	const dir = process.env.NSMAX_FONT_DIR;
	const fontFiles = Object.fromEntries(["inter-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2"].map((name) => [name, fs.readFileSync(path.join(dir, name)).toString("base64")]));
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), fontFiles });
	await page.waitForFunction(() => Array.from(document.fonts).filter((face) => /Inter Variable|JetBrains Mono Variable/.test(face.family)).length === 2, null, { timeout: 5e3 });
	await page.reload({ waitUntil: "domcontentloaded" });
	await settle(page, 500);
	const state = await page.evaluate(() => ({
		requested: window.__gmRequests.filter((url) => url.startsWith("https://cdn.jsdelivr.net/")).length,
		loaded: Array.from(document.fonts).filter((face) => /Inter Variable|JetBrains Mono Variable/.test(face.family) && face.status === "loaded").length,
		bodyFont: getComputedStyle(document.body).fontFamily
	}));
	assert.equal(state.requested, 0);
	assert.equal(state.loaded, 2);
	assert.match(state.bodyFont, /^"Inter Variable"/);
	await settle(page, 300);
	await shot(page, "list-light-fonts");
	assert.deepEqual(errors, []);
	await context.close();
});

test("风格：只保留简洁风格，之前选了液态玻璃的设置也按简洁风格显示", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: true, style: "glass", layout: "cards" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	const state = await page.evaluate(() => {
		const card = getComputedStyle(document.querySelector(".post-list-item"));
		return { style: document.documentElement.dataset.nsmaxStyle, background: card.backgroundColor, blur: card.backdropFilter };
	});
	assert.equal(state.style, "flat");
	assert.equal(state.background, "rgb(251, 250, 246)");
	assert.ok(!state.blur || state.blur === "none");
	await page.click("[data-nspp-settings-launcher]");
	await page.waitForFunction(() => document.getElementById("nspp-settings")?.shadowRoot?.querySelector("dialog")?.open);
	const text = await page.evaluate(() => document.getElementById("nspp-settings").shadowRoot.querySelector(".content").textContent);
	assert.ok(!text.includes("液态玻璃") && !text.includes("Sub-Store"));
	assert.deepEqual(errors, []);
	await context.close();
});

test("字号默认大一号，用户卡片的私信 / @我 数字徽章与文字垂直居中对齐", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("html[data-nsmax-size=large]");
	// 未读数由接口异步返回后才渲染徽章（CI 上较慢），等到至少一个可见徽章旁边有文字标签再测量。
	await page.waitForFunction(() => Array.from(document.querySelectorAll(".user-stat .notify-count")).some((badge) => badge.getClientRects().length && Array.from(badge.parentElement.children).some((child) => child !== badge && child.tagName === "SPAN" && child.textContent.trim())), null, { timeout: 8e3 });
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const center = (element) => {
			const box = element.getBoundingClientRect();
			return box.top + box.height / 2;
		};
		const offsets = Array.from(document.querySelectorAll(".user-stat .notify-count")).filter((badge) => badge.getClientRects().length).map((badge) => {
			const label = Array.from(badge.parentElement.children).find((child) => child !== badge && child.tagName === "SPAN" && child.textContent.trim());
			return label ? Math.abs(center(label) - center(badge)) : -1;
		});
		return {
			title: getComputedStyle(document.querySelector(".post-list-item .post-title a")).fontSize,
			stat: getComputedStyle(document.querySelector(".user-stat")).fontSize,
			offsets
		};
	});
	assert.equal(state.title, "16px");
	assert.equal(state.stat, "15px");
	assert.ok(state.offsets.length > 0 && state.offsets.every((offset) => offset >= 0 && offset <= 1.5), `徽章与文字中心偏差：${state.offsets.join(", ")}`);
	assert.deepEqual(errors, []);
	await context.close();
});

test("用户资料卡：黑白灰配色、数字用 Inter 等宽数字，NodeSeek++ 写死的系统字体换成主题字体", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 400);
	await page.hover(".post-list-item .info-author");
	await page.waitForSelector(".nspp-user-hover:not([hidden]) dd", { timeout: 8e3 });
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const card = document.querySelector(".nspp-user-hover:not([hidden])");
		const style = (element) => element && getComputedStyle(element);
		const actions = Array.from(card.querySelectorAll(".nspp-user-hover-actions > :is(a,button)")).map((element) => style(element).backgroundColor);
		const badge = document.querySelector(".nspp-user-badges, .post-list-item .role-tag, .nspp-block-toggle");
		return {
			background: style(card).backgroundColor,
			text: style(card).color,
			dd: style(card.querySelector("dd:not([class])")).fontFamily,
			score: card.querySelector(".nspp-user-hover-score strong") ? style(card.querySelector(".nspp-user-hover-score strong")).color : null,
			actions,
			badgeFont: badge ? style(badge).fontFamily : null
		};
	});
	assert.equal(state.background, "rgb(255, 255, 255)");
	assert.equal(state.text, "rgb(28, 28, 30)");
	assert.match(state.dd, /^"Inter/);
	if (state.score) assert.equal(state.score, "rgb(28, 28, 30)");
	// 操作按钮只用灰色或黑色，不再是绿 / 蓝 / 紫 / 红
	for (const color of state.actions) assert.ok(!/rgb\((33, 128, 68|9, 105, 218|130, 80, 223|207, 52, 52)\)/.test(color), `按钮颜色 ${color}`);
	if (state.badgeFont) assert.match(state.badgeFont, /^"?Inter/);
	await shot(page, "user-hover");
	assert.deepEqual(errors, []);
	await context.close();
});

test("悬停：用户卡片统计项、热榜条目、NQ 入口、页码不出现胶囊底色，只改变文字；帖子行整行浅灰底（复刻 sb.sb）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage() });
	await page.waitForSelector(".nsmax-hot-list li a", { timeout: 5e3 });
	await page.waitForSelector("[data-nsmax-shortcut]", { timeout: 5e3 });
	await settle(page, 400);
	const transparent = "rgba(0, 0, 0, 0)";
	for (const selector of ["[data-nsmax-stat] a:not([hidden])", ".nsmax-hot-list > li > a", ".nsmax-shortcut"]) {
		const target = page.locator(selector).first();
		await target.hover();
		await settle(page, 260);
		const background = await target.evaluate((element) => getComputedStyle(element).backgroundColor);
		assert.equal(background, transparent, `${selector} 悬停时出现底色 ${background}`);
	}
	const pager = page.locator(".nsk-pager a").first();
	const pagerBackground = await pager.evaluate((element) => getComputedStyle(element).backgroundColor);
	await pager.hover();
	await settle(page, 260);
	assert.equal(await pager.evaluate((element) => getComputedStyle(element).backgroundColor), pagerBackground, "页码悬停时换了底色");
	const row = page.locator("ul.post-list > li.post-list-item").first();
	await row.hover();
	await settle(page, 260);
	assert.equal(await row.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(242, 244, 247)");
	await page.locator("ul.post-list > li.post-list-item").first().hover();
	await settle(page, 260);
	assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("ul.post-list > li.post-list-item .post-title a")).textDecorationLine), "underline");
	assert.deepEqual(errors, []);
	await context.close();
});

test("深色模式：sb.sb 深色配色（#0d0e14 深蓝灰，不是纯黑），发布按钮不再是站点绿色，侧栏卡片保持圆角", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { seed: SBSB, html: postPage({ dark: true }) });
	await page.waitForSelector("html[data-nsmax-theme]");
	await page.waitForSelector(".nsmax-hot-panel", { timeout: 5e3 });
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const style = (selector) => getComputedStyle(document.querySelector(selector));
		return {
			body: style("body").backgroundColor,
			bgMain: getComputedStyle(document.body).getPropertyValue("--bg-main-color").trim(),
			submit: style("button.submit").backgroundColor,
			panels: Array.from(document.querySelectorAll("#nsk-right-panel-container .nsk-panel")).map((panel) => getComputedStyle(panel).borderTopLeftRadius)
		};
	});
	assert.equal(state.body, "rgb(13, 14, 20)");
	assert.notEqual(state.bgMain, "#000");
	assert.notEqual(state.submit, "rgb(26, 143, 74)");
	assert.ok(state.panels.length >= 2 && state.panels.every((radius) => radius === "12px"), `侧栏卡片圆角：${state.panels.join(", ")}`);
	assert.deepEqual(errors, []);
	await context.close();
});

test("顶栏搜索框：固定宽度，聚焦与悬停时不再伸缩", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nsmax-header-search]", { timeout: 5e3 });
	await settle(page, 300);
	const width = () => page.evaluate(() => Math.round(document.querySelector("[data-nsmax-header-search]").getBoundingClientRect().width));
	const before = await width();
	await page.hover("#search-site2");
	await page.focus("#search-site2");
	await settle(page, 400);
	assert.equal(before, 240);
	assert.equal(await width(), 240);
	assert.deepEqual(errors, []);
	await context.close();
});

test("字体：输入框、按钮、NodeSeek++ 控件都用 Inter，代码用 JetBrains Mono；启动遮罩在整理完成后去掉", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await page.waitForFunction(() => !Array.from(document.documentElement.attributes).some((attribute) => attribute.name.startsWith("data-nsmax-boot")), null, { timeout: 4e3 });
	await settle(page, 300);
	const fonts = await page.evaluate(() => ({
		textarea: getComputedStyle(document.querySelector(".md-editor textarea")).fontFamily,
		button: getComputedStyle(document.querySelector("button.submit")).fontFamily,
		pager: getComputedStyle(document.querySelector(".floor-link")).fontFamily,
		code: getComputedStyle(document.querySelector(".post-content pre code, .post-content code")).fontFamily,
		header: getComputedStyle(document.querySelector("#nsk-head")).opacity
	}));
	for (const key of ["textarea", "button", "pager"]) assert.match(fonts[key], /^"?Inter/, `${key}: ${fonts[key]}`);
	assert.match(fonts.code, /JetBrains Mono/);
	assert.equal(fonts.header, "1");
	assert.deepEqual(errors, []);
	await context.close();
});

test("翻页（复刻 sb.sb）：居中一排 30px 圆形描边胶囊，当前页实心，「下一页」同高", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const pager = document.querySelector(".nsk-pager:not(.pager-top)");
		return {
			justify: getComputedStyle(pager).justifyContent,
			items: Array.from(pager.querySelectorAll(":is(a,span)")).map((element) => {
				const style = getComputedStyle(element);
				return { text: element.textContent.trim(), current: element.matches(".pager-cur"), border: style.borderTopColor, background: style.backgroundColor, color: style.color, radius: style.borderTopLeftRadius, height: Math.round(element.getBoundingClientRect().height) };
			})
		};
	});
	assert.equal(state.justify, "center");
	assert.ok(state.items.length >= 3);
	for (const item of state.items) {
		assert.equal(item.height, 30, `页码 ${item.text} 高度 ${item.height}`);
		assert.equal(item.radius, "999px");
		if (item.current) {
			assert.equal(item.background, "rgb(28, 28, 30)");
			assert.equal(item.color, "rgb(255, 255, 255)");
		} else {
			assert.equal(item.border, "rgb(224, 226, 232)", `页码 ${item.text} 边框`);
			assert.equal(item.background, "rgb(255, 255, 255)");
		}
	}
	assert.deepEqual(errors, []);
	await context.close();
});

test("签名档：链接和彩色文字统一为主题的灰色，不保留站点或用户设置的颜色", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 300);
	const colors = await page.evaluate(() => ({
		muted: getComputedStyle(document.querySelector(".signature")).color,
		link: getComputedStyle(document.querySelector(".signature a")).color,
		span: getComputedStyle(document.querySelector(".signature span")).color
	}));
	for (const color of Object.values(colors)) assert.ok(!/rgb\((46, 164, 79|63, 185, 80)\)/.test(color), `签名档仍是绿色：${color}`);
	assert.equal(colors.muted, colors.span);
	assert.deepEqual(errors, []);
	await context.close();
});

test("帖子页：定位到的楼层只有左侧细线与短暂淡出的底色，楼层号不是灰色胶囊", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1#2", { html: postPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 2800);
	const state = await page.evaluate(() => {
		const item = document.getElementById("2");
		const style = getComputedStyle(item);
		const floor = getComputedStyle(document.querySelector("a.floor-link"));
		return { target: item.matches(":target"), shadow: style.boxShadow, background: style.backgroundColor, floorBackground: floor.backgroundColor };
	});
	assert.equal(state.target, true);
	assert.match(state.shadow, /inset/);
	assert.equal(state.background, "rgba(0, 0, 0, 0)");
	assert.equal(state.floorBackground, "rgba(0, 0, 0, 0)");
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏导航：默认隐藏生活/Dev/贴图/沙盒，并加入 NQ（NodeQuality）快捷入口", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nsmax-shortcut]", { timeout: 5e3 });
	const nav = await page.evaluate(() => ({
		visible: Array.from(document.querySelectorAll(".category-list > .nav-item")).filter((item) => getComputedStyle(item).display !== "none").map((item) => item.textContent.trim()),
		shortcuts: Array.from(document.querySelectorAll(".nsmax-shortcuts a")).map((a) => [a.textContent.trim(), a.href, a.target, a.querySelector("svg").getBoundingClientRect().width > 0, a.querySelector("span").scrollWidth <= a.querySelector("span").clientWidth]),
		inPanel: !!document.querySelector("#nsk-left-panel-container .category-list > .nsmax-shortcuts"),
		header: Array.from(document.querySelectorAll("#nsk-head a")).length
	}));
	assert.deepEqual(nav.visible, ["日常", "技术", "情报", "测评", "交易", "拼车", "推广", "曝光", "内版"]);
	assert.deepEqual(nav.shortcuts, [["NQ", "https://nodequality.com/", "_blank", true, true]]);
	assert.equal(nav.inPanel, true);
	assert.equal(nav.header, 9);
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏导航：NQ 使用 NodeQuality 彩色标志，旧版默认设置自动换成新图标并隐藏 DeepFlood 入口", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "sidebar-nav": { enabled: true, dedupe: "header", hidden: "生活\nDev\n贴图\n沙盒", shortcuts: "NQ|https://nodequality.com|gauge|NodeQuality 测机" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	await page.waitForSelector("[data-nsmax-shortcut]", { timeout: 5e3 });
	const icon = await page.evaluate(() => {
		const svg = document.querySelector(".nsmax-shortcuts a svg");
		return {
			brand: svg.getAttribute("data-nsmax-brand"),
			fills: Array.from(svg.querySelectorAll("path"), (path) => path.getAttribute("fill")),
			stroke: svg.getAttribute("stroke"),
			saved: JSON.parse(localStorage.getItem("__gm__:nspp:settings:www.nodeseek.com"))["sidebar-nav"].shortcuts,
			hidden: JSON.parse(localStorage.getItem("__gm__:nspp:settings:www.nodeseek.com"))["sidebar-nav"].hidden,
			deepflood: getComputedStyle(document.querySelector("#nsk-head a[href*='deepflood.com']")).display
		};
	});
	assert.equal(icon.brand, "nq");
	assert.deepEqual(icon.fills, ["#37975b", "#30b966", "#bd1310", "#ee8a46", "#a0d567", "#2fbcf1"]);
	assert.equal(icon.stroke, null);
	assert.equal(icon.saved, "NQ|https://nodequality.com|nq|NodeQuality 测机");
	assert.equal(icon.hidden, "生活\nDev\n贴图\n沙盒\nDeepFlood");
	assert.equal(icon.deepflood, "none");
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏导航：侧栏可见时隐藏顶栏重复版块，窄屏侧栏隐藏后顶栏自动恢复", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nsmax-shortcut]", { timeout: 5e3 });
	const headerVisible = () => page.evaluate(() => Array.from(document.querySelectorAll("#nsk-head a")).filter((a) => getComputedStyle(a).display !== "none").map((a) => a.textContent.trim()));
	assert.deepEqual(await headerVisible(), ["NodeSeek"]);
	await settle(page, 300);
	await shot(page, "list-nav");
	await page.setViewportSize({ width: 700, height: 900 });
	await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-sidenav"), null, { timeout: 3e3 });
	assert.deepEqual(await headerVisible(), ["NodeSeek", "日常", "技术", "情报", "测评", "交易", "拼车", "推广"]);
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-sidenav"), null, { timeout: 3e3 });
	assert.deepEqual(await headerVisible(), ["NodeSeek"]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏导航：导航条目不是链接时也能按文字识别（隐藏、顶栏去重、快捷入口）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ navMode: "div" }) });
	await page.waitForSelector(".nsmax-shortcuts", { timeout: 5e3 });
	const state = await page.evaluate(() => ({
		visible: Array.from(document.querySelectorAll(".category-list > .nav-item")).filter((item) => getComputedStyle(item).display !== "none").map((item) => item.textContent.trim()),
		header: Array.from(document.querySelectorAll("#nsk-head a")).filter((a) => getComputedStyle(a).display !== "none").map((a) => a.textContent.trim()),
		shortcut: document.querySelector(".nsmax-shortcuts a")?.textContent.trim()
	}));
	assert.deepEqual(state.visible, ["日常", "技术", "情报", "测评", "交易", "拼车", "推广", "曝光", "内版"]);
	assert.deepEqual(state.header, ["NodeSeek"]);
	assert.equal(state.shortcut, "NQ");
	assert.deepEqual(errors, []);
	await context.close();
});

test("新用户面板：默认整块隐藏；关闭隐藏后头像排成规整的 4 列网格，用户卡片图标保持原生间距", async () => {
	let { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nsmax-hidden-panel]", { state: "attached", timeout: 5e3 });
	assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".nsk-new-member-board")).display), "none");
	assert.deepEqual(errors, []);
	await context.close();
	const seed = { "nspp:settings:www.nodeseek.com": { "modern-theme": { hideNewMembers: false } } };
	({ context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed }));
	await page.waitForSelector("[data-nsmax-members]", { timeout: 5e3 });
	const grid = await page.evaluate(() => {
		const members = Array.from(document.querySelectorAll("[data-nsmax-member]"));
		const tops = members.map((member) => Math.round(member.getBoundingClientRect().top));
		return {
			display: getComputedStyle(document.querySelector("[data-nsmax-members]")).display,
			count: members.length,
			firstRow: tops.filter((top) => top === tops[0]).length,
			iconPadding: getComputedStyle(document.querySelector(".user-actions a")).paddingLeft
		};
	});
	assert.deepEqual(grid, { display: "grid", count: 6, firstRow: 4, iconPadding: "0px" });
	assert.deepEqual(errors, []);
	await context.close();
});

test("精简顶栏：只保留标志、标题、搜索框与深浅色切换，隐藏版块与 DeepFlood", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nsmax-own-header=colors]", { timeout: 5e3 });
	await settle(page, 200);
	const visible = (selector) => page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).filter((element) => element.getClientRects().length > 0).length, selector);
	const layout = await page.evaluate(() => {
		const shown = (element) => element.getClientRects().length > 0;
		const head = document.querySelector("#nsk-head");
		const logo = document.querySelector(".site-title").getBoundingClientRect();
		const toggle = document.querySelector("[data-nsmax-own-header=colors]").getBoundingClientRect();
		return {
			shown: Array.from(head.querySelectorAll("a, .beta-icon, input, .search-box, .color-theme-switcher, .nsmax-header-action")).filter(shown).map((element) => element.dataset.nsmaxOwnHeader || element.className || element.tagName.toLowerCase()),
			toggleAttr: document.querySelector(".color-theme-switcher").hasAttribute("data-nsmax-header-toggle"),
			sameRow: Math.abs(logo.top + logo.height / 2 - (toggle.top + toggle.height / 2)) < 6,
			apart: toggle.left - logo.right > 400
		};
	});
	// 站点自己的切换按钮（.tool-btn）隐藏，换成脚本的屏蔽按钮与深浅色按钮
	assert.deepEqual(layout.shown, ["site-logo", "beta", "search-box", "input", "keywords", "colors"]);
	assert.equal(layout.toggleAttr, true);
	assert.equal(layout.sameRow, true);
	assert.equal(layout.apart, true);
	await page.setViewportSize({ width: 700, height: 900 });
	await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-sidenav"), null, { timeout: 3e3 });
	assert.equal(await visible("#nsk-head .search-box"), 1);
	assert.deepEqual(errors, []);
	await context.close();
});

test("没有左侧版块栏的页面：顶栏不插入快捷入口、不跳动，宽屏同样精简顶栏并保留搜索框", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification", { html: notificationPage({ leftNav: false }) });
	await page.waitForSelector("[data-nsmax-own-header=colors]", { timeout: 5e3 });
	// 记录根元素属性与顶栏隐藏标记的变化次数：稳定后不应再来回切换。
	await page.evaluate(() => {
		window.__flips = 0;
		new MutationObserver((records) => {
			window.__flips += records.length;
		}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nsmax-sidenav", "data-nsmax-sidenav-page"] });
	});
	await settle(page, 1500);
	const state = await page.evaluate(() => ({
		flips: window.__flips,
		sidenav: document.documentElement.hasAttribute("data-nsmax-sidenav"),
		shortcutInHeader: !!document.querySelector("#nsk-head .nsmax-shortcuts"),
		shown: Array.from(document.querySelectorAll("#nsk-head a, #nsk-head .beta-icon, #nsk-head .search-box, #nsk-head .color-theme-switcher, #nsk-head .nsmax-header-action")).filter((element) => element.getClientRects().length > 0).map((element) => element.dataset.nsmaxOwnHeader || element.className || element.tagName.toLowerCase())
	}));
	assert.equal(state.flips, 0);
	assert.equal(state.sidenav, false);
	assert.equal(state.shortcutInHeader, false);
	assert.deepEqual(state.shown, ["site-logo", "beta", "search-box", "keywords", "colors"]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("请求限流：429 等待后自动重试成功，接口自身的 403 不触发全站冷却", async () => {
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/notification", {
		html: notificationPage(),
		api: {
			"/api/block-list/list": [{ status: 429, headers: { "Retry-After": "1" }, body: { success: false } }],
			"/api/notification/unread-count": [{ status: 403, body: { success: false, message: "forbidden" } }]
		}
	});
	// 黑名单在 429 后自动重试拿到名单，原生通知页里黑名单用户的通知被隐藏。
	await page.waitForFunction(() => {
		const items = Array.from(document.querySelectorAll(".notification-item"));
		return items.length && items.filter((item) => getComputedStyle(item).display === "none").length >= 2;
	}, null, { timeout: 12e3 });
	assert.equal(calls["/api/block-list/list"], 2);
	const cooldown = await page.evaluate(() => JSON.parse(localStorage.getItem("__gm__:nspp:request-cooldown:www.nodeseek.com") || "0"));
	assert.ok(cooldown - Date.now() < 6e3, "429 后的冷却应按 Retry-After 计算且不超过数秒");
	await page.close();
	// 只有 403 的页面：不写入冷却。
	await page.context().clearCookies();
	const fresh = await open(browser, "https://www.nodeseek.com/", { html: listPage(), api: { "/api/notification/unread-count": [{ status: 403, body: { success: false } }, { status: 403, body: { success: false } }] } });
	await settle(fresh.page, 1500);
	const after = await fresh.page.evaluate(() => JSON.parse(localStorage.getItem("__gm__:nspp:request-cooldown:www.nodeseek.com") || "0"));
	assert.ok(after <= Date.now(), "接口 403 不应触发冷却");
	assert.deepEqual(errors, []);
	assert.deepEqual(fresh.errors, []);
	await fresh.context.close();
	await context.close();
});

test("评论框：图床按钮与发布评论在同一行，工具栏换成统一线条图标", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("[data-nsmax-submit-row] .nspp-upload-choose", { timeout: 5e3 });
	await page.waitForSelector(".mde-toolbar [data-nsmax-tool]", { timeout: 5e3 });
	await settle(page, 200);
	const state = await page.evaluate(() => {
		const choose = document.querySelector(".nspp-upload-choose").getBoundingClientRect();
		const submit = document.querySelector("button.submit").getBoundingClientRect();
		const items = Array.from(document.querySelectorAll(".mde-toolbar .toolbar-item"));
		return {
			sameRow: Math.abs(choose.top + choose.height / 2 - (submit.top + submit.height / 2)) < 4,
			leftOfSubmit: choose.right < submit.left,
			editorBottomGap: Math.round(document.querySelector(".md-editor").getBoundingClientRect().bottom - submit.bottom),
			names: items.map((item) => item.querySelector("[data-nsmax-icon]")?.getAttribute("data-nsmax-icon") || item.getAttribute("data-nsmax-icon") || null),
			nativeHidden: items.filter((item) => item.hasAttribute("data-nsmax-tool")).every((item) => getComputedStyle(item.querySelector("svg:not(.nsmax-tool-icon)")).display === "none"),
			iconSize: Math.round(items[0].querySelector(".nsmax-tool-icon").getBoundingClientRect().width),
			itemSize: Math.round(items[0].getBoundingClientRect().width),
			right: items.at(-1).hasAttribute("data-nsmax-tool")
		};
	});
	assert.equal(state.sameRow, true);
	assert.equal(state.leftOfSubmit, true);
	assert.ok(state.editorBottomGap < 24, `编辑器底部空白 ${state.editorBottomGap}px`);
	assert.deepEqual(state.names, ["bold", "italic", "strike", "heading", "unordered", "ordered", "quote", "link", "image", "code", "table", "rule", "undo", "redo", "clear", null]);
	assert.equal(state.nativeHidden, true);
	assert.equal(state.iconSize, 18);
	assert.equal(state.itemSize, 32);
	assert.equal(state.right, false);
	// 原生「图片」按钮仍然打开图床上传
	const chooser = page.waitForEvent("filechooser", { timeout: 3e3 });
	await page.click(".mde-toolbar .i-icon-pic");
	await chooser;
	await shot(page, "post-editor");
	assert.deepEqual(errors, []);
	await context.close();
});

test("图片上传：默认上传到欧记图床并插入图片链接", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector(".nspp-upload-status input[type=file]", { state: "attached", timeout: 5e3 });
	await page.setInputFiles(".nspp-upload-status input[type=file]", { name: "shot.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
	await page.waitForFunction(() => document.querySelector(".md-editor textarea").value.includes("image.110726.com"), null, { timeout: 5e3 });
	const result = await page.evaluate(() => ({
		text: document.querySelector(".md-editor textarea").value,
		upload: window.__uploads?.[0]
	}));
	assert.equal(result.text, "![image](<https://image.110726.com/api/i/abc123.png>)");
	assert.equal(result.upload.url, "https://image.110726.com/api/public/uploads?publicVisible=false");
	assert.equal(result.upload.headers.Origin, "https://image.110726.com");
	assert.equal(result.upload.anonymous, true);
	assert.deepEqual(errors, []);
	await context.close();
});

test("独立主题 CSS：不安装脚本、只加载 theme/nodeseek-max.css 也能生效", async () => {
	const css = fs.readFileSync(path.join(ROOT, "theme", "nodeseek-max.css"), "utf8");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), script: false, css });
	await settle(page, 300);
	const state = await page.evaluate(() => ({
		canvas: getComputedStyle(document.body).backgroundColor,
		grid: getComputedStyle(document.body).backgroundImage,
		row: getComputedStyle(document.querySelector(".post-list-item")).borderBottomStyle,
		stat: getComputedStyle(document.querySelector(".user-stat")).backgroundColor,
		font: getComputedStyle(document.body).fontFamily
	}));
	// 默认 Claude 风格：米白页面底；用户卡片的统计区不再是一条浅底带（透明，透出卡片白底）
	assert.equal(state.canvas, "rgb(245, 244, 237)");
	assert.equal(state.grid, "none");
	assert.equal(state.row, "solid");
	assert.equal(state.stat, "rgba(0, 0, 0, 0)");
	assert.match(state.font, /^"Inter Variable"/);
	assert.deepEqual(errors, []);
	await context.close();
});

test("黑名单：原生通知页隐藏黑名单用户的 @ 与私信通知", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "private-messages": { enabled: false } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification", { html: notificationPage(), seed });
	await page.waitForFunction(() => document.querySelectorAll("[data-nsmax-blocked]").length === 2, null, { timeout: 5e3 });
	const visible = await page.evaluate(() => Array.from(document.querySelectorAll(".notification-list > li")).filter((li) => getComputedStyle(li).display !== "none").map((li) => li.textContent.trim()));
	assert.deepEqual(visible, ["friend 回复了你的主题 另一帖"]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("黑名单：紧凑消息中心开启时通知页加载无报错（模拟页没有原生通知容器，数据层过滤需在真实站点验证）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification", { html: notificationPage() });
	await page.waitForFunction(() => {
		const workspace = document.querySelector(".nspp-messages");
		return workspace && !workspace.hidden && document.querySelectorAll(".nspp-messages-conversations .nspp-messages-peer").length > 0;
	}, null, { timeout: 8e3 }).catch(() => {});
	const peers = await page.evaluate(() => Array.from(document.querySelectorAll(".nspp-messages-conversations .nspp-messages-peer strong")).map((node) => node.textContent));
	if (peers.length) assert.ok(!peers.includes("spammer"), `会话列表仍包含黑名单用户：${peers.join(",")}`);
	assert.deepEqual(errors, []);
	await context.close();
});

test("设置面板：可打开、搜索，不再包含 AI 写作助手与快捷回复", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nspp-settings-launcher]", { timeout: 5e3 });
	await page.click("[data-nspp-settings-launcher]");
	const text = () => page.evaluate(() => document.getElementById("nspp-settings").shadowRoot.querySelector(".content").textContent);
	await page.waitForFunction(() => document.getElementById("nspp-settings")?.shadowRoot?.querySelector("dialog")?.open);
	const all = await text();
	assert.ok(all.includes("现代化主题") && all.includes("侧栏版块导航"));
	assert.ok(!all.includes("AI 写作助手") && !all.includes("快捷回复"));
	await page.evaluate(() => {
		const search = document.getElementById("nspp-settings").shadowRoot.querySelector("input[type=search]");
		search.value = "热榜";
		search.dispatchEvent(new Event("input"));
	});
	await page.waitForFunction(() => !document.getElementById("nspp-settings").shadowRoot.querySelector(".content").textContent.includes("现代化主题"), null, { timeout: 2e3 });
	assert.ok((await text()).includes("NodeSeek 热榜"));
	const look = await page.evaluate(() => {
		const shadow = document.getElementById("nspp-settings").shadowRoot;
		const toggle = shadow.querySelector("article input[type=checkbox]");
		return {
			switchWidth: getComputedStyle(toggle).width,
			appearance: getComputedStyle(toggle).appearance,
			dialogWidth: Math.round(shadow.querySelector("dialog").getBoundingClientRect().width),
			card: getComputedStyle(shadow.querySelector("article")).borderTopLeftRadius
		};
	});
	assert.equal(look.switchWidth, "36px");
	assert.equal(look.appearance, "none");
	assert.ok(look.dialogWidth >= 900, `设置面板宽度 ${look.dialogWidth}`);
	// Claude 风格的设置面板像 Claude 的设置页：功能之间只用分隔线隔开，不套卡片
	assert.equal(look.card, "0px");
	await settle(page, 200);
	await shot(page, "settings");
	assert.deepEqual(errors, []);
	await context.close();
});

test("工具弹窗：回帖足迹统一成卡片式模态框，关闭按钮为线条图标，主要按钮用强调色，空状态居中", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage({ dark }) });
		await page.waitForSelector('#nspp-tools button[title="回帖足迹"]', { timeout: 5e3 });
		await page.click('#nspp-tools button[title="回帖足迹"]');
		await settle(page, 400);
		const state = await page.evaluate(() => {
			const dialog = document.querySelector(".nspp-footprints-dialog");
			const close = dialog.querySelector("header > button:last-child");
			const sync = dialog.querySelector(".nspp-footprints-toolbar > button");
			const empty = dialog.querySelector(".nspp-footprints-list > p");
			return {
				radius: getComputedStyle(dialog).borderRadius,
				background: getComputedStyle(dialog).backgroundColor,
				closeFont: getComputedStyle(close).fontSize,
				closeIcon: getComputedStyle(close, "::before").maskImage || getComputedStyle(close, "::before").webkitMaskImage,
				syncBackground: getComputedStyle(sync).backgroundColor,
				emptyAlign: getComputedStyle(empty).textAlign,
				emptyIcon: getComputedStyle(empty, "::before").content
			};
		});
		assert.equal(state.radius, "12px");
		assert.equal(state.background, dark ? "rgb(20, 21, 28)" : "rgb(255, 255, 255)");
		assert.equal(state.closeFont, "0px");
		assert.match(state.closeIcon, /svg/);
		assert.equal(state.syncBackground, dark ? "rgb(238, 240, 246)" : "rgb(28, 28, 30)");
		assert.equal(state.emptyAlign, "center");
		assert.equal(state.emptyIcon, '""');
		await shot(page, `footprints-${dark ? "dark" : "light"}`);
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("侧栏工具与徽章：热榜按钮去掉橙色渐变改线条图标，用户等级 / 天数徽章统一灰色", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark: true }) });
	await page.waitForSelector("#nspp-tools [data-nspp-hot-launcher]", { timeout: 5e3 });
	await page.waitForSelector(".post-list-item .nspp-user-badges .nspp-level", { timeout: 5e3 });
	const state = await page.evaluate(() => {
		const hot = document.querySelector("#nspp-tools [data-nspp-hot-launcher]");
		const muted = getComputedStyle(document.body).getPropertyValue("--nsmax-muted").trim();
		const probe = document.createElement("span");
		probe.style.color = muted;
		document.body.append(probe);
		const mutedRgb = getComputedStyle(probe).color;
		probe.remove();
		return {
			hotBackground: getComputedStyle(hot).backgroundImage,
			hotSvg: getComputedStyle(hot.querySelector("svg")).display,
			level: getComputedStyle(document.querySelector(".post-list-item .nspp-level")).color,
			age: getComputedStyle(document.querySelector(".post-list-item .nspp-age")).color,
			mutedRgb
		};
	});
	assert.equal(state.hotBackground, "none");
	assert.equal(state.hotSvg, "none");
	assert.equal(state.level, state.mutedRgb);
	assert.equal(state.age, state.mutedRgb);
	assert.deepEqual(errors, []);
	await context.close();
});

test("评论区：圆角方形头像，正文与名字左对齐，顶部有「全部回复」分隔；代码块仍按需高亮", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { seed: SBSB, html: postPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await page.evaluate(() => document.querySelector(".nsk-post .post-content").insertAdjacentHTML("beforeend", "<pre><code class=\"language-javascript\">const answer = 42;</code></pre>"));
	await page.waitForSelector("pre code.language-javascript .hljs-keyword", { timeout: 5e3 });
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const item = document.querySelector("ul.comments > li.content-item");
		const avatar = item.querySelector(".nsk-content-meta-info img");
		const name = item.querySelector('.author-info a[href*="/space/"]');
		const content = item.querySelector(".post-content");
		return {
			avatar: avatar.getBoundingClientRect().width,
			radius: getComputedStyle(avatar).borderRadius,
			indent: Math.round(content.getBoundingClientRect().left - name.getBoundingClientRect().left),
			heading: getComputedStyle(document.querySelector("ul.comments"), "::before").content
		};
	});
	assert.equal(state.avatar, 32);
	assert.equal(state.radius, "20%");
	assert.ok(Math.abs(state.indent) <= 2, `正文应与名字对齐，偏差 ${state.indent}px`);
	assert.equal(state.heading, '"全部回复"');
	await shot(page, "comments");
	assert.deepEqual(errors, []);
	await context.close();
});

test("sb.sb 风格：顶栏搜索框浅底细边框、按钮为胶囊、帖子行小头像、标题中等字重、热榜单行带回复数、主楼正文与作者名对齐", async () => {
	let { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage() });
	await page.waitForSelector(".nsmax-hot-list li a .nsmax-hot-count", { timeout: 5e3 });
	await settle(page, 300);
	const list = await page.evaluate(() => {
		const css = (element) => getComputedStyle(element);
		const search = document.querySelector("[data-nsmax-header-search]");
		const avatar = document.querySelector(".post-list-item img.avatar-normal");
		return {
			searchBackground: css(search).backgroundColor,
			searchBorder: css(search).borderTopColor,
			cta: getComputedStyle(document.querySelector("[data-nsmax-cta]"), "::before").borderTopLeftRadius,
			avatar: avatar.getBoundingClientRect().width,
			titleWeight: css(document.querySelector(".post-list-item .post-title a")).fontWeight,
			hotWrap: css(document.querySelector(".nsmax-hot-text")).whiteSpace,
			hotCount: document.querySelector(".nsmax-hot-count").textContent,
			activeTab: css(document.querySelector(".nsmax-hot-tabs button[aria-selected=true]")).backgroundColor
		};
	});
	assert.equal(list.searchBackground, "rgb(250, 251, 252)");
	assert.equal(list.searchBorder, "rgb(224, 226, 232)");
	assert.equal(list.cta, "999px");
	assert.equal(list.avatar, 24);
	assert.equal(list.titleWeight, "500");
	assert.equal(list.hotWrap, "nowrap");
	assert.match(list.hotCount, /^\d+$/);
	assert.equal(list.activeTab, "rgb(28, 28, 30)");
	await shot(page, "list-sbsb");
	assert.deepEqual(errors, []);
	await context.close();
	({ context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { seed: SBSB, html: postPage() }));
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 400);
	const post = await page.evaluate(() => {
		const name = document.querySelector('.nsk-post .author-info a[href*="/space/"]');
		const content = document.querySelector(".nsk-post > .post-content");
		return { indent: Math.round(content.getBoundingClientRect().left - name.getBoundingClientRect().left), title: getComputedStyle(document.querySelector(".post-title h1")).fontSize };
	});
	assert.ok(Math.abs(post.indent) <= 2, `主楼正文应与作者名对齐，偏差 ${post.indent}px`);
	assert.equal(post.title, "20px");
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏热榜：长标题单行省略，不会把按内容定宽的右侧栏撑宽、挤压帖子列表", async () => {
	// 真实站点的右侧栏宽度按内容计算（模拟页默认固定 280px），这里改成按内容定宽，并换成很长的热帖标题
	const css = "#nsk-right-panel-container{width:auto!important;flex:0 1 auto!important;max-width:none!important}";
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), css, viewport: { width: 1440, height: 900 } });
	await page.waitForSelector(".nsmax-hot-list li a", { timeout: 5e3 });
	await page.evaluate(() => document.querySelectorAll(".nsmax-hot-text").forEach((text) => { text.textContent = "国庆快乐！除了吃喝玩乐，BWH 也给大家准备了一台 ECOMMERCE VPS，NodeSeek 管理组祝大家假期愉快、好运连连！"; }));
	await settle(page, 200);
	const size = await page.evaluate(() => ({
		right: document.getElementById("nsk-right-panel-container").getBoundingClientRect().width,
		main: document.getElementById("nsk-body-left").getBoundingClientRect().width,
		ellipsis: getComputedStyle(document.querySelector(".nsmax-hot-text")).textOverflow
	}));
	assert.ok(size.right < 360, `右侧栏被撑到 ${Math.round(size.right)}px`);
	assert.ok(size.main > 600, `帖子列表只剩 ${Math.round(size.main)}px`);
	assert.equal(size.ellipsis, "ellipsis");
	assert.deepEqual(errors, []);
	await context.close();
});

test("加载：顶栏、左侧栏、右侧栏在页面解析阶段就整理好并显示，不等页面加载完再淡入", async () => {
	// 页面末尾的内联脚本运行时页面已解析完，但 DOMContentLoaded 还没触发、各模块也还没启动（#nspp-tools 尚不存在）
	const probe = `<script>window.__early = (() => {
		const root = document.documentElement;
		return {
			modules: !!document.getElementById("nspp-tools"),
			boot: Array.from(root.attributes).filter((attribute) => attribute.name.startsWith("data-nsmax-boot")).map((attribute) => attribute.name),
			headerHidden: document.querySelectorAll("[data-nsmax-header-hide]").length,
			headerSearch: !!document.querySelector("[data-nsmax-header-search]"),
			header: !!document.querySelector("[data-nsmax-header]"),
			navHidden: Array.from(document.querySelectorAll("#nsk-left-panel-container [data-nsmax-hidden]")).map((element) => element.textContent.trim()),
			sidenav: root.hasAttribute("data-nsmax-sidenav"),
			card: !!document.querySelector("[data-nsmax-usercard]"),
			cta: !!document.querySelector("[data-nsmax-cta]"),
			leftOpacity: getComputedStyle(document.getElementById("nsk-left-panel-container")).opacity
		};
	})();</script>`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage().replace("</body>", `${probe}</body>`) });
	await page.waitForSelector("#nspp-tools button", { timeout: 5e3 });
	const early = await page.evaluate(() => window.__early);
	assert.equal(early.modules, false, "探测脚本应在模块启动前运行");
	assert.deepEqual(early.boot, []);
	assert.ok(early.headerHidden > 0, "顶栏应已精简");
	assert.equal(early.headerSearch, true);
	assert.equal(early.header, true);
	assert.ok(early.navHidden.includes("生活"), `左侧栏隐藏项：${early.navHidden.join("、")}`);
	assert.equal(early.sidenav, true);
	assert.equal(early.card, true);
	assert.equal(early.cta, true);
	assert.equal(early.leftOpacity, "1");
	// 模块启动后沿用同一份标记：NQ 入口、热榜面板照常插入，隐藏项不变
	await page.waitForSelector(".nsmax-shortcuts a, .nsmax-hot-panel", { timeout: 5e3 });
	const later = await page.evaluate(() => ({
		shortcuts: document.querySelectorAll(".nsmax-shortcuts a").length,
		hidden: document.querySelectorAll("#nsk-left-panel-container [data-nsmax-hidden]").length
	}));
	assert.ok(later.shortcuts > 0);
	assert.equal(later.hidden, early.navHidden.length);
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧栏热榜：上次的榜单存在本地，刷新后直接显示，未过期时不再联网", async () => {
	const posts = Array.from({ length: 12 }, (_, index) => ({ id: 9000 + index, title: `缓存热帖 ${index + 1}`, author: "cache", views: 10, comments: 30 - index, score: 100 - index }));
	const seed = { "nspp:state:www.nodeseek.com:hot-rankings": { "snapshot:hot": { posts, updated: Date.now() - 6e4, fetched: Date.now() } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	await page.waitForSelector(".nsmax-hot-panel", { timeout: 5e3 });
	const state = await page.evaluate(() => ({
		skeleton: document.querySelectorAll(".nsmax-hot-skeleton").length,
		first: document.querySelector(".nsmax-hot-list .nsmax-hot-text")?.textContent,
		requests: window.__gmRequests.filter((url) => url.includes("api.bimg.eu.org/hot")).length
	}));
	assert.equal(state.skeleton, 0);
	assert.equal(state.first, "缓存热帖 1");
	await settle(page, 300);
	assert.equal(await page.evaluate(() => window.__gmRequests.filter((url) => url.includes("api.bimg.eu.org/hot")).length), 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("加载：页面加载完才插入的热榜面板按上次实测高度预留位置，插入时下面的卡片不移动；其余榜单空闲时预取", async () => {
	// 页面末尾的内联脚本记下模块启动前「快捷入口」卡片的位置（热榜插在它前面）；第一次打开记录面板高度，刷新后应原地填入
	const probe = `<script>window.__cardTop = document.querySelector(".quick-access").getBoundingClientRect().top;</script>`;
	// 「快捷入口」默认隐藏；这里打开它，用它来量热榜插入时下面卡片的位移
	const seed = { "nspp:settings:www.nodeseek.com": { "modern-theme": { hideQuickAccess: false } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage().replace("</body>", `${probe}</body>`), seed });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	await settle(page, 400);
	const first = await page.evaluate(() => ({ before: window.__cardTop, after: document.querySelector(".quick-access").getBoundingClientRect().top }));
	assert.ok(first.after - first.before > 100, "第一次打开没有记录，面板插入会把下面的卡片往下推");
	// 其余两个榜单在空闲时预取并存到本地
	await page.waitForFunction(() => ["daily", "weekly"].every((kind) => window.__gmRequests.some((url) => url.includes(`/${kind}.json`))), null, { timeout: 8e3 });
	await settle(page, 200);
	await page.reload();
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	await settle(page, 1800);
	const second = await page.evaluate(() => ({
		before: window.__cardTop,
		after: document.querySelector(".quick-access").getBoundingClientRect().top,
		// 预取的榜单已缓存且未过期：刷新后不再请求
		requests: window.__gmRequests.filter((url) => /\/(daily|weekly)\.json/.test(url)).length
	}));
	assert.ok(Math.abs(second.after - second.before) <= 1, `快捷入口卡片移动了 ${Math.round(second.after - second.before)}px`);
	assert.equal(second.requests, 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("消息中心：私信与通知统一主题配色——一张卡片、对方气泡白底细边框、自己的气泡用强调色、发送按钮为胶囊、无绿色", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { seed: SBSB, html: messageCenterPage() });
	await page.waitForSelector(".nspp-messages-message.is-mine .nspp-messages-bubble", { timeout: 8e3 });
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const css = (selector) => getComputedStyle(document.querySelector(selector));
		return {
			frame: css(".nspp-messages").borderTopLeftRadius,
			container: css(".nspp-messages-container").borderTopWidth,
			mine: css(".nspp-messages-message.is-mine .nspp-messages-bubble").backgroundColor,
			theirs: css(".nspp-messages-message:not(.is-mine):not(.is-system) .nspp-messages-bubble").backgroundColor,
			theirsBorder: css(".nspp-messages-message:not(.is-mine):not(.is-system) .nspp-messages-bubble").borderTopColor,
			send: css(".nspp-messages-send").borderTopLeftRadius,
			sendBackground: css(".nspp-messages-send").backgroundColor,
			profile: css(".nspp-chat-profile").backgroundImage
		};
	});
	assert.equal(state.frame, "12px");
	assert.equal(state.container, "0px");
	assert.equal(state.mine, "rgb(28, 28, 30)");
	assert.equal(state.theirs, "rgb(255, 255, 255)");
	assert.equal(state.theirsBorder, "rgb(224, 226, 232)");
	assert.equal(state.send, "999px");
	assert.equal(state.sendBackground, "rgb(28, 28, 30)");
	assert.equal(state.profile, "none");
	await shot(page, "messages");
	assert.deepEqual(errors, []);
	await context.close();
});

test("评论框：「发布评论」按钮不伸出编辑器（站点给提交行设 100% 宽、给按钮设浮动与负外边距也一样），引用行在编辑器里是灰色而非绿色", async () => {
	const css = ".md-editor .submit-row{width:100%}.md-editor button.submit{float:right;margin-right:-14px;position:relative;left:6px}";
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), css });
	await page.waitForSelector("[data-nsmax-submit-row]", { timeout: 5e3 });
	await page.evaluate(() => document.querySelector(".md-editor textarea").insertAdjacentHTML("beforebegin", "<div class=\"CodeMirror\"><pre class=\"CodeMirror-line\"><span class=\"cm-quote cm-quote-1\">&gt; 引用别人的楼层内容</span> <span class=\"cm-link\">@buyer</span></pre></div>"));
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const editor = document.querySelector(".md-editor").getBoundingClientRect();
		const button = document.querySelector(".md-editor button.submit").getBoundingClientRect();
		const muted = getComputedStyle(document.body).getPropertyValue("--nsmax-muted").trim();
		const probe = document.createElement("span");
		probe.style.color = muted;
		document.body.append(probe);
		const mutedRgb = getComputedStyle(probe).color;
		probe.remove();
		return {
			overflowRight: Math.round(button.right - editor.right),
			insideBottom: button.bottom <= editor.bottom,
			quote: getComputedStyle(document.querySelector(".cm-quote")).color,
			link: getComputedStyle(document.querySelector(".cm-link")).color,
			mutedRgb
		};
	});
	assert.ok(state.overflowRight <= -6, `按钮超出编辑器右边缘 ${state.overflowRight}px`);
	assert.equal(state.insideBottom, true);
	assert.equal(state.quote, state.mutedRgb);
	assert.notEqual(state.link, "rgb(0, 0, 204)");
	await shot(page, "editor");
	assert.deepEqual(errors, []);
	await context.close();
});

test("评论框：按钮容器被站点设成固定高度、或「发布评论」直接挂在编辑器下并绝对定位时，按钮也完整显示在编辑器内，上传按钮与它同一行", async () => {
	const variants = [
		{ name: "固定高度容器", html: postPage(), css: ".md-editor .submit-row{height:24px;position:relative}.md-editor .submit-row button.submit{position:absolute;right:8px;top:4px;height:36px}" },
		{ name: "直接挂在编辑器下", html: postPage().replace('<div class="submit-row" style="padding:8px;text-align:right"><button class="submit btn">发布评论</button></div>', '<button class="submit btn" style="position:absolute;right:10px;bottom:-16px">发布评论</button>'), css: ".md-editor{position:relative}" }
	];
	for (const { name, html, css } of variants) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, css });
		await page.waitForSelector(".md-editor .nspp-upload-choose", { timeout: 5e3 });
		await settle(page, 400);
		const box = await page.evaluate(() => {
			const editor = document.querySelector(".md-editor").getBoundingClientRect();
			const button = document.querySelector(".md-editor button.submit").getBoundingClientRect();
			const upload = document.querySelector(".md-editor .nspp-upload-choose").getBoundingClientRect();
			return { bottomGap: Math.round(editor.bottom - button.bottom), rightGap: Math.round(editor.right - button.right), sameLine: Math.abs((upload.top + upload.bottom) / 2 - (button.top + button.bottom) / 2) <= 4, uploadLeft: upload.left < button.left };
		});
		assert.ok(box.bottomGap >= 4, `${name}：按钮下沿离编辑器底边 ${box.bottomGap}px（被裁切）`);
		assert.ok(box.rightGap >= 4, `${name}：按钮右沿超出 ${-box.rightGap}px`);
		assert.equal(box.sameLine, true, `${name}：上传按钮不在同一行`);
		assert.equal(box.uploadLeft, true);
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("评论框：隐藏「支持markdown语法 / 支持MD语法」提示，工具栏其他按钮不受影响", async () => {
	// 手机版提示文字在标签栏里、写作「支持MD语法」，并且和全屏等按钮挨着
	const html = postPage().replace('<span class="tab">预览</span></div>', '<span class="tab">预览</span><span class="tab-right"><span class="md-tip">支持MD语法</span><span class="toolbar-item" title="全屏">全屏</span></span></div>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html });
	await page.waitForSelector("[data-nsmax-md-hint]", { state: "attached", timeout: 5e3 });
	const state = await page.evaluate(() => ({
		toolbarHint: getComputedStyle(document.querySelector(".mde-toolbar .toolbar-item.right")).display,
		tabHint: getComputedStyle(document.querySelector(".md-tip")).display,
		fullscreen: getComputedStyle(document.querySelector('.tab-right [title="全屏"]')).display,
		tools: Array.from(document.querySelectorAll(".mde-toolbar .toolbar-item:not(.right)")).every((item) => getComputedStyle(item).display !== "none")
	}));
	assert.equal(state.toolbarHint, "none");
	assert.equal(state.tabHint, "none");
	assert.notEqual(state.fullscreen, "none");
	assert.equal(state.tools, true);
	assert.deepEqual(errors, []);
	await context.close();
});

test("加载：NodeSeek++ 夜间模式在页面解析阶段就生效，不再先亮后暗", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "reading-navigation": { enabled: true, dark: true } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed, init: `document.addEventListener("readystatechange", () => { if (document.readyState === "interactive") window.__darkBeforeScripts = document.body.classList.contains("dark-layout"); });` });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 400);
	const state = await page.evaluate(() => ({ early: window.__darkBeforeScripts, now: document.body.classList.contains("dark-layout") }));
	assert.deepEqual(state, { early: true, now: true });
	assert.deepEqual(errors, []);
	await context.close();
});

test("设置页：输入框白底深一档边框（sb.sb）、提交按钮用强调色、复选框跟随强调色，子导航当前项加粗", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/setting#/profile", { seed: SBSB, html: settingPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const css = (selector, prop) => getComputedStyle(document.querySelector(selector))[prop];
		return {
			page: document.documentElement.dataset.nsmaxPage,
			input: css("input[type=email]", "backgroundColor"),
			inputRadius: css("input[type=email]", "borderRadius"),
			submit: css("button[type=submit]", "backgroundColor"),
			cancel: css("#nsk-body button[type=button]", "backgroundColor"),
			check: css("input[type=checkbox]", "accentColor"),
			tab: css(".router-link-active", "fontWeight"),
			cta: getComputedStyle(document.querySelector(".btn-post"), "::before").backgroundColor
		};
	});
	assert.equal(state.page, "setting");
	assert.equal(state.input, "rgb(255, 255, 255)");
	assert.equal(state.inputRadius, "8px");
	assert.equal(state.submit, "rgb(28, 28, 30)");
	assert.equal(state.cancel, "rgb(255, 255, 255)");
	assert.equal(state.check, "rgb(28, 28, 30)");
	assert.equal(state.tab, "600");
	assert.equal(state.cta, "rgb(28, 28, 30)");
	await shot(page, "setting");
	assert.deepEqual(errors, []);
	await context.close();
});

test("侧边工具栏：任何桌面宽度都放在内容右侧 24px 处，不压住右侧栏；窄窗口时内容区让出位置", async () => {
	for (const width of [1024, 1240, 1280, 1366, 1440]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width, height: 860 } });
		await page.waitForSelector("#nspp-tools button");
		await settle(page, 500);
		const state = await page.evaluate(() => {
			const tools = document.getElementById("nspp-tools").getBoundingClientRect();
			const right = document.getElementById("nsk-right-panel-container").getBoundingClientRect();
			return { gap: Math.round(tools.left - right.right), edge: Math.round(innerWidth - tools.right), scroll: document.documentElement.scrollWidth - innerWidth };
		});
		assert.ok(state.gap >= 23, `${width}px：工具栏与右侧栏间距 ${state.gap}px`);
		assert.ok(state.edge >= 12, `${width}px：工具栏离窗口右边 ${state.edge}px`);
		assert.equal(state.scroll, 0, `${width}px：出现横向滚动`);
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("帖子页细节：复制代码收进代码块右上角、回复与主楼对齐、点图片用 Viewer.js 大图查看", async () => {
	const image = `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23748094'/%3E%3C/svg%3E" alt="截图">`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage().replace("这是一段正文", `${image}这是一段正文`) });
	await page.waitForSelector("[data-nspp-copy]");
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const button = document.querySelector("[data-nspp-copy]"), pre = button.nextElementSibling;
		const b = button.getBoundingClientRect(), p = pre.getBoundingClientRect(), prev = button.previousElementSibling.getBoundingClientRect();
		const avatar = (selector) => document.querySelector(`${selector} img.avatar-normal`).getBoundingClientRect().left;
		return {
			inside: b.top >= p.top && b.bottom <= p.bottom && b.right <= p.right && b.left >= p.left,
			flow: Math.round(p.top - prev.bottom),
			opacity: getComputedStyle(button).opacity,
			avatars: [avatar(".nsk-post"), avatar("ul.comments>li")]
		};
	});
	assert.ok(state.inside, "复制按钮不在代码块内");
	assert.ok(state.flow <= 20, `复制按钮仍占一行：代码块与上一段间距 ${state.flow}px`);
	assert.equal(state.opacity, "0");
	assert.equal(state.avatars[0], state.avatars[1], `回复头像与主楼头像未对齐：${state.avatars.join(" / ")}`);
	await page.hover("[data-nspp-copy] + pre");
	await settle(page, 250);
	assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("[data-nspp-copy]")).opacity), "1");
	await page.click(".nsk-post .post-content img");
	await page.waitForSelector("dialog.nspp-image-preview[open]");
	assert.equal(await page.evaluate(() => document.querySelectorAll("dialog.nspp-image-viewer").length), 0);
	await page.keyboard.press("Escape");
	await settle(page, 400);
	assert.equal(await page.evaluate(() => document.querySelectorAll("dialog[open]").length), 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("弹层细节：帖子预览标题不画粗聚焦框、表格有细线；热榜抽屉榜单与侧栏同款胶囊；提示条在顶栏下方", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { seed: SBSB, html: listPage(), pages: { "/post-1000-1": postPage() } });
	await page.waitForSelector("#nspp-tools button");
	await settle(page, 500);
	await page.hover(".post-list-item .post-title a");
	await page.waitForSelector(".nspp-post-preview[open] .nspp-preview-content table");
	await settle(page, 300);
	const preview = await page.evaluate(() => {
		const title = document.querySelector(".nspp-post-preview>header a"), cell = document.querySelector(".nspp-preview-content td");
		return { outline: getComputedStyle(title).outlineStyle, size: getComputedStyle(title).fontSize, cell: getComputedStyle(cell).borderTopStyle, width: Math.round(document.querySelector(".nspp-post-preview").getBoundingClientRect().width) };
	});
	assert.equal(preview.outline, "none");
	assert.equal(preview.size, "14px");
	assert.equal(preview.cell, "solid");
	assert.equal(preview.width, 400);
	await page.mouse.move(5, 700);
	await settle(page, 500);
	await page.click("#nspp-tools [data-nspp-hot-launcher]");
	await page.waitForSelector(".nspp-hot-rankings[open] nav button[aria-pressed=true]");
	await settle(page, 400);
	const hot = await page.evaluate(() => {
		const style = (element) => getComputedStyle(element);
		const active = document.querySelector(".nspp-hot-rankings nav button[aria-pressed=true]");
		const idle = document.querySelector(".nspp-hot-rankings nav button[data-ranking][aria-pressed=false]");
		const refresh = document.querySelector(".nspp-hot-rankings nav>button:not([data-ranking])");
		return { active: style(active).backgroundColor, idle: style(idle).borderTopColor, refresh: style(refresh).borderTopColor };
	});
	assert.equal(hot.active, "rgb(28, 28, 30)");
	assert.equal(hot.idle, "rgb(224, 226, 232)");
	assert.equal(hot.refresh, "rgba(0, 0, 0, 0)");
	const toastTop = await page.evaluate(() => {
		const toast = document.getElementById("nspp-settings")?.shadowRoot?.querySelector(".toast");
		return toast ? parseFloat(getComputedStyle(toast).top) : null;
	});
	if (toastTop !== null) assert.ok(toastTop >= 78, `提示条压在顶栏上：top ${toastTop}px`);
	assert.deepEqual(errors, []);
	await context.close();
});

test("消息中心与设置页：外层主栏不再多套一张卡片；资料读取中一行显示；设置项标签在输入框上方", async () => {
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: messageCenterPage() });
		await page.waitForSelector(".nspp-messages:not([hidden])");
		await settle(page, 600);
		const state = await page.evaluate(() => {
			const main = getComputedStyle(document.getElementById("nsk-body-left"));
			const data = document.querySelector(".nspp-chat-profile-data");
			return { padding: main.paddingTop, background: main.backgroundColor, data: data && !data.children.length ? getComputedStyle(data).display : "block" };
		});
		assert.equal(state.padding, "0px");
		assert.equal(state.background, "rgba(0, 0, 0, 0)");
		assert.equal(state.data, "block");
		assert.deepEqual(errors, []);
		await context.close();
	}
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage() });
		await page.waitForSelector("html[data-nsmax-theme]");
		await settle(page, 500);
		const state = await page.evaluate(() => {
			const label = document.querySelector("label:has(>input[type=email])"), input = label.querySelector("input");
			const text = document.createRange();
			text.selectNodeContents(label.firstChild);
			return {
				above: text.getBoundingClientRect().bottom <= input.getBoundingClientRect().top,
				panel: getComputedStyle(document.querySelector("#nsk-body-left>.nsk-panel")).borderTopWidth,
				select: getComputedStyle(document.querySelector("select")).appearance
			};
		});
		assert.ok(state.above, "标签文字没有在输入框上方");
		assert.equal(state.panel, "0px");
		assert.equal(state.select, "none");
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("右侧栏「快捷入口」面板默认隐藏（与用户卡片重复），关闭开关后恢复显示", async () => {
	for (const [seed, visible] of [[undefined, false], [{ "nspp:settings:www.nodeseek.com": { "modern-theme": { hideQuickAccess: false } } }, true]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
		await page.waitForSelector(".nsmax-hot-panel", { timeout: 5e3 });
		await settle(page, 300);
		const state = await page.evaluate(() => ({ display: getComputedStyle(document.querySelector(".nsk-panel.quick-access")).display, beforeQuick: document.querySelector(".nsmax-hot-panel").nextElementSibling?.classList.contains("quick-access") }));
		assert.equal(state.display !== "none", visible);
		assert.ok(state.beforeQuick, "热榜仍插在快捷入口前面");
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("评论框（参考 Claude 的输入框）：输入区在最上面，工具栏与「内容 / 预览」一行，表情分类、上传与发送按钮一行；发送按钮是珊瑚色方形箭头", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("[data-nsmax-submit-row] .nspp-upload-choose");
	await page.waitForSelector("ul.comments .nspp-user-badges .nspp-age", { timeout: 8e3 });
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		const middle = (rect) => rect.top + rect.height / 2;
		const input = box(".md-editor>textarea"), tabs = box(".md-editor>.tab-select"), tools = box(".md-editor>.mde-toolbar"), expression = box(".md-editor>.expression"), submit = box(".md-editor button.submit"), editor = box(".md-editor");
		const style = getComputedStyle(document.querySelector(".md-editor"));
		const button = document.querySelector(".md-editor button.submit");
		const badge = document.querySelector("ul.comments .nspp-user-badges .nspp-age");
		return {
			inputFirst: input.bottom <= tools.top + 1 && input.bottom <= tabs.top + 1,
			toolRow: Math.abs(middle(tabs) - middle(tools)) < 6 && tabs.left >= tools.right - 1,
			footerRow: Math.abs(middle(submit) - middle(expression)) < 6 && submit.left > expression.right && expression.top >= tools.bottom - 1,
			insideEditor: submit.right <= editor.right && submit.bottom <= editor.bottom,
			radius: style.borderTopLeftRadius,
			shadow: style.boxShadow !== "none",
			send: [Math.round(submit.width), Math.round(submit.height), getComputedStyle(button).backgroundColor, getComputedStyle(button).fontSize, button.title],
			sendIcon: getComputedStyle(button, "::before").width,
			badgeBorder: getComputedStyle(badge).borderTopWidth,
			badgeBackground: getComputedStyle(badge).backgroundColor,
			badgeIcon: [getComputedStyle(badge, "::before").content, getComputedStyle(badge.querySelector("svg")).display]
		};
	});
	assert.ok(state.inputFirst, "输入区不在工具栏上方");
	assert.ok(state.toolRow, "「内容 / 预览」与工具栏不在同一行");
	assert.ok(state.footerRow, "表情分类与发送按钮不在同一行");
	assert.ok(state.insideEditor, "发送按钮超出评论框");
	assert.equal(state.radius, "24px");
	assert.ok(state.shadow, "评论框没有投影");
	assert.deepEqual(state.send, [32, 32, "rgb(193, 95, 60)", "0px", "发布评论"]);
	assert.equal(state.sendIcon, "16px");
	assert.equal(state.badgeBorder, "0px");
	assert.equal(state.badgeBackground, "rgb(236, 235, 227)");
	assert.deepEqual(state.badgeIcon, ['""', "none"]);
	await shot(page, "post-editor-claude");
	assert.deepEqual(errors, []);
	await context.close();
	// sb.sb 风格：同一套布局，12px 圆角、黑色胶囊发送按钮
	const sb = await open(browser, "https://www.nodeseek.com/post-1000-1", { seed: SBSB, html: postPage() });
	await sb.page.waitForSelector("[data-nsmax-submit-row] .nspp-upload-choose");
	await settle(sb.page, 300);
	const look = await sb.page.evaluate(() => {
		const button = getComputedStyle(document.querySelector(".md-editor button.submit"));
		return [getComputedStyle(document.querySelector(".md-editor")).borderTopLeftRadius, button.backgroundColor, button.borderTopLeftRadius];
	});
	assert.deepEqual(look, ["12px", "rgb(28, 28, 30)", "999px"]);
	assert.deepEqual(sb.errors, []);
	await sb.context.close();
});

test("Claude 风格（默认）：米白底、主栏不套卡片、珊瑚色发帖按钮、10px 圆角按钮、圆形头像、帖子标题衬线体", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector(".nsmax-hot-panel .nsmax-hot-list li a", { timeout: 5e3 });
	await settle(page, 300);
	const list = await page.evaluate(() => {
		const css = (selector, pseudo) => getComputedStyle(document.querySelector(selector), pseudo);
		return {
			palette: document.documentElement.dataset.nsmaxPalette,
			canvas: css("body").backgroundColor,
			main: css("#nsk-body-left").backgroundColor,
			nav: css("#nsk-left-panel-container .nsk-panel").backgroundColor,
			card: css("[data-nsmax-usercard]").backgroundColor,
			cta: [css("[data-nsmax-cta]", "::before").backgroundColor, css("[data-nsmax-cta]", "::before").borderTopLeftRadius],
			pager: [css(".nsk-pager .pager-cur").borderTopLeftRadius, css(".nsk-pager .pager-cur").backgroundColor],
			avatar: css(".post-list-item img.avatar-normal").borderTopLeftRadius,
			chip: css(".post-list-item .post-category").borderTopLeftRadius,
			header: css("#nsk-head").borderBottomColor
		};
	});
	assert.deepEqual(list, {
		palette: "claude",
		canvas: "rgb(245, 244, 237)",
		main: "rgba(0, 0, 0, 0)",
		nav: "rgba(0, 0, 0, 0)",
		card: "rgb(251, 250, 246)",
		cta: ["rgb(193, 95, 60)", "10px"],
		pager: ["10px", "color(srgb 0.121569 0.117647 0.113725 / 0.08)"],
		avatar: "50%",
		chip: "6px",
		header: "rgba(0, 0, 0, 0)"
	});
	await shot(page, "claude-list");
	await context.close();
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await settle(post.page, 600);
	const title = await post.page.evaluate(() => getComputedStyle(document.querySelector(".post-title h1")));
	const font = await post.page.evaluate(() => [getComputedStyle(document.querySelector(".post-title h1")).fontFamily, getComputedStyle(document.querySelector(".nsk-post .post-content p")).fontFamily, getComputedStyle(document.querySelector(".post-list-item, .nsk-content-meta-info")).fontFamily]);
	assert.match(font[0], /Georgia/);
	assert.match(font[1], /Georgia/);
	assert.match(font[2], /^"?Inter/);
	assert.ok(title);
	assert.deepEqual(errors, []);
	assert.deepEqual(post.errors, []);
	await post.context.close();
});

test("线条图标：版块、用户卡片按钮、统计区、深浅色切换与搜索换成统一线条图标，原图标只隐藏；统计区文字不被打乱", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark }) });
		await page.waitForSelector(".user-stat .nspp-notification-link", { timeout: 8e3 }).catch(() => {});
		await settle(page, 400);
		const state = await page.evaluate(() => {
			const icons = (context) => document.querySelectorAll(`.nsmax-icon[data-nsmax-icon-for=${context}]`).length;
			const toggle = document.querySelector("[data-nsmax-own-header=colors] .nsmax-icon");
			return {
				nav: icons("nav"),
				card: icons("card"),
				stat: icons("stat") >= 6,
				originalsHidden: Array.from(document.querySelectorAll("[data-nsmax-icon-orig]")).every((icon) => getComputedStyle(icon).display === "none"),
				moon: getComputedStyle(toggle.querySelector(".nsmax-icon-moon")).display,
				sun: getComputedStyle(toggle.querySelector(".nsmax-icon-sun")).display,
				search: icons("search"),
				labels: Array.from(document.querySelectorAll(".user-stat a, .user-stat .stat-block > div")).map((item) => item.textContent.replace(/\s+/g, "").replace(/\d+$/, "")),
				stroke: getComputedStyle(document.querySelector(".nsmax-icon")).strokeWidth
			};
		});
		assert.equal(state.nav, 13);
		assert.equal(state.card, 3);
		assert.ok(state.stat, "统计区图标没有替换");
		assert.ok(state.originalsHidden, "原图标没有隐藏");
		// 深浅色按钮显示当前模式：浅色是太阳、深色是月亮
		assert.deepEqual([state.moon, state.sun], dark ? ["inline", "none"] : ["none", "inline"]);
		assert.equal(state.search, 1);
		for (const label of ["等级Lv", "鸡腿", "主题帖", "评论数", "私信"]) assert.ok(state.labels.some((text) => text.startsWith(label)), `统计区缺少「${label}」：${state.labels.join("、")}`);
		assert.equal(state.stroke, "1.5px");
		// 站点重新渲染、原图标被换成新节点：只配一个线条图标，不重复
		await page.evaluate(() => {
			const old = document.querySelector("#nsk-left-panel-container li a svg[data-nsmax-icon-orig]");
			const fresh = old.cloneNode(true);
			fresh.removeAttribute("data-nsmax-icon-orig");
			old.replaceWith(fresh);
		});
		await settle(page, 400);
		const counts = await page.evaluate(() => Array.from(document.querySelectorAll("#nsk-left-panel-container li a")).map((link) => link.querySelectorAll(".nsmax-icon").length));
		assert.ok(counts.every((count) => count === 1), counts.join(","));
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("按钮里的图标与文字都在正中（纯图标按钮误差 0.6px 以内，文字上下居中误差 1px 以内）", async () => {
	const probe = () => {
		const out = [];
		const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; };
		for (const el of document.querySelectorAll("button, a, [role=button], .toolbar-item, [data-nsmax-header-toggle]")) {
			if (!visible(el)) continue;
			const cs = getComputedStyle(el);
			const r = el.getBoundingClientRect();
			const svgs = Array.from(el.querySelectorAll("svg")).filter((svg) => visible(svg) && !svg.parentElement.closest("svg"));
			const text = Array.from(el.childNodes).filter((node) => node.nodeType === 3).map((node) => node.data).join("").trim();
			if (svgs.length === 1 && (!text || parseFloat(cs.fontSize) === 0) && !el.querySelector("span:not(:empty)")) {
				const s = svgs[0].getBoundingClientRect();
				const dx = s.left + s.width / 2 - (r.left + r.width / 2), dy = s.top + s.height / 2 - (r.top + r.height / 2);
				if (Math.abs(dx) > 0.6 || Math.abs(dy) > 0.6) out.push(`${el.className || el.title} 图标偏移 ${dx.toFixed(1)},${dy.toFixed(1)}`);
			} else if (text && !svgs.length && parseFloat(cs.fontSize) === 0 && /flex/.test(cs.display) && !/^(none|normal)$/.test(getComputedStyle(el, "::before").content)) {
				// 文字缩成 0 字号、只显示 ::before 图标的按钮（帖子页的发送按钮）：隐藏的文字仍是一个弹性项，
				// 间距会把图标推偏。用文字节点的位置反推图标中心：图标在文字前，中间隔着 gap
				const range = document.createRange();
				range.selectNodeContents(el);
				const t = range.getBoundingClientRect();
				const dx = t.left - (parseFloat(cs.columnGap) || 0) - parseFloat(getComputedStyle(el, "::before").width) / 2 - (r.left + r.width / 2);
				if (Math.abs(dx) > 0.6) out.push(`${el.className || text} 图标偏移 ${dx.toFixed(1)}`);
			} else if (text && !svgs.length && parseFloat(cs.fontSize) > 0 && r.height <= 40 && /flex|grid/.test(cs.display) && el.matches("button,.btn,.nsk-pager a")) {
				const range = document.createRange();
				range.selectNodeContents(el);
				const t = range.getBoundingClientRect();
				const dy = t.top + t.height / 2 - (r.top + r.height / 2);
				if (Math.abs(dy) > 1) out.push(`${el.className || text} 文字偏移 ${dy.toFixed(1)}`);
			}
		}
		return out;
	};
	for (const [url, html] of [["https://www.nodeseek.com/", listPage()], ["https://www.nodeseek.com/post-1000-1", postPage()], ["https://www.nodeseek.com/notification#/message?mode=talk&to=7", messageCenterPage()]]) {
		const { context, page, errors } = await open(browser, url, { html });
		await settle(page, 1200);
		await page.evaluate(() => document.querySelector("[data-nspp-copy]")?.style.setProperty("opacity", "1"));
		assert.deepEqual(await page.evaluate(probe), [], url);
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("圆角统一（Claude 风格）：各页面、私信 / 通知、设置面板、弹窗里的圆角只有 6 / 10 / 16 / 24px 四档，另外只有头像、角标、开关等是圆形", async () => {
	const probe = () => {
		const allowed = new Set(["6px", "10px", "16px", "24px", "50%"]);
		const bad = [];
		const roots = [document, ...Array.from(document.querySelectorAll("*")).filter((element) => element.shadowRoot).map((element) => element.shadowRoot)];
		for (const root of roots) for (const element of root.querySelectorAll("*")) {
			const box = element.getBoundingClientRect();
			if (box.width < 4 || box.height < 4) continue;
			const style = getComputedStyle(element);
			if (style.display === "none" || style.visibility === "hidden") continue;
			if (style.backgroundColor === "rgba(0, 0, 0, 0)" && style.borderTopWidth === "0px" && style.boxShadow === "none" && !/^(IMG|INPUT|BUTTON|TEXTAREA|SELECT)$/.test(element.tagName)) continue;
			for (const corner of ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"]) {
				const radius = style[corner];
				if (radius === "0px" || allowed.has(radius)) continue;
				if (radius.endsWith("px") && parseFloat(radius) >= Math.min(box.width, box.height) / 2 - 0.5) continue;
				bad.push(`${element.tagName.toLowerCase()}.${String(element.className?.baseVal ?? element.className).trim().split(/\s+/).slice(0, 2).join(".")} ${Math.round(box.width)}x${Math.round(box.height)} ${corner}=${radius}`);
				break;
			}
		}
		return Array.from(new Set(bad));
	};
	const pages = [
		["https://www.nodeseek.com/", listPage()],
		["https://www.nodeseek.com/post-1000-1", postPage()],
		["https://www.nodeseek.com/notification#/message?mode=talk&to=7", messageCenterPage()],
		["https://www.nodeseek.com/notification#/atMe", messageCenterPage()],
		["https://www.nodeseek.com/new-discussion", newPostPage()],
		["https://www.nodeseek.com/setting#/profile", settingPage()]
	];
	for (const [url, html] of pages) {
		const { context, page, errors } = await open(browser, url, { html });
		await settle(page, 1500);
		assert.deepEqual(await page.evaluate(probe), [], url);
		if (url === "https://www.nodeseek.com/") {
			await page.click("[data-nspp-settings-launcher]");
			await settle(page, 600);
			assert.deepEqual(await page.evaluate(probe), [], "设置面板");
			await page.keyboard.press("Escape");
			await settle(page, 300);
			await page.hover(".post-list-item .info-author");
			await page.waitForSelector(".nspp-user-hover:not([hidden]) dd", { timeout: 8e3 });
			await settle(page, 300);
			assert.deepEqual(await page.evaluate(probe), [], "用户资料卡");
			await page.mouse.move(5, 600);
			await page.click('#nspp-tools button[title^="帖子监控"]');
			await settle(page, 600);
			assert.deepEqual(await page.evaluate(probe), [], "帖子监控");
			await page.keyboard.press("Escape");
			await settle(page, 300);
			for (const [selector, name] of [["[data-nsmax-own-header=colors]", "深浅色菜单"], ["[data-nsmax-own-header=keywords]", "关键词屏蔽"]]) {
				await page.click(selector);
				await settle(page, 300);
				assert.deepEqual(await page.evaluate(probe), [], name);
				await page.keyboard.press("Escape");
			}
		}
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("字号与字重统一（Claude 风格）：界面文字只用 11–16 / 18 / 20 / 24px 这几档字号和 400 / 500 / 600 三档字重；帖子正文里作者写的标题不算", async () => {
	const probe = () => {
		const sizes = new Set(["11px", "12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px"]);
		const weights = new Set(["400", "500", "600"]);
		const content = ".post-content,.comment-content,.markdown-body,.nspp-notice-body,.nspp-preview-content,.nspp-messages-bubble.is-markdown,code,pre,kbd,samp";
		const bad = [];
		const roots = [document, ...Array.from(document.querySelectorAll("*")).filter((element) => element.shadowRoot).map((element) => element.shadowRoot)];
		for (const root of roots) for (const element of root.querySelectorAll("*")) {
			if (!Array.from(element.childNodes).some((child) => child.nodeType === 3 && child.textContent.trim())) continue;
			if (element.closest(content) || /^(SCRIPT|STYLE|TITLE|OPTION)$/.test(element.tagName)) continue;
			const box = element.getBoundingClientRect();
			if (box.width < 1 || box.height < 1) continue;
			const style = getComputedStyle(element);
			if (style.visibility === "hidden" || style.fontSize === "0px") continue;
			if (!sizes.has(style.fontSize) || !weights.has(style.fontWeight)) bad.push(`${element.tagName.toLowerCase()}.${String(element.className?.baseVal ?? element.className).trim().split(/\s+/).slice(0, 2).join(".")} ${style.fontSize}/${style.fontWeight}`);
		}
		return Array.from(new Set(bad));
	};
	const pages = [
		["https://www.nodeseek.com/", listPage()],
		["https://www.nodeseek.com/post-1000-1", postPage()],
		["https://www.nodeseek.com/notification#/message?mode=talk&to=7", messageCenterPage()],
		["https://www.nodeseek.com/notification#/atMe", messageCenterPage()],
		["https://www.nodeseek.com/new-discussion", newPostPage()],
		["https://www.nodeseek.com/setting#/profile", settingPage()]
	];
	for (const [url, html] of pages) {
		const { context, page, errors } = await open(browser, url, { html });
		await settle(page, 1500);
		assert.deepEqual(await page.evaluate(probe), [], url);
		if (url === "https://www.nodeseek.com/") {
			await page.click("[data-nspp-settings-launcher]");
			await settle(page, 600);
			assert.deepEqual(await page.evaluate(probe), [], "设置面板");
			await page.keyboard.press("Escape");
			await settle(page, 300);
			await page.hover(".post-list-item .info-author");
			await page.waitForSelector(".nspp-user-hover:not([hidden]) dd", { timeout: 8e3 });
			await settle(page, 300);
			assert.deepEqual(await page.evaluate(probe), [], "用户资料卡");
			await page.mouse.move(5, 600);
			for (const [selector, name] of [["[data-nsmax-own-header=colors]", "深浅色菜单"], ["[data-nsmax-own-header=keywords]", "关键词屏蔽"]]) {
				await page.click(selector);
				await settle(page, 300);
				assert.deepEqual(await page.evaluate(probe), [], name);
				await page.keyboard.press("Escape");
			}
		}
		assert.deepEqual(errors, []);
		await context.close();
	}
});

test("私信（参考 Claude 的会话界面）：左侧会话列表是通高的圆角浮层；选中会话后资料卡就是会话头，标题栏只留右上角按钮；自己的消息不带头像，对方连续消息只显示一个头像，自己连续的气泡相接圆角收小；格式工具默认收起", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: messageCenterPage() });
	await page.waitForSelector(".nspp-chat-profile-data .nspp-chat-profile-stat", { timeout: 8e3 });
	await settle(page, 300);
	const layout = await page.evaluate(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		const root = box(".nspp-messages"), sidebar = box(".nspp-messages-workspace:not(.nspp-notice-workspace)>.nspp-messages-sidebar"), profile = box(".nspp-chat-profile"), actions = box(".nspp-messages-top-actions");
		const thread = document.querySelector(".nspp-messages-thread");
		const theirs = thread.querySelector(".nspp-messages-message:not(.is-mine,.is-system)");
		thread.append(theirs.cloneNode(true), theirs.cloneNode(true));
		const mineGroup = [thread.querySelector(".nspp-messages-message.is-mine").cloneNode(true), thread.querySelector(".nspp-messages-message.is-mine").cloneNode(true)];
		thread.append(...mineGroup);
		const group = Array.from(thread.querySelectorAll(".nspp-messages-message")).slice(-4, -2);
		const visible = (element) => !!element && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
		const tools = Array.from(document.querySelectorAll(".nspp-message-editor-toolbar>*")).filter(visible).map((element) => element.dataset.tool || element.textContent);
		return {
			sidebarFull: sidebar.height >= root.height - 20 && Math.abs((sidebar.top - root.top) - (root.bottom - sidebar.bottom)) <= 1,
			sidebarRadius: getComputedStyle(document.querySelector(".nspp-messages-workspace:not(.nspp-notice-workspace)>.nspp-messages-sidebar")).borderTopLeftRadius,
			heading: visible(document.querySelector(".nspp-messages-top .nspp-messages-heading:not([hidden])")),
			actionsOverProfile: actions.top >= profile.top && actions.bottom <= profile.bottom && actions.right <= profile.right,
			mineAvatar: visible(thread.querySelector(".nspp-messages-message.is-mine>.nspp-chat-avatar-link")),
			groupAvatars: group.map((message) => visible(message.querySelector(".nspp-chat-avatar-link"))),
			groupCorners: mineGroup.map((message) => [getComputedStyle(message.querySelector(".nspp-messages-bubble")).borderTopRightRadius, getComputedStyle(message.querySelector(".nspp-messages-bubble")).borderBottomRightRadius]),
			tools,
			toggle: visible(document.querySelector(".nspp-message-format-toggle"))
		};
	});
	assert.deepEqual(layout, {
		sidebarFull: true,
		sidebarRadius: "16px",
		heading: false,
		actionsOverProfile: true,
		mineAvatar: false,
		groupAvatars: [false, false],
		groupCorners: [["16px", "6px"], ["6px", "16px"]],
		tools: ["image"],
		toggle: true
	});
	await page.click(".nspp-message-format-toggle");
	const opened = await page.evaluate(() => ({
		expanded: document.querySelector(".nspp-message-format-toggle").getAttribute("aria-expanded"),
		tools: Array.from(document.querySelectorAll(".nspp-message-editor-toolbar>*")).filter((element) => getComputedStyle(element).display !== "none").length
	}));
	assert.deepEqual(opened, { expanded: "true", tools: 18 });
	// 没选会话时仍有标题栏
	await page.evaluate(() => { location.hash = "#/message?mode=list"; });
	await settle(page, 600);
	assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".nspp-messages-top .nspp-messages-heading:not([hidden])")).display), "flex");
	// @我：桌面上不显示手机布局才用的「联系人」返回按钮，搜索框的放大镜落在输入框里
	await page.evaluate(() => { location.hash = "#/atMe"; });
	await page.waitForSelector(".nspp-notice-workspace:not([hidden]) .nspp-messages-search input", { timeout: 8e3 });
	await settle(page, 600);
	const notice = await page.evaluate(() => {
		const search = document.querySelector(".nspp-notice-workspace .nspp-messages-search");
		const input = search.querySelector("input").getBoundingClientRect(), icon = getComputedStyle(search, "::before");
		const left = search.getBoundingClientRect().left + parseFloat(icon.left);
		return { back: Array.from(document.querySelectorAll(".nspp-messages-back")).map((button) => getComputedStyle(button).display), iconInside: left > input.left && left < input.left + 24 };
	});
	assert.deepEqual(notice, { back: notice.back.map(() => "none"), iconInside: true });
	assert.ok(notice.back.length > 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("私信（参考 Claude 的输入框）：输入框浮在会话区底部、与会话头同样缩进 8px 的 16px 圆角卡片带投影，发送按钮是珊瑚色圆角方形箭头；自己的气泡暖灰；对方的消息像 Claude 的回复，不带气泡、衬线正文", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: messageCenterPage() });
	await page.waitForSelector(".nspp-messages-message.is-mine .nspp-messages-bubble", { timeout: 8e3 });
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const css = (selector) => getComputedStyle(document.querySelector(selector));
		const send = document.querySelector(".nspp-messages-send").getBoundingClientRect();
		return {
			composer: [css(".nspp-messages-composer").borderTopLeftRadius, css(".nspp-messages-composer").backgroundColor, css(".nspp-messages-composer").boxShadow !== "none", css(".nspp-messages-composer").marginBottom],
			send: [Math.round(send.width), Math.round(send.height), css(".nspp-messages-send").backgroundColor, css(".nspp-messages-send").fontSize, css(".nspp-messages-send").borderTopLeftRadius],
			mine: css(".nspp-messages-message.is-mine .nspp-messages-bubble").backgroundColor,
			theirs: (() => { const bubble = css(".nspp-messages-message:not(.is-mine):not(.is-system) .nspp-messages-bubble"); return [bubble.backgroundColor, bubble.borderTopWidth, /Tiempos|Serif/.test(bubble.fontFamily)]; })(),
			resize: css(".nspp-message-editor-body textarea").resize
		};
	});
	assert.deepEqual(state, {
		composer: ["16px", "rgb(251, 250, 246)", true, "8px"],
		send: [32, 32, "rgb(193, 95, 60)", "0px", "10px"],
		mine: "rgb(235, 233, 224)",
		theirs: ["rgba(0, 0, 0, 0)", "0px", true],
		resize: "none"
	});
	await shot(page, "messages-claude");
	assert.deepEqual(errors, []);
	await context.close();
});

test("设置面板（参考 claude.ai 网页版）：整块米白底，顶栏、底栏不再是白色横条也没有分隔线，标题衬线体，16px 圆角", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nspp-settings-launcher]", { timeout: 5e3 });
	await page.click("[data-nspp-settings-launcher]");
	await page.waitForFunction(() => document.getElementById("nspp-settings")?.shadowRoot?.querySelector("dialog")?.open);
	await settle(page, 400);
	const state = await page.evaluate(() => {
		const shadow = document.getElementById("nspp-settings").shadowRoot;
		const css = (selector) => getComputedStyle(shadow.querySelector(selector));
		return {
			dialog: [css("dialog").backgroundColor, css("dialog").borderTopLeftRadius],
			header: [css("header").backgroundColor, css("header").borderBottomWidth],
			footer: [css(".settings-footer").backgroundColor, css(".settings-footer").borderTopWidth],
			title: css(".heading h2").fontFamily,
			categories: css(".categories").borderRightWidth,
			article: css(".settings-workspace article").backgroundColor,
			primary: css(".settings-footer .primary").borderTopLeftRadius
		};
	});
	assert.deepEqual(state.dialog, ["rgb(245, 244, 237)", "16px"]);
	assert.deepEqual(state.header, ["rgba(0, 0, 0, 0)", "0px"]);
	assert.deepEqual(state.footer, ["rgba(0, 0, 0, 0)", "0px"]);
	assert.match(state.title, /Georgia/);
	assert.equal(state.categories, "0px");
	assert.equal(state.article, "rgba(0, 0, 0, 0)");
	assert.equal(state.primary, "10px");
	await shot(page, "settings-claude");
	assert.deepEqual(errors, []);
	await context.close();
});

test("发帖页：标题是大号白色输入框，正文编辑器加高，发送按钮显示箭头与文字", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/new-discussion", { html: newPostPage() });
	await settle(page, 800);
	const state = await page.evaluate(() => {
		const title = document.querySelector(".post-title-input");
		const button = document.querySelector(".md-editor button.submit");
		return {
			page: document.documentElement.dataset.nsmaxPage,
			title: [Math.round(title.getBoundingClientRect().height), getComputedStyle(title).borderTopLeftRadius, getComputedStyle(title).backgroundColor],
			editor: Math.round(document.querySelector(".md-editor textarea").getBoundingClientRect().height) >= 360,
			button: [getComputedStyle(button).backgroundColor, parseFloat(getComputedStyle(button).fontSize) > 0, getComputedStyle(button, "::before").width]
		};
	});
	assert.deepEqual(state, { page: "new", title: [48, "10px", "rgb(251, 250, 246)"], editor: true, button: ["rgb(193, 95, 60)", true, "16px"] });
	await shot(page, "new-discussion");
	assert.deepEqual(errors, []);
	await context.close();
});

test("细节：作者行各项按中线对齐、「引用 / 回复」带图标、输入时输入区没有单独的聚焦边框、用户卡片按钮与名字左对齐、「屏蔽」有图标", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("ul.comments .nspp-user-badges .nspp-age", { timeout: 8e3 });
	await settle(page, 400);
	await page.click(".md-editor textarea");
	await page.keyboard.type("测试");
	const state = await page.evaluate(() => {
		const li = document.querySelector("ul.comments li");
		const middle = (element) => { const box = element.getBoundingClientRect(); return box.top + box.height / 2; };
		const centers = Array.from(li.querySelectorAll(".author-info > a, .nspp-user-badges > *, .role-tag, a.floor-link")).map(middle);
		const quote = getComputedStyle(li.querySelector(".comment-menu .menu-item[title=引用]"), "::before");
		const textarea = getComputedStyle(document.querySelector(".md-editor textarea"));
		const name = document.querySelector("[data-nsmax-usercard] .user-name").getBoundingClientRect();
		const icon = document.querySelector("[data-nsmax-usercard] .nsmax-icon[data-nsmax-icon-for=card]").getBoundingClientRect();
		return {
			spread: Math.max(...centers) - Math.min(...centers),
			quote: [quote.content, quote.width],
			textarea: [textarea.boxShadow, textarea.borderBottomWidth],
			iconLeft: Math.abs(icon.left - name.left)
		};
	});
	assert.ok(state.spread <= 1.2, `作者行上下错开 ${state.spread.toFixed(1)}px`);
	assert.deepEqual(state.quote, ['""', "14px"]);
	assert.deepEqual(state.textarea, ["none", "0px"]);
	assert.ok(state.iconLeft <= 1, `用户卡片图标与名字错开 ${state.iconLeft.toFixed(1)}px`);
	await context.close();
	const list = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await settle(list.page, 400);
	await list.page.hover(".post-list-item .info-author");
	await list.page.waitForSelector(".nspp-user-hover:not([hidden]) .nspp-block-toggle", { timeout: 8e3 });
	const block = await list.page.evaluate(() => {
		const button = document.querySelector(".nspp-user-hover:not([hidden]) .nspp-block-toggle");
		return [getComputedStyle(button, "::before").content, getComputedStyle(button.querySelector("svg")).display];
	});
	assert.deepEqual(block, ['""', "none"]);
	assert.deepEqual(errors, []);
	assert.deepEqual(list.errors, []);
	await list.context.close();
});

test("细节（v1.5.8）：设置面板点最后一个分类能跳到并高亮它；主帖操作按钮一行排开；输入框聚焦是很淡的光晕", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("[data-nspp-settings-launcher]", { timeout: 5e3 });
	await page.click("[data-nspp-settings-launcher]");
	await page.waitForFunction(() => document.getElementById("nspp-settings")?.shadowRoot?.querySelector("dialog")?.open);
	await settle(page, 400);
	await page.evaluate(() => {
		const links = document.getElementById("nspp-settings").shadowRoot.querySelectorAll(".categories a");
		links[links.length - 1].click();
	});
	await settle(page, 1000);
	const jump = await page.evaluate(() => {
		const shadow = document.getElementById("nspp-settings").shadowRoot;
		const content = shadow.querySelector(".content");
		return { current: shadow.querySelector(".categories a[aria-current]")?.textContent, bottom: content.scrollTop + content.clientHeight >= content.scrollHeight - 2 };
	});
	assert.deepEqual(jump, { current: "关于", bottom: true });
	await context.close();
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await settle(post.page, 800);
	const actions = await post.page.evaluate(() => Array.from(document.querySelectorAll(".nsk-post > .comment-menu .menu-item")).map((item) => {
		const box = item.getBoundingClientRect();
		return [getComputedStyle(item).flexDirection, Math.round(box.height), Math.round(box.top)];
	}));
	assert.ok(actions.length >= 3);
	assert.ok(actions.every(([direction, height, top]) => direction === "row" && height === 32 && top === actions[0][2]), JSON.stringify(actions));
	assert.deepEqual(errors, []);
	assert.deepEqual(post.errors, []);
	await post.context.close();
	const setting = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage() });
	await settle(setting.page, 600);
	await setting.page.focus("input[name=email]");
	await settle(setting.page, 400);
	const ring = await setting.page.evaluate(() => getComputedStyle(document.querySelector("input[name=email]")).boxShadow);
	assert.match(ring, /0\.07\)/, ring);
	assert.deepEqual(setting.errors, []);
	await setting.context.close();
});

test("深浅色：点右上角按钮弹出「浅色 / 深色 / 跟随系统」菜单，选中后由脚本决定深浅色并在刷新后保留；跟随系统时随系统切换，按钮显示显示器图标", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), colorScheme: "dark" });
	await settle(page, 1200);
	assert.equal(await page.evaluate(() => document.documentElement.dataset.nsmaxColorMode), "site");
	await page.click("[data-nsmax-own-header=colors]");
	await page.waitForSelector(".nsmax-pop[data-kind=colors]");
	const menu = await page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-pop [role=menuitemradio]")).map((item) => [item.textContent, item.getAttribute("aria-checked")]));
	assert.deepEqual(menu, [["浅色", "true"], ["深色", "false"], ["跟随系统", "false"]]);
	// 再点一次按钮关闭；Esc 也能关闭
	await page.click("[data-nsmax-own-header=colors]");
	assert.equal(await page.evaluate(() => !!document.querySelector(".nsmax-pop")), false);
	await page.click("[data-nsmax-own-header=colors]");
	await page.keyboard.press("Escape");
	assert.equal(await page.evaluate(() => !!document.querySelector(".nsmax-pop")), false);
	await page.click("[data-nsmax-own-header=colors]");
	await page.click(".nsmax-pop [role=menuitemradio]:nth-child(2)");
	assert.deepEqual(await page.evaluate(() => [document.body.classList.contains("dark-layout"), !!document.querySelector(".nsmax-pop")]), [true, false]);
	await page.reload();
	await settle(page, 1200);
	assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.nsmaxColorMode, document.body.classList.contains("dark-layout")]), ["dark", true]);
	await page.click("[data-nsmax-own-header=colors]");
	await page.click(".nsmax-pop [role=menuitemradio]:nth-child(3)");
	const system = await page.evaluate(() => ({
		dark: document.body.classList.contains("dark-layout"),
		icons: Array.from(document.querySelectorAll("[data-nsmax-own-header=colors] .nsmax-icon path")).filter((path) => getComputedStyle(path).display !== "none").map((path) => path.getAttribute("class"))
	}));
	assert.deepEqual(system, { dark: true, icons: ["nsmax-icon-display"] });
	await page.emulateMedia({ colorScheme: "light" });
	await settle(page, 200);
	assert.equal(await page.evaluate(() => document.body.classList.contains("dark-layout")), false);
	await page.reload();
	await settle(page, 1200);
	assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.nsmaxColorMode, document.body.classList.contains("dark-layout")]), ["system", false]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("关键词屏蔽：顶栏深浅色按钮旁的屏蔽按钮可以添加、删除关键词，立即隐藏命中的帖子与侧栏热榜条目；可选同时匹配评论内容", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await settle(page, 1500);
	const button = await page.evaluate(() => {
		const action = document.querySelector(".nsmax-header-action");
		return { adjacent: action?.nextElementSibling === document.querySelector("[data-nsmax-own-header=colors]"), label: action?.getAttribute("aria-label") };
	});
	assert.deepEqual(button, { adjacent: true, label: "关键词屏蔽" });
	await page.click(".nsmax-header-action");
	await page.waitForSelector(".nsmax-pop[data-kind=keywords] input");
	await page.keyboard.type("docker");
	await page.keyboard.press("Enter");
	await page.keyboard.type("/热帖 ?3：/");
	await page.keyboard.press("Enter");
	await settle(page, 300);
	const state = await page.evaluate(() => ({
		chips: Array.from(document.querySelectorAll(".nsmax-pop-chips li span")).map((chip) => chip.textContent),
		hidden: Array.from(document.querySelectorAll(".post-list-item")).filter((item) => item.hidden).map((item) => item.querySelector(".post-title a").textContent),
		hot: Array.from(document.querySelectorAll(".nsmax-hot-list .nsmax-hot-rank")).map((rank) => rank.textContent).slice(0, 4),
		count: document.querySelector(".nsmax-pop-count").textContent
	}));
	assert.deepEqual(state, { chips: ["docker", "/热帖 ?3：/"], hidden: ["分享一个 Docker 一键部署脚本"], hot: ["1", "2", "4", "5"], count: "本页已屏蔽 2 条" });
	await page.click(".nsmax-pop-chips li:first-child button");
	await settle(page, 300);
	assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll(".post-list-item")).filter((item) => item.hidden).length), 0);
	await page.keyboard.press("Escape");
	await page.reload();
	await settle(page, 1500);
	assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-hot-list .nsmax-hot-rank")).map((rank) => rank.textContent).slice(0, 3)), ["1", "2", "4"]);
	assert.deepEqual(errors, []);
	await context.close();
	// 评论内容：默认不匹配，打开「也匹配评论内容」后命中的楼层隐藏
	const seed = { "nspp:settings:www.nodeseek.com": { "content-filter": { keywords: "私信你" } } };
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), seed });
	await settle(post.page, 1500);
	const floors = () => post.page.evaluate(() => Array.from(document.querySelectorAll(".comments .content-item")).filter((item) => item.hidden).length);
	assert.equal(await floors(), 0);
	await post.page.click(".nsmax-header-action");
	await post.page.click(".nsmax-pop-foot input[type=checkbox]");
	await settle(post.page, 300);
	assert.equal(await floors(), 1);
	assert.deepEqual(post.errors, []);
	await post.context.close();
});

test("设置面板（参考 Claude 的设置页）：设计风格、深浅色、字体是带预览的选择卡片，方向键可切换，点「深色」并保存后生效；功能之间不套卡片", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await settle(page, 1200);
	await page.click("[data-nspp-settings-launcher]");
	await settle(page, 600);
	const groups = await page.evaluate(() => Array.from(document.getElementById("nspp-settings").shadowRoot.querySelectorAll(".choice-cards")).map((group) => [group.getAttribute("aria-label"), Array.from(group.children).map((card) => `${card.textContent}${card.getAttribute("aria-checked") === "true" ? "*" : ""}`)]));
	assert.deepEqual(groups, [["设计风格", ["Claude*", "sb.sb"]], ["字体", ["AaClaude*", "AaInter", "Aa系统字体", "Aa站点默认"]], ["深浅色", ["跟随站点*", "浅色", "深色", "跟随系统"]]]);
	const hidden = await page.evaluate(() => Array.from(document.getElementById("nspp-settings").shadowRoot.querySelectorAll(".field[data-cards] select")).every((select) => getComputedStyle(select).display === "none"));
	assert.equal(hidden, true);
	// 方向键在同一组里切换
	await page.evaluate(() => document.getElementById("nspp-settings").shadowRoot.querySelector('.choice-cards[aria-label="深浅色"] [aria-checked=true]').focus());
	await page.keyboard.press("ArrowRight");
	assert.equal(await page.evaluate(() => document.getElementById("nspp-settings").shadowRoot.querySelector('.choice-cards[aria-label="深浅色"] [aria-checked=true]').textContent), "浅色");
	await page.evaluate(() => document.getElementById("nspp-settings").shadowRoot.querySelector('.choice-cards[aria-label="深浅色"] [data-value=dark]').click());
	await page.evaluate(() => Array.from(document.getElementById("nspp-settings").shadowRoot.querySelectorAll("button")).find((button) => button.textContent === "保存并刷新").click());
	await page.waitForLoadState("load");
	await settle(page, 1200);
	assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.nsmaxColorMode, document.body.classList.contains("dark-layout")]), ["dark", true]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("按钮与输入框统一（Claude 风格）：常规按钮 32px、输入框与下拉框 36px；提示条与热榜弹窗用线条图标，热榜类型是分段切换", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await settle(page, 1500);
	const heights = (selector) => page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).filter((element) => element.getBoundingClientRect().height > 0).map((element) => Math.round(element.getBoundingClientRect().height)), selector);
	assert.deepEqual([...new Set(await heights(".nsk-pager :is(a,span), #nsk-body-left>button.nspp-action"))], [32]);
	const toast = await page.evaluate(() => { const toast = document.getElementById("nspp-settings").shadowRoot.querySelector(".toast"); return [!!toast.querySelector(".toast-icon svg"), !!toast.querySelector(".toast-close svg"), toast.querySelector(".toast-close").textContent]; });
	assert.deepEqual(toast, [true, true, ""]);
	await page.click('#nspp-tools button[title^="帖子监控"]');
	await settle(page, 600);
	assert.deepEqual([...new Set(await heights(".nspp-monitor[open]>header>button:not(:last-child), .nspp-monitor[open]>footer>button"))], [32]);
	await page.keyboard.press("Escape");
	await page.click('#nspp-tools button[title="NodeSeek 热榜"]');
	await settle(page, 600);
	const hot = await page.evaluate(() => {
		const dialog = document.querySelector(".nspp-hot-rankings[open]");
		const group = dialog.querySelector(".nspp-hot-kinds"), refresh = dialog.querySelector(".nspp-hot-refresh");
		return { tabs: group.querySelectorAll("button[data-ranking]").length, groupBg: getComputedStyle(group).backgroundColor !== "rgba(0, 0, 0, 0)", refresh: [Math.round(refresh.getBoundingClientRect().width), getComputedStyle(refresh).fontSize], heat: getComputedStyle(dialog.querySelector(".nspp-hot-heat svg") || dialog).strokeWidth };
	});
	assert.deepEqual(hot, { tabs: 3, groupBg: true, refresh: [32, "0px"], heat: "1.5px" });
	await page.keyboard.press("Escape");
	await page.click("[data-nspp-settings-launcher]");
	await settle(page, 600);
	const panel = await page.evaluate(() => {
		const root = document.getElementById("nspp-settings").shadowRoot;
		const visible = (element) => element.getBoundingClientRect().height > 0;
		return {
			inputs: [...new Set(Array.from(root.querySelectorAll("input:not([type=checkbox],[type=color]), select")).filter(visible).map((element) => Math.round(element.getBoundingClientRect().height)))],
			footer: [...new Set(Array.from(root.querySelectorAll(".settings-footer button")).filter(visible).map((element) => Math.round(element.getBoundingClientRect().height)))]
		};
	});
	assert.deepEqual(panel, { inputs: [36], footer: [32] });
	assert.deepEqual(errors, []);
	await context.close();
	const setting = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage() });
	await settle(setting.page, 1200);
	const form = await setting.page.evaluate(() => ({
		fields: [...new Set(Array.from(document.querySelectorAll("#nsk-body :is(input[type=email],select)")).map((element) => Math.round(element.getBoundingClientRect().height)))],
		buttons: [...new Set(Array.from(document.querySelectorAll("#nsk-body .actions button")).map((element) => Math.round(element.getBoundingClientRect().height)))],
		checkbox: (() => { const box = document.querySelector("#nsk-body input[type=checkbox]"); const cs = getComputedStyle(box); return [cs.appearance, Math.round(box.getBoundingClientRect().width), cs.backgroundColor]; })()
	}));
	assert.deepEqual(form, { fields: [36], buttons: [32], checkbox: ["none", 16, "rgb(31, 30, 29)"] });
	// 设置页的按钮规则只管主栏，右侧热榜的分段切换保持 26px
	assert.deepEqual([...new Set(await setting.page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-hot-tabs button")).map((button) => Math.round(button.getBoundingClientRect().height))))], [26]);
	assert.deepEqual(setting.errors, []);
	await setting.context.close();
});

test("用户脚本元数据与版本一致", () => {
	const source = fs.readFileSync(path.join(ROOT, "nodeseek-max.user.js"), "utf8");
	const meta = fs.readFileSync(path.join(ROOT, "nodeseek-max.meta.js"), "utf8");
	const header = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
	assert.ok(header);
	assert.equal(meta.trim(), header.trim());
	const version = header.match(/^\/\/ @version\s+(\S+)$/m)?.[1];
	assert.match(header, /^\/\/ @icon\s+data:image\/svg\+xml;base64,/m);
	assert.ok(header.indexOf("@match        https://www.nodeseek.com/*") < header.indexOf("@include"), "NodeSeek 应排在匹配列表最前");
	assert.equal(source.match(/var NSMAX_VERSION = "([^"]+)";/)?.[1], version);
});

test("列表控件：排序是分段控件、页码是幽灵按钮，按网址判断当前页，站点结构多层包裹或全标 active 也能识别", async () => {
	for (const pagerMode of [undefined, "wrapped"]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ pagerMode }) });
		await page.waitForSelector("[data-nsmax-sorter]");
		await settle(page, 300);
		const state = await page.evaluate(() => {
			const css = (element) => getComputedStyle(element);
			const sorter = document.querySelector("[data-nsmax-sorter]");
			const items = Array.from(document.querySelectorAll(".pager-top [data-nsmax-pg]"));
			return {
				sorter: [css(sorter).display, css(sorter).height, css(sorter).borderTopLeftRadius],
				separator: css(document.querySelector("[data-nsmax-sort-sep]")).display,
				on: document.querySelector("[data-nsmax-sort-on]").textContent,
				onBackground: css(document.querySelector("[data-nsmax-sort-on]")).backgroundColor,
				offBackground: css(document.querySelector("[data-nsmax-sort-item]:not([data-nsmax-sort-on])")).backgroundColor,
				kinds: items.map((item) => `${item.dataset.nsmaxPg}${item.hasAttribute("data-nsmax-pg-cur") ? "*" : ""}${item.hasAttribute("data-nsmax-pg-off") ? "-" : ""}`).join(" "),
				heights: [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().height)))],
				borders: [...new Set(items.map((item) => css(item).borderTopWidth))],
				plain: css(items.find((item) => item.dataset.nsmaxPg === "num" && !item.hasAttribute("data-nsmax-pg-cur"))).backgroundColor,
				arrow: `${getComputedStyle(items.at(-1), "::before").maskImage} ${getComputedStyle(items.at(-1), "::before").webkitMaskImage}`,
				wraps: Array.from(document.querySelectorAll(".pager-top [data-nsmax-pg-wrap]")).map((element) => css(element).display)
			};
		});
		assert.deepEqual(state.sorter, ["flex", "32px", "10px"], pagerMode);
		assert.equal(state.separator, "none");
		assert.equal(state.on, "新评论");
		assert.equal(state.onBackground, "rgb(253, 252, 249)");
		assert.equal(state.offBackground, "rgba(0, 0, 0, 0)");
		assert.equal(state.kinds, "prev- num* num num gap num next", pagerMode);
		assert.deepEqual(state.heights, [32]);
		assert.deepEqual(state.borders, ["0px"]);
		assert.equal(state.plain, "rgba(0, 0, 0, 0)");
		assert.match(state.arrow, /svg/);
		assert.ok(state.wraps.every((display) => display === "contents"), state.wraps.join());
		assert.deepEqual(errors, []);
		await context.close();
	}
	// 第 3 页：当前页按网址判断；站点没标状态时也对。
	const third = listPage({ pagerMode: "wrapped" });
	const { context, page } = await open(browser, "https://www.nodeseek.com/page-3", { html: third });
	await page.waitForSelector("[data-nsmax-pg-cur]");
	assert.equal(await page.evaluate(() => document.querySelector(".pager-top [data-nsmax-pg-cur]").textContent.trim()), "3");
	await context.close();
});

test("窗口较窄、站点收起左侧栏时：顶栏保留版块标签（不含 DeepFlood），左侧栏可见时不显示；关掉侧栏导航功能也照常判断", async () => {
	const seeds = [undefined, { "nspp:settings:www.nodeseek.com": { "sidebar-nav": { enabled: false } } }];
	for (const seed of seeds) {
		const wide = await open(browser, "https://www.nodeseek.com/categories/tech", { html: listPage(), seed });
		await wide.page.waitForSelector("[data-nsmax-header-cat]", { state: "attached" });
		await settle(wide.page, 300);
		const wideState = await wide.page.evaluate(() => ({
			sidenav: document.documentElement.hasAttribute("data-nsmax-sidenav"),
			visible: Array.from(document.querySelectorAll("#nsk-head a")).filter((link) => link.offsetParent && link.getBoundingClientRect().width > 0).map((link) => link.textContent.trim()).filter((text) => text && text !== "NodeSeek"),
			action: getComputedStyle(document.querySelector(".nsmax-header-action")).display
		}));
		assert.equal(wideState.sidenav, true, `seed ${JSON.stringify(seed)}`);
		assert.deepEqual(wideState.visible, []);
		assert.match(wideState.action, /flex/);
		await wide.page.setViewportSize({ width: 905, height: 800 });
		await settle(wide.page, 400);
		const narrow = await wide.page.evaluate(() => {
			const links = Array.from(document.querySelectorAll("#nsk-head a")).filter((link) => link.getBoundingClientRect().width > 0 && getComputedStyle(link).display !== "none");
			const cats = links.filter((link) => link.hasAttribute("data-nsmax-header-cat"));
			const boxes = cats.map((link) => link.getBoundingClientRect());
			const header = document.querySelector("#nsk-head").getBoundingClientRect();
			return {
				sidenav: document.documentElement.hasAttribute("data-nsmax-sidenav"),
				labels: cats.map((link) => link.textContent.trim()),
				on: document.querySelector("[data-nsmax-header-cat-on]")?.textContent,
				onBackground: getComputedStyle(document.querySelector("[data-nsmax-header-cat-on]")).backgroundColor,
				heights: [...new Set(boxes.map((box) => Math.round(box.height)))],
				gaps: boxes.slice(1).map((box, index) => Math.round(box.left - boxes[index].right)),
				oneRow: new Set(boxes.map((box) => Math.round(box.top))).size === 1,
				inside: links.every((link) => link.getBoundingClientRect().left >= header.left && link.getBoundingClientRect().right <= header.right),
				action: getComputedStyle(document.querySelector(".nsmax-header-action")).display,
				search: Math.round(document.querySelector("[data-nsmax-header-search]").getBoundingClientRect().width)
			};
		});
		assert.equal(narrow.sidenav, false);
		assert.deepEqual(narrow.labels, ["日常", "技术", "情报", "测评", "交易", "拼车", "推广"]);
		assert.equal(narrow.on, "技术");
		assert.notEqual(narrow.onBackground, "rgba(0, 0, 0, 0)");
		assert.deepEqual(narrow.heights, [32]);
		assert.ok(narrow.gaps.every((gap) => gap === 2), narrow.gaps.join());
		assert.ok(narrow.oneRow && narrow.inside, JSON.stringify(narrow));
		assert.match(narrow.action, /flex/);
		assert.ok(narrow.search >= 168 && narrow.search <= 240, narrow.search);
		if (!seed) await shot(wide.page, "narrow-header");
		assert.deepEqual(wide.errors, []);
		await wide.context.close();
	}
});

test("悬停预加载：同标签页链接用 Speculation Rules，新标签页打开的帖子用 link prefetch，每个地址只预取一次", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector(".post-title a[target=_blank]");
	await settle(page, 300);
	await page.locator(".pager-top a.pager-pos[href='/page-2']").hover();
	await page.waitForTimeout(300);
	await page.locator("ul.post-list .post-title a").first().hover();
	await page.waitForTimeout(300);
	await page.locator(".pager-top a.pager-pos[href='/page-2']").hover();
	await page.waitForTimeout(300);
	const nodes = await page.evaluate(() => Array.from(document.querySelectorAll("script[type=speculationrules], link[rel=prefetch]")).map((node) => node.tagName === "SCRIPT" ? JSON.parse(node.textContent).prefetch[0].urls[0] : `link ${node.href}`));
	assert.deepEqual(nodes, ["https://www.nodeseek.com/page-2", "link https://www.nodeseek.com/post-1000-1"]);
	assert.deepEqual(errors, []);
	await context.close();
});

test("站内跳转：新页面还没整理好时先停在旧页面，整理好后交叉淡入（不跳过过渡）", async () => {
	const init = `window.addEventListener("pagereveal", (event) => { window.__reveal = { transition: !!event.viewTransition, hold: document.documentElement.hasAttribute("data-nsmax-vt-hold") }; event.viewTransition?.ready.then(() => window.__animated = true, () => window.__animated = false); setTimeout(() => window.__holdLater = document.documentElement.hasAttribute("data-nsmax-vt-hold"), 0); });`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages: { "/page-2": listPage() }, init });
	await settle(page, 400);
	await page.locator(".pager-top a.pager-pos[href='/page-2']").click();
	await page.waitForURL("**/page-2");
	await page.waitForFunction(() => window.__animated !== undefined);
	await settle(page, 600);
	const state = await page.evaluate(() => ({ reveal: window.__reveal, animated: window.__animated, hold: document.documentElement.hasAttribute("data-nsmax-vt-hold"), boot: ["header", "left", "right"].filter((name) => document.documentElement.hasAttribute(`data-nsmax-boot-${name}`)) }));
	assert.equal(state.reveal.transition, true);
	assert.equal(state.animated, true);
	assert.equal(state.hold, false);
	assert.deepEqual(state.boot, []);
	assert.deepEqual(errors, []);
	await context.close();
});

test("脚本管理器在 <html> 已存在时才注入（Chrome 上 Tampermonkey 的实际时机）：脚本不中断，各功能照常启动", async () => {
	for (const [url, html] of [["https://www.nodeseek.com/", listPage()], ["https://www.nodeseek.com/post-1000-1", postPage()], ["https://www.nodeseek.com/setting", settingPage()]]) {
		const { context, page, errors } = await open(browser, url, { html, injectWhenRoot: true });
		await page.waitForSelector("#nspp-tools", { timeout: 5e3 });
		await settle(page, 600);
		const state = await page.evaluate(() => ({
			injectError: window.__injectError || null,
			theme: document.documentElement.hasAttribute("data-nsmax-theme"),
			sidenav: document.documentElement.hasAttribute("data-nsmax-sidenav"),
			hidden: document.querySelectorAll("[data-nsmax-hidden]").length,
			cta: !!document.querySelector("[data-nsmax-cta]"),
			boot: ["header", "left", "right"].filter((name) => document.documentElement.hasAttribute(`data-nsmax-boot-${name}`))
		}));
		assert.deepEqual(state, { injectError: null, theme: true, sidenav: true, hidden: 5, cta: true, boot: [] }, url);
		if (url.endsWith("/")) await page.waitForSelector(".nsmax-hot-panel", { timeout: 5e3 });
		assert.deepEqual(errors, [], url);
		await context.close();
	}
});

test("站点的深浅色切换只是一个裸图标（svg / img）时：顶栏照样有脚本自己的深浅色按钮，不会只剩屏蔽按钮", async () => {
	for (const icon of ["svg", "img"]) {
		const bare = icon === "svg" ? `<svg class="theme-switch" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>` : `<img class="theme-switch" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'/%3E" width="18" height="18" alt="">`;
		const html = listPage().replace(/<div class="color-theme-switcher">[\s\S]*?<\/div>/, bare);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, injectWhenRoot: true });
		await page.waitForSelector("[data-nsmax-own-header=colors]", { timeout: 5e3 });
		await settle(page, 400);
		const state = await page.evaluate(() => {
			const box = (selector) => {
				const rect = document.querySelector(selector).getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			};
			// 顶栏右侧可见的图标都在按钮里（没有游离在外、点不了的图标）
			const stray = Array.from(document.querySelectorAll("#nsk-head > :is(svg, img)")).filter((element) => element.getBoundingClientRect().width > 0).length;
			return { colors: box("[data-nsmax-own-header=colors]"), keywords: box("[data-nsmax-own-header=keywords]"), order: document.querySelector("[data-nsmax-own-header=keywords]").nextElementSibling?.dataset.nsmaxOwnHeader, stray };
		});
		assert.deepEqual(state, { colors: true, keywords: true, order: "colors", stray: 0 }, icon);
		await page.click("[data-nsmax-own-header=colors]");
		await page.waitForSelector(".nsmax-pop[data-kind=colors]");
		assert.deepEqual(errors, [], icon);
		await context.close();
	}
});

test("加载性能护栏：根元素上没有 :has()（会让任何 DOM 变化都触发整页样式重算），最右边的 :is() 已拆成可分桶的规则", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed: { "nspp:settings:www.nodeseek.com": { "modern-theme": { colorMode: "dark" } } } });
	await settle(page, 800);
	const state = await page.evaluate(() => {
		const selectors = [];
		const walk = (rules) => {
			for (const rule of rules) {
				if (rule.selectorText) selectors.push(rule.selectorText);
				else if (rule.cssRules) walk(rule.cssRules);
			}
		};
		for (const sheet of document.styleSheets) try { walk(sheet.cssRules); } catch {}
		const parts = selectors.flatMap((text) => text.split(/,(?![^(]*\))/).map((part) => part.trim()));
		return {
			rootHas: parts.filter((part) => /^html[^\s>+~]*:has\(/.test(part)).slice(0, 5),
			rightmostIs: parts.filter((part) => /^html\[data-nsmax-theme\]\S*\s+:is\([^()]*\)$/.test(part)).length,
			dark: document.documentElement.hasAttribute("data-nsmax-dark"),
			canvas: getComputedStyle(document.body).backgroundColor
		};
	});
	assert.deepEqual(state.rootHas, []);
	assert.ok(state.rightmostIs < 20, `仍有 ${state.rightmostIs} 条最右边是 :is() 的规则`);
	assert.equal(state.dark, true);
	assert.equal(state.canvas, "rgb(38, 38, 36)");
	assert.deepEqual(errors, []);
	await context.close();
});
