"use strict";
// 冒烟测试：node --test tests/  （需要 playwright 与 Chromium）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launch, open, ROOT } = require("./harness.cjs");
const { listPage, postPage, notificationPage } = require("./fixtures/pages.cjs");

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
	assert.equal(hot.canvas, "rgb(250, 250, 250)");
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
		cta: getComputedStyle(document.querySelector("[data-nsmax-cta]")).backgroundColor,
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
	assert.equal(card.stat, "rgba(0, 0, 0, 0.05)");
	assert.equal(card.cta, "rgb(24, 24, 27)");
	assert.equal(card.badge, "rgb(24, 24, 27)");
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
	assert.equal(colors.canvas, "rgb(9, 9, 11)");
	assert.equal(colors.text, "rgb(250, 250, 250)");
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

test("翻页：页码不加边框圆圈，当前页只用加粗深色文字区分", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await settle(page, 300);
	const state = await page.evaluate(() => Array.from(document.querySelectorAll(".nsk-pager :is(a,span)")).map((element) => {
		const style = getComputedStyle(element);
		return { text: element.textContent.trim(), border: style.borderTopColor, background: style.backgroundColor, weight: style.fontWeight };
	}));
	assert.ok(state.length >= 2);
	for (const item of state) {
		assert.equal(item.border, "rgba(0, 0, 0, 0)", `页码 ${item.text} 仍有边框`);
		assert.equal(item.background, "rgba(0, 0, 0, 0)", `页码 ${item.text} 有背景`);
	}
	assert.equal(state.find((item) => item.text === "1").weight, "700");
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

test("新用户面板：头像排成规整的 4 列网格，用户卡片图标保持原生间距", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
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

test("精简顶栏：只保留标志、标题与深浅色切换，窄屏恢复搜索框", async () => {
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
	assert.deepEqual(layout.shown, ["site-logo", "beta", "tool-btn"]);
	assert.equal(layout.toggleAttr, true);
	assert.equal(layout.sameRow, true);
	assert.equal(layout.apart, true);
	await page.setViewportSize({ width: 700, height: 900 });
	await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-sidenav"), null, { timeout: 3e3 });
	assert.equal(await visible("#nsk-head .search-box"), 1);
	assert.deepEqual(errors, []);
	await context.close();
});

test("没有左侧版块栏的页面：顶栏不插入快捷入口、不跳动，宽屏同样精简顶栏", async () => {
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
	assert.deepEqual(state.shown, ["site-logo", "beta", "tool-btn"]);
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
	assert.equal(state.canvas, "rgb(250, 250, 250)");
	assert.equal(state.grid, "none");
	assert.equal(state.row, "solid");
	assert.equal(state.stat, "rgba(0, 0, 0, 0.05)");
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
	assert.equal(look.card, "14px");
	await settle(page, 200);
	await shot(page, "settings");
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
