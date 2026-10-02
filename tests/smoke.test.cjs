"use strict";
// 冒烟测试：node --test tests/  （需要 playwright 与 Chromium）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launch, open, ROOT } = require("./harness.cjs");
const { listPage, postPage, notificationPage, messageCenterPage, settingPage } = require("./fixtures/pages.cjs");

const SHOTS = process.env.NSMAX_SCREENSHOTS;
let browser;

test.before(async () => {
	browser = await launch();
});
test.after(async () => {
	await browser?.close();
});

const settle = (page, ms = 600) => page.waitForTimeout(ms);
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ dark: true }), colorScheme: "dark" });
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
	assert.equal(state.background, "rgb(255, 255, 255)");
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ dark: true }) });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 300);
	const state = await page.evaluate(() => {
		const pager = document.querySelector(".nsk-pager");
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
	await page.waitForSelector("[data-nsmax-header-toggle]", { timeout: 5e3 });
	await settle(page, 200);
	const visible = (selector) => page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).filter((element) => element.getClientRects().length > 0).length, selector);
	const layout = await page.evaluate(() => {
		const shown = (element) => element.getClientRects().length > 0;
		const head = document.querySelector("#nsk-head .nsk-container");
		const logo = document.querySelector(".site-logo").getBoundingClientRect();
		const toggle = document.querySelector(".tool-btn").getBoundingClientRect();
		return {
			shown: Array.from(head.querySelectorAll("a, sup, input, .search-box, .tool-btn")).filter(shown).map((element) => element.className || element.tagName.toLowerCase()),
			toggleAttr: document.querySelector(".tool-btn").hasAttribute("data-nsmax-header-toggle"),
			sameRow: Math.abs(logo.top + logo.height / 2 - (toggle.top + toggle.height / 2)) < 6,
			apart: toggle.left - logo.right > 400
		};
	});
	assert.deepEqual(layout.shown, ["site-logo", "beta", "search-box", "input", "tool-btn"]);
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
	await page.waitForSelector("[data-nsmax-header-toggle]", { timeout: 5e3 });
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
		shown: Array.from(document.querySelectorAll("#nsk-head .nsk-container a, #nsk-head .nsk-container sup, #nsk-head .search-box, #nsk-head .tool-btn")).filter((element) => element.getClientRects().length > 0).map((element) => element.className || element.tagName.toLowerCase())
	}));
	assert.equal(state.flips, 0);
	assert.equal(state.sidenav, false);
	assert.equal(state.shortcutInHeader, false);
	assert.deepEqual(state.shown, ["site-logo", "beta", "search-box", "tool-btn"]);
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
	assert.equal(state.iconSize, 17);
	assert.equal(state.itemSize, 30);
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
	assert.equal(state.canvas, "rgb(247, 248, 250)");
	assert.equal(state.grid, "none");
	assert.equal(state.row, "solid");
	assert.equal(state.stat, "rgb(250, 251, 252)");
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
	assert.equal(look.card, "12px");
	await settle(page, 200);
	await shot(page, "settings");
	assert.deepEqual(errors, []);
	await context.close();
});

test("工具弹窗：回帖足迹统一成卡片式模态框，关闭按钮为线条图标，主要按钮用强调色，空状态居中", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark }) });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
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
	let { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
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
	({ context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() }));
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 400);
	const post = await page.evaluate(() => {
		const name = document.querySelector('.nsk-post .author-info a[href*="/space/"]');
		const content = document.querySelector(".nsk-post > .post-content");
		return { indent: Math.round(content.getBoundingClientRect().left - name.getBoundingClientRect().left), title: getComputedStyle(document.querySelector(".post-title h1")).fontSize };
	});
	assert.ok(Math.abs(post.indent) <= 2, `主楼正文应与作者名对齐，偏差 ${post.indent}px`);
	assert.equal(post.title, "21px");
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
		main: document.getElementById("nsk-left").getBoundingClientRect().width,
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: messageCenterPage() });
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const css = (selector, prop) => getComputedStyle(document.querySelector(selector))[prop];
		return {
			page: document.documentElement.dataset.nsmaxPage,
			input: css("input[type=email]", "backgroundColor"),
			inputRadius: css("input[type=email]", "borderRadius"),
			submit: css("button[type=submit]", "backgroundColor"),
			cancel: css("button[type=button]", "backgroundColor"),
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
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages: { "/post-1000-1": postPage() } });
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
			const main = getComputedStyle(document.getElementById("nsk-left"));
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
				panel: getComputedStyle(document.querySelector("#nsk-left>.nsk-panel")).borderTopWidth,
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

test("评论框（重新设计）：「内容 / 预览」与工具栏同一行，表情分类与发布评论同一行；作者行徽章为无边框软标签", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector("[data-nsmax-submit-row] .nspp-upload-choose");
	await page.waitForSelector("ul.comments .nspp-user-badges .nspp-age", { timeout: 8e3 });
	await settle(page, 500);
	const state = await page.evaluate(() => {
		const box = (selector) => document.querySelector(selector).getBoundingClientRect();
		const tabs = box(".md-editor>.tab-select"), tools = box(".md-editor>.mde-toolbar"), expression = box(".md-editor>.expression"), submit = box(".md-editor button.submit"), editor = box(".md-editor");
		const badge = getComputedStyle(document.querySelector("ul.comments .nspp-user-badges .nspp-age"));
		return {
			headerRow: Math.abs(tabs.top - tools.top) < 2 && tools.left > tabs.right - 1,
			footerRow: submit.top > expression.top - 4 && submit.bottom < expression.bottom + 8 && submit.left > expression.right,
			insideEditor: submit.right <= editor.right && submit.bottom <= editor.bottom,
			radius: getComputedStyle(document.querySelector(".md-editor")).borderTopLeftRadius,
			badgeBorder: badge.borderTopWidth,
			badgeBackground: badge.backgroundColor
		};
	});
	assert.ok(state.headerRow, "「内容 / 预览」与工具栏不在同一行");
	assert.ok(state.footerRow, "表情分类与发布评论不在同一行");
	assert.ok(state.insideEditor, "发布评论超出评论框");
	assert.equal(state.radius, "12px");
	assert.equal(state.badgeBorder, "0px");
	assert.equal(state.badgeBackground, "rgb(242, 244, 247)");
	assert.deepEqual(errors, []);
	await context.close();
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
