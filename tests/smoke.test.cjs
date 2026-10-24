"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { searchOverlayPage, providersPage, friendsPage, invitePage, creditGuestPage, notificationGuestPage, settingGuestPage, fansGuestPage, listPage, searchPage, luckyPage, postPage, notificationPage, settingPage, nativeMessagePage, nativeTalkPage, nativeSpacePage, newPostPage, spaceTopicsPage, spaceCommentsPage, boardPage, fansPage, creditPage, spaceCollectionsPage, signInPage, emailSignInPage, smsSignInPage, registerPage, rulingPage, boardRealPage, spaceGeneralPage, specialPostPage, progressPage } = require("./fixtures/pages.cjs");

let browser;
const wait = (page, ms = 500) => page.waitForTimeout(ms);
// 列表里的帖子都当作已经按内容查过抽奖（2026-10-23 起列表里每篇都会在后台查一次）：测预览、预取、请求数的几条用，免得后台查抽奖的请求混进来
const CHECKED_INIT = `;if (window.top === window) localStorage.setItem("nsmax:special-checked", JSON.stringify(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [String(1000 + i), Date.now()]))));`;
// 量「后台一篇一篇查」的测试里关掉帖子悬停预览：它在页面空下来时用普通优先级先取首屏 4 篇（和后台查共用一份），不算后台请求
const NO_PREVIEW = { "nspp:settings:www.nodeseek.com": { "post-preview": { enabled: false } } };
// NodeSeek 自己的偏好（IndexedDB ns-preference-db / ns-preference-store / configuration），页面脚本运行前写好
const sitePrefInit = (openPostInNewPage) => `(() => { const r = indexedDB.open("ns-preference-db", 1); r.onupgradeneeded = () => r.result.createObjectStore("ns-preference-store"); r.onsuccess = () => { const db = r.result; const tx = db.transaction("ns-preference-store", "readwrite"); tx.objectStore("ns-preference-store").put({ openPostInNewPage: ${openPostInNewPage}, autoDarkMode: false, darkModeFollow: "system" }, "configuration"); tx.oncomplete = () => db.close(); }; })();`;

test.before(async () => {
	browser = await launch();
});

test.after(async () => {
	await browser?.close();
});

test("外链跳转：知乎中转页直达目标地址", async () => {
	const { context, page } = await open(browser, "https://link.zhihu.com/?target=https%3A%2F%2Fexample.com%2Fpath%3Fa%3D1");
	await page.waitForURL("https://example.com/path?a=1", { timeout: 5e3 });
	await context.close();
});

test("列表页：SB Theme UI 套件生效且首屏结构稳定", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	await page.waitForSelector("html[data-nsmax-theme]");
	await wait(page);
	const state = await page.evaluate(() => ({
		page: document.documentElement.dataset.nsmaxPage,
		canvas: getComputedStyle(document.body).backgroundColor,
		list: document.querySelectorAll(".post-item").length,
		aliases: document.querySelectorAll(".post-item").length === document.querySelectorAll("ul.post-list > li").length,
		header: document.querySelector(".top .bar .brand") !== null,
		search: document.querySelector(".search-form .search-input") !== null,
		fastNav: getComputedStyle(document.querySelector("#fast-nav-button-group")).display,
		tools: getComputedStyle(document.querySelector("#nspp-tools")).display,
		padding: getComputedStyle(document.querySelector(".post-item")).padding
	}));
	assert.equal(state.page, "list");
	assert.equal(state.canvas, "rgb(247, 248, 250)");
	assert.equal(state.list, 6);
	assert.equal(state.aliases, true);
	assert.equal(state.header, true);
	assert.equal(state.search, true);
	// 回到顶部 / 底部照 sb.sb .to-top 显示（以前整组藏起来）
	assert.equal(state.fastNav, "block");
	assert.equal(state.tools, "none");
	assert.equal(state.padding, "11px 66px 11px 14px");
	assert.deepEqual(errors, []);
	await context.close();
});

test("列表页：资料卡和热榜恢复，删除信用分，NQ 在顶栏最后，「精华」在列表工具条（2026-10-18）", async () => {
const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	await wait(page);
	const state = await page.evaluate(() => ({
		right: getComputedStyle(document.querySelector("#nsk-right-panel-container")).display,
		card: getComputedStyle(document.querySelector(".user-card")).display,
		quick: getComputedStyle(document.querySelector(".quick-access")).display,
		hot: !!document.querySelector(".nsmax-hot-panel"),
		nq: [...document.querySelectorAll("a")].some((a) => /nodequality|^NQ$/i.test(a.textContent.trim()))
	}));
	assert.equal(state.right, "flex");
	assert.equal(state.card, "block");
	assert.equal(state.quick, "none");
	assert.equal(state.hot, true);
	assert.equal(state.nq, true);
	assert.equal(await page.locator(".post-list-controler .nsmax-nq-entry").count(),0);
	assert.equal(await page.locator("#nsk-head ul.nav-menu > li.nsmax-nq-tab-item:last-child > a.nsmax-nq-tab").count(),1);
	assert.equal(await page.locator("#nsk-head .nsmax-essence-tab-item").count(),0, "顶栏不再有「精华」");
	assert.equal(await page.locator(".post-list-controler > .nsmax-kind-tabs > a.nsmax-kind-tab[data-kind=award][href='/award']").count(),1, "「精华」在列表工具条");
	assert.equal(await page.locator(".pager-top").isVisible(),false);
	assert.equal(await page.locator(".pager-bottom").isVisible(),true);
	assert.equal(await page.locator(".nspp-trust").count(), 0);
	assert.equal(Object.keys(calls).filter(key => key.startsWith("/api/account/getInfo/")).length, 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("帖子页：SB Theme UI 正文、代码块、回复流和操作块生效", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	await page.waitForSelector(".post-entry");
	await wait(page);
	const state = await page.evaluate(() => ({
		page: document.documentElement.dataset.nsmaxPage,
		entry: document.querySelectorAll(".post-entry").length,
		comments: document.querySelectorAll(".comment-item").length,
		code: getComputedStyle(document.querySelector(".post-content pre")).borderRadius,
		actions: document.querySelector(".topic-actions") !== null,
		editor: (() => { const editor = document.querySelector(".md-editor"); return !!editor && !!editor.getClientRects().length; })(),
		fastNav: getComputedStyle(document.querySelector("#fast-nav-button-group")).display
	}));
	assert.equal(state.page, "post");
	assert.equal(state.entry, 1);
	assert.equal(state.comments, 3);
	assert.equal(state.code, "8px");
	assert.equal(state.actions, true);
	assert.equal(state.editor, true);
	assert.equal(state.fastNav, "block");
	assert.deepEqual(errors, []);
	await context.close();
});

test("深色模式：套件表面、文字和操作色同步切换", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark: true }), colorScheme: "dark" });
	await wait(page);
	const state = await page.evaluate(() => ({
		dark: document.documentElement.hasAttribute("data-nsmax-dark"),
		canvas: getComputedStyle(document.body).backgroundColor,
		card: getComputedStyle(document.querySelector("ul.post-list")).backgroundColor,
		text: getComputedStyle(document.querySelector(".post-title a")).color
	}));
	assert.equal(state.dark, true);
	assert.equal(state.canvas, "rgb(13, 14, 20)");
	assert.equal(state.card, "rgb(20, 21, 28)");
	assert.ok(state.text.length > 0);
	assert.deepEqual(errors, []);
	await context.close();
});

test("跟随系统：不受站点 dark-layout 干扰，并随系统媒体查询切换", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "modern-theme": { colorMode: "system" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark: true }), seed, colorScheme: "light" });
	try {
		await wait(page);
		const light = await page.evaluate(() => ({
			mode: document.documentElement.dataset.nsmaxColorMode,
			dark: document.documentElement.hasAttribute("data-nsmax-dark"),
			bodyDark: document.body.classList.contains("dark-layout")
		}));
		assert.deepEqual(light, { mode: "system", dark: false, bodyDark: false });
		await page.evaluate(() => document.body.classList.add("dark-layout"));
		await page.waitForTimeout(30);
		assert.equal(await page.locator("html").evaluate(e => e.hasAttribute("data-nsmax-dark")), false);
		await page.emulateMedia({ colorScheme: "dark" });
		await page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-dark"));
		assert.equal(await page.locator("body").evaluate(e => e.classList.contains("dark-layout")), true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("通知页：按需加载 SB 消息中心，原站列表隐藏且不请求用户资料", async () => {
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/notification#", { html: notificationPage() });
	await page.waitForSelector(".nsk-notification");
	await wait(page);
	const state = await page.evaluate(() => ({
		page: document.documentElement.dataset.nsmaxPage,
		tabs: document.querySelectorAll(".app-title").length,
		rows: document.querySelectorAll(".reply-item").length,
		rowRadius: getComputedStyle(document.querySelector(".reply-container")).borderRadius,
		tools: document.querySelector("#nspp-tools"),
		messages: !!document.querySelector(".nspp-messages"),
		editor: document.querySelector(".md-editor")
	}));
	assert.equal(state.page, "notification");
	assert.equal(state.tabs, 3);
	assert.equal(state.rows, 2);
	assert.equal(state.rowRadius, "12px");
	assert.equal(state.tools, null);
	assert.equal(state.messages, true);
	assert.equal(await page.locator(".nspp-messages").isVisible(),true);
	assert.equal(await page.locator(".reply-container").isVisible(),false);
	assert.equal(Object.keys(calls).some(key=>key.startsWith("/api/account/getInfo/")),false);
	assert.equal(calls["/api/notification/message/list"] || 0,0);
	assert.equal(state.editor, null);
	assert.deepEqual(errors, []);
	await context.close();
});

test("设置页：单栏 SB Theme UI 表单，不加载右栏和工具条", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage() });
	await page.waitForSelector("html[data-nsmax-theme]");
	await wait(page);
	const state = await page.evaluate(() => ({
		page: document.documentElement.dataset.nsmaxPage,
		right: document.querySelector("#nsk-right-panel-container"),
		tools: document.querySelector("#nspp-tools"),
		panel: getComputedStyle(document.querySelector("#user-setting-panel .selector-right-side")).borderRadius,
		side: getComputedStyle(document.querySelector("#user-setting-panel .selector-left-side")).borderRadius,
		order: document.querySelector("#user-setting-panel .selector-right-side").getBoundingClientRect().right <= document.querySelector("#user-setting-panel .selector-left-side").getBoundingClientRect().left,
		input: getComputedStyle(document.querySelector("#user-setting-panel input[type=text]")).borderRadius,
		nav: document.querySelectorAll("#user-setting-panel .select-item").length,
		fields: document.querySelectorAll("#user-setting-panel .personal-info fieldset").length,
		save: document.querySelector("#user-setting-panel .personal-info button.btn") !== null,
		footer: document.querySelector("body > footer") ? getComputedStyle(document.querySelector("body > footer")).display : "none"
	}));
	assert.equal(state.page, "setting");
	assert.equal(state.right, null);
	assert.equal(state.tools, null);
	assert.equal(state.panel, "12px");
	assert.equal(state.side, "12px");
	assert.equal(state.order, true);
	assert.equal(state.input, "8px");
	assert.equal(state.nav, 8);
	assert.equal(state.fields, 4);
	assert.equal(state.save, true);
	assert.equal(state.footer, "none");
	assert.deepEqual(errors, []);
	await context.close();
});

test("已移除模块：默认启动链不包含阅读历史、监控、足迹和悬浮回复", () => {
	const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "nodeseek-max.user.js"), "utf8");
	const main = source.slice(source.lastIndexOf("function main()"));
	assert.doesNotMatch(main, /readingFeatures,\s*\.\.\.monitoringFeatures/);
	assert.doesNotMatch(main, /\.\.\.extraFeatures/);
	assert.doesNotMatch(main, /floatingReply/);
	assert.doesNotMatch(source, /var userBadges =/);
});

test("回复编辑器：真实嵌套结构可输入、引用和点击原生提交", async () => {
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), seed: { "nspp:settings": { "user-level": { enabled: true } } } });
	try {
		await page.waitForSelector(".md-editor #editor-body textarea");
		await wait(page);
		assert.equal(await page.locator(".md-editor").isVisible(), true);
		await page.locator(".md-editor textarea").fill("本地回归测试，不发送到论坛");
		await page.evaluate(() => {
			window.__nativeSubmit = 0;
			document.querySelector(".md-editor button.submit").addEventListener("click", e => { e.preventDefault(); window.__nativeSubmit++; });
			document.querySelector('ul.comments .menu-item[title="引用"]').addEventListener("click", () => document.querySelector(".md-editor textarea").focus());
		});
		await page.locator('ul.comments .menu-item[title="引用"]').first().click();
		assert.equal(await page.locator(".md-editor textarea").evaluate(e => document.activeElement === e), true);
		await page.locator(".md-editor button.submit").click();
		assert.equal(await page.evaluate(() => window.__nativeSubmit), 1);
		assert.equal(await page.locator(".md-editor textarea").inputValue(), "本地回归测试，不发送到论坛");
		const labels = await page.locator('.nsmax-floor-actions .comment-menu :is([title="点赞"],[title="引用"],[title="回复"])').evaluateAll(es => es.map(e => [e.title, getComputedStyle(e,"::before").content]));
		assert.ok(labels.length > 0 && labels.every(([title, content]) => content === `"${title}"`), JSON.stringify(labels));
		assert.equal(await page.locator('.nsmax-floor-actions .menu-item[data-nsmax-compact-action]').count(),15);
		assert.ok(Object.entries(calls).filter(([key]) => key.startsWith("/api/account/getInfo/")).every(([, count]) => count === 1), "作者栏的资料每人只读一次：" + JSON.stringify(calls));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("今日热门：单行十条和浏览数，仅请求日榜", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-hot-text");
		const count = kind => page.evaluate(kind => window.__gmRequests.filter(url => url.includes(`/` + kind + `.json`)).length, kind);
		assert.equal(await count("hot"), 0);
		assert.equal(await count("daily"), 1);
		assert.equal(await count("weekly"), 0);
		assert.equal(await page.locator('.nsmax-hot-tabs').isVisible(), false);
		assert.equal(await page.locator('.nsmax-hot-title').innerText(), '今日热门');
		assert.equal(await page.locator('.nsmax-hot-list li').count(),10);
		assert.equal(await page.locator('.nsmax-hot-count').first().innerText(),'1000');
		assert.equal(await page.locator('.nsmax-hot-text').first().evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("CodeMirror：保留隐藏键盘输入，真实提交区保持可用", async () => {
	const { context, page, errors } = await open(browser,"https://www.nodeseek.com/post-1000-1",{html:postPage({editorMode:"codemirror"})});
	try {
		await wait(page);
		assert.equal(await page.locator('.CodeMirror').isVisible(),true);
		const state = await page.locator('.CodeMirror textarea').evaluate(e=>({height:parseFloat(getComputedStyle(e).height),padding:parseFloat(getComputedStyle(e).paddingTop)}));
		assert.ok(state.height < 40, JSON.stringify(state));
		assert.equal(state.padding,0);
		const submit=page.locator('.md-editor .topic-select button.submit');
		assert.equal(await submit.isVisible(),true);
		assert.ok(await submit.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>0));
		assert.deepEqual(errors,[]);
	} finally { await context.close(); }
});

test("代码复制：按钮不增加正文高度，复制内容不混入按钮标签", async () => {
	const { context,page,errors }=await open(browser,"https://www.nodeseek.com/post-1000-1",{html:postPage()});
	try {
		await page.waitForSelector('.nsmax-code > [data-nspp-copy]');
		await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedText=text}},configurable:true}));
		await page.locator('.post-content .nsmax-code').hover();
		const button=page.locator('.nsmax-code > [data-nspp-copy]');
		assert.equal(await button.evaluate(e=>getComputedStyle(e).position),'absolute');
		await button.click();
		assert.equal(await page.evaluate(()=>window.__copiedText),'curl -fsSL https://example.com/install.sh | bash');
		assert.deepEqual(errors,[]);
	} finally {await context.close();}
});

test("手机：页面无横向溢出、回复输入可用；页脚照 sb.sb 手机版显示（链接两列），设置页和消息中心不显示", async () => {
	for (const [url, render] of [["/",listPage],["/post-1000-1",postPage],["/setting",settingPage],["/notification",notificationPage]]) {
		const { context, page, errors } = await open(browser, `https://www.nodeseek.com${url}`, { html: render(), viewport: { width:390,height:844 } });
		try {
			await wait(page);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false, url);
			const footer = /setting|notification/.test(url) ? false : true;
			assert.equal(await page.locator('body > footer').isVisible(), footer, url);
			if (footer) assert.equal(await page.locator('body > footer .contain').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length), 2, url);
			if (url.includes('post-')) assert.equal(await page.locator('.md-editor textarea').isVisible(), true);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("手机版页面（服务器按手机 UA 输出的顶栏）：≡ / 标志 / 搜索框 / 按钮排成一行吸顶，版块一排胶囊不吸顶，侧滑菜单照 sb.sb", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ mobile: true }), viewport: { width: 375, height: 812 } });
	try {
		await wait(page, 800);
		const bar = await page.evaluate(() => {
			const box = (selector) => { const e = document.querySelector(selector); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), visible: r.width > 0 && getComputedStyle(e).visibility !== "hidden" }; };
			return {
				flag: document.documentElement.hasAttribute("data-nsmax-mhead"),
				menu: box("#toggle-left-panel"), logo: box("#nsk-head a.logo-link"), logoText: document.querySelector("#nsk-head a.logo-link")?.textContent.trim(),
				search: box("#nsk-head form.search-box"), colors: box("#nsk-head [data-nsmax-own-header=colors]"), settings: box("#nsk-head [data-nsmax-own-header=settings]"),
				keywords: box("#nsk-head [data-nsmax-own-header=keywords]"), ownMenu: !!document.querySelector(".nsmax-mobile-menu"),
				head: box("#nsk-head"), sticky: getComputedStyle(document.querySelector("#nsk-head")).position,
				strip: getComputedStyle(document.querySelector("header > ul.mobile-nav")).position,
				pills: Array.from(document.querySelectorAll("header > ul.mobile-nav > li")).filter((li) => li.getBoundingClientRect().width > 0).map((li) => li.textContent.trim()),
				pillHeight: Math.round(document.querySelector("header > ul.mobile-nav > li > a").getBoundingClientRect().height),
				current: getComputedStyle(document.querySelector("header > ul.mobile-nav > li.current-category > a")).backgroundColor,
				action: getComputedStyle(document.documentElement).getPropertyValue("--action").trim(),
				overflow: document.scrollingElement.scrollWidth > innerWidth + 1
			};
		});
		assert.equal(bar.flag, true);
		assert.equal(bar.ownMenu, false, "手机版顶栏自带 ≡，不再加脚本自己的版块按钮");
		for (const name of ["menu", "logo", "search", "colors", "settings"]) {
			assert.ok(bar[name]?.visible, `${name} 要显示：${JSON.stringify(bar)}`);
			assert.ok(bar[name].top >= bar.head.top && bar[name].bottom <= bar.head.bottom && bar[name].right <= 375, `${name} 在顶栏这一行里：${JSON.stringify(bar)}`);
		}
		assert.equal(bar.logoText, "NodeSeek");
		assert.ok(!bar.keywords?.visible, "窄屏不放关键词屏蔽");
		assert.ok(bar.menu.left < bar.logo.left && bar.logo.right <= bar.search.left && bar.search.right <= bar.colors.left && bar.colors.right <= bar.settings.left, JSON.stringify(bar));
		// 搜索框占满标志和按钮之间的宽度（两边各隔 8px；字体不同时宽度会变，CI 的 Linux 字体字标更宽）
		assert.ok(Math.abs(bar.search.left - bar.logo.right - 8) <= 1 && Math.abs(bar.colors.left - bar.search.right - 8) <= 1 && bar.search.width >= 80, `搜索框占满剩余宽度：${JSON.stringify(bar)}`);
		assert.equal(bar.sticky, "sticky");
		assert.equal(bar.strip, "static");
		assert.equal(bar.pills[0], "全部");
		assert.ok(!bar.pills.includes("推广") && !bar.pills.includes("DF"), JSON.stringify(bar.pills));
		assert.ok(!bar.pills.some((text) => text.includes("精华")), "精华挪到了列表工具条（2026-10-18），版块那一排没有");
		assert.equal(bar.pillHeight, 32);
		assert.equal(bar.current, "rgb(28, 28, 30)", "当前版块墨色实底");
		assert.equal(bar.overflow, false);
		// 往下滚：顶栏吸顶，版块那一排跟着内容走
		await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
		await wait(page, 200);
		const scrolled = await page.evaluate(() => ({ head: Math.round(document.querySelector("#nsk-head").getBoundingClientRect().top), strip: Math.round(document.querySelector("header > ul.mobile-nav").getBoundingClientRect().bottom) }));
		assert.equal(scrolled.head, 0);
		assert.ok(scrolled.strip < 0, JSON.stringify(scrolled));
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
		// 侧滑菜单：300px 宽面板底，版块列表照顶栏规则隐藏
		await page.locator("#toggle-left-panel").click();
		await wait(page, 500);
		const drawer = await page.evaluate(() => {
			const panel = document.getElementById("left-slide-panel");
			const r = panel.getBoundingClientRect();
			const links = Array.from(panel.querySelectorAll(".category-mobile a")).filter((a) => a.getBoundingClientRect().height > 0);
			return { left: Math.round(r.left), width: Math.round(r.width), bg: getComputedStyle(panel).backgroundColor, links: links.map((a) => a.textContent.trim()), row: Math.round(links[0].getBoundingClientRect().height), font: getComputedStyle(links[0].querySelector("p")).fontSize, mask: getComputedStyle(document.querySelector(".global-mask")).backgroundColor };
		});
		assert.equal(drawer.left, 0);
		assert.equal(drawer.width, 300);
		assert.equal(drawer.bg, "rgb(255, 255, 255)");
		assert.equal(drawer.font, "14.5px");
		assert.equal(drawer.row, 39);
		assert.ok(!drawer.links.some((text) => /推广|生活|Dev|贴图|沙盒/.test(text)), JSON.stringify(drawer.links));
		assert.ok(drawer.links.includes("日常") && drawer.links.includes("推荐阅读"), JSON.stringify(drawer.links));
		assert.match(drawer.mask, /rgba\(5, 0, 56, 0\.42\)/);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("手机版个人空间（没有版块那一排）：不往顶栏那排菜单里补版块，搜索框照样占满剩余宽度", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage({ mobile: true, mobileNav: false }), viewport: { width: 375, height: 812 } });
	try {
		await wait(page, 800);
		const state = await page.evaluate(() => ({
			extras: document.querySelectorAll("#nsk-head ul.nav-menu > li[data-nsmax-own-header-item], #nsk-head ul.nav-menu > li.nsmax-essence-tab-item").length,
			search: Math.round(document.querySelector("#nsk-head form.search-box").getBoundingClientRect().width),
			// 标志和搜索框之间只隔一个 8px 间距（以前多出 7 个空 li，每个都占一份间距，搜索框被挤到两三个像素）
			gap: Math.round(document.querySelector("#nsk-head form.search-box").getBoundingClientRect().left - document.querySelector("#nsk-head a.logo-link").getBoundingClientRect().right),
			overflow: document.scrollingElement.scrollWidth > innerWidth + 1
		}));
		assert.equal(state.extras, 0, JSON.stringify(state));
		assert.ok(state.gap === 8 && state.search >= 80, JSON.stringify(state));
		assert.equal(state.overflow, false);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("手机：长标题折行不撑宽页面；主帖操作换到名字下面；设置页一栏；账簿、管理记录排成卡片；关注页不溢出", async () => {
	const long = "警惕再次出现的geelinx".repeat(9);
	const cases = [
		["/", listPage({ mobile: true }).replace("求推荐稳定的美西 VPS", long)],
		["/post-1000-1", postPage({ mobile: true })],
		["/setting", settingPage({ mobile: true })],
		["/credit", creditPage({ mobile: true })],
		["/ruling", rulingPage({ mobile: true })],
		["/fans", fansPage({ mobile: true })]
	];
	for (const [url, html] of cases) {
		const { context, page, errors } = await open(browser, `https://www.nodeseek.com${url}`, { html, viewport: { width: 375, height: 812 } });
		try {
			await wait(page, 700);
			assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1), false, `${url} 横向溢出`);
			if (url === "/") {
				const title = await page.locator(".post-title a", { hasText: "geelinx" }).evaluate((a) => ({ right: a.getBoundingClientRect().right, height: a.closest(".post-title").getBoundingClientRect().height }));
				assert.ok(title.right <= 375 && title.height > 40, JSON.stringify(title));
			}
			if (url.includes("post-")) {
				const op = await page.evaluate(() => { const item = document.querySelector(".nsk-post > .content-item"); const time = item.querySelector(".date-created").getBoundingClientRect(); const bar = item.querySelector(".nsmax-op-actions").getBoundingClientRect(); return { timeBottom: time.bottom, barTop: bar.top }; });
				assert.ok(op.barTop >= op.timeBottom, `主帖操作不压在时间上：${JSON.stringify(op)}`);
			}
			if (url === "/setting") {
				const layout = await page.evaluate(() => { const nav = document.querySelector("#user-setting-panel .selector-left-side").getBoundingClientRect(); const form = document.querySelector("#user-setting-panel .selector-right-side").getBoundingClientRect(); return { navBottom: nav.bottom, formTop: form.top, formWidth: form.width }; });
				assert.ok(layout.formTop >= layout.navBottom && layout.formWidth >= 340, JSON.stringify(layout));
			}
			if (url === "/credit" || url === "/ruling") {
				const table = await page.evaluate(() => { const t = document.querySelector(".credit-table table, .ruling-log table"); return { head: getComputedStyle(t.querySelector("thead")).display, row: getComputedStyle(t.querySelector("tbody > tr")).display }; });
				assert.deepEqual(table, { head: "none", row: "grid" }, url);
			}
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("手机版块导航：菜单保留真实链接并支持 Escape 关闭", async () => {
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:390,height:844}});
	try {
		const button=page.getByRole('button',{name:'所有版块',exact:true});
		await button.click();
		assert.equal(await page.locator('dialog.nsmax-mobile-nav').isVisible(),true);
		assert.ok(await page.locator('.nsmax-mobile-nav a[href*="/categories/"]').count()>=7);
		await page.keyboard.press('Escape');
		assert.equal(await page.locator('dialog.nsmax-mobile-nav').isVisible(),false);
		assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
		assert.deepEqual(errors,[]);
	} finally {await context.close();}
});

test("版本和生成产物同步", () => {
	const fs = require("node:fs");
	const path = require("node:path");
	const root = path.join(__dirname, "..");
	const source = fs.readFileSync(path.join(root, "nodeseek-max.user.js"), "utf8");
	const meta = fs.readFileSync(path.join(root, "nodeseek-max.meta.js"), "utf8");
	const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
	assert.equal(source.match(/@version\s+(\S+)/)[1], packageJson.version);
	assert.equal(meta.match(/@version\s+(\S+)/)[1], packageJson.version);
	assert.equal(packageJson.version, "1.8.40");
});

test("真实私信：灰色硬编码被覆盖、计数固定高度、图片不撑破页面",async()=>{
	for(const [render,hash] of [[nativeMessagePage,'#/message?mode=list&native=1'],[nativeTalkPage,'#/message?mode=talk&to=10&native=1']]) {
		for(const width of [1440,390]){
			const {context,page,errors}=await open(browser,'https://www.nodeseek.com/notification'+hash,{html:render({dark:true}),viewport:{width,height:900},colorScheme:'dark'});
			try{
				await wait(page);
				const state=await page.evaluate(()=>{const r=document.querySelector('.nsk-notification');const badge=r.querySelector('.unread-count');return{bg:getComputedStyle(r.children[1]).backgroundColor,bar:getComputedStyle(r.children[0]).backgroundColor,h:getComputedStyle(badge).height,overflow:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(r).fontFamily}});
				assert.equal(state.bg,'rgba(0, 0, 0, 0)');
				assert.equal(state.bar,'rgba(0, 0, 0, 0)');
				assert.equal(state.h,'16px');
				assert.equal(state.overflow,false);
				assert.ok(state.font.includes('system-ui'));
				if(render===nativeMessagePage&&width===1440){
					const position=await page.locator('.talk-item').first().evaluate(e=>{const avatar=e.querySelector('.avatar').getBoundingClientRect();const name=e.querySelector('.middle').getBoundingClientRect();const time=e.querySelector('.right').getBoundingClientRect();return{gap:name.left-avatar.right,time:time.left-name.right}});
					assert.ok(position.gap>=8&&position.gap<=16,JSON.stringify(position));
					assert.ok(position.time>=0,JSON.stringify(position));
				}
				if(render===nativeTalkPage){
					await page.locator('.message-input textarea').fill('只测试本地输入');
					assert.equal(await page.locator('.message-input button').isEnabled(),true);
					assert.equal(await page.locator('.message-wrapper .content').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(26, 27, 36)');
				}
				assert.deepEqual(errors,[]);
			}finally{await context.close();}
		}
	}
});

test("SB 个人卡：四列统计、两列菜单和卡片内的发帖入口",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await page.waitForSelector('.nsmax-sb-account');
		assert.equal(await page.locator('.nsmax-account-numbers dd').count(),4);
		assert.equal(await page.locator('.nsmax-account-menu a').count(),10);
		assert.equal(await page.locator('.nsmax-account-menu a[href="/fans?type=fans"]').isVisible(),true);
		assert.equal(await page.locator('.nsmax-account-menu a[href="/ruling"]').isVisible(),true);
		assert.equal(await page.locator('.nsmax-sb-account a[href="/new-discussion"]').isVisible(),true);
		assert.equal(await page.locator('.user-card>.user-head').isVisible(),false);
		await page.evaluate(()=>document.querySelector('.user-card>.user-stat').append(document.createTextNode('鸡腿 4161')));
		await wait(page,500);
		assert.equal(await page.locator('.nsmax-sb-account a[href="/new-discussion"]').isVisible(),true);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("楼层与正文：正文使用完整剩余宽度，回复框只有一层边框",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage(),viewport:{width:1440,height:900},init:"if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}"});
	try{
		await wait(page);
		const dims=await page.evaluate(()=>{const row=document.querySelector('.content-item');const article=row.querySelector('article');const floor=row.querySelector('.floor-link-wrapper');const editor=document.querySelector('.md-editor');return{right:row.getBoundingClientRect().right-article.getBoundingClientRect().right,floor:getComputedStyle(floor).position,mainBorder:getComputedStyle(document.querySelector('#nsk-body-left')).borderTopWidth,editorBorder:getComputedStyle(editor).borderTopWidth}});
		assert.ok(dims.right<=20,JSON.stringify(dims));
		assert.equal(dims.floor,'absolute');
		assert.equal(dims.mainBorder,'0px');
		assert.equal(dims.editorBorder,'1px');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("设置弹窗：完整设置、关于说明和检查更新按需打开，关闭后页面保持原样",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await wait(page);
		assert.equal(await page.locator('#nspp-settings').count(),0);
		const before=await page.locator('#nsk-body').boundingBox();
		await page.getByRole('button',{name:'NodeSeek Max 设置',exact:true}).click();
		const host=page.locator('#nspp-settings');
		assert.equal(await host.locator('dialog').isVisible(),true);
		assert.ok(await host.locator('input,select,textarea,.categories,[data-feature]').count()>0);
		const buttonText=await host.locator('button').allTextContents();
		for(const label of ['保存并刷新','恢复默认','清空缓存','导出配置','导入配置','关闭','检查更新']) assert.ok(buttonText.includes(label),label);
		assert.equal(await host.getByRole('heading',{name:'NodeSeek Max',exact:true}).count(),1);
		assert.ok((await host.locator('dialog').boundingBox()).width<=940);
		assert.deepEqual(await page.locator('#nsk-body').boundingBox(),before);
		await host.getByRole('button',{name:'关闭',exact:true}).click();
		assert.equal(await host.locator('dialog').isVisible(),false);
		assert.deepEqual(await page.locator('#nsk-body').boundingBox(),before);
		await page.getByRole('button',{name:'NodeSeek Max 设置',exact:true}).click();
		assert.equal(await page.locator('#nspp-settings').count(),1);
		await page.keyboard.press('Escape');
		assert.equal(await host.locator('dialog').isVisible(),false);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("编辑期间：CodeMirror 重绘不触发全页作者/图标扫描",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage({editorMode:'codemirror'})});
	try{
		await wait(page,3200);
		const count=await page.evaluate(async()=>{
			let calls=0;
			const native=Document.prototype.querySelectorAll;
			Document.prototype.querySelectorAll=function(selector){calls++;return native.call(this,selector)};
			try{
				const editor=document.querySelector('.CodeMirror-code');
				for(let i=0;i<20;i++){editor.replaceChildren(document.createTextNode('本地输入 '+i));await new Promise(r=>setTimeout(r,12));}
				await new Promise(r=>setTimeout(r,250));
				return calls;
			}finally{Document.prototype.querySelectorAll=native;}
		});
		assert.ok(count<=2,`输入期间触发了 ${count} 次全页扫描`);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("手机关于弹窗：无横向溢出且检查更新能返回结果",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/notification',{html:notificationPage(),viewport:{width:390,height:844}});
	try{
		await page.getByRole('button',{name:'NodeSeek Max 设置',exact:true}).click();
		const host=page.locator('#nspp-settings');
		const dims=await host.locator('dialog').evaluate(e=>({width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth+1}));
		assert.ok(dims.width<=390&&!dims.overflow,JSON.stringify(dims));
		await host.getByRole('button',{name:'检查更新',exact:true}).click();
		// 2026-10-18 起设置面板的提示也是 sb.sb 的深色小条（.nsmax-toast，放在顶层，模态框上面也看得见）
		await page.waitForFunction(()=>document.querySelector('body > .nsmax-toast')?.textContent.includes('最新版本'));
		assert.equal(await page.evaluate(()=>{const t=document.querySelector('body > .nsmax-toast');return t.matches(':popover-open')&&getComputedStyle(t).position==='fixed';}),true,'提示条在顶层');
		assert.equal(await host.getByRole('button',{name:'检查更新',exact:true}).isEnabled(),true);
		assert.ok(await host.locator('input,select,textarea').count()>0);
		await host.getByRole('button',{name:'关闭',exact:true}).click();
		assert.equal(await host.locator('dialog').isVisible(),false);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});


test("加载阶段：回复和过滤先就绪，下方慢资源不阻塞第一页，不自动抓下一页",async()=>{
	const html=postPage().replace('</body>','<img src="/slow-offscreen.svg" style="position:absolute;top:10000px" alt="下方资源"></body>');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html,beforeNavigate:async page=>{
		await page.route('**/slow-offscreen.svg',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});});
	}});
	try{
		await page.waitForSelector('.nsmax-editor-controls');
		await page.waitForFunction(()=>performance.getEntriesByName('nsmax:deferred-start').length>0);
		await page.waitForLoadState('load');
		const timings=await page.evaluate(()=>({primary:performance.getEntriesByName('nsmax:primary-ready')[0].startTime,deferred:performance.getEntriesByName('nsmax:deferred-start')[0].startTime,load:performance.getEntriesByType('navigation')[0].loadEventStart,extra:performance.getEntriesByType('resource').filter(e=>/\/page-2/.test(e.name)).length}));
		assert.ok(timings.primary<timings.deferred,JSON.stringify(timings));
		assert.ok(timings.deferred<timings.load,JSON.stringify(timings));
		assert.equal(timings.extra,0);
		assert.equal(await page.locator('.md-editor textarea').isVisible(),true);
		assert.equal(await page.locator('.post-top-pager').isVisible(),false);
		assert.equal(await page.locator('.post-bottom-pager').isVisible(),true);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("评论追加：默认按需加载、去重、安全清理、楼中楼、操作入口和底部分页",async()=>{
	const first=postPage().replaceAll('/page-2','/post-1000-2');
	const second=postPage().replace('id="1"','id="4"').replace('id="2"','id="5"').replace('id="3"','id="6"').replace('收了，私信你','<a href="/space/11">@buyer</a> <a href="/post-1000-1#1">#1</a> 本地楼中楼').replaceAll('class="pager-pos pager-cur">1','class="pager-pos pager-cur">2').replaceAll('class="pager-next"','class="pager-end"').replace('价格不错，帮顶','<img src="/avatar/test" onerror="window.__unsafe=1">价格不错，帮顶');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:first,pages:{'/post-1000-2':second}});
	try{
		await page.waitForSelector('button.nspp-action');
		assert.equal(await page.locator('ul.comments li.content-item').count(),3);
		await page.locator('button.nspp-action').filter({hasText:'加载下一页'}).click({ force: true });
		await page.waitForSelector('li[id="4"]');
		await page.waitForSelector('li[id="1"]>.nsmax-floor-box>.nsmax-nested-replies>li[id="4"]');
		assert.equal(await page.locator('ul.comments li.content-item').count(),6);
		assert.equal(await page.locator('.post-bottom-pager .pager-cur').innerText(),'2');
		const actions=page.locator('li[id="4"]>.nsmax-floor-actions .comment-menu .menu-item');
		assert.equal(await actions.count(),5);
		assert.equal(await page.locator('li[id="4"]>.nsmax-floor-actions [title="加鸡腿"]').getAttribute('href'),'/post-1000-2#4');
		assert.equal(await page.locator('ul.comments [onerror]').count(),0);
		assert.equal(await page.evaluate(()=>window.__unsafe),undefined);
		assert.equal(await page.locator('button.nspp-action').filter({hasText:'已加载全部内容'}).isDisabled(),true);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("回复预览与粘贴图片：保留草稿、返回输入和本地上传绑定",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage()});
	try{
		await page.waitForSelector('.nsmax-editor-controls');
		assert.equal(await page.locator('.md-editor .tab-select').isVisible(),false);
		assert.equal(await page.locator('.md-editor .mde-toolbar').isVisible(),false);
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'Markdown',exact:true}).click();
		// 2026-10-24：Markdown 模式只显示脚本自己那一排工具，站点的工具栏照样不显示（以前两排一起出来）
		assert.equal(await page.locator('.md-editor .nsmax-custom-mde-toolbar').isVisible(),true);
		assert.equal(await page.locator('.md-editor .mde-toolbar').isVisible(),false);
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'切换到纯文本',exact:true}).click();
		await page.locator('.md-editor textarea').fill('**草稿测试**');
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
		assert.equal(await page.locator('.nsmax-editor-preview strong').innerText(),'草稿测试');
		assert.equal(await page.locator('.md-editor textarea').isVisible(),false);
		assert.equal(await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).innerText(),'继续编辑');
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
		assert.equal(await page.locator('.md-editor textarea').inputValue(),'**草稿测试**');
		await page.locator('.md-editor textarea').evaluate(input=>{
			const data=new DataTransfer();
			data.items.add(new File([new Uint8Array([137,80,78,71])],'local.png',{type:'image/png'}));
			input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
		});
		await page.waitForFunction(()=>window.__uploads?.length===1);
		await page.waitForFunction(()=>document.querySelector('.md-editor textarea').value.includes('abc123.png'));
		assert.ok((await page.locator('.md-editor textarea').inputValue()).includes('草稿测试'));
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("SB 字体与动效：正文、编辑器、弹窗一致且不下载旧字体，原生资料卡唯一可见",async()=>{
	const html=postPage().replace('</body>','<div class="hover-user-card">原生资料卡</div><div class="nspp-user-hover">旧资料卡</div></body>');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html,seed:{'nspp:settings:www.nodeseek.com':{'modern-theme':{enabled:true,font:'claude'}}}});
	try{
		await wait(page);
		const fonts=await page.locator('body,article.post-content,.md-editor textarea').evaluateAll(es=>es.map(e=>getComputedStyle(e).fontFamily));
		assert.ok(fonts.every(font=>font===fonts[0]&&font.includes('system-ui')),JSON.stringify(fonts));
		assert.equal(await page.evaluate(()=>window.__gmRequests.filter(url=>url.includes('fontsource')).every(url=>url.includes('/space-mono'))),true);
		assert.equal(await page.locator('.hover-user-card').isVisible(),true);
		assert.equal(await page.locator('.nspp-user-hover:visible').count(),0);
		assert.equal(await page.locator('section.nspp-user-hover').count(),0);
		const transition=await page.locator('ul.comments .menu-item').first().evaluate(e=>({props:getComputedStyle(e).transitionProperty,times:getComputedStyle(e).transitionDuration,ease:getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()}));
		assert.equal(transition.ease,'cubic-bezier(0.23, 1, 0.32, 1)');
		assert.ok(transition.times.includes('0.12s'));
		assert.ok(!transition.props.includes('all'));
		await page.emulateMedia({reducedMotion:'reduce'});
		assert.equal(await page.locator('ul.comments .menu-item').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("私信首屏：一轮会话请求、输入预览可用、无批量资料请求及页面溢出",async()=>{
	for(const width of [1440,390]){
		const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/notification#/message?mode=talk&to=10',{html:nativeTalkPage(),viewport:{width,height:900}});
		try{
			await page.waitForSelector('.nspp-messages textarea:visible');
			await wait(page);
			assert.equal(calls['/api/notification/message/list'],1);
			assert.equal(Object.keys(calls).some(key=>key.startsWith('/api/account/getInfo/')),false);
			await page.locator('.nspp-messages textarea').fill('私信本地草稿，不发送');
			assert.equal(await page.locator('.nspp-messages textarea').inputValue(),'私信本地草稿，不发送');
			assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
			assert.deepEqual(errors,[]);
		}finally{await context.close();}
	}
});


test("SB 新布局：NQ 纯文字、分页形状、列表小字顺序与热榜比例",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await page.waitForSelector('.nsmax-hot-text');
		assert.equal(await page.locator('#nsk-head .nsmax-nq-tab').innerText(),'NQ');
		assert.equal(await page.locator('#nsk-head .nsmax-nq-tab svg.nsmax-nq-icon').count(),1);
		assert.equal(await page.locator('.pager-bottom a.pager-next').innerText(),'下一页');
		assert.equal(await page.locator('.pager-bottom .pager-prev').isVisible(),false);
		const row=page.locator('ul.post-list:not(.topic-carousel-panel)>li').first();
		const ordered=await row.locator('.post-info').evaluate(e=>[...e.children].filter(n=>n.matches('.info-author,.info-last-comment-time,.nsmax-inline-category,.info-views,.info-comments-count,.info-last-commenter')).map(n=>n.className));
		// 2026-10-20 实时 sb.sb .post-meta：作者 · 时间 · 版块 · 浏览 · 回复 · 最后回复人
		assert.deepEqual(ordered.map(name=>name.match(/info-author|nsmax-inline-category|info-views|info-comments-count|info-last-commenter|info-last-comment-time/)?.[0]),['info-author','info-last-comment-time','nsmax-inline-category','info-views','info-comments-count','info-last-commenter']);
		const state=await row.locator('.post-info').evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,gap:getComputedStyle(e).gap}));
		assert.deepEqual(state,{font:'12.5px',line:'20px',gap:'0px 10px'});
		assert.equal(await page.locator('.nsmax-hot-refresh').isVisible(),false);
		assert.equal(await page.locator('.nsmax-hot-panel').evaluate(e=>getComputedStyle(e).borderTopWidth),'1px');
		assert.equal(await page.locator('.nsmax-account-rank').innerText(),'Lv.6');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("评论对齐：操作区在右上方、照 sb.sb 用小字、保留真实计数、正文与作者对齐",async()=>{
	const html=postPage().replaceAll('title="引用"','title="引用"').replaceAll('<span></span>','<span>引用</span>');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html,viewport:{width:1440,height:900},init:"if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}"});
	try{
		await page.waitForSelector('.nsmax-floor-actions');
		const dims=await page.locator('ul.comments li.content-item').evaluateAll(rows=>rows.map(row=>{
			const author=row.querySelector('.author-name').getBoundingClientRect(),body=row.querySelector('article').getBoundingClientRect(),actions=row.querySelector('.nsmax-floor-actions').getBoundingClientRect();return {authorX:author.left,bodyX:body.left,authorY:author.top,actionY:actions.top,actionX:actions.left,authorRight:author.right};
		}));
		assert.ok(dims.every(r=>Math.abs(r.authorX-r.bodyX)<=1&&Math.abs(r.authorY-r.actionY)<=4&&r.actionX>r.authorRight),JSON.stringify(dims));
		assert.ok(dims.every(r=>r.authorX===dims[0].authorX),JSON.stringify(dims));
		assert.equal(await page.locator('.nsmax-floor-actions [data-nsmax-action-label]:visible').count(),0);
		assert.equal(await page.locator('.nsmax-floor-actions [title="点赞"] [data-nsmax-action-count]').first().innerText(),'1');
		assert.equal(await page.locator('.nsmax-floor-actions .menu-item[data-nsmax-action=thumbup]').first().evaluate(e=>getComputedStyle(e,'::before').content),'"点赞"');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("真实预览容器：CodeMirror 外层收起，图片与预览顶部无空白，返回草稿",async()=>{
	let html=postPage({editorMode:'codemirror'}).replace('<div class="vue-codemirror">','<div class="cm-wrapper" style="height:300px;min-height:300px"><div class="vue-codemirror">').replace('<div class="topic-select">','</div><div class="topic-select">');
	html=html.replace('</body>',`<script>
	const host=document.querySelector('.CodeMirror');let value='![本地图片](${require('./fixtures/pages.cjs').AVATAR || 'https://www.nodeseek.com/avatar/test'})';const changes=new Set();
	host.CodeMirror={getValue:()=>value,setValue:text=>{value=text;changes.forEach(fn=>fn())},on:(event,fn)=>{if(event==='change')changes.add(fn)},off:(event,fn)=>changes.delete(fn),refresh:()=>{},focus:()=>host.querySelector('textarea').focus(),getWrapperElement:()=>host,getOption:()=>undefined};
	</script></body>`);
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html});
	try{
		await page.waitForSelector('.nsmax-editor-head');
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
		await page.locator('.nsmax-editor-preview img').waitFor();
		assert.equal(await page.locator('[data-nsmax-editor-pane]').isVisible(),false);
		assert.equal(await page.locator('.nsmax-editor-preview img').isVisible(),true);
		const gap=await page.locator('.nsmax-editor-preview').evaluate(e=>e.getBoundingClientRect().top-e.parentElement.getBoundingClientRect().top);
		assert.ok(gap<=2,`预览顶部留下 ${gap}px 空白`);
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
		assert.equal(await page.locator('.CodeMirror').isVisible(),true);
		assert.ok(await page.locator('.CodeMirror').evaluate(e=>e.CodeMirror.getValue().includes('本地图片')));
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("最近浏览：本地去重、十条上限、安全标题、位于热榜之后，无额外请求",async()=>{
	const seed=Array.from({length:10},(_,i)=>({path:'/post-'+(9000+i)+'-1',title:'以前浏览 '+i}));
	const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage(),init:`if(window.top===window){localStorage.setItem('nsmax:recent:1',${JSON.stringify(JSON.stringify(seed))});localStorage.setItem('nsmax:post-layout','simple');}`});
	try{
		await page.waitForSelector('.nsmax-recent-panel a');
		assert.equal(await page.locator('.nsmax-recent-panel a').count(),10);
		assert.equal(await page.locator('.nsmax-recent-panel a').first().getAttribute('href'),'/post-1000-1');
		assert.equal(await page.locator('.nsmax-hot-panel + .nsmax-recent-panel').count(),1);
		const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nsmax:recent:1')));
		assert.equal(saved.length,10);
		assert.equal(saved.filter(r=>r.path==='/post-1000-1').length,1);
		assert.equal(Object.keys(calls).some(path=>path.includes('/getInfo/')),false);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("头像与用户名悬停：仅一张资料卡且均含头像、按需请求一次、缓存复用、Escape 关闭",async()=>{
	const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-nsmax-mounting'));
		assert.equal(Object.keys(calls).some(path=>path.includes('/getInfo/')),false);
		const avatar=page.locator('ul.post-list>li>a:has(img)').first();
		await avatar.hover();
		await page.waitForSelector('.nsmax-person-pop dd');
		assert.equal(await page.locator('.nsmax-person-pop:visible').count(),1);
		assert.equal(await page.locator('.nsmax-person-pop .nsmax-person-head img').count(),1);
		assert.equal(Object.keys(calls).filter(path=>path.includes('/getInfo/')).length,1);
		await page.keyboard.press('Escape');
		assert.equal(await page.locator('.nsmax-person-pop').count(),0);
		await page.mouse.move(5,5);
		const nameLink=page.locator('ul.post-list>li .info-author a').first();
		await nameLink.hover();
		await page.waitForSelector('.nsmax-person-pop dd');
		assert.equal(await page.locator('.nsmax-person-pop:visible').count(),1);
		assert.equal(await page.locator('.nsmax-person-pop .nsmax-person-head img').count(),1);
		assert.equal(Object.values(Object.fromEntries(Object.entries(calls).filter(([key])=>key.includes('/getInfo/')))).reduce((a,b)=>a+b,0),1);
		assert.equal(await page.locator('section.nspp-user-hover').count(),0);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("个人空间：去除黑底、注册天数、空统计和空介绍，主题颜色随深浅切换",async()=>{
	for(const dark of [false,true]){
		const {context,page,errors}=await open(browser,'https://www.nodeseek.com/space/10',{html:nativeSpacePage({dark}),colorScheme:dark?'dark':'light'});
		try{
			await page.waitForSelector('[data-nsmax-obsolete-stat]',{state:'attached'});
			assert.equal(await page.locator('.head-container .card-block>.nsmax-user-stat:visible').count(),9);
			assert.equal(await page.locator('.readme').isVisible(),false);
			assert.equal(await page.locator('.nsmax-space-progress').count(),1);
			assert.equal(await page.locator('.nsmax-space-progress>i>b').count(),1);
			const color=await page.locator('.comments-list').evaluate(e=>getComputedStyle(e).backgroundColor);
			assert.equal(color,dark?'rgb(20, 21, 28)':'rgb(255, 255, 255)');
			assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
			assert.deepEqual(errors,[]);
		}finally{await context.close();}
	}
});

test("发帖页：同一套编辑器、标题焦点、原生分类和深色提交按钮保持可用",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/new-discussion',{html:newPostPage()});
	try{
		await page.waitForSelector('.nsmax-editor-head');
		await page.locator('#mde-title').fill('本地测试标题，不发布');
		await page.locator('#category').selectOption('tech');
		await page.locator('.md-editor textarea').fill('测试正文');
		assert.equal(await page.locator('.nsmax-editor-controls').getByRole('button',{name:'抽奖',exact:true}).count(), 0);
		await page.locator('.nsmax-lucky-trigger').click();
		await page.waitForSelector('dialog.nsmax-lucky-dialog[open]');
		await page.locator('dialog.nsmax-lucky-dialog .nsmax-lucky-field input').first().fill('50 鸡腿');
		// 「发布抽奖帖」：标题、正文、版块填进发帖表单，再点站点自己的「发布帖子」（夹具里的按钮不发请求）
		await page.locator('dialog.nsmax-lucky-dialog .nsmax-dialog-button.primary').click();
		await page.waitForFunction(()=>!document.querySelector('dialog.nsmax-lucky-dialog'));
		assert.equal(await page.locator('#mde-title').inputValue(),'【抽奖】50 鸡腿');
		assert.match(await page.locator('.md-editor textarea').inputValue(),/开奖链接\*\*：发布后自动生成/);
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
		assert.match(await page.locator('.nsmax-editor-preview').innerText(),/测试正文/);
		assert.match(await page.locator('.nsmax-editor-preview').innerText(),/开奖链接/);
		assert.equal(await page.locator('#category').inputValue(),'tech');
		await page.waitForFunction(()=>getComputedStyle(document.querySelector('.md-editor button.submit')).backgroundColor==='rgb(28, 28, 30)');
		assert.equal(await page.locator('.md-editor button.submit').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(28, 28, 30)');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});


test("帖子悬停预览：SB 卡片表面与标题色、按需读取、Escape 关闭",async()=>{
	for(const dark of [false,true]){
		const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage({dark}),pages:{'/post-1000-1':postPage({dark})},colorScheme:dark?'dark':'light'});
		try{
			await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-nsmax-mounting'));
			await page.locator('.post-list-item .post-title a').first().hover();
			await page.waitForSelector('dialog.nspp-post-preview article');
			const style=await page.locator('dialog.nspp-post-preview').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,radius:getComputedStyle(e).borderRadius,title:getComputedStyle(e.querySelector('header>a')).color}));
			assert.equal(style.bg,dark?'rgb(20, 21, 28)':'rgb(255, 255, 255)');
			assert.equal(style.radius,'12px');
			assert.equal(style.title,dark?'rgb(242, 243, 248)':'rgb(28, 28, 30)');
			await page.keyboard.press('Escape');
			assert.equal(await page.locator('dialog.nspp-post-preview').isVisible(),false);
			assert.deepEqual(errors,[]);
		}finally{await context.close();}
	}
});


test("实际个人空间：scoped discussion-wrapper 在主题、评论和路由换页都使用 SB 颜色",async()=>{
	for(const dark of [false,true])for(const [render,hash]of[[spaceTopicsPage,'#/discussions'],[spaceCommentsPage,'#/comments']]){
		const {context,page,errors}=await open(browser,'https://www.nodeseek.com/space/10'+hash,{html:render({dark}),colorScheme:dark?'dark':'light'});
		try{
			const wrapper=page.locator('.discussion-wrapper');
			assert.equal(await wrapper.evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(20, 21, 28)':'rgb(255, 255, 255)');
			assert.equal(await wrapper.locator('.discussion-item').first().evaluate(e=>getComputedStyle(e).borderTopStyle),'none');
			if(hash.includes('comments'))assert.equal(await wrapper.locator('p').first().evaluate(e=>getComputedStyle(e).color),dark?'rgb(168, 171, 187)':'rgb(85, 90, 106)');
			await page.evaluate(()=>{location.hash='#/discussions/2';const root=document.querySelector('.discussion-wrapper');const clone=root.firstElementChild.cloneNode(true);root.replaceChildren(clone);});
			assert.equal(await wrapper.evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(20, 21, 28)':'rgb(255, 255, 255)');
			assert.deepEqual(errors,[]);
		}finally{await context.close();}
	}
});

test("消息中心：仅一套分类、头部只留全部已读、会话导航无重复、附件预览和草稿可用",async()=>{
	for(const width of [1440,390]){
		const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/notification#/message?mode=talk&to=7',{html:nativeTalkPage(),viewport:{width,height:900}});
		try{
			await page.waitForSelector('.nspp-messages textarea:visible');
			assert.equal(await page.locator('.nsmax-message-tabs:visible').count(),1,'分类标签只在顶栏这一套（左栏不再重复一份）');
			assert.equal(await page.locator('.app-switch:visible,.nspp-messages-fixed-contacts:visible').count(),0);
			assert.deepEqual(await page.locator('.nspp-messages-top-actions button:visible').allTextContents(),['全部已读'],'私信页顶栏右边只有全部已读（筛选、刷新是通知列表用的）');
			assert.deepEqual(await page.locator('.nspp-message-editor-toolbar button').allTextContents(),['附件','预览']);
			assert.equal(await page.getByRole('button',{name:'原版页面',exact:true}).count(),0);
			await page.locator('.nspp-messages textarea').fill('**本地消息草稿**');
			await page.locator('.nspp-message-editor-toolbar').getByRole('button',{name:'预览',exact:true}).click();
			assert.equal(await page.locator('.nspp-message-editor-preview strong').innerText(),'本地消息草稿');
			assert.equal(await page.locator('.nspp-messages textarea').isVisible(),false);
			await page.locator('.nspp-message-editor-toolbar').getByRole('button',{name:'编辑',exact:true}).click();
			assert.equal(await page.locator('.nspp-messages textarea').inputValue(),'**本地消息草稿**');
			const saved=await page.locator('.nspp-messages textarea').inputValue();
			await page.locator('.nsmax-message-tabs').getByRole('link',{name:/@我/}).click();
			await page.locator('.nsmax-message-tabs').getByRole('link',{name:/私信/}).click();
			await page.locator('.nspp-messages-peer[data-id="7"]').click();
			assert.equal(await page.locator('.nspp-messages textarea').inputValue(),saved);
			assert.equal(await page.locator('.nsmax-message-tabs:visible').count(),1,'分类标签只在顶栏这一套（左栏不再重复一份）');
			assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
			assert.equal(calls['/api/notification/message/send']||0,0);
			assert.deepEqual(errors,[]);
		}finally{await context.close();}
	}
});

test("系统消息：显示通知行与右侧时间，不生成聊天气泡或发送框",async()=>{
	const items={success:true,talkTo:{member_id:9,member_name:'系统通知'},msgArray:[{id:81,sender_id:9,receiver_id:1,sender_name:'系统通知',content:'你关注的用户发布了[新的帖子](/post-123-1)',is_markdown:true,viewed:1,created_at:new Date().toISOString()}]};
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/notification#/message?mode=talk&to=9',{html:nativeTalkPage(),api:{'/api/notification/message/with/9':[{status:200,body:items}]}});
	try{
		await page.waitForSelector('.is-system-thread .is-system');
		assert.equal(await page.locator('.nspp-messages-composer').isVisible(),false);
		const style=await page.locator('.is-system .nspp-messages-bubble').evaluate(e=>({border:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));
		assert.deepEqual(style,{border:'0px',bg:'rgba(0, 0, 0, 0)'});
		assert.equal(await page.locator('.is-system time').count(),1);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("关键词弹窗：输入、说明和复选项不重叠且添加删除能即时过滤",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await page.getByRole('button',{name:'关键词屏蔽',exact:true}).click();
		const pop=page.locator('.nsmax-pop[data-kind=keywords]');
		const bounds=await pop.evaluate(e=>{const form=e.querySelector('form').getBoundingClientRect(),hint=e.querySelector('.nsmax-pop-empty').getBoundingClientRect(),foot=e.querySelector('.nsmax-pop-foot').getBoundingClientRect();return{formBottom:form.bottom,hintTop:hint.top,hintBottom:hint.bottom,footTop:foot.top}});
		assert.ok(bounds.hintTop>=bounds.formBottom+10&&bounds.footTop>=bounds.hintBottom+10,JSON.stringify(bounds));
		await pop.getByRole('textbox',{name:'要屏蔽的关键词'}).fill('CN2');await pop.getByRole('button',{name:'添加',exact:true}).click();
		assert.equal(await page.locator('ul.post-list>li').first().isVisible(),false);
		await pop.getByRole('button',{name:'删除「CN2」'}).click();
		assert.equal(await page.locator('ul.post-list>li').first().isVisible(),true);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("搜索侧栏：热榜最近浏览恢复、随页面滚动与统计链接正确",async()=>{
	const records=[{path:'/post-1100-1',title:'以前浏览的帖子'}];
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/search?q=css',{html:listPage({count:50}),viewport:{width:1440,height:900},init:`if(window.top===window)localStorage.setItem('nsmax:recent:1',${JSON.stringify(JSON.stringify(records))});`});
	try{
		await page.waitForSelector('.nsmax-hot-text');await page.waitForSelector('.nsmax-recent-panel');
		const side=page.locator('#nsk-right-panel-container'),main=page.locator('#nsk-body-left');
		assert.ok(Math.abs((await side.boundingBox()).y-(await main.boundingBox()).y)<=1);
		await page.evaluate(()=>window.scrollTo(0,800));await page.waitForTimeout(50);
		assert.equal(await side.evaluate(e=>getComputedStyle(e).position),'sticky','右栏固定在顶栏下面，不随页面滚动（2026-10-14 按用户要求）');
		assert.equal(await side.evaluate(e=>getComputedStyle(e).overflowY),'auto','右栏内容比屏幕高时可以单独滚动');
		assert.ok(Math.abs((await side.boundingBox()).y-77)<=1,'右栏顶端停在顶栏下方 20px');
		for(const [label,href]of[['鸡腿','/credit'],['星辰','/stardust/list'],['主题帖','/space/1#/discussions'],['评论数','/space/1#/comments']])assert.equal(await page.locator('.nsmax-account-stat').filter({has:page.locator('dt').filter({hasText:label})}).getAttribute('href'),href);
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'个人设置',exact:true}).getAttribute('href'),'/setting');
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'我的邀请',exact:true}).count(),0);
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'我的粉丝',exact:true}).getAttribute('href'),'/fans?type=fans');
		assert.deepEqual(await page.locator('.nsmax-account-menu a').evaluateAll(links=>links.map(a=>a.firstChild?.nextSibling?.textContent||a.textContent)),['我的主页','我的主题','我的回帖','我的收藏','我的粉丝','我的关注','我的通知','每日签到','管理记录','个人设置'],'我的私信去掉（我的通知里有私信），我的粉丝后面是我的关注');
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:/^我的关注/}).getAttribute('href'),'/fans?type=follow');
		const fanRow=await page.locator('.nsmax-account-menu').evaluate(menu=>{const box=(label)=>Array.from(menu.querySelectorAll('a')).find(a=>a.textContent.startsWith(label)).getBoundingClientRect();return{fans:box('我的粉丝').top,follow:box('我的关注').top,notice:box('我的通知').top};});
		assert.equal(fanRow.fans,fanRow.follow,'我的粉丝、我的关注在同一行');
		assert.ok(fanRow.notice>fanRow.fans,'我的通知挪到下一行');
		assert.equal(await page.locator('.nsmax-account-menu a').filter({hasText:'我的通知'}).locator('.nsmax-account-unread').innerText(),'7','我的通知的未读数 = @我 5 + 回复 1（通知分类模块补的）+ 私信 1');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("搜索入口：不显示 Google，搜索弹层保留帖子和用户入口", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await page.evaluate(() => {
			const overlay = document.createElement("div");
			overlay.className = "search-overlay";
			overlay.innerHTML = '<div class="glass-tabs"><button class="tab-btn">帖子</button><button class="tab-btn">用户</button><button class="tab-btn googleSearch">谷歌</button></div>';
			document.body.append(overlay);
		});
		// 藏掉「谷歌」的样式在首帧之后才补注入的浮层段里（真实使用时点搜索框那一下就先补上了）：等它补上，不按固定的几十毫秒算
		await page.waitForFunction(() => ![...document.querySelectorAll(".search-overlay .googleSearch")].some((el) => el.getClientRects().length), null, { timeout: 3e3 });
		assert.equal(await page.locator(".search-overlay .googleSearch:visible").count(), 0);
		assert.deepEqual(await page.locator(".search-overlay .tab-btn:visible").allTextContents(), ["帖子", "用户"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("列表图标与抽奖：五项单图标、SB 悬停色、抽奖标签唯一（只给确认有开奖链接的帖子）、推荐轮播隐藏",async()=>{
	const html=listPage().replace('出一台香港 CN2 GIA 小鸡，年付 99','抽奖：国庆活动').replace('<ul class="post-list">','<div class="topic-carousel-wrapper"><ul class="topic-carousel-panel"><li>滚动推荐</li></ul></div><ul class="post-list">');
	// 2026-10-18 起只按正文里的开奖链接认抽奖：这一篇当作打开过、确认有开奖链接
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html,init:`if(window.top===window)localStorage.setItem('nsmax:special-posts',JSON.stringify({"1000":"lottery"}))`});
	try{
		await page.waitForSelector('.nsmax-prize-badge');
		const row=page.locator('ul.post-list>li').first();
		assert.equal(await row.locator('.nsmax-prize-badge').innerText(),'抽奖');
		// 2026-10-23 起五项的图标由主题 CSS 画（::before 遮罩），不再插 svg；站点原来的图标都藏着
		assert.equal(await row.locator('.post-info').evaluate(info=>Array.from(info.children).filter(el=>{const b=getComputedStyle(el,'::before');return b.content==='""'&&b.display!=='none'&&(b.maskImage||b.webkitMaskImage||'none')!=='none';}).length),5);
		assert.equal(await row.locator('.post-info svg:visible').count(),0);
		await row.hover();
		await page.waitForFunction(()=>getComputedStyle(document.querySelector('ul.post-list>li')).backgroundColor==='rgb(242, 244, 247)');
		assert.equal(await page.locator('.topic-carousel-wrapper').isVisible(),false);
		assert.equal(await page.locator('.nsmax-hot-panel').evaluate(e=>getComputedStyle(e).borderRadius),'12px');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("评论操作小字、楼主蓝色热评红色、楼中楼透明、预览仅标题正文",async()=>{
	const html=postPage().replace('<a href="#1" class="floor-link">','<span class="hot-badge"></span><a href="#1" class="floor-link">');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html});
	try{
		await page.waitForSelector('.nsmax-floor-actions');
		assert.equal(await page.locator('.comment-menu .menu-item>svg:visible').count(),0);
		assert.equal(await page.locator('.nsmax-floor-actions [data-nsmax-action=reply]').first().evaluate(e=>getComputedStyle(e,'::before').content),'"回复"');
		assert.equal(await page.locator('.is-poster').evaluate(e=>getComputedStyle(e).color),'rgb(26, 26, 26)');
		assert.equal(await page.locator('.is-poster').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(245, 197, 24)');
		// 热评：sb.sb 没有对应元素，沿用它的 .post-user-group--staff 小标签（红底白字）
		assert.deepEqual(await page.locator('.hot-badge').evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).color]),['rgb(229, 72, 77)','rgb(255, 255, 255)']);
		const iconCount=await page.locator('.nsk-post .menu-item[data-nsmax-action=quote]').count();assert.ok(iconCount>=0);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("回复框：统一圆角、左侧回复按钮、拖动与键盘可调整高度",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage()});
	try{
		await page.waitForSelector('.nsmax-editor-resize');
		const input=page.locator('.md-editor textarea'),handle=page.getByRole('separator',{name:'调整输入框高度'});
		const before=await input.boundingBox();
		await handle.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
		const after=await input.boundingBox();assert.ok(after.height>=before.height+58);
		await handle.scrollIntoViewIfNeeded();
		const box=await handle.boundingBox();await page.mouse.move(box.x+box.width-3,box.y+box.height-3);await page.mouse.down();await page.mouse.move(box.x+box.width-3,box.y+box.height+80);await page.mouse.up();
		assert.ok((await input.boundingBox()).height>=after.height+70);
		assert.equal(await page.locator('.md-editor button.submit').innerText(),'回复楼主');
		const button=await page.locator('.md-editor button.submit').boundingBox(),editor=await page.locator('.md-editor').boundingBox();
		assert.ok(Math.abs(button.x-editor.x-17)<2);
		assert.equal(await page.locator('.md-editor').evaluate(e=>getComputedStyle(e).borderRadius),'12px');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("用户需求还原：图一抽奖同行不换行、图二管理记录、图三/四个人空间与Level6专属进度条",async()=>{
	// 1. 图一：抽奖徽章同行不换行
	const listHtml = listPage().replace('出一台香港 CN2 GIA 小鸡，年付 99','抽奖：大吉大利今晚吃鸡');
	const {context: ctxList, page: pageList, errors: errorsList} = await open(browser,'https://www.nodeseek.com/',{html: listHtml, init:`if(window.top===window)localStorage.setItem('nsmax:special-posts',JSON.stringify({"1000":"lottery"}))`});
	try {
		await pageList.waitForSelector('.nsmax-prize-badge');
		const badge = pageList.locator('ul.post-list .nsmax-prize-badge').first();
		const link = pageList.locator('ul.post-list .post-title a').first();
		const badgeBox = await badge.boundingBox();
		const linkBox = await link.boundingBox();
		assert.ok(badgeBox && linkBox, 'Badge and link bounding boxes exist');
		assert.ok(badgeBox.x < linkBox.x, 'Badge is in front of the title link');
		assert.ok(Math.abs(badgeBox.y - linkBox.y) < 6, `Badge and link are on the same line (y diff: ${Math.abs(badgeBox.y - linkBox.y)})`);
		assert.deepEqual(errorsList, []);
	} finally { await ctxList.close(); }

	// 1.2 等级限制放置在标题正后方紧凑排列
	const listHtmlLock = listPage().replace(
		'<div role="heading" aria-level="3" class="post-title"><a href="/post-1000-1" target="">出一台香港 CN2 GIA 小鸡，年付 99</a> <!----> <!----></div>',
		'<div role="heading" aria-level="3" class="post-title"><a href="/post-1000-1" target="">短标题</a><span style="color: rgb(255, 152, 152);"><svg class="iconpark-icon"><use href="#lock"></use></svg> 1</span> <!----></div>'
	);
	const {context: ctxLock, page: pageLock, errors: errorsLock} = await open(browser,'https://www.nodeseek.com/',{html: listHtmlLock});
	try {
		await pageLock.waitForSelector('ul.post-list .post-title > span:has(use[href="#lock"])');
		const link = pageLock.locator('ul.post-list .post-title a').first();
		const lock = pageLock.locator('ul.post-list .post-title > span:has(use[href="#lock"])').first();
		const linkBox = await link.boundingBox();
		const lockBox = await lock.boundingBox();
		assert.ok(linkBox && lockBox, 'Link and lock bounding boxes exist');
		assert.ok(lockBox.x > linkBox.x, 'Lock badge is after the title link');
		const gap = lockBox.x - (linkBox.x + linkBox.width);
		assert.ok(gap >= 0 && gap <= 10, `Lock badge directly follows title with small gap (gap: ${gap}px)`);
		assert.ok(Math.abs(lockBox.y - linkBox.y) < 6, 'Lock badge is on the same line as title link');
		assert.equal(await lock.evaluate(e => getComputedStyle(e).color), 'rgb(207, 43, 43)', '等级锁用 sb.sb 的 --danger');
		assert.deepEqual(errorsLock, []);
	} finally { await ctxLock.close(); }

	// 2. 图二：侧栏个人卡含管理记录 (/ruling) 与每日签到 (/board) 以及侧栏独立滚动
	const {context: ctxCard, page: pageCard, errors: errorsCard} = await open(browser,'https://www.nodeseek.com/',{html: listPage({count: 50}), viewport: { width: 1280, height: 400 }});
	try {
		await pageCard.waitForSelector('.nsmax-account-menu');
		const rulingLink = pageCard.locator('.nsmax-account-menu a[href="/ruling"]');
		assert.equal(await rulingLink.isVisible(), true);
		assert.equal(await rulingLink.innerText(), '管理记录');

		const checkinLink = pageCard.locator('.nsmax-account-menu a').filter({hasText: '每日签到'});
		assert.equal(await checkinLink.isVisible(), true);
		assert.equal(await checkinLink.getAttribute('href'), '/board');

		const side = pageCard.locator('#nsk-right-panel-container');
		// 2026-10-14 起按用户要求：右栏固定、可单独滚动；程序顺带滚动右栏（切换编辑器等）由 nsmaxGuardSidebarScroll 挡回去
		assert.equal(await side.evaluate(e => getComputedStyle(e).position), 'sticky');
		assert.equal(await side.evaluate(e => getComputedStyle(e).overflowY), 'auto');
		assert.deepEqual(errorsCard, []);
	} finally { await ctxCard.close(); }

	// 3. 图三与图四：个人空间布局与 Level 6 专属进度条
	const spaceHtmlLv6 = nativeSpacePage().replace('<div>等级</div><div>3</div>', '<div>等级</div><div>6</div>');
	const {context: ctxSpace, page: pageSpace, errors: errorsSpace} = await open(browser,'https://www.nodeseek.com/space/10',{html: spaceHtmlLv6});
	try {
		await pageSpace.waitForSelector('.nsmax-space-top');
		assert.equal(await pageSpace.locator('.nsmax-space-badge').count(), 0);
		assert.equal(await pageSpace.locator('.nsmax-space-meta .nsmax-space-online').count(), 0);
		assert.equal(await pageSpace.locator('.nsmax-space-meta .nsmax-space-uid').innerText(), 'UID 10');
		assert.equal(await pageSpace.locator('.head-container .card-block>.nsmax-user-stat:visible').count(), 9);
		const progress = pageSpace.locator('.nsmax-space-progress');
		assert.equal(await progress.getAttribute('data-nsmax-level-max') !== null, true);
		assert.equal(await progress.locator('.nsmax-space-progress-level').innerText(), 'Lv.6 登峰造极');
		assert.equal(await progress.locator('.nsmax-space-progress-level b').innerText(), '登峰造极');
		assert.equal(await progress.locator('.nsmax-space-progress-percent').innerText(), 'MAX');
		assert.equal(await progress.locator('.nsmax-space-progress-next').innerText(), '已达最高等级');
		assert.equal(await progress.locator('i > b').evaluate(e => e.style.width), '100%');
		assert.deepEqual(errorsSpace, []);
	} finally { await ctxSpace.close(); }
});

test('用户新需求：个人空间对齐sb.sb、悬停预览尺寸与加速、顶栏精华替换推广并置后带标记、全站Lv6尊贵标记', async () => {
	// 1. 个人空间对齐 sb.sb（svg 隐藏、标签精简、bio 独立排版、Lv6 标记）
	const spaceHtml = nativeSpacePage()
		.replace('<div class="card-item"><div>等级</div><div>3</div></div>', '<div class="card-item"><svg class="icon"><use href="#diamond"></use></svg><div>等级</div><div>6</div></div>')
		.replace('<div class="card-item"><div>鸡腿数目</div><div>1257</div></div>', '<div class="card-item"><svg class="icon"><use href="#drumstick"></use></svg><div>鸡腿数目</div><div>4192</div></div>')
		.replace('<p>一句话介绍自己</p>', '<p>一句话介绍自己</p>');
	const {context: ctxSpace, page: pageSpace, errors: errorsSpace} = await open(browser,'https://www.nodeseek.com/space/50169',{html: spaceHtml});
	try {
		await pageSpace.waitForSelector('.nsmax-space-top');
		// lastActive and online are completely removed per user demand
		assert.equal(await pageSpace.locator('.nsmax-space-last').count(), 0);
		assert.equal(await pageSpace.locator('.nsmax-space-online').count(), 0);

		// Stats labels are cleaned: "鸡腿" not "鸡腿数目"
		const chickenItem = pageSpace.locator('.head-container .card-block>.nsmax-user-stat').filter({hasText: '4192'});
		const chickenLabel = await chickenItem.first().locator('.nsmax-user-stat-label').innerText();
		assert.equal(chickenLabel, '鸡腿');

		// All SVGs in card-block items are hidden
		const svgs = pageSpace.locator('.head-container .card-block>.card-item svg');
		if (await svgs.count() > 0) {
			const svgDisplay = await svgs.first().evaluate(el => getComputedStyle(el).display);
			assert.equal(svgDisplay, 'none');
		}

		// 等级一格写「Lv.6」（2026-10-24 九格统计，以前四格里单独标记 Lv6）
		const levelStat = pageSpace.locator('.head-container .card-block>.nsmax-user-stat').filter({hasText: '等级'});
		assert.equal(await levelStat.locator('.nsmax-user-stat-value').innerText(), 'Lv.6');
		assert.deepEqual(errorsSpace, []);
	} finally { await ctxSpace.close(); }

	// 2. 顶栏精华替换推广、置于末尾、带标记
	const {context: ctxNav, page: pageNav, errors: errorsNav} = await open(browser,'https://www.nodeseek.com/',{html: listPage()});
	try {
		await pageNav.waitForSelector('.nsmax-nq-tab-item');
		// "推广" is hidden
		const promoItems = pageNav.locator('ul.nav-menu li').filter({hasText: '推广'});
		const promoCount = await promoItems.count();
		for (let i = 0; i < promoCount; i++) {
			const promoDisplay = await promoItems.nth(i).evaluate(el => getComputedStyle(el).display);
			assert.equal(promoDisplay, 'none');
		}
		// 2026-10-18：「精华」挪到列表工具条（「抽奖」旁边，照 sb.sb），顶栏只在最后留 NQ
		assert.equal(await pageNav.locator('ul.nav-menu .nsmax-essence-tab').count(), 0);
		const essenceTab = pageNav.locator('.post-list-controler > .nsmax-kind-tabs > a.nsmax-kind-tab[data-kind=award]');
		assert.equal(await essenceTab.isVisible(), true);
		assert.equal(await essenceTab.getAttribute('href'), '/award');
		const tail = await pageNav.locator('ul.nav-menu>li').evaluateAll(items => items.slice(-1).map(li => li.className));
		assert.deepEqual(tail, ['nsmax-nq-tab-item'], 'NQ at the end of nav-menu');
		assert.deepEqual(errorsNav, []);
	} finally { await ctxNav.close(); }

	// 3. 全站 Level 6 尊贵标记 (crown & highlight)
	const postWithLv6 = postPage().replace(
		'<span class="role-tag">Lv 2</span>',
		'<span class="role-tag">Lv 6</span>'
	);
	// 楼层名字后面的等级小标是紧凑排法里的（经典布局的等级在左边作者栏）：在「简洁模式」下看
	const {context: ctxPost, page: pagePost, errors: errorsPost} = await open(browser,'https://www.nodeseek.com/post-1000-1',{html: postWithLv6, init: "if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}"});
	try {
		await pagePost.waitForSelector('.role-tag[data-nsmax-lv6]');
		const tag = pagePost.locator('.role-tag[data-nsmax-lv6]').first();
		assert.equal(await tag.isVisible(), true);
		assert.equal(await tag.getAttribute('data-nsmax-lv6'), 'true');
		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }

	// 4. 悬停预览弹窗尺寸与比例
	const {context: ctxPrev, page: pagePrev, errors: errorsPrev} = await open(browser,'https://www.nodeseek.com/',{html: listPage()});
	try {
		await pagePrev.waitForSelector('ul.post-list .post-title a');
		await pagePrev.locator('ul.post-list .post-title a').first().hover();
		const preview = pagePrev.locator('dialog.nspp-post-preview');
		await preview.waitFor({ state: 'attached' });
		// Width should be compact (<= 400px)
		const maxW = await preview.evaluate(el => getComputedStyle(el).width);
		assert.ok(parseInt(maxW, 10) <= 400 && parseInt(maxW, 10) >= 350, `Preview width is compact: ${maxW}`);
		assert.deepEqual(errorsPrev, []);
	} finally { await ctxPrev.close(); }
});

test('用户最新需求还原：每日签到胶囊UI与排行榜前三高亮、个人空间无围框与Vue切Tab不崩溃、设置弹窗不含欧记图床', async () => {
	// 1. 签到页 UI 与排行榜
	const {context: ctxBoard, page: pageBoard, errors: errorsBoard} = await open(browser, 'https://www.nodeseek.com/board', {html: boardPage()});
	try {
		await pageBoard.waitForSelector('.nsmax-board-banner');
		const bannerText = await pageBoard.locator('.nsmax-board-banner-text').innerText();
		assert.ok(bannerText.includes('今日还未签到'));
		const btns = pageBoard.locator('.nsmax-board-btn');
		assert.equal(await btns.count(), 2);
		assert.equal(await btns.first().innerText(), '鸡腿 x 5');
		assert.equal(await btns.last().innerText(), '试试手气');

		const title = pageBoard.locator('.nsmax-board-title');
		assert.equal(await title.isVisible(), true);
		assert.ok((await title.innerText()).includes('今日签到鸡腿排行榜'));

		const rank1 = pageBoard.locator('.nsmax-board-row[data-rank="1"] .nsmax-board-rank');
		const rank2 = pageBoard.locator('.nsmax-board-row[data-rank="2"] .nsmax-board-rank');
		const rank3 = pageBoard.locator('.nsmax-board-row[data-rank="3"] .nsmax-board-rank');
		assert.equal(await rank1.evaluate(el => getComputedStyle(el).color), 'rgb(239, 68, 68)');
		assert.equal(await rank2.evaluate(el => getComputedStyle(el).color), 'rgb(249, 115, 22)');
		assert.equal(await rank3.evaluate(el => getComputedStyle(el).color), 'rgb(234, 179, 8)');
		assert.deepEqual(errorsBoard, []);
	} finally { await ctxBoard.close(); }

	// 2. 个人空间无围框、会员/在线已移除、MAX 居中居行
	const {context: ctxSpace, page: pageSpace, errors: errorsSpace} = await open(browser, 'https://www.nodeseek.com/space/10', {html: nativeSpacePage()});
	try {
		await pageSpace.waitForSelector('.nsmax-space-top');
		assert.equal(await pageSpace.locator('.nsmax-space-badge').count(), 0);
		assert.equal(await pageSpace.locator('.nsmax-space-online').count(), 0);
		const progress = pageSpace.locator('.nsmax-space-progress');
		assert.equal(await progress.evaluate(el => getComputedStyle(el).borderStyle), 'none');
		assert.equal(await progress.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
		// Click visible tabs to verify no removeChild / unmount errors
		const visibleTabs = pageSpace.locator('.selector a.select-item:visible');
		if (await visibleTabs.count() > 1) {
			await visibleTabs.nth(1).click();
			await pageSpace.waitForTimeout(60);
			await visibleTabs.nth(0).click();
			await pageSpace.waitForTimeout(60);
		}
		assert.deepEqual(errorsSpace, []);
	} finally { await ctxSpace.close(); }

	// 3. 设置页面不含欧记图床
	const {context: ctxSetting, page: pageSetting, errors: errorsSetting} = await open(browser, 'https://www.nodeseek.com/setting', {html: settingPage()});
	try {
		await wait(pageSetting);
		const html = await pageSetting.content();
		assert.ok(!html.includes('欧记图床'));
		assert.ok(!html.includes('image.110726.com'));
		assert.deepEqual(errorsSetting, []);
	} finally { await ctxSetting.close(); }
});

test("v1.7.11 视觉细节（v1.8.0 起按 sb.sb）：顶栏当前板块墨色胶囊、侧栏与悬停卡 Lv 6 位于名字下方", async () => {
	// 1. 顶栏内版非黑底药丸
	const { context: ctxNav, page: pageNav, errors: errorsNav } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pageNav);
		const navInside = pageNav.locator('ul.nav-menu a[href="/categories/inside"]');
		assert.equal(await navInside.count() > 0, true);
		// 模拟激活态
		await navInside.evaluate(el => el.setAttribute("aria-current", "page"));
		const insideStyle = await navInside.evaluate(el => ({
			bg: getComputedStyle(el).backgroundColor,
			color: getComputedStyle(el).color,
			weight: parseInt(getComputedStyle(el).fontWeight, 10)
		}));
		// sb.sb .forum-link.active：墨色实底胶囊、白字、500
		assert.equal(insideStyle.bg, "rgb(28, 28, 30)");
		assert.equal(insideStyle.color, "rgb(255, 255, 255)");
		assert.equal(insideStyle.weight, 500);

		// 2. 侧栏个人卡：Lv 6 位于名字下方且附带尊贵标签
		const accountCard = pageNav.locator(".nsmax-sb-account");
		assert.equal(await accountCard.isVisible(), true);
		const accountInfo = pageNav.locator(".nsmax-account-head .nsmax-account-info");
		assert.equal(await accountInfo.evaluate(el => getComputedStyle(el).flexDirection), "column");
		const accountRank = pageNav.locator(".nsmax-account-rank");
		assert.equal(await accountRank.getAttribute("data-nsmax-lv6"), "true");
		const nameBox = await pageNav.locator(".nsmax-account-name").boundingBox();
		const rankBox = await accountRank.boundingBox();
		assert.ok(rankBox.y >= nameBox.y + nameBox.height - 2, "Lv 6 rank badge is placed vertically under username");

		assert.deepEqual(errorsNav, []);
	} finally { await ctxNav.close(); }

	// 3. 用户头像悬停卡：Lv 6 位于名字下方且附带尊贵流光皇冠
	const apiMock = {
		"/api/account/getInfo/10": [{ body: { success: true, detail: { member_id: 10, member_name: "chunwai", rank: 6, coin: 5364, nPost: 113, nComment: 1612, fans: 20 } } }]
	};
	const { context: ctxPop, page: pagePop, errors: errorsPop } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), api: apiMock });
	try {
		await wait(pagePop);
		const userAvatarLink = pagePop.locator('ul.post-list .post-list-item a[href="/space/10"]').first();
		await userAvatarLink.hover();
		const personPop = pagePop.locator(".nsmax-person-pop");
		await personPop.waitFor({ state: "visible" });
		await pagePop.waitForSelector(".nsmax-person-level[data-nsmax-lv6]");
		const personLevel = pagePop.locator(".nsmax-person-level");
		assert.equal(await personLevel.innerText(), "Lv.6");
		assert.equal(await personLevel.getAttribute("data-nsmax-lv6"), "true");

		const popName = pagePop.locator(".nsmax-person-head a");
		const popNameBox = await popName.boundingBox();
		const popRankBox = await personLevel.boundingBox();
		assert.ok(popRankBox.y >= popNameBox.y + popNameBox.height - 2, "Person hover Lv 6 badge is vertically under username");

		assert.deepEqual(errorsPop, []);
	} finally { await ctxPop.close(); }
});

test("v1.7.12 体验重构：楼中楼平铺不挤扁、个人设置页现代双栏卡片、帖子悬停预览紧凑尺寸", async () => {
	// 1. 楼中楼多级回复平铺测试（避免逐级缩进成狭窄细条）
	const multiLevelPost = postPage().replace(
		'<ul class="comments">',
		`<ul class="comments">
		<li class="content-item" id="10"><div class="nsk-content-meta-info"><div><div class="author-info"><span class="author-name">userA</span></div></div></div><article class="post-content"><p>根楼层讨论</p></article></li>
		<li class="content-item" id="11"><div class="nsk-content-meta-info"><div><div class="author-info"><span class="author-name">userB</span></div></div></div><article class="post-content"><p><a href="/post-1000-1#10">@userA #10</a> 第一轮回复</p></article></li>
		<li class="content-item" id="12"><div class="nsk-content-meta-info"><div><div class="author-info"><span class="author-name">userA</span></div></div></div><article class="post-content"><p><a href="/post-1000-1#11">@userB #11</a> 第二轮回复（回复上一条子回复）</p></article></li>
		<li class="content-item" id="13"><div class="nsk-content-meta-info"><div><div class="author-info"><span class="author-name">userB</span></div></div></div><article class="post-content"><p><a href="/post-1000-1#12">@userA #12</a> 第三轮回复（再次连续回复）</p></article></li>`
	);
	const { context: ctxPost, page: pagePost, errors: errorsPost } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: multiLevelPost });
	try {
		await wait(pagePost);
		// 校验根楼层 #10 下存在 .nsmax-nested-replies
		const nestedList = pagePost.locator('[id="10"] > .nsmax-floor-box > .nsmax-nested-replies');
		assert.equal(await nestedList.count(), 1);
		// 所有子回复 #11, #12, #13 都平铺在根楼层的 .nsmax-nested-replies 下（而不是多层递归嵌套）
		const directChildren = nestedList.locator("> li.content-item");
		assert.equal(await directChildren.count(), 3, "所有连续多轮回复都平铺在根楼层下，避免深层递归阶梯");
		// 校验子元素内部不存在再嵌套的 .nsmax-nested-replies
		assert.equal(await pagePost.locator('[id="10"] .nsmax-fb-count').innerText(), "共 3 条回复");
		const deepNested = nestedList.locator(".nsmax-nested-replies");
		assert.equal(await deepNested.count(), 0, "深度上限严格为 1，杜绝多层嵌套");
		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }

	// 2. 个人设置页 #user-setting-panel 现代布局
	const { context: ctxSetting, page: pageSetting, errors: errorsSetting } = await open(browser, "https://www.nodeseek.com/setting", { html: settingPage() });
	try {
		await wait(pageSetting);
		const panel = pageSetting.locator("#user-setting-panel");
		assert.equal(await panel.isVisible(), true);
		const grid = await panel.evaluate(el => ({ display: getComputedStyle(el).display, cols: getComputedStyle(el).gridTemplateColumns }));
		assert.equal(grid.display, "grid");
		assert.ok(grid.cols.endsWith(" 260px"), "设置区为主栏 + 右侧 260px 双栏（sb.sb 侧栏宽度）");
		assert.deepEqual(errorsSetting, []);
	} finally { await ctxSetting.close(); }
});

test("v1.7.13 细节精修：NQ彩标前置、设置页居中去黑胶囊、帖子图片左对齐边框动效、侧栏支持悬停预览", async () => {
	// 1. 列表页：NQ 按钮包含彩色图标
	const { context: ctxList, page: pageList, errors: errorsList } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pageList);
		const nq = pageList.locator("#nsk-head .nsmax-nq-tab");
		assert.equal(await nq.count(), 1);
		// 2026-10-18 起照 sb.sb 顶栏「论坛应用」按钮：黄底深色字，图标是单色的阶梯「N」（深色模式下也看得清）
		const nqIcon = nq.locator("svg.nsmax-nq-icon");
		assert.equal(await nqIcon.count(), 1, "NQ 按钮前置 NodeQuality「N」图标");
		assert.equal(await nq.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(255, 208, 47)");
		assert.deepEqual(errorsList, []);
	} finally { await ctxList.close(); }

	// 2. 个人设置页居中与按钮去除黑底胶囊
	const { context: ctxSetting, page: pageSetting, errors: errorsSetting } = await open(browser, "https://www.nodeseek.com/setting", { html: settingPage() });
	try {
		await wait(pageSetting);
		const metrics = await pageSetting.evaluate(() => {
			const bodyLeft = document.querySelector("#nsk-body-left");
			const panel = document.querySelector("#user-setting-panel");
			const btn = document.querySelector("#user-setting-panel button");
			return {
				bodyLeftWidth: bodyLeft ? getComputedStyle(bodyLeft).width : "",
				panelMaxWidth: panel ? getComputedStyle(panel).maxWidth : "",
				btnRadius: btn ? getComputedStyle(btn).borderRadius : ""
			};
		});
		assert.equal(metrics.panelMaxWidth, "1600px", "设置页与 sb.sb 版心同宽（1600px）居中");
		assert.ok(metrics.btnRadius !== "999px", "设置按钮去除 999px 沉重黑胶囊样式");
		assert.deepEqual(errorsSetting, []);
	} finally { await ctxSetting.close(); }

	// 3. 帖子图片左对齐风格
	const postHtml = postPage();
	const { context: ctxPost, page: pagePost, errors: errorsPost } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postHtml });
	try {
		await wait(pagePost);
		const imgRules = await pagePost.evaluate(() => {
			const img = document.querySelector(".post-content img");
			if (!img) return null;
			const style = getComputedStyle(img);
			return {
				marginLeft: style.marginLeft,
				marginRight: style.marginRight
			};
		});
		if (imgRules) {
			assert.notEqual(imgRules.marginLeft, "auto");
		}
		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }
});

test("v1.7.14 极致精细化：统一两处 Level 6 标签且皇冠垂直居中、个人空间对齐图3去重与水印屏蔽、热榜30分钟自动静默刷新", async () => {
	// 1. Level 6 皇冠垂直居中与两处标签统一 (侧栏卡与悬停卡)
	const apiMock = {
		"/api/account/getInfo/10": [{ body: { success: true, detail: { member_id: 10, member_name: "chunwai", rank: 6, coin: 5364, nPost: 113, nComment: 1612, fans: 20 } } }]
	};
	const { context: ctxLv6, page: pageLv6, errors: errorsLv6 } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), api: apiMock });
	try {
		await wait(pageLv6);
		// 侧栏个人卡
		const accountRank = pageLv6.locator(".nsmax-account-rank");
		assert.equal(await accountRank.getAttribute("data-nsmax-lv6"), "true");
		assert.equal(await accountRank.innerText(), "Lv.6");
		const crownStyle = await pageLv6.evaluate(() => {
			const el = document.querySelector(".nsmax-account-rank");
			const pseudo = window.getComputedStyle(el, "::before");
			return {
				content: pseudo.content,
				emblem: pseudo.backgroundImage
			};
		});
		// v1.8.1 等级徽章：每级一个徽记（::before 背景图），Lv6 是金色实底 + 王冠
		assert.equal(await accountRank.getAttribute("data-nsmax-level"), "6");
		assert.equal(crownStyle.content, '""');
		assert.ok(crownStyle.emblem.includes("data:image/svg+xml"), "等级徽记应当显示");
		assert.ok((await accountRank.evaluate(el => getComputedStyle(el).backgroundImage)).includes("linear-gradient"), "Lv6 金色实底");

		// 头像悬停卡
		const userAvatarLink = pageLv6.locator('ul.post-list .post-list-item a[href="/space/10"]').first();
		await userAvatarLink.hover();
		const personPop = pageLv6.locator(".nsmax-person-pop");
		await personPop.waitFor({ state: "visible" });
		const personLevel = pageLv6.locator(".nsmax-person-level");
		assert.equal(await personLevel.innerText(), "Lv.6");
		assert.equal(await personLevel.getAttribute("data-nsmax-lv6"), "true");
		assert.deepEqual(errorsLv6, []);
	} finally { await ctxLv6.close(); }

	// 2. 个人空间对齐图 3：Tab 顺序为 主题/回帖/资料/设置，默认激活主题，彻底隐藏 selector 下的重复统计与水印 readme
	const { context: ctxSpace, page: pageSpace, errors: errorsSpace } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage() });
	try {
		await wait(pageSpace);
		// 顶栏仅保留一组统计
		assert.equal(await pageSpace.locator(".head-container .card-block>.nsmax-user-stat:visible").count(), 9);
		// selector 下的重复卡片和水印 readme 彻底隐藏
		assert.equal(await pageSpace.locator(".selector .card-block:visible").count(), 0);
		assert.equal(await pageSpace.locator(".selector-right-side > .card-block:visible").count(), 0);
		assert.equal(await pageSpace.locator(".selector .readme:visible").count(), 0);

		// Tab 排序与激活：移除资料与设置，保留【主题】、【回帖】；看的是别人的主页，没有【收藏】（只有自己看得到）
		const tabTexts = await pageSpace.locator(".selector a.select-item:visible").allInnerTexts();
		assert.equal(tabTexts[0], "主题");
		assert.equal(tabTexts[1], "回帖");
		assert.equal(tabTexts.length, 2);
		assert.equal(await pageSpace.locator(".nsmax-space-setting-btn").count(), 0);
		const activeTab = pageSpace.locator(".selector a.select-item.active:visible");
		assert.equal(await activeTab.innerText(), "主题");
		assert.deepEqual(errorsSpace, []);
	} finally { await ctxSpace.close(); }

	// 3. 今日热门组件定时器与缓存更新机制存在
	const { context: ctxHot, page: pageHot, errors: errorsHot } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pageHot);
		const hotPanel = pageHot.locator(".nsmax-hot-panel");
		assert.equal(await hotPanel.isVisible(), true);
		assert.deepEqual(errorsHot, []);
	} finally { await ctxHot.close(); }
});

test("v1.7.15 视觉与体验精修：设置面板去遮罩去灰条、字体切换全面生效、翻页无底部遮罩、零未捕获异常", async () => {
	// 1. 设置弹窗遮罩去除与标题无灰条
	const { context: ctxSet, page: pageSet, errors: errorsSet } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pageSet);
		await pageSet.locator(".nsmax-settings-button").click();
		const dialog = pageSet.locator("#nspp-settings dialog");
		await dialog.waitFor({ state: "visible" });

		// 检查 Shadow DOM 内部样式：滚动区 .body 无 mask-image，模块标题不吸顶、无底色条（v1.8.1 起面板按 sb.sb 重做）
		const styles = await pageSet.evaluate(() => {
			const host = document.querySelector("#nspp-settings");
			const shadow = host?.shadowRoot;
			const content = shadow?.querySelector(".body");
			const h3 = shadow?.querySelector(".module-title");
			const cStyle = content ? getComputedStyle(content) : null;
			const hStyle = h3 ? getComputedStyle(h3) : null;
			return {
				found: !!content && !!h3,
				maskImage: cStyle?.maskImage || cStyle?.webkitMaskImage || "none",
				h3Position: hStyle?.position || "",
				h3Bg: hStyle?.backgroundColor || ""
			};
		});
		assert.ok(styles.found, "面板里应有滚动区和模块标题");
		assert.ok(styles.maskImage === "none" || styles.maskImage === "", "content 不应含有遮罩 mask-image");
		assert.notEqual(styles.h3Position, "sticky", "h3 不应为 sticky 悬浮条");
		assert.deepEqual(errorsSet, []);
	} finally { await ctxSet.close(); }

	// 2. 字体切换生效验证：Inter、系统字体都要改到页面实际用的字体变量（以前被设计层的默认值盖掉）；已移除的 Claude 字体回到 sb.sb 同款
	for (const [font, attr, sans, mono] of [
		["inter", "inter", /^"Inter Variable"/, /^"JetBrains Mono Variable"/],
		["system", "system", /^system-ui/, /^ui-monospace/],
		["claude", "sbsb", /^system-ui/, /^"Space Mono"/]
	]) {
		const { context: ctxFont, page: pageFont, errors: errorsFont } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
			html: postPage(),
			seed: {
				"nsmax:migrate:font-system": true,
				"nsmax:migrate:font-sbsb": true,
				"nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: true, font } }
			}
		});
		try {
			await wait(pageFont);
			const fontState = await pageFont.evaluate(() => {
				const style = getComputedStyle(document.body);
				const post = document.querySelector("article.post-content, .post-content, h1");
				return {
					attr: document.documentElement.getAttribute("data-nsmax-font"),
					sans: style.getPropertyValue("--font-sans").trim(),
					mono: style.getPropertyValue("--font-mono").trim(),
					postFont: post ? getComputedStyle(post).fontFamily : ""
				};
			});
			assert.equal(fontState.attr, attr, `${font}：data-nsmax-font`);
			assert.match(fontState.sans, sans, `${font}：--font-sans`);
			assert.match(fontState.mono, mono, `${font}：--font-mono`);
			assert.match(fontState.postFont, sans, `${font}：正文实际字体 ${fontState.postFont}`);
			assert.deepEqual(errorsFont, []);
		} finally { await ctxFont.close(); }
	}

	// 3. 翻页区域去遮罩与页脚完全隐藏
	const { context: ctxPager, page: pagePager, errors: errorsPager } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pagePager);
		const pagerState = await pagePager.evaluate(() => {
			const pager = document.querySelector(".nsk-pager.pager-bottom, .post-bottom-pager, .nsk-pager:not(.pager-top)");
			const footer = document.querySelector("footer, .footer, body > footer");
			const hidden = !footer || getComputedStyle(footer).display === "none";
			return {
				pagerVisible: pager ? getComputedStyle(pager).display !== "none" : false,
				// v1.8.1 起桌面端按 sb.sb 新版显示页脚（品牌区 + 5 列链接），它是排在内容之后的普通块：不能固定 / 粘在底部，也不能盖住翻页区
				footerClear: hidden || (!/fixed|sticky/.test(getComputedStyle(footer).position) && footer.getBoundingClientRect().top >= pager.getBoundingClientRect().bottom)
			};
		});
		assert.equal(pagerState.pagerVisible, true);
		assert.equal(pagerState.footerClear, true, "页脚不应在翻页处形成遮罩");
		assert.deepEqual(errorsPager, []);
	} finally { await ctxPager.close(); }
});

test("v1.7.16 极致体验：不在新标签页打开帖子生效、丝滑过渡与极速预渲染", async () => {
	// 1. 关闭“新标签页打开”时，帖子链接 target 强制设为 _self 且不新开标签
	const { context: ctxTab, page: pageTab, errors: errorsTab } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		seed: {
			"nspp:settings:www.nodeseek.com": {
				"reading-content": {
					enabled: true,
					newTab: false
				}
			}
		}
	});
	try {
		await wait(pageTab);
		const targetState = await pageTab.evaluate(() => {
			const links = Array.from(document.querySelectorAll(".post-list-item .post-title a, .post-title a, a[href*='/post-']"));
			return {
				count: links.length,
				allSelfOrNone: links.every(a => !a.target || a.target === "_self")
			};
		});
		assert.ok(targetState.count > 0, "列表页应当存在帖子链接");
		assert.equal(targetState.allSelfOrNone, true, "关闭 newTab 后所有帖子链接都不应在新标签页打开");
		assert.deepEqual(errorsTab, []);
	} finally { await ctxTab.close(); }
});

test("v1.7.17 深度优化与功能完成：列表双重图标彻底杜绝、发帖一键抽奖弹窗配置并写入", async () => {
	// 1. 列表双重图标彻底杜绝
	const { context: ctxList, page: pageList, errors: errorsList } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		viewport: { width: 1440, height: 900 }
	});
	try {
		await wait(pageList);
		const iconCheck = await pageList.evaluate(() => {
			const rows = Array.from(document.querySelectorAll("#nsk-body-left .post-list-item .post-info"));
			let doubleSvgFound = false;
			let maskIconFound = false;
			for (const row of rows) {
				const items = row.querySelectorAll(".info-author, .info-views, .info-comments-count, .info-last-commenter");
				for (const item of items) {
					const svgs = Array.from(item.querySelectorAll("svg")).filter(s => getComputedStyle(s).display !== "none");
					if (svgs.length > 1) doubleSvgFound = true;
					const beforeContent = getComputedStyle(item, "::before").content;
					if (beforeContent && beforeContent !== "none" && beforeContent !== '""') {
						maskIconFound = true;
					}
				}
			}
			return { rowsCount: rows.length, doubleSvgFound, maskIconFound };
		});
		assert.ok(iconCheck.rowsCount > 0, "列表页应当存在列表行");
		assert.equal(iconCheck.doubleSvgFound, false, "列表项中不应出现两个可见 svg 图标");
		assert.equal(iconCheck.maskIconFound, false, "列表项不应通过 ::before 绘制冗余伪元素图标");
		assert.deepEqual(errorsList, []);
	} finally { await ctxList.close(); }

	// 2. 发帖页一键抽奖交互配置弹窗并回写
	const { context: ctxPost, page: pagePost, errors: errorsPost } = await open(browser, "https://www.nodeseek.com/new-discussion", {
		html: newPostPage()
	});
	try {
		await pagePost.waitForSelector(".nsmax-lucky-trigger");
		const trigger = pagePost.locator(".nsmax-lucky-trigger");
		assert.equal(await trigger.isVisible(), true, "发布按钮旁的一键抽奖按钮应当可见");

		// 点击唤起弹窗
		await trigger.click();
		await pagePost.waitForSelector("dialog.nsmax-lucky-dialog[open]");
		const modal = pagePost.locator("dialog.nsmax-lucky-dialog");
		assert.equal(await modal.isVisible(), true, "抽奖配置弹窗应当打开");

		// 修改配置项：奖品、中奖人数（2026-10-18 起是 sb.sb 表单弹窗）
		const inputs = modal.locator(".nsmax-lucky-field input");
		await inputs.nth(0).fill("搬瓦工 VPS 1台");
		await inputs.nth(1).fill("3");
		// 点击快捷时间按钮
		await pagePost.locator(".nsmax-lucky-presets button").first().click();

		// 发布抽奖帖：填进发帖表单（夹具里站点的「发布帖子」不发请求）
		await modal.locator(".nsmax-dialog-button.primary").click();
		await wait(pagePost, 150);

		// 验证弹窗已关闭且正文与标题均已更新
		assert.equal(await pagePost.locator("dialog.nsmax-lucky-dialog").count(), 0, "发布后抽奖弹窗应当关闭");
		const titleVal = await pagePost.locator("#mde-title").inputValue();
		const bodyVal = await pagePost.locator(".md-editor textarea").inputValue();

		assert.equal(titleVal, "【抽奖】搬瓦工 VPS 1台", "发帖标题应当带有抽奖前缀");
		assert.ok(bodyVal.includes("搬瓦工 VPS 1台"), "正文应当包含奖品名称");
		assert.ok(bodyVal.includes("3 人"), "正文应当包含中奖人数");
		assert.ok(bodyVal.includes("开奖链接"), "正文应当包含开奖链接一行（发出去后脚本补上）");

		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }
});

test("v1.7.19 极致细节复刻：主帖无#0楼号、标题栏双统计、OP小字引用回复举报、一键@admin评论、控制栏纯色咬合去遮罩", async () => {
	// 1. 帖子详情页 OP 楼层与标题栏
	const { context: ctxPost, page: pagePost, errors: errorsPost } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
		html: postPage()
	});
	try {
		await pagePost.waitForSelector(".nsk-post");
		await pagePost.waitForSelector(".nsmax-post-stat-item");
		await wait(pagePost);

		// A. 验证主帖 #0 楼号彻底隐藏
		const opFloorVisible = await pagePost.evaluate(() => {
			const op = document.querySelector(".nsk-post");
			if (!op) return false;
			const floorLinks = Array.from(op.querySelectorAll(".floor-link-wrapper, a.floor-link, [href='#0']"));
			return floorLinks.some(el => {
				const style = window.getComputedStyle(el);
				return style.display !== "none" && style.visibility !== "hidden" && !el.hasAttribute("hidden");
			});
		});
		assert.equal(opFloorVisible, false, "主帖 OP 不应显示 #0 楼号");

		// B. 验证标题栏包含浏览量与回复数两组统计
		const statsCheck = await pagePost.evaluate(() => {
			const stats = document.querySelector(".nsk-post .nsmax-post-stats");
			if (!stats) return { found: false };
			const items = stats.querySelectorAll(".nsmax-post-stat-item");
			return {
				found: true,
				count: items.length,
				views: items[0]?.textContent.trim(),
				replies: items[1]?.textContent.trim()
			};
		});
		assert.equal(statsCheck.found, true, "标题栏右侧应当存在统计区域");
		assert.equal(statsCheck.count, 2, "应当同时展示浏览量与回复数");
		assert.ok(Number(statsCheck.views) > 0, "浏览量应当大于0");
		assert.ok(Number(statsCheck.replies) > 0, "回复数应当大于0");

		// C. 验证主帖包含小字 引用、回复、举报
		const actionsCheck = await pagePost.evaluate(() => {
			const op = document.querySelector(".nsk-post");
			const actions = op?.querySelector(".nsmax-op-actions");
			if (!actions) return { found: false };
			const links = Array.from(actions.querySelectorAll(".nsmax-op-action")).map(a => a.textContent.trim());
			return {
				found: true,
				links
			};
		});
		assert.equal(actionsCheck.found, true, "OP 楼主右侧应当存在小字操作区域");
		assert.deepEqual(actionsCheck.links, ["引用", "回复", "举报"], "操作区应包含引用、回复、举报");

		// D. 验证主帖底部不含多余的大按钮“引用”和“回复”
		const bottomMenuCheck = await pagePost.evaluate(() => {
			const menu = document.querySelector(".nsk-post .comment-menu");
			if (!menu) return { hasExtra: false };
			const texts = Array.from(menu.querySelectorAll(".menu-item")).map(m => m.textContent + " " + (m.title || ""));
			return {
				hasExtra: texts.some(t => /引用|回复/.test(t))
			};
		});
		assert.equal(bottomMenuCheck.hasExtra, false, "主帖底部卡片不应包含冗余的引用和回复按钮");

		// E. 举报：回复框里写上 @admin，别的都不做（2026-10-18 起不自动发出去）
		let submitTriggered = false;
		await pagePost.exposeFunction("__testReportSubmitted", () => {
			submitTriggered = true;
		});
		await pagePost.evaluate(() => {
			const btn = document.querySelector(".md-editor button.submit");
			if (btn) btn.addEventListener("click", () => window.__testReportSubmitted());
		});
		await pagePost.locator(".nsmax-op-actions .nsmax-op-report").click();
		await wait(pagePost, 150);

		const editorVal = await pagePost.evaluate(() => {
			const input = document.querySelector(".md-editor textarea");
			return input ? input.value : "";
		});
		assert.ok(editorVal.includes("@admin"), "点击举报应当在编辑器中自动填入 @admin");
		assert.equal(submitTriggered, false, "举报只填 @admin，不自动发出");
		assert.equal(new URL(pagePost.url()).pathname, "/post-1000-1", "不跳到别的页");

		// F. 验证 Markdown 工具栏交互
		await pagePost.locator(".nsmax-editor-controls button[title*='Markdown'], .nsmax-editor-controls button[aria-label*='Markdown']").click();
		const mdeVisible = await pagePost.locator(".nsmax-custom-mde-toolbar").isVisible();
		assert.equal(mdeVisible, true, "点击使用 Markdown 编辑器后工具栏应可见");
		await pagePost.locator(".nsmax-custom-mde-toolbar button[title='粗体']").click();
		const boldVal = await pagePost.evaluate(() => document.querySelector(".md-editor textarea")?.value || "");
		assert.ok(boldVal.includes("**"), "点击粗体按钮应插入 Markdown 粗体标记");

		// G. 验证底部分页无黑色遮罩/多余 padding
		const pagerCheck = await pagePost.evaluate(() => {
			const pager = document.querySelector(".nsk-pager");
			const bodyLeft = document.querySelector("#nsk-body-left");
			return {
				pagerBg: pager ? getComputedStyle(pager).backgroundColor : "",
				bodyLeftPad: bodyLeft ? getComputedStyle(bodyLeft).paddingBottom : ""
			};
		});
		assert.notEqual(pagerCheck.bodyLeftPad, "60px", "body-left 底部内边距不应为 60px 造成空黑遮罩");

		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }

	// 2. 首页控制栏与顶栏复刻
	const { context: ctxList, page: pageList, errors: errorsList } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage()
	});
	try {
		await pageList.waitForSelector("html[data-nsmax-theme]");
		await wait(pageList);
		await pageList.waitForSelector(".post-list-controler");
		const controlerStyle = await pageList.evaluate(() => {
			const ctrl = document.querySelector(".post-list-controler");
			if (!ctrl) return null;
			const style = window.getComputedStyle(ctrl);
			return {
				display: style.display,
				height: style.height,
				borderRadius: style.borderTopLeftRadius,
				backgroundColor: style.backgroundColor
			};
		});
		assert.equal(controlerStyle.display, "flex");
		assert.equal(controlerStyle.height, "49.5px");
		assert.equal(controlerStyle.borderRadius, "12px");
		assert.notEqual(controlerStyle.backgroundColor, "rgba(0, 0, 0, 0)");

		// 验证没有遮罩
		const maskCheck = await pageList.evaluate(() => {
			const header = document.querySelector("body > header, #nsk-head");
			if (!header) return true;
			const before = window.getComputedStyle(header, "::before");
			return before.content === "none" || before.display === "none";
		});
		assert.equal(maskCheck, true, "顶栏不应有伪元素遮罩");

		assert.deepEqual(errorsList, []);
	} finally { await ctxList.close(); }
});

test("v1.7.21 深度定制：Markdown 选项卡点击原地切换不重载、跑分终端与表格美化、消息中心双栏防折字无死黑", async () => {
	const markdownTabsHtml = `
		<div class="tabs">
			<ul class="tab-list">
				<li class="tab-item active"><a href="#tab-1" data-tab="tab-1">HKT 测速</a></li>
				<li class="tab-item"><a href="#tab-2" data-tab="tab-2">HiNet 测速</a></li>
			</ul>
			<div class="tab-panels">
				<div id="tab-1" class="tab-panel active"><pre><code>HKT 1000Mbps Ping 5ms</code></pre></div>
				<div id="tab-2" class="tab-panel" style="display:none"><pre><code>HiNet 500Mbps Ping 12ms</code></pre></div>
			</div>
		</div>
	`;
	const html = postPage().replace("<h2>配置说明</h2>", markdownTabsHtml + "<h2>配置说明</h2>");
	const { context: ctxPost, page: pagePost, errors: errorsPost } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html });
	try {
		await pagePost.waitForSelector(".tabs .tab-item");
		await wait(pagePost);

		// 1. 验证选项卡初始状态
		assert.equal(await pagePost.locator(".tabs .tab-item").first().evaluate(e => e.classList.contains("active")), true);
		assert.equal(await pagePost.locator("#tab-1").isVisible(), true);
		assert.equal(await pagePost.locator("#tab-2").isVisible(), false);

		// 2. 点击切换选项卡，验证原地切换且不发生重定向或页面崩溃
		await pagePost.locator('.tabs .tab-item a[href="#tab-2"]').click();
		await wait(pagePost, 100);
		assert.equal(await pagePost.evaluate(() => location.pathname), "/post-1000-1");
		assert.equal(await pagePost.locator("#tab-2").isVisible(), true);
		assert.equal(await pagePost.locator("#tab-1").isVisible(), false);
		assert.equal(await pagePost.locator(".tabs .tab-item").nth(1).evaluate(e => e.classList.contains("active")), true);

		// 3. 验证 Markdown 表格与代码块的 sb.sb 样式
		const styles = await pagePost.evaluate(() => {
			const table = document.querySelector(".post-content table");
			const th = document.querySelector(".post-content th");
			const pre = document.querySelector(".post-content pre");
			return {
				thBg: th ? getComputedStyle(th).backgroundColor : "",
				preRadius: pre ? getComputedStyle(pre).borderRadius : "",
				preFont: pre ? getComputedStyle(pre).fontFamily : ""
			};
		});
		assert.notEqual(styles.thBg, "rgba(0, 0, 0, 0)");
		assert.ok(styles.preFont.includes("mono"));

		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }

	// 4. 验证通知与私信双栏无折字、无死黑
	const { context: ctxMsg, page: pageMsg, errors: errorsMsg } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", {
		html: nativeTalkPage(),
		viewport: { width: 1440, height: 900 }
	});
	try {
		await pageMsg.waitForSelector(".nspp-messages textarea:visible");
		await wait(pageMsg);

		const msgLayout = await pageMsg.evaluate(() => {
			const root = document.querySelector(".nspp-messages");
			const sidebar = document.querySelector(".nspp-messages-sidebar");
			const tabs = document.querySelector(".nspp-messages-top > .nsmax-message-tabs");
			const searchBtn = document.querySelector(".nspp-messages-search button");
			const composer = document.querySelector(".nspp-messages-composer");
			return {
				rootBg: root ? getComputedStyle(root).backgroundColor : "",
				hasNoticeNav: !!document.querySelector(".nsmax-notice-nav"),
				atMeLink: !!tabs?.querySelector('a[href*="atMe"]'),
				replyLink: !!tabs?.querySelector('a[href*="reply"]'),
				searchBtnWhite: searchBtn ? getComputedStyle(searchBtn).whiteSpace : "",
				composerVisible: composer ? getComputedStyle(composer).display !== "none" : false
			};
		});
		assert.notEqual(msgLayout.rootBg, "rgb(0, 0, 0)");
		assert.equal(msgLayout.hasNoticeNav, false, "@我 / 回复主题只在顶栏标签里，左栏不再重复");
		assert.equal(msgLayout.atMeLink, true);
		assert.equal(msgLayout.replyLink, true);
		assert.equal(msgLayout.searchBtnWhite, "nowrap");
		assert.equal(msgLayout.composerVisible, true);

		assert.deepEqual(errorsMsg, []);
	} finally { await ctxMsg.close(); }
});

test("v1.7.26 签到页往返防崩溃与中等屏顶栏防遮挡、右侧栏260px锁定", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1024, height: 768 } });
	try {
		await page.waitForSelector("html[data-nsmax-theme]");
		await wait(page);

		// 1. 验证 1024px 视口下顶栏分类与搜索框无重叠
		const headerState = await page.evaluate(() => {
			const nav = document.querySelector("#nsk-head ul.nav-menu");
			const search = document.querySelector("#nsk-head .search-box");
			if (!nav || !search) return { overlap: false };
			const nr = nav.getBoundingClientRect();
			const sr = search.getBoundingClientRect();
			return {
				navRight: nr.right,
				searchLeft: sr.left,
				overlap: nr.right > sr.left
			};
		});
		assert.equal(headerState.overlap, false, "分类栏不得与搜索框发生重叠遮挡");

		// 2. 模拟前端导航至 /board
		await page.evaluate(() => {
			window.history.pushState({}, "", "/board");
			window.dispatchEvent(new Event("popstate"));
		});
		await wait(page, 400);

		const boardState = await page.evaluate(() => {
			const banner = document.querySelector(".nsmax-board-banner");
			const bodyChildren = Array.from(document.querySelector("#nsk-body")?.children || []).map(c => c.id || c.className);
			return {
				page: document.documentElement.dataset.nsmaxPage,
				bannerExists: !!banner,
				bannerInBodyDirect: banner?.parentElement?.id === "nsk-body",
				bodyChildren
			};
		});
		assert.equal(boardState.page, "board");
		assert.equal(boardState.bannerExists, true);
		assert.equal(boardState.bannerInBodyDirect, false, "Banner 严禁作为 #nsk-body 的直接子节点");

		// 3. 模拟前端导航返回首页 /
		await page.evaluate(() => {
			window.history.pushState({}, "", "/");
			window.dispatchEvent(new Event("popstate"));
		});
		await wait(page, 400);

		const returnState = await page.evaluate(() => {
			const banner = document.querySelector(".nsmax-board-banner");
			const card = document.querySelector("#nsk-right-panel-container .user-card");
			const acc = document.querySelector("#nsk-right-panel-container .nsmax-sb-account");
			const rightPanel = document.querySelector("#nsk-body > #nsk-right-panel-container");
			return {
				page: document.documentElement.dataset.nsmaxPage,
				bannerExists: !!banner,
				rightPanelWidth: rightPanel ? Math.round(rightPanel.getBoundingClientRect().width) : 0,
				cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
				accInsideCard: card && acc ? card.contains(acc) : false
			};
		});
		assert.equal(returnState.page, "list");
		assert.equal(returnState.bannerExists, false, "离开 /board 后必须完全清理 Banner 残留");
		assert.equal(returnState.rightPanelWidth, 260, "右侧面板必须稳定维持 260px 宽度");
		assert.equal(returnState.cardWidth, 260, "个人资料卡必须撑满右侧栏 260px");
		assert.equal(returnState.accInsideCard, true, "个人账号信息组件必须被安全包裹在资料卡内部");

		assert.deepEqual(errors, []);
	} finally {
		await context.close();
	}
});

test("v1.7.27 发帖按钮全宽胶囊与文字完整性、顶栏精华跟随分类、中等屏两栏对齐与无死白", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		viewport: { width: 1024, height: 613 }
	});
	try {
		await page.waitForSelector(".nsmax-account-compose");
		const layout = await page.evaluate(() => {
			const compose = document.querySelector(".nsmax-account-compose");
			const essence = document.querySelector("ul.nav-menu > li.nsmax-essence-tab-item");
			const head = document.querySelector("#nsk-head");
			const body = document.querySelector("#nsk-body");
			const logo = document.querySelector("#nsk-head .site-title");
			const left = document.querySelector("#nsk-body-left");
			const right = document.querySelector("#nsk-right-panel-container");
			const search = document.querySelector("#nsk-head .search-box");
			const nav = document.querySelector("#nsk-head ul.nav-menu");

			return {
				composeText: compose ? compose.textContent.trim() : "",
				composeWidth: compose ? Math.round(compose.getBoundingClientRect().width) : 0,
				composeHeight: compose ? Math.round(compose.getBoundingClientRect().height) : 0,
				essenceMarginLeft: essence ? getComputedStyle(essence).marginLeft : "",
				essenceFollows: essence && nav ? essence.parentElement === nav : false,
				logoX: logo ? Math.round(logo.getBoundingClientRect().x) : 0,
				leftX: left ? Math.round(left.getBoundingClientRect().x) : 0,
				rightRight: right ? Math.round(right.getBoundingClientRect().right) : 0,
				searchX: search ? Math.round(search.getBoundingClientRect().x) : 0,
				navRight: nav ? Math.round(nav.getBoundingClientRect().right) : 0,
				headWidth: head ? Math.round(head.getBoundingClientRect().width) : 0,
				bodyWidth: body ? Math.round(body.getBoundingClientRect().width) : 0
			};
		});

		assert.equal(layout.composeText, "+ 发帖", "发帖按钮必须含有明确的 '+ 发帖' 文本");
		assert.ok(layout.composeWidth >= 200, `发帖按钮宽度必须撑满资料卡内容区 (实际 ${layout.composeWidth}px)`);
		assert.ok(layout.composeHeight >= 34, `发帖按钮高度必须达到胶囊标准高度 (实际 ${layout.composeHeight}px)`);
		// 2026-10-18：「精华」不在顶栏了（挪到列表工具条）
		assert.equal(layout.essenceFollows, false, "顶栏不再有精华标签");
		assert.equal(layout.logoX, layout.leftX, `Logo 起始坐标 (${layout.logoX}px) 必须与帖子列表卡片起始坐标 (${layout.leftX}px) 垂直绝对对齐`);
		assert.ok(layout.searchX >= layout.navRight, `搜索框 (${layout.searchX}px) 严禁遮挡分类菜单 (${layout.navRight}px)`);
		assert.ok(layout.rightRight >= 1000, `右侧面板必须铺展至视口右边缘 (实际 ${layout.rightRight}px)，杜绝死白右侧空隙`);
		assert.deepEqual(errors, []);
	} finally {
		await context.close();
	}
});



test("v1.8.1 防卡死：主题里没有 :has()，个人空间静止时不再反复改 DOM", async () => {
	const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "nodeseek-max.user.js"), "utf8");
	// 主题 CSS 现在是按页面分块（nsmax_theme_segments），拼起来检查
	const themeLine = source.split("\n").find((line) => line.startsWith("\tvar nsmax_theme_segments = "));
	const themeCss = JSON.parse(themeLine.slice("\tvar nsmax_theme_segments = ".length, -1)).map(([, css]) => css).join("");
	assert.equal(themeCss.includes(":has("), false, "主题 CSS 里的 :has() 会让帖子里的终端渲染卡死整页");
	for (const [render, hash] of [[spaceTopicsPage, "#/discussions"], [spaceCommentsPage, "#/comments"]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10" + hash, { html: render() });
		try {
			await page.waitForTimeout(1500);
			const churn = await page.evaluate(() => new Promise((resolve) => {
				let count = 0;
				const observer = new MutationObserver((records) => { count += records.length; });
				observer.observe(document, { childList: true, subtree: true, characterData: true });
				setTimeout(() => { observer.disconnect(); resolve(count); }, 1500);
			}));
			assert.equal(churn, 0, "个人空间静止时仍在改 DOM（整理函数要只在值变化时才写）");
			await page.locator(".selector a.select-item[data-nsmax-tab=comments]").click();
			assert.equal(await page.evaluate(() => location.hash), "#/comments");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.1 我的关注 / 粉丝：sb.sb 成员卡片、按钮挪进卡片、不把第一张当成自己的资料卡、静止不改 DOM", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/fans", { html: fansPage({ dark }), colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector(".nsmax-member");
			// 浮层样式按需注入：先动一下鼠标，保证量原生资料卡之前已经注入
			await page.mouse.move(8, 8);
			assert.equal(await page.locator(".nsmax-member").count(), 5);
			assert.deepEqual(await page.locator(".fans-switcher > a.switcher-item").allInnerTexts(), ["我的关注", "我的粉丝"]);
			assert.equal(await page.locator(".nsmax-member").first().locator(".nsmax-member-actions > .btn").count(), 3);
			assert.equal(await page.locator(".usercard-button-group > .btn").count(), 0);
			assert.equal(await page.locator(".hover-user-card").evaluate((el) => getComputedStyle(el).display), "none", "NodeSeek 自己的悬停资料卡没触发时不能显示出来");
			assert.equal(await page.locator(".user-card-wrapper [data-nsmax-usercard]").count(), 0, "成员卡片不能被当成侧栏资料卡");
			assert.equal(await page.locator(".nsmax-member").nth(1).locator(".nsmax-member-bio").innerText(), "加入 1316 天");
			assert.equal(await page.locator(".nsmax-member").first().locator("[data-nsmax-level]").getAttribute("data-nsmax-level"), "6");
			assert.equal(await page.locator(".nsmax-member").first().locator(".nsmax-member-avatar img").count(), 1);
			await page.waitForTimeout(1500);
			const churn = await page.evaluate(() => new Promise((resolve) => { let n = 0; const o = new MutationObserver((r) => { n += r.length; }); o.observe(document, { childList: true, subtree: true, characterData: true }); setTimeout(() => { o.disconnect(); resolve(n); }, 1500); }));
			assert.equal(churn, 0, "关注 / 粉丝页静止时仍在改 DOM");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.1 账簿：sb.sb 积分账本表格、页码挪到表格下方居中、变动正负上色、静止不改 DOM", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/credit#/p-1", { html: creditPage({ dark }), colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector(".credit-table td[data-nsmax-num]");
			await page.waitForTimeout(1500);
			const layout = await page.evaluate(() => {
				const table = document.querySelector(".credit-table table").getBoundingClientRect();
				const items = Array.from(document.querySelectorAll(".credit-table .nsk-pager :is(.pager-pos, .pager-prev, .pager-next, .nsmax-pager-ellipsis)")).filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect());
				const left = Math.min(...items.map((r) => r.left)), right = Math.max(...items.map((r) => r.right));
				const cells = Array.from(document.querySelectorAll(".credit-table tbody tr > td:first-child"));
				const style = (el, pseudo) => getComputedStyle(el, pseudo);
				return {
					gap: Math.round(Math.min(...items.map((r) => r.top)) - table.bottom),
					centerDiff: Math.abs((left + right) / 2 - (table.left + table.right) / 2),
					radius: style(document.querySelector(".credit-table table")).borderTopLeftRadius,
					signs: cells.map((td) => td.getAttribute("data-nsmax-num")),
					plusBefore: style(cells[0], "::before").content,
					minusColor: style(cells[2]).color,
					plusColor: style(cells[0]).color,
					success: style(document.documentElement).getPropertyValue("--success").trim(),
					font: style(cells[0]).fontFamily,
					flagged: document.querySelector(".credit-table > div").hasAttribute("data-nsmax-pagerbox"),
				};
			});
			assert.equal(layout.gap, 20, "页码应在表格下方 20px");
			assert.ok(layout.centerDiff <= 1, `页码应与表格居中对齐（偏 ${layout.centerDiff}px）`);
			assert.equal(layout.radius, "12px");
			assert.deepEqual(layout.signs, ["plus", "plus", "minus", "plus", "plus"]);
			assert.equal(layout.plusBefore, '"+"');
			assert.notEqual(layout.minusColor, layout.plusColor);
			assert.match(layout.font, /Space Mono/);
			assert.equal(layout.flagged, false, "账簿的页码和表格同在一个 div 里，不能当成页码外层排成左右两栏");
			const churn = await page.evaluate(() => new Promise((resolve) => { let n = 0; const o = new MutationObserver((r) => { n += r.length; }); o.observe(document, { childList: true, subtree: true, characterData: true }); setTimeout(() => { o.disconnect(); resolve(n); }, 1500); }));
			assert.equal(churn, 0, "账簿页静止时仍在改 DOM");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.1 设置面板：sb.sb 弹窗与分页、改动立即保存、搜索、联动开关、每个模块都有名字", async () => {
	const KEY = "nspp:settings:www.nodeseek.com";
	const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem("__gm__:" + key) || "{}"), KEY);
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark }), colorScheme: dark ? "dark" : "light", viewport: { width: 1440, height: 900 } });
		try {
			await wait(page);
			await page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
			const host = page.locator("#nspp-settings");
			await host.locator("dialog").waitFor({ state: "visible" });
			assert.deepEqual(await host.getByRole("tab").allInnerTexts(), ["外观", "浏览", "用户", "工具", "网络", "关于"]);
			const modules = await host.locator(".module").evaluateAll((list) => list.map((m) => ({ id: m.dataset.feature, title: m.querySelector(".module-title")?.textContent.trim() || "" })));
			assert.ok(modules.length >= 20, `模块数 ${modules.length}`);
			assert.deepEqual(modules.filter((m) => !m.title), [], "不能有没名字的空白开关");
			for (const id of ["sb-page-controls", "post-status-style"]) assert.ok(!modules.some((m) => m.id === id), `${id} 不进面板`);
			const box = await host.locator("dialog").evaluate((d) => ({ radius: getComputedStyle(d).borderTopLeftRadius, width: d.getBoundingClientRect().width }));
			assert.equal(box.radius, "12px");
			assert.ok(box.width <= 720, `弹窗宽 ${box.width}`);
			// 只保留圆角：面板里没有圆角 / 直角选项
			assert.equal(await host.getByRole("radio", { name: "直角" }).count(), 0);
			// 分段选择：点「特大」立即写入存储
			await host.getByRole("radio", { name: "特大", exact: true }).click();
			assert.equal(await host.getByRole("radio", { name: "特大", exact: true }).getAttribute("aria-checked"), "true");
			assert.equal((await stored(page))["modern-theme"].fontSize, "xlarge");
			// 今日热门：总开关同时关掉「侧栏显示」，不会留下关不掉的子开关
			await host.getByRole("checkbox", { name: "今日热门", exact: true }).uncheck();
			const hot = (await stored(page))["hot-rankings"];
			assert.equal(hot.enabled, false);
			assert.equal(hot.sidebar, false);
			// 分页切换与搜索
			await host.getByRole("tab", { name: "工具", exact: true }).click();
			assert.equal(await host.locator('.module[data-feature="image-upload"]').isVisible(), true);
			assert.equal(await host.locator('.module[data-feature="modern-theme"]').isVisible(), false);
			await host.getByRole("searchbox", { name: "搜索设置" }).fill("备注");
			await page.waitForTimeout(300);
			assert.deepEqual(await host.locator(".module").evaluateAll((list) => list.map((m) => m.dataset.feature)), ["user-notes"]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.1 自动翻页按设置运行：帖子列表默认不接下一页，打开「帖子自动翻页」才出现加载按钮", async () => {
	for (const posts of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
			html: listPage(),
			pages: { "/page-2": listPage() },
			seed: { "nspp:settings:www.nodeseek.com": { "infinite-scroll": { enabled: true, posts, comments: true } } }
		});
		try {
			await wait(page, 900);
			assert.equal(await page.locator("ul.post-list ~ button.nspp-action").count(), posts ? 1 : 0, `posts=${posts}`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.1 用户备注：名字后面的胶囊标签；2026-10-18 起「本地好友」删掉了，旧设置里存的好友不再显示标签", async () => {
	const seed = { "nspp:settings:www.nodeseek.com": { "user-notes": { enabled: true, notes: "user0=测试备注" }, "local-friends": { enabled: true, users: "user1" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed });
	try {
		await page.waitForSelector(".nspp-user-note");
		await wait(page, 600);
		const state = await page.evaluate(() => {
			const note = document.querySelector(".nspp-user-note");
			return {
				note: note.textContent,
				title: note.title,
				height: note.getBoundingClientRect().height,
				radius: parseFloat(getComputedStyle(note).borderTopLeftRadius),
				noteAuthor: note.closest(".post-list-item")?.querySelector(".info-author")?.textContent.trim(),
				friends: document.querySelectorAll(".nspp-friend-badge").length
			};
		});
		assert.equal(state.note, "测试备注");
		assert.equal(state.title, "备注：测试备注");
		assert.equal(state.height, 16);
		assert.ok(state.radius >= 8, `圆角 ${state.radius}`);
		assert.equal(state.noteAuthor, "user0");
		assert.equal(state.friends, 0, "本地好友删掉了");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});


test("v1.8.32 照 sb.sb 的圆角模式：--r-scale 是 1（旧设置里保存的「直角」不再生效）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		seed: { "nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: true, radius: "square" } } }
	});
	try {
		await wait(page);
		const state = await page.evaluate(() => ({
			attr: document.documentElement.getAttribute("data-nsmax-radius"),
			scale: getComputedStyle(document.body).getPropertyValue("--r-scale").trim(),
			card: getComputedStyle(document.querySelector(".post-list-controler")).borderTopLeftRadius,
			input: getComputedStyle(document.querySelector("#search-site")).borderTopLeftRadius,
			radius: getComputedStyle(document.body).getPropertyValue("--r").trim(),
			pill: getComputedStyle(document.body).getPropertyValue("--r-pill").trim()
		}));
		assert.equal(state.attr, "large", "圆角模式：属性是 large");
		assert.equal(state.scale, "1", "圆角模式：--r-scale 是 1");
		assert.equal(state.card, "12px");
		assert.equal(state.input, "8px");
		assert.equal(state.radius, "calc(12px * 1)");
		assert.equal(state.pill, "calc(9999px * 1)");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
test("v1.8.1 自己的帖子：主帖「编辑」挪到楼主信息右侧小字操作，楼层编辑也是小字；多行签名不裁、不半透明", async () => {
	const edit = '<div class="menu-item"><svg class="iconpark-icon"><use href="#edit"></use></svg><span>编辑</span></div>';
	let menus = 0;
	const html = postPage()
		.replace(/<div class="comment-menu">/g, (m) => (++menus <= 2 ? m + edit : m))
		.replace("</article>", '</article><div class="signature"><p><a href="https://example.com/aff">瓦工AFF</a></p>\n<p>#不卖东西！</p>\n</div>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html });
	try {
		await page.waitForSelector(".nsmax-op-actions .nsmax-op-edit");
		await wait(page, 600);
		const state = await page.evaluate(() => {
			const op = document.querySelector(".nsk-post > .content-item");
			const nativeEdit = op.querySelector(":scope > .comment-menu > .menu-item[data-nsmax-action=edit]");
			const floorEdit = document.querySelector("ul.comments .menu-item[data-nsmax-action=edit]");
			const sig = op.querySelector(".signature");
			const lines = [...sig.querySelectorAll("p")];
			const box = sig.getBoundingClientRect();
			const before = floorEdit ? getComputedStyle(floorEdit, "::before") : null;
			return {
				links: [...op.querySelectorAll(".nsmax-op-action")].map((a) => a.textContent.trim()),
				nativeHidden: !!nativeEdit && getComputedStyle(nativeEdit).display === "none",
				floorEdit: (document.querySelector("ul.comments .nsmax-floor-edit")?.textContent || (before ? before.content.replace(/"/g, "") : "missing")).trim(),
				opacity: lines.map((p) => getComputedStyle(p).opacity),
				margins: lines.map((p) => getComputedStyle(p).marginTop),
				lastInside: lines.at(-1).getBoundingClientRect().bottom <= box.bottom + 0.5,
				sameColor: getComputedStyle(sig.querySelector("a")).color === getComputedStyle(lines[1]).color
			};
		});
		assert.deepEqual(state.links, ["引用", "回复", "编辑", "举报"]);
		assert.equal(state.nativeHidden, true);
		assert.equal(state.floorEdit, "编辑", "楼层编辑是「编辑」小字");
		assert.deepEqual(state.opacity, ["1", "1"]);
		assert.deepEqual(state.margins, ["0px", "0px"]);
		assert.equal(state.lastInside, true, "签名第二行不能被裁掉");
		assert.equal(state.sameColor, true, "签名里的链接和文字同色");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.1 同一帖子的其它评论页不新开标签页；回复区「直达底部」打开最后一页、光标放进回复框", async () => {
	const html = postPage().replace("</article>", '<p><a class="t-same" href="/post-1000-2">第二页</a> <a class="t-other" href="/post-2000-1">别的帖子</a></p></article>');
	// NodeSeek 自己的「新标签页打开主题帖」打开（脚本跟随它）
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, init: sitePrefInit(true), pages: { "/post-1000-3": html } });
	try {
		await wait(page, 900);
		const targets = await page.evaluate(() => ({ same: document.querySelector(".t-same").getAttribute("target"), other: document.querySelector(".t-other").getAttribute("target") }));
		assert.notEqual(targets.same, "_blank", "同一帖子的评论页不能在新标签页打开");
		assert.equal(targets.other, "_blank", "别的帖子仍按设置在新标签页打开");
		// 帖子有 3 页、现在在第 1 页：直接打开第 3 页（评论自动翻页时在前面的页上滚到底，下一页接上来又把回复框往下顶）
		await Promise.all([page.waitForURL(/\/post-1000-3/), page.locator(".comment-container .nsmax-jump-reply").click()]);
		await page.waitForFunction(() => !!document.activeElement?.closest(".md-editor"), null, { timeout: 5e3 });
		assert.equal(await page.evaluate(() => location.hash), "", "到了以后地址里的 #nsmax-reply 去掉");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.1 个人空间「收藏」：列表占满一行接在标签下面，删除图标在右", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/1#/collections", { html: spaceCollectionsPage() });
	try {
		await wait(page, 900);
		const layout = await page.evaluate(() => {
			const sel = document.querySelector(".selector").getBoundingClientRect();
			const list = document.querySelector(".selector .discussion-wrapper").getBoundingClientRect();
			const tab = document.querySelector(".selector > a.select-item.active").getBoundingClientRect();
			const item = document.querySelector(".discussion-wrapper > a.discussion-item").getBoundingClientRect();
			const del = document.querySelector(".discussion-wrapper > a.discussion-item > .i-icon-delete").getBoundingClientRect();
			return { listWidth: Math.round(list.width), selWidth: Math.round(sel.width), tabAbove: tab.bottom <= list.top + 1, delRight: Math.round(item.right - del.right) };
		});
		assert.ok(layout.listWidth >= layout.selWidth, `列表应占满一行（${layout.listWidth} / ${layout.selWidth}）`);
		assert.equal(layout.tabAbove, true, "标签应在列表上方");
		assert.ok(layout.delRight <= 16, `删除图标应在右边（离右边 ${layout.delRight}px）`);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.1 深浅色按钮图标跟着页面实际深浅色；Cloudflare 安全验证页不套主题", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark: true }), seed: { "nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: true, colorMode: "light" } } } });
	try {
		await wait(page);
		const icon = await page.evaluate(() => ({ dark: document.documentElement.hasAttribute("data-nsmax-dark"), sun: getComputedStyle(document.querySelector(".nsmax-icon-sun")).display, moon: getComputedStyle(document.querySelector(".nsmax-icon-moon")).display }));
		assert.equal(icon.dark, false);
		assert.notEqual(icon.sun, "none", "浅色时显示太阳");
		assert.equal(icon.moon, "none");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	const challenge = '<!DOCTYPE html><html lang="zh-cn"><head><title>请稍候…</title><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1?ray=1"></script></head><body><div class="main-wrapper" role="main"><div class="main-content"><h1 class="zone-name-title h1">www.nodeseek.com</h1><p class="h2">正在进行安全验证</p></div></div></body></html>';
	const cf = await open(browser, "https://www.nodeseek.com/", { html: challenge });
	try {
		await wait(cf.page, 800);
		assert.equal(await cf.page.evaluate(() => document.documentElement.hasAttribute("data-nsmax-theme")), false, "验证页不能套主题");
	} finally { await cf.context.close(); }
	// 普通页面里也有 Cloudflare 的检测脚本（scripts/jsd、scripts/precursor），不能被当成验证页
	const normal = await open(browser, "https://www.nodeseek.com/", { html: listPage().replace("</head>", '<script src="/cdn-cgi/challenge-platform/scripts/precursor/main.js"></script><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></head>') });
	try {
		await wait(normal.page, 800);
		assert.equal(await normal.page.evaluate(() => document.documentElement.hasAttribute("data-nsmax-theme")), true, "普通页面带 Cloudflare 检测脚本时主题照常生效");
		assert.equal(await normal.page.locator(".nsmax-settings-button").count(), 1, "功能照常挂载");
	} finally { await normal.context.close(); }
});

// ---------- v1.8.0 设置项排查：选了会出问题的选项去掉，换成重新设计的 ----------
const OPT_KEY = "nspp:settings:www.nodeseek.com";
const ownerPost = () => postPage().replace(/\/space\/12/g, "/space/10").replace(/passerby/g, "seller");
const longReply = Array.from({ length: 40 }, (_, i) => `第 ${i + 1} 段：晚高峰实测丢包率很低，三网回程都走 CN2 GIA。`).join("</p><p>");

test("v1.8.0 设置项重做：图片上传只剩开关、网络请求三档节奏、关键词屏蔽自动判断等级、列表增强不再预读", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await wait(page);
		await page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		const host = page.locator("#nspp-settings");
		await host.locator("dialog").waitFor({ state: "visible" });
		const controls = (id) => host.locator(`.module[data-feature="${id}"]`).evaluate((m) => Array.from(m.querySelectorAll("input, select, textarea"), (c) => `${c.tagName.toLowerCase()}:${c.type || ""}:${c.dataset.key}`));
		assert.deepEqual(await controls("image-upload"), ["input:checkbox:enabled"], "图床协议、地址、Token 都去掉了");
		assert.deepEqual(await controls("list-interactions"), ["input:checkbox:enabled"], "自动预读互动计数去掉了");
		assert.deepEqual(await controls("reading-focus"), ["input:checkbox:enabled"], "只看楼主、折叠高度不再是全局设置");
		const filter = await controls("content-filter");
		assert.ok(filter.includes("input:checkbox:lockedAbove"), filter.join());
		assert.ok(!filter.some((c) => c.startsWith("input:number")), "不再手填当前等级");
		assert.ok(!filter.includes("input:checkbox:highlight"), "高亮勾选合进「命中后」");
		await host.getByRole("tab", { name: "网络", exact: true }).click();
		assert.deepEqual(await host.locator('.module[data-feature="request-settings"] [role=radio]').allInnerTexts(), ["标准", "稳妥", "最慢"]);
		assert.equal(await host.locator('.module[data-feature="request-settings"] input[type=number]').count(), 0);
		await host.getByRole("radio", { name: "稳妥", exact: true }).click();
		const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem("__gm__:" + key) || "{}"), OPT_KEY);
		assert.equal(stored["request-settings"].pace, "gentle");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.0 只看楼主：回复区标题栏上的按钮，只筛当前帖子，同一标签页刷新后保持", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: ownerPost(), viewport: { width: 1280, height: 900 } });
	try {
		await wait(page, 900);
		const visible = () => page.locator("ul.comments > li.content-item").evaluateAll((items) => items.filter((li) => getComputedStyle(li).display !== "none").map((li) => li.id));
		const only = page.locator(".comment-container .nsmax-owner-only");
		assert.equal(await only.innerText(), "只看楼主");
		assert.deepEqual(await visible(), ["1", "2", "3"]);
		await only.click();
		assert.equal(await only.getAttribute("aria-pressed"), "true");
		assert.deepEqual(await visible(), ["2"], "只剩楼主（seller）的楼层");
		await page.reload();
		await wait(page, 900);
		assert.equal(await page.locator(".comment-container .nsmax-owner-only").getAttribute("aria-pressed"), "true", "同一标签页刷新后保持");
		assert.deepEqual(await visible(), ["2"]);
		await page.locator(".comment-container .nsmax-owner-only").click();
		assert.deepEqual(await visible(), ["1", "2", "3"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 这一页没有楼主的回复：显示一行提示，不是空白
	const none = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage() });
	try {
		await wait(none.page, 900);
		await none.page.locator(".comment-container .nsmax-owner-only").click();
		assert.equal(await none.page.locator("ul.comments").evaluate((ul) => getComputedStyle(ul, "::after").content), '"这一页没有楼主的回复"');
		assert.deepEqual(none.errors, []);
	} finally { await none.context.close(); }
});

test("v1.8.0 折叠超长回复（胶囊按钮、底部渐隐）与关键词屏蔽的「已屏蔽」小条", async () => {
	const html = postPage().replace("线路怎么样？晚高峰丢包吗？", longReply);
	const seed = { [OPT_KEY]: { "reading-focus": { enabled: true }, "content-filter": { enabled: true, keywords: "收了", comments: true, mode: "collapse" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, seed, viewport: { width: 1280, height: 900 } });
	try {
		await wait(page, 900);
		const folded = page.locator('li[id="3"] > article.post-content');
		assert.equal(Math.round((await folded.boundingBox()).height), 420);
		assert.equal(await page.locator(".nsk-post article[data-nsmax-folded]").count(), 0, "主帖不折叠");
		const toggle = page.locator('li[id="3"] > .nsmax-fold-toggle');
		const style = await toggle.evaluate((b) => ({ text: b.textContent, height: b.getBoundingClientRect().height, radius: parseFloat(getComputedStyle(b).borderTopLeftRadius), mask: getComputedStyle(b.previousElementSibling).maskImage }));
		assert.equal(style.text, "展开全文");
		assert.equal(style.height, 28);
		assert.ok(style.radius >= 14, `胶囊圆角 ${style.radius}`);
		assert.match(style.mask, /linear-gradient/);
		await toggle.click();
		assert.ok((await folded.boundingBox()).height > 720);
		assert.equal(await toggle.innerText(), "收起");
		// 关键词命中的回复：原位置一行小条，写明原因；右侧「显示」胶囊点开原内容
		const bar = page.locator("ul.comments > li.nsmax-filtered");
		assert.equal(await bar.locator(".nsmax-filtered-label").innerText(), "已屏蔽一条回复：命中「收了」");
		assert.equal(await page.locator('li[id="1"]').isVisible(), false);
		await bar.getByRole("button", { name: "显示", exact: true }).click();
		assert.equal(await page.locator('li[id="1"]').isVisible(), true);
		assert.equal(await bar.getByRole("button").innerText(), "收起");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.0 关键词「只高亮」不隐藏热榜；停在列表标题上不再整页读取看不见的计数、不再后台预渲染", async () => {
	const pages = {};
	for (let i = 0; i < 6; i++) pages[`/post-${1000 + i}-1`] = postPage();
	const seed = { [OPT_KEY]: { "content-filter": { enabled: true, keywords: "VPS\n甲骨文", mode: "highlight" } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages, seed, viewport: { width: 1280, height: 900 } });
	try {
		const requests = [];
		page.on("request", (r) => { if (/\/post-\d+/.test(r.url())) requests.push(new URL(r.url()).pathname); });
		await wait(page, 1200);
		assert.equal(await page.locator(".post-title mark").count(), 1);
		const mark = await page.locator(".post-title mark").evaluate((m) => getComputedStyle(m).backgroundColor);
		assert.notEqual(mark, "rgb(255, 255, 0)", "不是浏览器默认的亮黄");
		assert.equal(await page.locator(".nsmax-hot-panel li a, .nsmax-hot-list li a").count() >= 10, true, "只高亮时热榜照常显示");
		assert.equal(await page.locator(".nspp-list-actions").count(), 0, "没有看不见的互动计数条");
		await page.locator("ul.post-list .post-title a").first().hover();
		await wait(page, 900);
		const same = requests.filter((path) => path === "/post-1000-1").length;
		assert.ok(same <= 2, `停一下最多两次请求（卡片预览 + 预取），实际 ${same}：${requests.join()}`);
		assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll("script[type=speculationrules]")).some((s) => s.textContent.includes("prerender"))), false, "不再预渲染");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.0 帖子列表自动翻页：自动接 3 页后改为点「继续加载下一页」，页脚能翻到", async () => {
	const pageN = (n) => listPage().replace(/href="\/page-2" rel="next"/g, `href="/page-${n + 1}" rel="next"`).replace(/\/post-(\d+)-1/g, (m, id) => `/post-${Number(id) + n * 100}-1`);
	const pages = {};
	for (let n = 2; n <= 6; n++) pages[`/page-${n}`] = pageN(n);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages, seed: { [OPT_KEY]: { "infinite-scroll": { enabled: true, posts: true, comments: true } } } });
	try {
		await wait(page, 900);
		for (let i = 0; i < 10; i++) {
			await page.mouse.wheel(0, 4000);
			await wait(page, 450);
		}
		const rows = () => page.locator("ul.post-list > li").count();
		assert.equal(await rows(), 24, "第 1 页 + 自动接的 3 页");
		const more = page.locator("ul.post-list ~ button.nspp-action");
		assert.equal(await more.innerText(), "继续加载下一页");
		await more.click();
		await page.waitForFunction(() => document.querySelectorAll("ul.post-list > li").length === 30);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.0 私信里粘贴图片：没改过设置也走 NodeImage（以前默认落到已下线的图床，直接失败）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: nativeTalkPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nspp-messages textarea:visible");
		await page.locator(".nspp-messages textarea").evaluate((input) => {
			const data = new DataTransfer();
			data.items.add(new File([new Uint8Array([137, 80, 78, 71])], "local.png", { type: "image/png" }));
			input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
		});
		await page.waitForFunction(() => window.__uploads?.length === 1);
		assert.match(await page.evaluate(() => window.__uploads[0].url), /^https:\/\/api\.nodeimage\.com\/api\/upload/);
		await page.waitForFunction(() => document.querySelector(".nspp-messages textarea").value.includes("abc123.png"));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.0 私信：手机宽度聊天区占满整行；输入区「Enter 发送」提示不盖住「预览」按钮", async () => {
	for (const width of [390, 1440]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: nativeTalkPage(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".nspp-messages textarea:visible");
			await wait(page, 300);
			// 字体偏宽时（Linux 的中文字体）也不能盖住：把字距拉大模拟
			await page.addStyleTag({ content: ".nspp-messages-compose-actions, .nspp-messages-compose-actions * { letter-spacing: 1.5px !important; }" });
			await wait(page, 100);
			const state = await page.evaluate(() => {
				const preview = Array.from(document.querySelectorAll(".nspp-message-editor-toolbar button")).find((b) => b.textContent.trim() === "预览");
				preview.scrollIntoView({ block: "center", behavior: "instant" });
				const r = preview.getBoundingClientRect();
				const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
				const workspace = document.querySelector(".nspp-messages-workspace").getBoundingClientRect();
				const chat = document.querySelector(".nspp-messages-chat").getBoundingClientRect();
				return { previewHit: preview.contains(hit), chatLeft: Math.round(chat.left - workspace.left), chatRight: Math.round(workspace.right - chat.right) };
			});
			assert.equal(state.previewHit, true, `${width}：「预览」按钮中心不能被提示文字盖住`);
			if (width <= 700) assert.deepEqual([state.chatLeft, state.chatRight], [0, 0], "手机上聊天区左右贴满");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

// ---------- 2026-10-14 第二批：登录 / 注册页、楼层操作行、签到 / 管理记录右栏、右栏固定、新标签页跟随站点设置、消息中心对齐 ----------
test("登录 / 注册页：表单显示出来（以前 #nsk-body-left-block 被当成空占位藏掉），按 sb.sb 登录页排成左右两半", async () => {
	for (const [url, html, inputs] of [["/signIn.html", signInPage, 2], ["/emailSignIn.html", emailSignInPage, 2], ["/smsSignIn.html", smsSignInPage, 2], ["/register.html", registerPage, 6]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com" + url, { html: html(), viewport: { width: 1440, height: 900 } });
		try {
			await wait(page, 900);
			const state = await page.evaluate(() => {
				const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }; };
				const visibleInputs = Array.from(document.querySelectorAll("[data-nsmax-auth-app] input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=button])")).filter((e) => e.getBoundingClientRect().width > 0);
				return { page: document.documentElement.dataset.nsmaxPage, card: box("[data-nsmax-auth-card]"), hero: box(".nsmax-auth-hero"), app: box("[data-nsmax-auth-app]"), side: box("#nsk-right-panel-container"), inputs: visibleInputs.length, inputHeight: visibleInputs[0] ? Math.round(visibleInputs[0].getBoundingClientRect().height) : 0, tabs: Array.from(document.querySelectorAll(".nsmax-auth-tabs > a")).map((a) => `${a.textContent}${a.getAttribute("aria-current") ? "*" : ""}`) };
			});
			assert.equal(state.page, "auth", url);
			assert.equal(state.card.w, 980, `${url} 卡片 980px`);
			assert.equal(state.hero.w, state.app.w, `${url} 左右两半一样宽`);
			assert.ok(state.inputs >= inputs, `${url} 输入框显示出来：${state.inputs}`);
			assert.equal(state.inputHeight, 44, `${url} 输入框 44px`);
			assert.ok(!state.side || state.side.w === 0, `${url} 不显示右栏`);
			assert.deepEqual(state.tabs, url === "/register.html" ? ["登录", "注册*"] : ["登录*", "注册"]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 普通列表页的 #nsk-body-left-block 是空的，照样不显示
	const list = await open(browser, "https://www.nodeseek.com/credit", { html: creditPage() });
	try {
		await wait(list.page, 600);
		assert.equal(await list.page.locator("#nsk-body-left-block").evaluate((e) => getComputedStyle(e).display), "none");
	} finally { await list.context.close(); }
});

test("楼层操作行：照 sb.sb 排成一排 12px 小字（回复 引用 点赞 鸡腿 反对 #楼号），字间 8px；楼中楼的楼号和外层右边对齐；手机上换到名字下面一行", async () => {
	const html = postPage({ dark: true }).replace("价格不错，帮顶", '<a href="/space/11">@buyer</a> <a href="/post-1000-1#1">#1</a> 价格不错，帮顶').replace(/(<li class="content-item" id="2">[\s\S]*?)<span>1<\/span>/, "$1<span>19</span>");
	const measure = () => Array.from(document.querySelectorAll("ul.comments > li.content-item")).map((li) => {
		const actions = li.querySelector(":scope > .nsmax-floor-actions");
		const parts = Array.from(actions.querySelectorAll(".menu-item, .floor-link")).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
		const box = actions.getBoundingClientRect();
		const name = li.querySelector(".author-name").getBoundingClientRect();
		const body = li.querySelector(":scope > article").getBoundingClientRect();
		return {
			labels: parts.map(({ e }) => (e.matches(".floor-link") ? e.textContent.trim().replace(/\d+/, "N") : getComputedStyle(e, "::before").content.replace(/"/g, ""))),
			gaps: parts.slice(1).map(({ r }, i) => Math.round(r.left - parts[i].r.right)),
			sizes: [...new Set(parts.map(({ e }) => getComputedStyle(e).fontSize))],
			right: Math.round(parts.at(-1).r.right),
			midDiff: Math.abs((box.top + box.bottom) / 2 - (name.top + name.bottom) / 2),
			left: Math.round(box.left), nameLeft: Math.round(name.left),
			top: box.top, bottom: box.bottom, nameBottom: name.bottom, bodyTop: body.top
		};
	});
	// 楼中楼框（默认的经典排法才有）：框里每条的操作也是 12px 小字，楼号在前（sb.sb .floor-box-meta）
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li[id='2'] > .nsmax-floor-actions");
			await wait(page, 400);
			const nested = await page.evaluate(() => {
				const actions = document.querySelector("li[id='2'] > .nsmax-floor-actions");
				const parts = Array.from(actions.querySelectorAll(".menu-item, .floor-link")).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
				return { labels: parts.map(({ e }) => (e.matches(".floor-link") ? e.textContent.trim().replace(/\d+/, "N") : getComputedStyle(e, "::before").content.replace(/"/g, ""))), sizes: [...new Set(parts.map(({ e }) => getComputedStyle(e).fontSize))] };
			});
			assert.deepEqual(nested.labels, ["#N", "回复", "引用", "点赞", "鸡腿", "反对"], "楼中楼框里楼号在前（sb.sb .floor-box-meta）：" + JSON.stringify(nested));
			assert.deepEqual(nested.sizes, ["12px"]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 简洁模式（2026-10-24 起照 sb.sb 没有楼中楼，回复一层一层排）：每层右上角一排小字
	for (const width of [1440, 390]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width, height: 900 }, init: "if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}" });
		try {
			await page.waitForSelector("ul.comments > li[id='2'] > .nsmax-floor-actions");
			await wait(page, 400);
			const rows = await page.evaluate(measure);
			assert.equal(rows.length, 3, "楼中楼摊平：三层都在最外层");
			for (const row of rows) {
				assert.deepEqual(row.labels, ["回复", "引用", "点赞", "鸡腿", "反对", "#N"], JSON.stringify(row));
				assert.ok(row.gaps.every((gap) => Math.abs(gap - 8) <= 1), `字与字之间 8px：${JSON.stringify(row)}`);
				assert.deepEqual(row.sizes, ["12px"]);
				if (width > 700) assert.ok(row.midDiff <= 1, `和名字那行中线对齐：${JSON.stringify(row)}`);
				else assert.ok(row.top >= row.nameBottom && row.bottom <= row.bodyTop && Math.abs(row.left - row.nameLeft) <= 1, `手机上在名字下面单独一行、和名字左对齐：${JSON.stringify(row)}`);
			}
			if (width > 700) assert.ok(rows.every((row) => row.right === rows[0].right), `所有楼层（含楼中楼）楼号右边对齐：${JSON.stringify(rows)}`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("签到排行、管理记录：补上右栏（资料卡 + 今日热门），主栏和右栏两端对齐顶栏，管理记录页码居中", async () => {
	for (const [url, html] of [["/ruling", rulingPage], ["/board", boardRealPage]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com" + url, { html: html(), viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector("#nsk-right-panel-container .nsmax-sb-account");
			await page.waitForSelector("#nsk-right-panel-container .nsmax-hot-text");
			const m = await page.evaluate(() => {
				const r = (s) => document.querySelector(s)?.getBoundingClientRect();
				const head = Math.max(...Array.from(document.querySelectorAll("#nsk-head button, #nsk-head a")).map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => b.right));
				const pager = r(".ruling-log .rulling-log-head .nsk-pager"), table = r(".ruling-log table");
				return { logo: r("#nsk-head .site-title").left, main: r(".board, .ruling-log").left, side: r("#nsk-right-panel-container").right, head, account: r(".nsmax-sb-account").top, hot: r(".nsmax-hot-panel").top, pager: pager && table ? Math.round(pager.left + pager.width / 2 - (table.left + table.width / 2)) : 0 };
			});
			assert.ok(Math.abs(m.main - m.logo) <= 1, `${url} 主栏左边对齐站标：${m.main} / ${m.logo}`);
			assert.ok(Math.abs(m.side - m.head) <= 1, `${url} 右栏右边对齐顶栏按钮：${m.side} / ${m.head}`);
			assert.ok(m.account < m.hot, "资料卡在今日热门上面");
			assert.ok(Math.abs(m.pager) <= 1, `页码居中：偏 ${m.pager}px`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("右栏固定在顶栏下面、可单独滚动；页面别处的操作顺带滚动右栏时滚回原位", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ count: 40 }), viewport: { width: 1440, height: 500 } });
	try {
		await page.waitForSelector(".nsmax-hot-text");
		// 等首屏整理完（整理期间主栏还收着，页面没那么长）、右栏内容比可视高度高（能单独滚动）
		await page.waitForFunction(() => {
			const side = document.getElementById("nsk-right-panel-container");
			return !document.documentElement.matches("[data-nsmax-boot-left], [data-nsmax-boot-right]") && document.scrollingElement.scrollHeight > 2400 && side.scrollHeight > side.clientHeight + 40;
		}, null, { timeout: 8000 });
		const side = page.locator("#nsk-right-panel-container");
		// 页面开着平滑滚动：测试里直接跳过去，不等动画（CI 上动画没走完就量，位置不准）
		await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
		await wait(page, 100);
		assert.ok(Math.abs(await page.evaluate(() => scrollY) - 1200) <= 1, "页面滚到 1200");
		assert.ok(Math.abs((await side.boundingBox()).y - 77) <= 1, "滚动页面后右栏还停在顶栏下面");
		// 程序顺带滚动右栏（没有滚轮 / 触摸 / 键盘）：滚回原位
		const restored = await side.evaluate(async (e) => { e.scrollTop = 120; await new Promise((r) => setTimeout(r, 80)); return e.scrollTop; });
		assert.equal(restored, 0, "不是用户自己滚的，右栏滚回原位");
		// 鼠标放在右栏上滚轮：右栏自己滚，页面不动
		const before = await page.evaluate(() => scrollY);
		const box = await side.boundingBox();
		await page.mouse.move(box.x + 100, box.y + 200);
		await page.mouse.wheel(0, 200);
		await wait(page, 300);
		assert.ok(await side.evaluate((e) => e.scrollTop) > 0, "右栏自己滚动了");
		assert.equal(await page.evaluate(() => scrollY), before, "页面没有跟着滚");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("帖子是否在新标签页打开：跟随 NodeSeek 自己的「新标签页打开主题帖」，脚本不再自己强制", async () => {
	for (const [pref, expected] of [[false, null], [true, "_blank"], [null, null]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init: pref === null ? "" : sitePrefInit(pref) });
		try {
			await wait(page, 900);
			const target = await page.locator("ul.post-list .post-title a").first().evaluate((a) => a.getAttribute("target"));
			assert.equal(target === "_blank" ? "_blank" : null, expected, `站点设置 ${pref}`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 设置面板里不再有脚本自己的「链接在新标签页打开」
	const { context, page } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(page);
		await page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		const keys = await page.locator('#nspp-settings .module[data-feature="reading-content"]').evaluate((m) => Array.from(m.querySelectorAll("input"), (i) => i.dataset.key));
		assert.ok(!keys.includes("newTab"), keys.join());
	} finally { await context.close(); }
});

test("消息中心：通知列表名字和动作挨在一起、时间靠右成一列；系统消息时间单独一列右对齐、和正文同一条中线", async () => {
	const notices = await open(browser, "https://www.nodeseek.com/notification#/atMe", { html: nativeTalkPage(), viewport: { width: 1440, height: 900 } });
	try {
		await notices.page.waitForSelector(".nspp-notice-workspace .nspp-notice-action");
		const rows = await notices.page.evaluate(() => Array.from(document.querySelectorAll(".nspp-notice-workspace .nspp-messages-peer")).map((row) => ({ name: row.querySelector(".nspp-messages-peer-title > strong").getBoundingClientRect().right, action: row.querySelector(".nspp-notice-action").getBoundingClientRect().left, time: Math.round(row.querySelector(".nspp-messages-peer-title > time").getBoundingClientRect().right) })));
		assert.ok(rows.length >= 2);
		for (const row of rows) assert.ok(row.action - row.name <= 10, `动作紧跟名字：间距 ${row.action - row.name}`);
		assert.equal(new Set(rows.map((row) => row.time)).size, 1, "时间右边对齐");
		assert.deepEqual(notices.errors, []);
	} finally { await notices.context.close(); }
	const now = Date.now();
	const items = { success: true, talkTo: { member_id: 9, member_name: "系统通知" }, msgArray: [
		{ id: 81, sender_id: 9, receiver_id: 1, sender_name: "系统通知", content: "你关注的用户vico发布了一篇[新的帖子](/post-123-1)", is_markdown: true, viewed: 1, created_at: new Date(now - 864e5).toISOString() },
		{ id: 82, sender_id: 9, receiver_id: 1, sender_name: "系统通知", content: "您的 [评论](/post-1-1#3) 被用户 [早饭](/space/5) 星辰点赞", is_markdown: true, viewed: 1, created_at: new Date(now - 432e5).toISOString() }
	] };
	const system = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=9", { html: nativeTalkPage(), api: { "/api/notification/message/with/9": [{ status: 200, body: items }] }, viewport: { width: 1440, height: 900 } });
	try {
		await system.page.waitForSelector(".is-system-thread .is-system time");
		const rows = await system.page.evaluate(() => Array.from(document.querySelectorAll(".is-system")).map((row) => { const text = row.querySelector(".nspp-messages-bubble").getBoundingClientRect(), time = row.querySelector("time").getBoundingClientRect(); return { right: Math.round(time.right), mid: Math.round(time.top + time.height / 2) - Math.round(text.top + text.height / 2) }; }));
		assert.equal(new Set(rows.map((row) => row.right)).size, 1, "时间右边对齐");
		for (const row of rows) assert.ok(Math.abs(row.mid) <= 2, `时间和正文同一条中线：差 ${row.mid}`);
		assert.deepEqual(system.errors, []);
	} finally { await system.context.close(); }
});

test("今日热门在页面解析阶段就按缓存画出来（不再等整页解析完才「卡着进来」），模块挂载时原地接管、不重复", async () => {
	const posts = Array.from({ length: 12 }, (_, i) => ({ id: 3000 + i, title: `缓存热帖 ${i + 1}`, author: `a${i}`, views: 900 - i * 10, comments: 5, score: 1000 - i }));
	const seed = { "nspp:state:www.nodeseek.com:hot-rankings": { "snapshot:daily": { posts, fetched: Date.now() - 6e4, updated: Date.now() - 6e4 } } };
	const init = `(() => { new MutationObserver((list, observer) => { if (document.querySelector(".nsmax-hot-panel")) { window.__hotAt = performance.now(); window.__hotEarly = document.querySelector(".nsmax-hot-panel").hasAttribute("data-nsmax-hot-early"); observer.disconnect(); } }).observe(document, { childList: true, subtree: true }); document.addEventListener("DOMContentLoaded", () => { window.__dcl = performance.now(); }, { once: true }); })();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), seed, init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-hot-panel:not([data-nsmax-hot-early])");
		await wait(page, 300);
		const state = await page.evaluate(() => ({ hotAt: window.__hotAt, dcl: window.__dcl, early: window.__hotEarly, panels: document.querySelectorAll(".nsmax-hot-panel").length, first: document.querySelector(".nsmax-hot-text")?.textContent }));
		// 本地夹具一下子就解析完，和 DOMContentLoaded 比先后没有意义；先出现的是解析阶段画的面板，就说明没等模块挂载
		assert.equal(state.early, true, "先出现的是解析阶段画的面板");
		assert.equal(state.panels, 1, "模块接管后只有一个热榜面板");
		assert.equal(state.first, "缓存热帖 1");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("个人空间：写了介绍时显示「介绍」标签并默认打开，介绍照正文排（以前整个藏掉）；没写时不显示这个标签", async () => {
	const intro = '<p><img src="https://example.com/banner.webp" alt="banner" style="width:1600px;height:400px"></p><h2>JP Riven Gen2</h2><p><strong>1Gbps@100GB 月流量，￥55/月</strong></p><table><thead><tr><th>直连</th><th>IX</th></tr></thead><tbody><tr><td>1Gbps</td><td>200Mbps</td></tr></tbody></table>';
	const html = spaceGeneralPage(intro);
	const api = { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail: { member_id: 10, member_name: "Steve", rank: 6, coin: 7900, nPost: 459, nComment: 7947, readme: "![banner](https://example.com/banner.webp)\n## JP Riven Gen2", created_at: "2023-10-17T00:00:00.000Z" } } }] };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10#/general", { html, api, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".selector a.select-item[data-nsmax-tab=general]:not([hidden])");
		await wait(page, 400);
		const state = await page.evaluate(() => {
			const readme = document.querySelector(".selector > .readme");
			const img = readme.querySelector("img").getBoundingClientRect();
			return {
				hash: location.hash,
				tabs: Array.from(document.querySelectorAll(".selector a.select-item")).filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.trim()),
				active: document.querySelector(".selector a.select-item.active")?.textContent.trim(),
				visible: readme.getBoundingClientRect().height > 100,
				imgFits: img.right <= readme.getBoundingClientRect().right,
				overflow: document.scrollingElement.scrollWidth > innerWidth + 1
			};
		});
		assert.equal(state.hash, "#/general");
		assert.deepEqual(state.tabs, ["介绍", "主题", "回帖"], "别人的主页没有「收藏」");
		assert.equal(state.active, "介绍");
		assert.equal(state.visible, true, "介绍内容要显示");
		assert.equal(state.imgFits, true);
		assert.equal(state.overflow, false);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 没写介绍（接口 readme 为空、站点显示「没有找到readme」）：不显示「介绍」，落到「主题」
	const empty = await open(browser, "https://www.nodeseek.com/space/10#/general", { html: spaceGeneralPage(), viewport: { width: 1440, height: 900 } });
	try {
		await wait(empty.page, 1200);
		const state = await empty.page.evaluate(() => ({ hash: location.hash, tabs: Array.from(document.querySelectorAll(".selector a.select-item")).filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.trim()), active: document.querySelector(".selector a.select-item.active")?.textContent.trim() }));
		assert.equal(state.hash, "#/discussions");
		assert.deepEqual(state.tabs, ["主题", "回帖"]);
		assert.equal(state.active, "主题");
		assert.deepEqual(empty.errors, []);
	} finally { await empty.context.close(); }
});

test("提示：NodeSeek 一句话提示框改成 sb.sb toast；要确认的提示框排成 sb.sb 弹窗、按钮是「确定 / 取消」", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-floor-actions");
		await wait(page, 300);
		// 照 msc-script 的 buildUI 造一个提示框：先整个建好再加到 body，点确定后移除并回调
		const alerted = await page.evaluate(() => new Promise((resolve) => {
			window.__mscBuild = (title, type, onOk) => {
				const dialog = document.createElement("div"); dialog.className = "msc-confirm";
				dialog.innerHTML = `<div class="msc-overlay"><button class="msc-close">×</button></div><div class="msc-content"><h3 class="msc-title"></h3><div class="msc-body"><p class="msc-sub"></p></div><div class="msc-action"><button class="msc-ok">OK</button>${type === "alert" ? "" : '<button class="msc-cancel">Cancel</button>'}</div></div>`;
				dialog.querySelector(".msc-title").textContent = title;
				dialog.querySelector(".msc-ok").addEventListener("click", () => { dialog.remove(); onOk?.(); });
				document.body.appendChild(dialog);
				dialog.style.display = "block";
			};
			window.__mscBuild("您已进行过点赞操作", "alert", () => resolve("ok-called"));
			setTimeout(() => resolve("not-dismissed"), 1000);
		}));
		assert.equal(alerted, "ok-called", "一句话提示自动关掉（照常回调）");
		assert.equal(await page.locator(".msc-confirm").count(), 0);
		await page.waitForSelector(".nsmax-toast[data-nsmax-shown]");
		await wait(page, 350);
		assert.equal(await page.locator(".nsmax-toast").innerText(), "您已进行过点赞操作");
		const toast = await page.locator(".nsmax-toast").evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, bottom: Math.round(innerHeight - e.getBoundingClientRect().bottom) }));
		assert.deepEqual(toast, { bg: "rgb(28, 28, 30)", bottom: 24 });
		// 要确认的：留着，排成卡片
		await page.evaluate(() => window.__mscBuild("是否投喂鸡腿，这将消耗你一个鸡腿", "confirm"));
		await wait(page, 300);
		const confirm = await page.evaluate(() => {
			const content = document.querySelector(".msc-confirm .msc-content");
			const r = content.getBoundingClientRect();
			return { width: Math.round(r.width), centered: Math.abs((r.left + r.right) / 2 - innerWidth / 2) <= 1, bg: getComputedStyle(content).backgroundColor, head: getComputedStyle(content, "::before").content, title: getComputedStyle(content.querySelector(".msc-title")).fontSize, buttons: Array.from(content.querySelectorAll(".msc-action > button")).map((b) => [b.textContent, Math.round(b.getBoundingClientRect().left)]) };
		});
		assert.equal(confirm.width, 440);
		assert.equal(confirm.centered, true);
		assert.equal(confirm.bg, "rgb(255, 255, 255)");
		assert.equal(confirm.head, '"提示"');
		assert.equal(confirm.title, "14px");
		assert.deepEqual(confirm.buttons.map(([text]) => text), ["确定", "取消"]);
		assert.ok(confirm.buttons[0][1] > confirm.buttons[1][1], "确定在右边");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("点赞成功：这一项变红（原站 .clicked），弹出「已点赞」", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-floor-actions");
		await wait(page, 300);
		const like = page.locator('ul.comments li.content-item .nsmax-floor-actions .menu-item[title="点赞"]').first();
		const before = await like.evaluate((e) => getComputedStyle(e).color);
		await like.click();
		// 站点的 Vue 组件在接口成功后给这一项加上 clicked
		await like.evaluate((e) => setTimeout(() => e.classList.add("clicked"), 120));
		// 2026-10-18 起各模块的提示都走同一个提示条（夹具里自动签到也会弹「签到成功」）：等它换成「已点赞」
		await page.waitForFunction(() => document.querySelector(".nsmax-toast")?.textContent === "已点赞" && document.querySelector(".nsmax-toast").hasAttribute("data-nsmax-shown"));
		await page.mouse.move(5, 5);
		await wait(page, 300);
		const after = await like.evaluate((e) => getComputedStyle(e).color);
		assert.notEqual(after, before);
		assert.equal(after, "rgb(207, 43, 43)");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("编辑主帖：标题栏写「编辑帖子」、标题框排在标题栏下面；阅读限制是小字 + 34px 下拉框，宽屏和按钮同一行、手机单独一行不出界", async () => {
	for (const [width, mobile] of [[1440, false], [375, true]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ editorMode: "edit-discussion", mobile }), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector('.md-editor[data-nsmax-editor-mode="edit-discussion"] > .nsmax-editor-head + .title-input');
			await wait(page, 300);
			const info = await page.evaluate(() => {
				const editor = document.querySelector(".md-editor");
				const field = editor.querySelector(".topic-select > [data-nsmax-topic-field]");
				const select = field.querySelector("select"), label = field.querySelector("label"), button = editor.querySelector(".topic-select > button.submit");
				const rect = (element) => element.getBoundingClientRect();
				const middle = (element) => (rect(element).top + rect(element).bottom) / 2;
				return {
					heading: editor.querySelector(".nsmax-editor-heading").textContent,
					button: button.textContent.trim(),
					titleHeight: Math.round(rect(editor.querySelector(".title-input input")).height),
					selectHeight: Math.round(rect(select).height),
					labelSize: getComputedStyle(label).fontSize,
					iconShown: [...field.children].some((element) => !element.matches("label, select") && element.getClientRects().length > 0),
					sameRow: Math.abs(middle(select) - middle(button)) < 4,
					fieldAbove: rect(field).bottom <= rect(button).top,
					selectRight: Math.round(rect(select).right),
					editorRight: Math.round(rect(editor).right),
					overflow: document.documentElement.scrollWidth - innerWidth,
				};
			});
			assert.equal(info.heading, "编辑帖子");
			assert.equal(info.button, "编辑帖子");
			assert.equal(info.titleHeight, 40);
			assert.equal(info.selectHeight, 34);
			assert.equal(info.labelSize, "13px");
			assert.equal(info.iconShown, false);
			if (mobile) {
				assert.ok(info.fieldAbove, JSON.stringify(info));
				assert.ok(info.selectRight <= info.editorRight, JSON.stringify(info));
				assert.ok(info.overflow <= 0, JSON.stringify(info));
			} else assert.ok(info.sameRow, JSON.stringify(info));
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 真站回复模式：提交行里是站点留的空 div + 「发布评论」，手机上空 div 不能单独占一行把按钮往下推
	{
		const { context, page } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ editorMode: "codemirror", mobile: true }), viewport: { width: 375, height: 900 } });
		try {
			await page.waitForSelector(".md-editor > .topic-select > button.submit");
			await wait(page, 500);
			const gap = await page.evaluate(() => { const row = document.querySelector(".md-editor > .topic-select"); return Math.round(row.querySelector("button.submit").getBoundingClientRect().top - row.getBoundingClientRect().top); });
			assert.equal(gap, 0);
		} finally { await context.close(); }
	}
	// 平常回复：还是「发表回复」+「回复楼主」按钮（sb.sb），标题栏留在正文框里
	const { context, page } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".md-editor .nsmax-editor-heading");
		await wait(page, 300);
		assert.deepEqual(await page.evaluate(() => [document.querySelector(".nsmax-editor-heading").textContent, document.querySelector(".md-editor button.submit").textContent.trim(), !!document.querySelector("#editor-body > .nsmax-editor-head"), document.querySelector(".md-editor").dataset.nsmaxEditorMode]), ["发表回复", "回复楼主", true, "reply"]);
	} finally { await context.close(); }
});

test("搜索结果页没有结果：照 sb.sb 一行搜索摘要 + 空状态面板，排序、分页、站点自己的提示都收起来；「换个关键词」打开站点的搜索框", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E7%94%B2%E9%AA%A8%E6%96%87vps&category=tech", { html: searchPage({ nativeEmpty: "没有找到相关内容" }), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-search-empty .empty-state");
		await wait(page, 300);
		const info = await page.evaluate(() => {
			const left = document.querySelector("#nsk-body-left");
			const summary = left.querySelector(".nsmax-search-summary");
			const panel = left.querySelector(".nsmax-search-empty");
			const state = panel.querySelector(".empty-state");
			return {
				summary: summary.textContent,
				keywordColor: getComputedStyle(summary.querySelector("strong")).color,
				summaryColor: getComputedStyle(summary).color,
				summarySize: getComputedStyle(summary).fontSize,
				shown: [...left.children].filter((element) => element.getClientRects().length > 0).map((element) => element.className),
				padding: getComputedStyle(state).padding,
				align: getComputedStyle(state).textAlign,
				title: panel.querySelector(".nsmax-search-empty-title").textContent,
				actions: [...panel.querySelectorAll(".nsmax-search-empty-actions > *")].map((element) => [element.textContent, element.getAttribute("href")]),
				input: document.querySelector("#search-site2").value,
			};
		});
		assert.equal(info.summary, "搜索 甲骨文vps · 版块 技术 · 没有找到结果");
		assert.notEqual(info.keywordColor, info.summaryColor);
		assert.equal(info.summarySize, "13.5px");
		assert.deepEqual(info.shown, ["nsmax-search-summary", "nsmax-search-empty"]);
		assert.equal(info.padding, "44px 16px");
		assert.equal(info.align, "center");
		assert.equal(info.title, "没有找到相关帖子");
		assert.deepEqual(info.actions, [["换个关键词", null], ["搜索全部版块", "/search?q=" + encodeURIComponent("甲骨文vps")]]);
		assert.equal(info.input, "甲骨文vps");
		// 站点的搜索弹层挂在顶栏搜索框的点击上
		await page.evaluate(() => document.querySelector("form.search-box").addEventListener("click", (event) => { event.preventDefault(); window.__nsmaxSearchOpened = true; }));
		await page.click(".nsmax-search-empty-actions > button");
		assert.equal(await page.evaluate(() => window.__nsmaxSearchOpened), true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("搜索结果页有结果：列表照常显示，上面一行搜索摘要（翻到第 2 页时带上页码）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=vps&page=2", { html: searchPage({ count: 4 }), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-search-summary");
		await wait(page, 300);
		const info = await page.evaluate(() => ({
			summary: document.querySelector(".nsmax-search-summary").textContent,
			empty: !!document.querySelector(".nsmax-search-empty"),
			rows: [...document.querySelectorAll("ul.post-list > li.post-list-item")].filter((element) => element.getClientRects().length > 0).length,
			toolbar: document.querySelector(".post-list-controler").getClientRects().length > 0,
			gap: Math.round(document.querySelector(".post-list-controler").getBoundingClientRect().top - document.querySelector(".nsmax-search-summary").getBoundingClientRect().bottom),
		}));
		assert.deepEqual(info, { summary: "搜索 vps · 第 2 页", empty: false, rows: 4, toolbar: true, gap: 8 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("抽奖页：顶上一条细线栏（链接 + 右侧三个按钮），标题和简介照常显示，表单是 sb.sb 面板（四格一排、36px 输入框、主题色按钮）；手机上不出界", async () => {
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/lucky", { html: luckyPage(), viewport: { width: 1280, height: 900 } });
		try {
			await page.waitForSelector(".sample-panel > header > nav > .nsmax-header-action");
			await wait(page, 300);
			const info = await page.evaluate(() => {
				const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
				const shown = (element) => element.getClientRects().length > 0;
				const nav = document.querySelector(".sample-panel > header > nav");
				return {
					page: document.documentElement.dataset.nsmaxPage,
					navHeight: Math.round(nav.getBoundingClientRect().height),
					links: [...nav.querySelectorAll(":scope > a")].filter(shown).map((element) => element.textContent.trim()),
					actions: nav.querySelectorAll(":scope > .nsmax-header-action").length,
					actionsRight: Math.round(nav.lastElementChild.getBoundingClientRect().right) === Math.round(rect(".sample-panel > form").right),
					heroActions: document.querySelectorAll(".hero-div .nsmax-header-action").length,
					intro: shown(document.querySelector(".intro")),
					formBelowIntro: rect(".sample-panel > form").top >= rect(".intro").bottom,
					legendWeight: getComputedStyle(document.querySelector("legend")).fontWeight,
					inputHeight: Math.round(rect("#post-id").height),
					fieldTops: [...document.querySelectorAll(".pure-g > *")].map((element) => Math.round(element.getBoundingClientRect().top)),
					button: getComputedStyle(document.querySelector(".sample-panel .pure-button-primary")).backgroundColor,
					overflow: document.documentElement.scrollWidth - innerWidth,
				};
			});
			assert.equal(info.page, "lucky");
			assert.equal(info.navHeight, 53);
			assert.deepEqual(info.links, ["主页"]);
			assert.equal(info.actions, 3);
			assert.ok(info.actionsRight, JSON.stringify(info));
			assert.equal(info.heroActions, 0);
			assert.equal(info.intro, true);
			assert.ok(info.formBelowIntro, JSON.stringify(info));
			assert.equal(info.legendWeight, "600");
			assert.equal(info.inputHeight, 36);
			assert.equal(new Set(info.fieldTops).size, 1, JSON.stringify(info.fieldTops));
			assert.notEqual(info.button, "rgb(0, 120, 231)");
			assert.equal(info.overflow, 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/lucky", { html: luckyPage({ view: true }), viewport: { width: 375, height: 812 } });
		try {
			await page.waitForSelector(".sample-panel > header > nav > .nsmax-header-action");
			await wait(page, 300);
			const info = await page.evaluate(() => {
				const rect = (element) => element.getBoundingClientRect();
				const fields = [...document.querySelectorAll(".pure-g > *")];
				const board = document.querySelector(".board");
				return {
					links: [...document.querySelectorAll(".sample-panel > header > nav > a")].filter((element) => element.getClientRects().length > 0).map((element) => element.textContent.trim()),
					dateFull: Math.round(rect(fields[1]).width) === Math.round(rect(document.querySelector(".pure-g")).width - 32),
					pairTop: Math.round(rect(fields[2]).top) === Math.round(rect(fields[3]).top),
					boardLeft: Math.round(rect(board).left),
					formLeft: Math.round(rect(document.querySelector(".sample-panel > form")).left),
					rows: document.querySelectorAll(".board .rank-row").length,
					overflow: document.documentElement.scrollWidth - innerWidth,
				};
			});
			assert.deepEqual(info.links, ["主页", "抽奖贴"]);
			assert.ok(info.dateFull, JSON.stringify(info));
			assert.ok(info.pairTop, JSON.stringify(info));
			assert.equal(info.boardLeft, info.formLeft);
			assert.equal(info.rows, 3);
			assert.equal(info.overflow, 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("我的通知重排（2026-10-17）：顶栏一套分类、@我是一整列通知（未读小标 / 以下为已读 / 所在帖子）、点开标为已读；私信才有会话列表", async () => {
	const now = Date.now();
	const atList = [
		{ id: 31, post_id: 4001, floor_id: 9, commenter_id: 7, commenter_name: "friend", post_title: "人找车", content: "<p>@tester 还在吗</p>", viewed: 0, created_at: new Date(now - 6e4).toISOString() },
		{ id: 30, post_id: 4002, floor_id: 3, commenter_id: 8, commenter_name: "buddy", post_title: "测评", content: "<p>@tester 看看</p>", viewed: 1, created_at: new Date(now - 864e5).toISOString() }
	];
	for (const width of [1440, 390]) {
		// 站点设置成「新标签页打开帖子」：通知行和别处的帖子链接一样在新标签页打开
		const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/notification#/atMe", { html: nativeTalkPage(), init: sitePrefInit(true), viewport: { width, height: 900 }, api: { "/api/notification/at-me/list": [{ status: 200, body: { success: true, atList } }] } });
		try {
			await page.waitForSelector(".nsmax-notice-row");
			assert.equal(await page.locator(".nspp-messages-top > .nsmax-message-tabs a").count(), 3, "分类只在顶栏：@我、回复主题、私信");
			assert.equal(await page.locator(".nsmax-notice-nav").count(), 0);
			assert.equal(await page.locator(".nspp-messages-sidebar").isVisible(), false, "@我页面没有私信会话列表");
			assert.equal(await page.locator(".nspp-messages-chat").isVisible(), false);
			const rows = page.locator(".nsmax-notice-row");
			assert.equal(await rows.count(), 2);
			assert.equal(await rows.first().getAttribute("data-unread"), "");
			assert.equal(await rows.first().locator(".nsmax-notice-unread").innerText(), "未读");
			assert.equal(await rows.first().locator(".nsmax-notice-floor").innerText(), "#9");
			assert.equal(await rows.first().locator(".nsmax-notice-where").innerText(), "在 人找车");
			assert.equal(await page.locator(".nsmax-notice-divider").innerText(), "以下为已读");
			const geometry = await page.evaluate(() => {
				const card = document.querySelector(".nspp-notice-workspace").getBoundingClientRect();
				const top = document.querySelector(".nspp-messages-top").getBoundingClientRect();
				const last = Array.from(document.querySelectorAll(".nsmax-notice-row")).pop().getBoundingClientRect();
				return { gap: Math.round(card.top - top.bottom), rowsFill: card.bottom - last.bottom };
			});
			assert.equal(geometry.gap, 18, "标签栏和通知卡片相隔 18px");
			assert.ok(geometry.rowsFill < 120, `通知卡片按内容高度，不撑满窗口（最后一条下面还空 ${geometry.rowsFill}px）`);
			const link = rows.first().locator(".nsmax-notice-main");
			await page.waitForFunction(() => document.querySelector(".nsmax-notice-main")?.target === "_blank");
			assert.match(await link.getAttribute("href"), /^\/post-4001/);
			const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
			await popup.close();
			await page.waitForFunction(() => !document.querySelector(".nsmax-notice-row[data-unread]"));
			assert.equal(calls["/api/notification/at-me/markViewed"], 1, "点开一条就标为已读");
			await page.locator(".nsmax-message-tabs").getByRole("link", { name: /私信/ }).click();
			await page.waitForSelector(".nspp-messages-peer[data-id]");
			assert.equal(await page.locator(".nspp-messages-sidebar").isVisible(), true, "私信页才显示会话列表");
			assert.equal(await page.locator(".nspp-notice-workspace").isVisible(), false);
			assert.equal(await page.locator(".nsmax-notice-tools").isVisible(), false, "筛选、刷新只在通知列表时显示");
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("我的通知：站点设置在当前页打开帖子时，点通知先标为已读再跳到那一楼", async () => {
	const atList = [{ id: 41, post_id: 4101, floor_id: 2, commenter_id: 7, commenter_name: "friend", post_title: "当前页打开", content: "<p>@tester 看这里</p>", viewed: 0, created_at: new Date().toISOString() }];
	const { context, page, calls } = await open(browser, "https://www.nodeseek.com/notification#/atMe", { html: nativeTalkPage(), init: sitePrefInit(false), viewport: { width: 1440, height: 900 }, api: { "/api/notification/at-me/list": [{ status: 200, body: { success: true, atList } }] } });
	try {
		await page.waitForSelector(".nsmax-notice-row[data-unread]");
		await page.waitForTimeout(400);
		assert.notEqual(await page.locator(".nsmax-notice-main").getAttribute("target"), "_blank");
		await Promise.all([page.waitForURL(/\/post-4101-1/), page.locator(".nsmax-notice-main").click()]);
		assert.equal(calls["/api/notification/at-me/markViewed"], 1, "跳走之前已经标为已读");
	} finally { await context.close(); }
});

test("投票帖（2026-10-17；2026-10-18 起标题前不再加「投票」小标）：投票照 sb.sb .poll-widget（总票数、每项票数和百分比、8px 进度条、20px 投票人头像一排），头像不当正文配图", async () => {
	for (const width of [1440, 390]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: specialPostPage(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".vote-panel form > h2[data-nsmax-total]");
			await wait(page, 600);
			const state = await page.evaluate(() => {
				const article = document.querySelector(".nsk-post article.post-content").getBoundingClientRect();
				const [voted, open] = document.querySelectorAll(".vote-panel");
				const box = voted.getBoundingClientRect();
				const head = voted.querySelector("form > h2");
				const avatars = Array.from(voted.querySelectorAll(".vote-stat")[2].querySelectorAll(".voter-avatar-container img")).map((img) => img.getBoundingClientRect());
				const value = voted.querySelector(".vote-stat-count-value");
				const badge = document.querySelector(".nsk-post .post-title h1 > .nsmax-poll-badge");
				return {
					widthRatio: box.width / article.width,
					height: Math.round(box.height),
					background: getComputedStyle(voted).backgroundColor,
					total: head.dataset.nsmaxTotal,
					headAlign: getComputedStyle(head).textAlign,
					pct: Array.from(voted.querySelectorAll(".vote-stat-count-value")).map((v) => v.dataset.nsmaxPct),
					votes: getComputedStyle(value, "::after").content,
					bar: Math.round(voted.querySelector(".vote-stat-count-bar-wrapper").getBoundingClientRect().height),
					barText: getComputedStyle(voted.querySelector(".vote-stat-count-bar")).fontSize,
					avatar: [Math.round(avatars[0].width), Math.round(avatars[0].height)],
					avatarRow: avatars[0].top === avatars[1].top,
					postImages: voted.querySelectorAll(".nsmax-post-image, .post-image-link").length,
					imageParagraph: voted.closest("p")?.classList.contains("nsmax-image-paragraph") || false,
					deepLink: getComputedStyle(voted.querySelector("form > div[style*='text-align']")).display,
					radio: getComputedStyle(voted.querySelector(".vote-stat input")).display,
					openChoice: getComputedStyle(open.querySelector(".vote-stat")).borderTopStyle,
					openButton: getComputedStyle(open.querySelector(".op-buttons button")).backgroundColor,
					badge: badge && { text: badge.textContent, bg: getComputedStyle(badge).backgroundColor, color: getComputedStyle(badge).color },
					remembered: JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1000"],
					overflow: document.scrollingElement.scrollWidth > innerWidth + 1
				};
			});
			assert.ok(state.widthRatio > 0.95, `投票占满正文宽度（以前是 400px 的居中小卡片），实际 ${state.widthRatio.toFixed(2)}`);
			assert.ok(state.height < 520, `投过票的投票不能被头像撑高（以前两三千像素），实际 ${state.height}px`);
			assert.equal(state.background, "rgb(250, 251, 252)", "sb.sb .poll-widget：次底色");
			assert.equal(state.total, "公开投票 · 152 票");
			assert.equal(state.headAlign, "left");
			assert.deepEqual(state.pct, ["6%", "2%", "92%"]);
			assert.match(state.votes, /票 · /, "票数后面接「票 · 百分比」");
			assert.equal(state.bar, 8, "进度条 8px");
			assert.equal(state.barText, "0px", "进度条里站点写的百分比不显示（挪到右边票数后面）");
			assert.deepEqual(state.avatar, [20, 20], "投票人头像 20px");
			assert.equal(state.avatarRow, true, "投票人头像排成一排，不是每个单独一行");
			assert.equal(state.postImages, 0, "投票人头像不当正文配图");
			assert.equal(state.imageParagraph, false);
			assert.equal(state.deepLink, "none", "App 深链接那行灰字收起");
			assert.equal(state.radio, "none", "投过票的选项不显示单选框");
			assert.equal(state.openChoice, "solid", "没投过的投票：每项一张细线框小卡片");
			assert.equal(state.openButton, "rgb(28, 28, 30)", "投票按钮：墨色实底");
			assert.equal(state.badge, null, "标题前不再加「投票」小标（2026-10-18）");
			assert.equal(state.remembered, "lottery,poll", "打开过的投票 / 抽奖帖记在本机，列表里也带小标");
			assert.equal(state.overflow, false);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("抽奖帖（2026-10-17）：开奖链接换成 sb.sb .lottery-widget 抽奖卡片（倒计时每秒走、一小时内 / 五分钟内换颜色、开奖信息、查看开奖 + 回复参与），不会一张套一张", async () => {
	const now = Date.now();
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: specialPostPage({ now }), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-lottery");
		await wait(page, 1300);
		const state = await page.evaluate(() => ({
			cards: document.querySelectorAll(".nsmax-lottery").length,
			nested: document.querySelectorAll(".nsmax-lottery .nsmax-lottery").length,
			states: Array.from(document.querySelectorAll(".nsmax-lottery"), (card) => card.dataset.state),
			label: Array.from(document.querySelectorAll(".nsmax-lottery-state"), (el) => el.textContent),
			clock: Array.from(document.querySelectorAll(".nsmax-lottery")[0].querySelectorAll(".nsmax-lottery-seg"), (seg) => seg.textContent),
			stat: document.querySelector(".nsmax-lottery-stat").textContent,
			table: Array.from(document.querySelectorAll(".nsmax-lottery")[0].querySelectorAll(".nsmax-lottery-table td"), (td) => td.textContent),
			doneLabel: document.querySelectorAll(".nsmax-lottery-label")[3].textContent,
			doneClock: getComputedStyle(document.querySelectorAll(".nsmax-lottery-clock")[3]).display,
			sourceHidden: Array.from(document.querySelectorAll("[data-nsmax-lottery-source]"), (el) => getComputedStyle(el).display),
			view: { href: document.querySelector(".nsmax-lottery-view").getAttribute("href"), target: document.querySelector(".nsmax-lottery-view").target },
			soonBg: getComputedStyle(document.querySelectorAll(".nsmax-lottery-countdown")[1]).backgroundColor,
			imminentBg: getComputedStyle(document.querySelectorAll(".nsmax-lottery-countdown")[2]).backgroundColor,
			primary: Array.from(document.querySelectorAll(".nsmax-lottery"), (card) => getComputedStyle(card.querySelector(".nsmax-lottery-join")).backgroundColor === "rgb(28, 28, 30)" ? "join" : "view")
		}));
		assert.equal(state.cards, 4, "每个开奖链接一张卡片");
		assert.equal(state.nested, 0, "卡片里的「查看开奖」不能再生成卡片");
		assert.deepEqual(state.states, ["open", "soon", "imminent", "done"]);
		assert.deepEqual(state.label, ["进行中", "进行中", "进行中", "已结束"]);
		assert.deepEqual(state.clock.map((text) => text.replace(/\d+/, "N")), ["N天", "N时", "N分", "N秒"], "单位照 sb.sb 用中文（2026-10-18）");
		assert.match(state.clock[1], /^02时$/);
		assert.match(state.stat, /开奖 \d{4}-\d{2}-\d{2} \d{2}:\d{2}.*从 2 楼起.*共 3 个名额/);
		assert.doesNotMatch(state.stat, /#2/, "起始楼层不写 #（用户 2026-10-18）");
		assert.deepEqual(state.table.slice(1), ["3", "未开奖"], "奖品 / 名额 / 中奖者");
		assert.match(state.doneLabel, /^已于 \d{4}-\d{2}-\d{2} \d{2}:\d{2} 开奖$/);
		assert.equal(state.doneClock, "none", "到了开奖时间倒计时条只留一句「已于 … 开奖」");
		assert.deepEqual(state.sourceHidden, ["none", "none", "none", "none"], "原来只有一个链接的段落收起");
		assert.match(state.view.href, /^https:\/\/www\.nodeseek\.com\/lucky\?post=1000&time=\d+/);
		assert.equal(state.view.target, "_blank");
		assert.equal(state.soonBg, "rgb(255, 244, 196)", "一小时内：品牌浅底");
		assert.equal(state.imminentBg, "rgb(251, 212, 212)", "五分钟内：红色浅底");
		assert.deepEqual(state.primary, ["join", "join", "join", "view"], "没开奖时「回复参与」是主按钮，开奖后换成「查看开奖」");
		// 倒计时每秒走（只改文字，不整块重建）
		const seconds = () => page.evaluate(() => document.querySelectorAll(".nsmax-lottery")[0].querySelectorAll(".nsmax-lottery-seg b")[3].textContent);
		const before = await seconds();
		await wait(page, 1100);
		assert.notEqual(await seconds(), before, "倒计时在走");
		// 回复参与：跳到回复框并聚焦
		await page.locator(".nsmax-lottery-join").first().click();
		await page.waitForFunction(() => document.activeElement?.closest(".md-editor"), null, { timeout: 2e3 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("列表（2026-10-18 起）：只有确认正文里有开奖链接的帖子标题前加红色「抽奖」；标题里有「抽奖」但没确认的不加，投票帖不再加「投票」", async () => {
	const html = listPage().replace("求推荐稳定的美西 VPS", "【投票】你用哪家 VPS").replace("分享一个 Docker 一键部署脚本", "签到领鸡腿还是抽奖？").replace("今天的 NodeSeek 签到抽奖结果", "国庆抽奖送 10 个鸡腿");
	// 1003 打开过、确认有开奖链接；1004 确认有投票；1002 标题里有「抽奖」但没确认（后台去查也查不到正文）
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 1440, height: 900 }, init: `try { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1003": "lottery", "1004": "poll" })); } catch {}` });
	try {
		await page.waitForSelector(".nsmax-prize-badge");
		await wait(page, 600);
		const rows = await page.evaluate(() => Array.from(document.querySelectorAll(".post-list-item .post-title"), (title) => ({
			title: title.querySelector("a").textContent.trim(),
			badges: Array.from(title.querySelectorAll(".nsmax-poll-badge, .nsmax-prize-badge"), (badge) => `${badge.textContent}:${getComputedStyle(badge).backgroundColor}`),
			before: title.querySelector(".nsmax-poll-badge, .nsmax-prize-badge")?.nextElementSibling?.tagName || ""
		})).filter((row) => row.badges.length));
		assert.deepEqual(rows, [
			{ title: "国庆抽奖送 10 个鸡腿", badges: ["抽奖:rgb(224, 83, 59)"], before: "A" }
		]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-17 第二批：未读数是 16px 小圆、今日热门标题下不空一截、旧资料卡不弹出、系统通知未读有标记、别人主页没有「收藏」标签", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-account-menu .nsmax-account-unread");
		await page.waitForSelector(".nsmax-hot-text");
		await wait(page, 400);
		const state = await page.evaluate(() => {
			const badge = document.querySelector(".nsmax-account-menu .nsmax-account-unread");
			const box = badge.getBoundingClientRect();
			const title = document.querySelector(".nsmax-hot-panel .nsmax-hot-head .nsmax-hot-title");
			const card = document.createElement("div");
			card.className = "user-card hover-user-card";
			card.style.cssText = "position: absolute; top: 100px; left: 100px;";
			card.textContent = "旧资料卡";
			document.body.append(card);
			return {
				text: badge.textContent,
				size: [Math.round(box.width), Math.round(box.height)],
				radius: parseFloat(getComputedStyle(badge).borderTopLeftRadius) >= 8,
				titleMargin: [getComputedStyle(title).marginTop, getComputedStyle(title).marginBottom],
				hoverCard: getComputedStyle(card).display
			};
		});
		assert.equal(state.text.length, 1);
		assert.deepEqual(state.size, [16, 16], "一位数的未读数是 16px 小圆（以前 24×16 的椭圆）");
		assert.equal(state.radius, true);
		assert.deepEqual(state.titleMargin, ["0px", "0px"], "「今日热门」标题不再额外留外边距");
		assert.equal(state.hoverCard, "none", "站点旧版资料卡（点头像弹出）不显示，资料卡只用 sb.sb 样式那张");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 私信：系统通知有未读时，会话行带未读标记（摘要金色加粗 + 右边黄点）
	const unread = [{ id: 61, sender_id: 5230, receiver_id: 1, sender_name: "系统通知", receiver_name: "tester", content: "你的帖子被加入了推荐阅读", viewed: 0, created_at: new Date().toISOString() }];
	const messages = await open(browser, "https://www.nodeseek.com/notification#/message?mode=list", { html: nativeTalkPage(), viewport: { width: 1440, height: 900 }, api: { "/api/notification/message/list": [{ status: 200, body: { success: true, msgArray: unread } }] } });
	try {
		await messages.page.waitForSelector(".nspp-messages-peer[data-id]");
		await wait(messages.page, 300);
		const row = await messages.page.evaluate(() => {
			const peer = Array.from(document.querySelectorAll(".nspp-messages-peer[data-id]")).find((el) => el.textContent.includes("系统消息"));
			const dot = peer?.querySelector(".nspp-messages-unread");
			return { unread: peer?.hasAttribute("data-unread"), dot: dot ? [getComputedStyle(dot).display, getComputedStyle(dot).width] : null, snippet: peer ? getComputedStyle(peer.querySelector(".nspp-messages-snippet")).fontWeight : "" };
		});
		assert.equal(row.unread, true, "系统通知的会话带未读标记");
		assert.notEqual(row.dot?.[0], "none", "未读黄点要显示");
		assert.equal(row.dot?.[1], "8px");
		assert.equal(row.snippet, "600", "未读会话的摘要加粗");
		assert.deepEqual(messages.errors, []);
	} finally { await messages.context.close(); }
	// 个人主页：看别人的主页没有「收藏」标签（只有自己看得到收藏），看自己的才有
	for (const [uid, tabs] of [[10, ["主题", "回帖"]], [1, ["主题", "回帖", "收藏"]]]) {
		const space = await open(browser, `https://www.nodeseek.com/space/${uid}#/discussions`, { html: nativeSpacePage(), viewport: { width: 1440, height: 900 } });
		try {
			await wait(space.page, 900);
			const visible = await space.page.evaluate(() => Array.from(document.querySelectorAll(".selector a.select-item")).filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.textContent.trim()));
			assert.deepEqual(visible, tabs, `UID ${uid}`);
			assert.deepEqual(space.errors, []);
		} finally { await space.context.close(); }
	}
});

test("加载提速（2026-10-17）：帖子页挂载时不再当场量页面高度（以前阅读进度条一读 scrollHeight 就强制整页排版一次）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 }, init: `(() => {
		window.__forced = 0;
		const desc = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
		Object.defineProperty(Element.prototype, "scrollHeight", { configurable: true, get() { if (this === document.documentElement && document.readyState !== "complete" && !window.__idle) window.__forced++; return desc.get.call(this); } });
		document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => { window.__idle = true; })));
	})();` });
	try {
		await page.waitForSelector("#nsmax-progress", { state: "attached" });
		await wait(page, 800);
		const state = await page.evaluate(() => ({ forced: window.__forced, idle: document.querySelector("#nsmax-progress").hasAttribute("data-idle"), marks: performance.getEntriesByType("mark").map((m) => m.name) }));
		assert.equal(state.forced, 0, "首屏画出来之前不读整页高度");
		assert.equal(state.idle, true, "刚打开时进度条按 0 显示");
		for (const mark of ["nsmax:start", "nsmax:sync-end", "nsmax:primary-ready"]) assert.ok(state.marks.includes(mark), `有 ${mark} 打点`);
		await page.evaluate(() => window.scrollTo(0, 600));
		await page.waitForFunction(() => !document.querySelector("#nsmax-progress").hasAttribute("data-idle"));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 第三批（2026-10-17）的测试用：第 2 层回复第 1 层、第 3 层回复第 2 层（都收进第 1 层的楼中楼框），第 1 层带签名
const floorPost = (options = {}) => postPage(options)
	.replace("<p>价格不错，帮顶</p>", `<p><a href="/member?t=buyer">@buyer</a> <a href="/post-1000-1#1" target="_self">#1</a> 价格不错，帮顶</p>`)
	.replace("<p>线路怎么样？晚高峰丢包吗？</p>", `<p><a href="/member?t=passerby">@passerby</a> <a href="/post-1000-1#2" target="_self">#2</a> 线路怎么样？晚高峰丢包吗？</p><p>顺便问下价格</p>`)
	.replace("<p>收了，私信你</p>", `<p>收了，私信你</p></article><div class="signature"><h3>· · <a href="/post-1-1">动态调优脚本</a> · <a href="/post-2-1">自动推送机器人</a></h3></div><article class="nsmax-fixture-dummy" hidden>`);

test("帖子页经典布局（2026-10-17 图七）：每层左边作者栏（88px 头像、名字、UID、等级、帖子 / 鸡腿 / 星辰），右边头部是时间 + 细线框操作胶囊，签名前「个性签名」；「简洁模式」切回紧凑排法", async () => {
	for (const width of [1440, 390]) {
		const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector("ul.comments > li[id='1'] > .nsmax-author-col");
			// 作者栏出现在屏幕上才读资料：手机上第 1 层在首屏下面，先滚过去
			await page.locator("ul.comments > li[id='1']").scrollIntoViewIfNeeded();
			await page.waitForSelector("ul.comments > li[id='1'] > .nsmax-author-col[data-nsmax-filled]");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const floor = document.querySelector("ul.comments > li[id='1']");
				const col = floor.querySelector(":scope > .nsmax-author-col");
				const avatar = col.querySelector(".nsmax-author-avatar").getBoundingClientRect();
				const article = floor.querySelector(":scope > article").getBoundingClientRect();
				const pill = floor.querySelector(":scope > .nsmax-floor-actions .menu-item[data-nsmax-action=reply]");
				return {
					layout: document.documentElement.dataset.nsmaxPostLayout,
					cols: document.querySelectorAll("#nsk-body-left .nsmax-author-col").length,
					name: col.querySelector(".nsmax-author-name").textContent,
					uid: col.querySelector(".nsmax-author-uid").textContent,
					level: col.querySelector(".nsmax-author-level")?.textContent,
					stats: Array.from(col.querySelectorAll(".nsmax-author-stats > a > span"), (span) => span.textContent),
					statsShown: !!col.querySelector(".nsmax-author-stats") && getComputedStyle(col.querySelector(".nsmax-author-stats")).display !== "none",
					avatar: [Math.round(avatar.width), Math.round(avatar.height)],
					colLeftOfBody: col.getBoundingClientRect().right <= article.left + 1,
					colAboveBody: col.getBoundingClientRect().bottom <= article.top + 1,
					pill: { border: getComputedStyle(pill).borderTopStyle, radius: parseFloat(getComputedStyle(pill).borderTopLeftRadius) },
					headName: getComputedStyle(floor.querySelector(":scope > .nsk-content-meta-info .author-name")).display,
					sig: getComputedStyle(floor.querySelector(":scope > .signature"), "::before").content,
					overflow: document.scrollingElement.scrollWidth > innerWidth + 1,
					toggle: document.querySelector(".comment-container .nsmax-layout-toggle")?.textContent
				};
			});
			assert.equal(state.layout, "classic");
			assert.equal(state.cols, 2, "主帖和外层回复各一栏（楼中楼不加）");
			assert.equal(state.name, "buyer");
			assert.equal(state.uid, "UID 11");
			assert.equal(state.level, "Lv.3");
			assert.deepEqual(state.stats, ["帖子", "鸡腿", "星辰"]);
			assert.equal(state.pill.border, "solid", "楼层操作是细线框小胶囊");
			assert.ok(state.pill.radius >= 9, "胶囊圆角");
			assert.equal(state.headName, "none", "右边头部不再重复名字");
			assert.equal(state.sig, '"个性签名"');
			assert.equal(state.toggle, "简洁模式");
			assert.equal(state.overflow, false);
			if (width > 720) {
				assert.deepEqual(state.avatar, [88, 88]);
				assert.equal(state.colLeftOfBody, true, "作者栏在左边");
				assert.equal(state.statsShown, true);
			} else {
				assert.deepEqual(state.avatar, [40, 40], "手机上作者栏是一行：40px 头像");
				assert.equal(state.colAboveBody, true, "手机上作者栏在正文上面");
				assert.equal(state.statsShown, false, "手机上不显示三格数字");
			}
			assert.ok(Object.entries(calls).filter(([key]) => key.startsWith("/api/account/getInfo/")).every(([, count]) => count === 1), "同一个人的资料只读一次");
			if (width > 720) {
				await page.locator(".comment-container .nsmax-layout-toggle").click();
				assert.equal(await page.evaluate(() => document.documentElement.dataset.nsmaxPostLayout), "simple");
				assert.equal(await page.locator("ul.comments > li[id='1'] > .nsmax-author-col").isVisible(), false, "简洁模式下作者栏收起");
				assert.equal(await page.evaluate(() => localStorage.getItem("nsmax:post-layout")), "simple");
			}
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("楼中楼框（2026-10-17 图五）：回复收进外层楼层末尾的次底色框，一条一行「名字 回复 某某：内容」、右边时间 #楼号 操作，框底「共 N 条回复」+「我也说一句」", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li[id='3']");
		await wait(page, 300);
		const state = await page.evaluate(() => {
			const box = document.querySelector("li[id='1'] > .nsmax-floor-box");
			const rows = Array.from(box.querySelectorAll(".nsmax-nested-replies > li.content-item"));
			const say = box.querySelector(".nsmax-fb-say");
			return {
				who: rows.map((row) => row.querySelector(".nsmax-fb-who").textContent),
				lead: Array.from(box.querySelectorAll("[data-nsmax-fb-lead]"), (a) => getComputedStyle(a).display),
				count: box.querySelector(".nsmax-fb-count").textContent,
				bg: getComputedStyle(box).backgroundColor,
				rowHeights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
				sig: rows.map((row) => row.querySelector(":scope > .signature") ? getComputedStyle(row.querySelector(":scope > .signature")).display : "none"),
				say: { text: say.textContent, bg: getComputedStyle(say).backgroundColor },
				timeRight: rows.map((row) => row.querySelector(".content-info").getBoundingClientRect().left > row.querySelector(":scope > article").getBoundingClientRect().left)
			};
		});
		assert.deepEqual(state.who, ["passerby：", "curious回复passerby："], "回复层主只写名字，回复楼中楼写「回复 某某」");
		assert.deepEqual(state.lead, ["none", "none", "none", "none"], "开头的「@某某 #楼号」藏起来");
		assert.equal(state.count, "共 2 条回复");
		assert.equal(state.bg, "rgb(250, 251, 252)", "次底色框（sb.sb .floor-box）");
		assert.ok(state.rowHeights.every((h) => h < 70), "每条一两行：" + JSON.stringify(state.rowHeights));
		assert.deepEqual(state.sig, ["none", "none"], "楼中楼不显示签名");
		assert.deepEqual(state.say, { text: "我也说一句", bg: "rgb(28, 28, 30)" });
		assert.deepEqual(state.timeRight, [true, true], "时间在内容右边");
		// 「我也说一句」= 回复这一层：回复框挪到这一层下面
		await page.locator("li[id='1'] .nsmax-fb-say").click();
		await page.waitForFunction(() => document.querySelector(".md-editor")?.closest("li.content-item")?.id === "1");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("回复某一层（2026-10-17 图六）：回复框挪到那一层下面，按钮写回复的是谁（回复楼中楼里的人是「回复 某某」，2026-10-18）+「取消回复」；取消后放回页面底部，只有「@某某 #楼号」时一起清掉", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".md-editor .nsmax-editor-head");
		await wait(page, 300);
		const home = await page.evaluate(() => document.querySelector(".md-editor").parentElement.className || document.querySelector(".md-editor").parentElement.tagName);
		// 站点的回复：在编辑器里填「@某某 [#楼号](链接) 」（这里模拟 NodeSeek 编辑器的 reply()）
		await page.evaluate(() => document.querySelector("ul.comments > li[id='3'] .menu-item[title='回复'], li[id='3'] .menu-item[title='回复']").addEventListener("click", () => {
			const input = document.querySelector(".md-editor textarea");
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(input, "@curious [#3](https://www.nodeseek.com/post-1000-1#3) ");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		}));
		await page.locator("li[id='3'] .menu-item[title='回复']").click();
		await page.waitForFunction(() => document.querySelector(".md-editor button.submit")?.textContent === "回复 curious");
		const inline = await page.evaluate(() => ({
			floor: document.querySelector(".md-editor").closest("ul.comments > li.content-item")?.id,
			after: document.querySelector(".md-editor").closest("[data-nsmax-inline]")?.previousElementSibling?.className,
			cancel: getComputedStyle(document.querySelector(".nsmax-reply-cancel")).display,
			clear: getComputedStyle(document.querySelector(".nsmax-draft-clear")).display
		}));
		assert.equal(inline.floor, "1", "楼中楼的回复挂到它所在的外层楼层下面");
		assert.equal(inline.after, "nsmax-floor-box", "回复框在楼中楼框后面");
		assert.notEqual(inline.cancel, "none", "「取消回复」显示");
		assert.notEqual(inline.clear, "none", "有内容时「清空草稿」显示");
		await page.locator(".nsmax-reply-cancel").click();
		const back = await page.evaluate(() => ({ inFloor: !!document.querySelector(".md-editor").closest("li.content-item"), value: document.querySelector(".md-editor textarea").value, label: document.querySelector(".md-editor button.submit").textContent, cancel: getComputedStyle(document.querySelector(".nsmax-reply-cancel")).display, parent: document.querySelector(".md-editor").parentElement.className || document.querySelector(".md-editor").parentElement.tagName }));
		assert.deepEqual(back, { inFloor: false, value: "", label: "回复楼主", cancel: "none", parent: home });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("回复框照 sb.sb（2026-10-17）：标题栏 45px「发表回复 · 说两句」、「预览」在工具按钮里、输入框用系统字体（不是等宽字）、提示字「写下你的回复…」", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".md-editor .nsmax-editor-status");
		await wait(page, 300);
		// 站点的 Markdown 编辑器（CodeMirror）每一行是 pre.CodeMirror-line：放一行进去看用的什么字体
		await page.evaluate(() => document.querySelector(".md-editor .nsmax-editor-surface").insertAdjacentHTML("beforeend", '<div class="CodeMirror"><pre class="CodeMirror-line">输入的字</pre></div>'));
		const state = await page.evaluate(() => ({
			head: Math.round(document.querySelector(".nsmax-editor-head").getBoundingClientRect().height),
			status: document.querySelector(".nsmax-editor-status").textContent,
			headButtons: document.querySelectorAll(".nsmax-editor-head button").length,
			chips: Array.from(document.querySelectorAll(".nsmax-editor-controls > button"), (b) => b.textContent.trim()),
			chipHeights: [...new Set(Array.from(document.querySelectorAll(".nsmax-editor-controls > button"), (b) => Math.round(b.getBoundingClientRect().height)))],
			lineFont: getComputedStyle(document.querySelector(".CodeMirror pre.CodeMirror-line")).fontFamily
		}));
		assert.equal(state.head, 45, "标题栏 45px（sb.sb .reply-panel-head）");
		assert.equal(state.status, "说两句");
		assert.equal(state.headButtons, 0, "标题栏里不再放「内容 / 预览」");
		assert.deepEqual(state.chips, ["使用 Markdown 编辑器", "上传附件", "表情", "预览"]);
		assert.equal(state.chipHeights.length, 1, "工具按钮一样高：" + JSON.stringify(state.chipHeights));
		assert.doesNotMatch(state.lineFont, /Mono/i, "输入的字不是等宽字体：" + state.lineFont);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("列表工具条「精华」「抽奖」（2026-10-18，照 sb.sb 的 精华 / 抽奖 分类）：接在「新帖子」后面；标题像的帖子在后台确认一次（只看主帖正文），确认不是的不挂小标", async () => {
	const lottery = postPage().replace("配置说明", "签到抽奖结果").replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1003&amp;time=1893456000000&amp;count=1">开奖</a></p></article>');
	const notLottery = postPage().replace("配置说明", "签到领鸡腿还是抽奖？");
	const html = listPage().replace("求推荐稳定的美西 VPS", "大家签到是领鸡腿还是抽奖？");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 1440, height: 900 }, pages: { "/post-1001-1": notLottery, "/post-1003-1": lottery } });
	try {
		await page.waitForSelector(".nsmax-kind-tabs");
		const tabs = await page.evaluate(() => {
			const sorter = document.querySelector(".post-list-controler > .sorter").getBoundingClientRect();
			const first = document.querySelector(".nsmax-kind-tab").getBoundingClientRect();
			return { links: Array.from(document.querySelectorAll(".nsmax-kind-tab"), (a) => a.textContent + " " + decodeURIComponent(a.getAttribute("href"))), gap: Math.round(first.left - sorter.right), on: document.querySelectorAll(".nsmax-kind-tab[data-nsmax-on]").length, header: document.querySelectorAll("#nsk-head .nsmax-essence-tab-item").length };
		});
		assert.deepEqual(tabs.links, ["精华 /award", "抽奖 /search?q=抽奖"], "「投票」去掉，「精华」从顶栏挪过来");
		assert.ok(tabs.gap >= 0 && tabs.gap < 24, "紧跟在「新帖子」后面：" + tabs.gap);
		assert.equal(tabs.on, 0, "首页没有选中的分类");
		assert.equal(tabs.header, 0, "顶栏不再有「精华」");
		// 后台确认：1003 正文有开奖链接 → 抽奖；1001 只是标题里有「抽奖」→ 查过以后不挂
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return "1001" in c && "1003" in c; } catch { return false; } }, null, { timeout: 8e3 });
		await wait(page, 300);
		const badges = await page.evaluate(() => Array.from(document.querySelectorAll(".post-list-item .post-title"), (t) => [t.querySelector("a").textContent.trim(), !!t.querySelector(".nsmax-prize-badge"), !!t.querySelector(".nsmax-poll-badge")]).filter(([title]) => /抽奖/.test(title)));
		assert.deepEqual(badges, [["大家签到是领鸡腿还是抽奖？", false, false], ["今天的 NodeSeek 签到抽奖结果", true, false]]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 精华页（站点的 /award）：「精华」是选中样子；点「新帖子」回首页列表（站点的排序链接本来会停在精华页）
	const award = await open(browser, "https://www.nodeseek.com/award", { html: listPage(), viewport: { width: 1440, height: 900 }, pages: { "/": listPage() } });
	try {
		await award.page.waitForSelector(".nsmax-kind-tab[data-nsmax-on]");
		assert.equal(await award.page.locator(".nsmax-kind-tab[data-nsmax-on]").innerText(), "精华");
		await award.page.locator(".post-list-controler > .sorter > a[data-sort=postTime]").click();
		await award.page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("sortBy") === "postTime");
		assert.deepEqual(award.errors, []);
	} finally { await award.context.close(); }
	// 抽奖页（站内搜索「抽奖」当分类用，照 sb.sb /prize/）：只显示确认有开奖链接的帖子，没查过的在后台查完按顺序显示；
	// 1001 查过是抽奖，1000 / 1002 查过不是，1003 有开奖链接，1004 没有，1005 打不开
	const lucky = postPage().replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1003&amp;time=1893456000000&amp;count=1">开奖</a></p></article>');
	const view = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { html: searchPage({ count: 6 }), viewport: { width: 1440, height: 900 }, pages: { "/post-1003-1": lucky, "/post-1004-1": postPage() }, init: `if (window.top === window) { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1001": "lottery" })); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1000": 1, "1001": 1, "1002": 1 })); }` });
	try {
		await view.page.waitForSelector(".nsmax-kind-tab[data-kind=lottery][data-nsmax-on]");
		const visible = () => view.page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).filter((li) => getComputedStyle(li).display !== "none").map((li) => li.querySelector(".post-title a").getAttribute("href")));
		// 2026-10-23：1005 打不开——查完以后状态行说一声、给「重试」（以前一声不响地当成「不是」）；
		// 识别完页码才出来，最后那个「… 100」（搜索结果的总页数）不显示
		await view.page.waitForFunction(() => /没能识别/.test(document.querySelector(".nsmax-lottery-status")?.textContent || ""), null, { timeout: 8e3 });
		assert.deepEqual(await visible(), ["/post-1001-1", "/post-1003-1"], "只剩确认有开奖链接的");
		const done = await view.page.evaluate(() => {
			const status = document.querySelector(".nsmax-lottery-status");
			const pager = document.querySelector("#nsk-body-left .nsk-pager.pager-bottom");
			return { text: status.textContent, hidden: status.hidden, retry: !!status.querySelector("button.nsmax-lottery-retry"), pending: document.documentElement.hasAttribute("data-nsmax-lottery-pending"), pager: getComputedStyle(pager).display !== "none", pages: Array.from(pager.querySelectorAll(".pager-pos, .nsmax-pager-ellipsis")).filter((el) => getComputedStyle(el).display !== "none").map((el) => el.textContent.trim()) };
		});
		assert.deepEqual(done, { text: "有 1 篇没能识别（网络或站点限流）重试", hidden: false, retry: true, pending: false, pager: true, pages: ["1", "2", "3"] });
		const asked = [];
		view.page.on("request", (request) => { if (new URL(request.url()).pathname === "/post-1005-1") asked.push(request.url()); });
		await view.page.click(".nsmax-lottery-retry");
		await view.page.waitForFunction(() => /没能识别/.test(document.querySelector(".nsmax-lottery-status")?.textContent || "") && !document.documentElement.hasAttribute("data-nsmax-lottery-pending"), null, { timeout: 8e3 });
		assert.equal(asked.length, 1, "点「重试」把没查成的那篇再查一次");
		const state = await view.page.evaluate(() => ({ title: document.title, view: document.documentElement.hasAttribute("data-nsmax-lottery-view"), sorterOn: getComputedStyle(document.querySelector(".post-list-controler > .sorter > a.selected")).fontWeight }));
		assert.equal(state.title, "抽奖 - NodeSeek");
		assert.equal(state.view, true);
		assert.deepEqual(view.errors, []);
	} finally { await view.context.close(); }
});

test("2026-10-17 第四批：我的关注「取关」不再是灰底；帖子预览里表情贴图和文字竖直居中、其他图片单独一行带细线框；搜索面板照 sb.sb 重排", async () => {
	const fans = await open(browser, "https://www.nodeseek.com/fans?type=follow", { html: fansPage().replaceAll('<a class="btn">取关</a>', '<a class="btn" style="background-color: gray !important;">取关</a>'), viewport: { width: 1440, height: 900 } });
	try {
		await fans.page.waitForSelector(".btn[data-nsmax-unfollow]");
		const btn = await fans.page.evaluate(() => { const b = document.querySelector(".btn[data-nsmax-unfollow]"); return { inline: b.style.getPropertyValue("background-color"), bg: getComputedStyle(b).backgroundColor }; });
		assert.equal(btn.inline, "", "站点写死的灰底去掉");
		assert.notEqual(btn.bg, "rgb(128, 128, 128)");
		assert.deepEqual(fans.errors, []);
	} finally { await fans.context.close(); }
	const post = postPage().replace(/<article class="post-content">[\s\S]*?<\/article>/, () => '<article class="post-content"><p>感觉流畅起来了 <img class="sticker" src="https://www.nodeseek.com/avatar/903.png" alt="xhj014"></p><p><img src="https://www.nodeseek.com/avatar/904.png" alt="image"><br>截图后面的字</p></article>');
	const list = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, pages: { "/post-1000-1": post } });
	try {
		await list.page.waitForSelector("ul.post-list .post-title a");
		await wait(list.page, 600);
		await list.page.locator("ul.post-list .post-title a").first().hover();
		await list.page.waitForSelector("dialog.nspp-post-preview .nspp-preview-content img.sticker", { timeout: 5e3 });
		const preview = await list.page.evaluate(() => {
			const sticker = document.querySelector("dialog.nspp-post-preview img.sticker");
			const shot = document.querySelector("dialog.nspp-post-preview img:not(.sticker)");
			return { sticker: [getComputedStyle(sticker).verticalAlign, getComputedStyle(sticker).maxWidth], shot: [getComputedStyle(shot).display, getComputedStyle(shot).borderTopStyle], br: getComputedStyle(shot.nextElementSibling).display };
		});
		assert.deepEqual(preview, { sticker: ["middle", "90px"], shot: ["block", "solid"], br: "none" });
		// 搜索面板（站点组件，这里放一份同样结构）
		await list.page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div class="search-overlay"><div class="glass-card"><nav class="glass-tabs"><button class="tab-btn active">帖子</button><button class="tab-btn">用户</button><button class="glass-close">×</button></nav><div class="glass-content"><div class="sub-nav">' + ["全部", "日常", "技术", "情报", "测评", "交易", "拼车", "Dev", "贴图", "曝光", "内版", "沙盒", "生活"].map((t, i) => `<span class="sub-pill${i ? "" : " active"}">${t}</span>`).join("") + '</div><div class="glass-input-group"><input type="text" placeholder="搜索 全部 帖子..."><button class="glass-search-btn"><span>搜索</span></button></div><div class="search-history"><div class="history-header"><span>搜索历史</span><button class="clear-history-btn">清空</button></div><div class="history-list"><div class="history-item"><span class="history-keyword">ix</span><span class="history-scope-tag">全部</span></div></div></div></div></div></div>'));
		const overlay = await list.page.evaluate(() => {
			const card = document.querySelector(".search-overlay .glass-card").getBoundingClientRect();
			const input = document.querySelector(".search-overlay .glass-input-group input").getBoundingClientRect();
			const pills = Array.from(document.querySelectorAll(".search-overlay .sub-pill"), (p) => Math.round(p.getBoundingClientRect().top));
			return { width: Math.round(card.width), input: Math.round(input.height), inputFirst: input.top < pills[0], oneRow: new Set(pills).size === 1 };
		});
		// 2026-10-19 第十三批改成 600px 卡片、44px 一体搜索框（输入框在框里，高 42px）
		assert.deepEqual(overlay, { width: 600, input: 42, inputFirst: true, oneRow: true });
		assert.deepEqual(list.errors, []);
	} finally { await list.context.close(); }
});

// 2026-10-18：侧栏一起出现、页面更顺滑
// 真实站点上服务器只给资料卡一个 #usercard-me 骨架，右栏后面的站点脚本才画出真正的资料卡；这里用一个晚 500ms 才返回的脚本模拟
const delayedCardPage = () => {
	const html = listPage();
	const open = '<div id="nsk-right-panel-container">';
	const begin = html.indexOf(open);
	const start = begin + open.length + 1;
	const end = html.indexOf('\n<a class="btn-post"', start);
	const card = html.slice(start, end);
	assert.ok(card.startsWith('<div class="user-card">'), "夹具结构：右栏第一块是资料卡");
	// 右栏容器的结束标签（按 div 嵌套层数找）
	let depth = 0, close = -1;
	for (const match of html.slice(begin).matchAll(/<div\b|<\/div>/g)) {
		depth += match[0] === "</div>" ? -1 : 1;
		if (!depth) { close = begin + match.index + match[0].length; break; }
	}
	assert.ok(close > end);
	// 骨架换掉资料卡；右栏后面放一个晚 500ms 才到的站点脚本，把骨架换成资料卡（和真实站点一样在解析过程中画）
	return {
		card,
		html: html.slice(0, start) + '<div id="usercard-me" class="skeleton" style="height: 373px; margin-bottom: 10px"></div>' + html.slice(end, close) + '<script src="/usercard.js"></script>' + html.slice(close)
	};
};

test("侧栏一起出现（2026-10-18）：脚本在页面解析前运行时，浏览器等页面解析完（站点画好资料卡）才画第一帧——第一帧里资料卡、今日热门、最近浏览都在；模块接管时不重画、热榜拿到数据不变高", async () => {
	const { card, html: page$ } = delayedCardPage();
	const seed = Array.from({ length: 4 }, (_, i) => ({ path: `/post-${7000 + i}-1`, title: `以前浏览 ${i + 1}` }));
	const init = `(() => {
		if (window.top !== window) return;
		localStorage.setItem("nsmax:recent:1", ${JSON.stringify(JSON.stringify(seed))});
		window.__maskSet = false;
		new MutationObserver(() => { if (document.documentElement?.hasAttribute("data-nsmax-boot-body")) window.__maskSet = true; }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-nsmax-boot-body"] });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.name !== "first-contentful-paint" || window.__first) continue;
				const side = document.getElementById("nsk-right-panel-container");
				const hot = side?.querySelector(".nsmax-hot-panel");
				const recent = side?.querySelector(".nsmax-recent-panel");
				window.__earlyRecent = recent || null;
				window.__first = {
					at: entry.startTime,
					skeleton: !!document.querySelector("#usercard-me.skeleton"),
					account: !!side?.querySelector(".nsmax-sb-account"),
					hot: !!hot,
					hotSkeletonRows: hot ? hot.querySelectorAll(".nsmax-hot-skeleton").length : 0, hotRealRows: hot ? hot.querySelectorAll(".nsmax-hot-list > li:not(.nsmax-hot-skeleton)").length : 0,
					height: hot ? hot.getBoundingClientRect().height : 0,
					rowH: hot ? Array.from(hot.querySelectorAll(".nsmax-hot-skeleton"), (li) => Math.round(li.getBoundingClientRect().height * 2) / 2) : [],
					recent: recent ? recent.querySelectorAll("li").length : 0,
					order: side ? Array.from(side.children, (el) => el.classList.contains("nsmax-hot-panel") ? "hot" : el.classList.contains("nsmax-recent-panel") ? "recent" : el.classList.contains("user-card") ? "card" : "").filter(Boolean) : []
				};
				if (recent) new MutationObserver((records) => { window.__recentChurn = (window.__recentChurn || 0) + records.length; }).observe(recent, { childList: true, subtree: true });
			}
		}).observe({ type: "paint", buffered: true });
	})();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: page$, init, viewport: { width: 1440, height: 900 },
		beforeNavigate: (p) => p.route("**/usercard.js", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 500));
			// 真实站点的头像加载完之前带 .skeleton（站点脚本加载完才摘掉）
			await route.fulfill({ status: 200, contentType: "application/javascript", body: `window.__cardAt = performance.now(); document.getElementById("usercard-me").outerHTML = ${JSON.stringify(card.replace('class="avatar-normal"', 'class="avatar-normal skeleton"'))};` });
		})
	});
	try {
		await page.waitForFunction(() => window.__first);
		const early = await page.evaluate(() => ({ first: window.__first, cardAt: window.__cardAt, mask: window.__maskSet, hold: performance.getEntriesByName("nsmax:render-hold").length, domInteractive: performance.getEntriesByType("navigation")[0].domInteractive }));
		assert.equal(early.hold, 1, "脚本在页面解析前运行：用浏览器的渲染阻塞等页面解析完");
		assert.equal(early.mask, false, "不再先藏主体再淡入");
		assert.ok(early.first.at >= early.cardAt, `站点画好资料卡之后才画第一帧：首帧 ${early.first.at.toFixed(0)}ms，资料卡 ${early.cardAt.toFixed(0)}ms`);
		assert.equal(early.first.skeleton, false);
		assert.equal(early.first.account, true, "第一帧里资料卡已经整理好");
		assert.equal(early.first.hot, true, "第一帧里今日热门已经在（没有缓存时是骨架）");
		// 热榜数据有时比第一帧先到（测试里接口回得快）：第一帧里是 10 行骨架，或者已经是 10 行真数据
		assert.equal(early.first.hotSkeletonRows + early.first.hotRealRows, 10);
		assert.equal(early.first.recent, 4, "第一帧里最近浏览已经在");
		assert.deepEqual(early.first.order, ["card", "hot", "recent"]);
		// 模块挂载后：热榜换成模块的面板、拿到数据；最近浏览原地接管、不重画
		await page.waitForSelector(".nsmax-hot-panel:not([data-nsmax-hot-early]) .nsmax-hot-text");
		await wait(page, 400);
		const later = await page.evaluate(() => ({
			hotPanels: document.querySelectorAll(".nsmax-hot-panel").length,
			recentPanels: document.querySelectorAll(".nsmax-recent-panel").length,
			sameRecent: document.querySelector(".nsmax-recent-panel") === window.__earlyRecent,
			churn: window.__recentChurn || 0,
			height: document.querySelector(".nsmax-hot-panel").getBoundingClientRect().height,
			rowH: Array.from(document.querySelectorAll(".nsmax-hot-list > li"), (li) => Math.round(li.getBoundingClientRect().height * 2) / 2),
			animations: document.getAnimations().filter((a) => a.effect?.target?.closest?.("#nsk-right-panel-container") && a.animationName === "nsmax-appear").length,
			skeletonAvatar: document.querySelectorAll(".nsmax-sb-account img.skeleton").length,
			holdLink: !!document.getElementById("nsmax-render-hold")
		}));
		assert.equal(later.hotPanels, 1);
		assert.equal(later.recentPanels, 1);
		assert.equal(later.sameRecent, true, "最近浏览是页面解析阶段画的那一个");
		assert.equal(later.churn, 0, "模块接管时最近浏览不重画");
		assert.equal(new Set(later.rowH).size, 1, `热榜真实行一样高：${later.rowH}`);
		if (early.first.hotSkeletonRows) assert.deepEqual([...new Set(early.first.rowH)], [later.rowH[0]], `骨架行和真实行一样高：${early.first.rowH[0]} / ${later.rowH[0]}`);
		assert.ok(Math.abs(later.height - early.first.height) <= 1, `热榜拿到数据前后同样高：${early.first.height} → ${later.height}`);
		assert.equal(later.animations, 0, "侧栏卡片不再各自淡入");
		assert.equal(later.skeletonAvatar, 0, "资料卡复制的头像不带站点的加载闪烁（深色模式下会无限循环）");
		assert.equal(later.holdLink, false, "页面解析完把渲染阻塞的标记拿掉");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("页面更顺滑（2026-10-18）：主题里没有最右边是多参数 :is() 的选择器（每次整页重算样式都要拿每个元素试一遍），选中文字颜色只挂在 html 上", async () => {
	// Windows 上 git（core.autocrlf）检出的文件是 CRLF
	const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "nodeseek-max.user.js"), "utf8").replace(/\r\n?/g, "\n");
	const themeLine = source.split("\n").find((line) => line.startsWith("\tvar nsmax_theme_segments = "));
	const css = JSON.parse(themeLine.slice("\tvar nsmax_theme_segments = ".length, -1)).map(([, part]) => part).join("");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-sb-account");
		const state = await page.evaluate((css) => {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(css);
			const splitTop = (text) => { const out = []; let depth = 0, cur = ""; for (const c of text) { if (c === "(" || c === "[") depth++; if (c === ")" || c === "]") depth--; if (!depth && c === ",") { out.push(cur); cur = ""; continue; } cur += c; } out.push(cur); return out; };
			const slow = [];
			let selection = [];
			const walk = (rules) => { for (const rule of rules) {
				if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
				if (!rule.selectorText) continue;
				for (const part of splitTop(rule.selectorText)) {
					// 最右边一段：最后一个括号外的组合符之后
					const text = part.trim();
					let depth = 0, cut = -1;
					for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === "(" || c === "[") depth++; else if (c === ")" || c === "]") depth--; else if (!depth && " >+~".includes(c)) cut = i; }
					const last = text.slice(cut + 1);
					if (/^:is\(/.test(last)) {
						let level = 0, end = -1;
						for (let i = 3; i < last.length; i++) { if (last[i] === "(") level++; else if (last[i] === ")" && --level === 0) { end = i; break; } }
						const args = splitTop(last.slice(4, end)).map((arg) => arg.trim());
						let rest = "", d = 0;
						for (const c of last.slice(end + 1)) { if (c === "(") d++; else if (c === ")") d--; else if (!d) rest += c; }
						// :is(#…, *) 这种特异度垫片什么都匹配，等同于 *，不算
						if (args.length > 1 && !args.includes("*") && !/[.#[]/.test(rest)) slow.push(text.slice(-120));
					}
					if (/::selection/.test(part) && !/CodeMirror/.test(part)) selection.push(part.trim());
				}
			} };
			walk(sheet.cssRules);
			const deep = document.querySelector(".post-list-item .post-title a");
			return { slow, selection, deepBg: getComputedStyle(deep, "::selection").backgroundColor, rootBg: getComputedStyle(document.documentElement, "::selection").backgroundColor };
		}, css);
		assert.deepEqual(state.slow, [], "最右边的多参数 :is() 都拆成了能分桶的选择器");
		// 慢的是「任意后代 ::selection」（html ::selection：每次整页重算样式给每个元素算一份）；按标签名、类名挂的
		// （textarea::selection、楼中楼「楼主」小标签的反色，2026-10-24）只算那几种元素，不算
		const bare = state.selection.map((sel) => sel.replace(/\([^)]*\)/g, ""));
		assert.deepEqual(bare.filter((sel) => /(^|[\s>+~])::selection$/.test(sel)), [], "没有任意后代的 ::selection 规则：" + bare.join(" | "));
		assert.ok(bare.some((sel) => /^html\[data-nsmax-theme\][^ ]*::selection$/.test(sel)), `html 本身上挂了一条：${bare.join(" | ")}`);
		assert.equal(state.deepBg, state.rootBg, "页面深处的文字选中颜色和 html 上的一样（高亮继承）");
		assert.notEqual(state.deepBg, "rgba(0, 0, 0, 0)");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("页面更顺滑（2026-10-18）：站点自己改动页面时（如置顶轮播换一条），脚本不再把没变的属性重写一遍", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-sb-account");
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await wait(page, 1500);
		const records = await page.evaluate(async () => {
			const seen = [];
			const observer = new MutationObserver((list) => { for (const r of list) if (r.type === "attributes" && r.oldValue === r.target.getAttribute(r.attributeName)) seen.push(`${r.target.tagName.toLowerCase()}.${String(r.target.className?.baseVal ?? r.target.className).split(" ")[0]}[${r.attributeName}]`); });
			observer.observe(document.body, { attributes: true, attributeOldValue: true, subtree: true });
			// 模拟站点脚本插入、删除节点（真实站点的置顶轮播每隔几秒换一条），触发脚本的整理
			for (let i = 0; i < 3; i++) {
				const marker = document.createElement("div");
				marker.className = "nsmax-test-churn";
				document.querySelector("#nsk-body-left").append(marker);
				await new Promise((resolve) => setTimeout(resolve, 700));
				marker.remove();
				await new Promise((resolve) => setTimeout(resolve, 700));
			}
			observer.disconnect();
			return seen;
		});
		assert.deepEqual([...new Set(records)], [], "没有「写入同样的值」的属性变动");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-10-18 第五批（用户图一到图五）
test("第五批（2026-10-18）：置顶回复的绿色图钉换成墨色「置顶」小标；楼中楼「@某某 #楼号」后面换行时内容接在冒号后面；温馨提醒和正文左右对齐", async () => {
	const html = floorPost()
		.replace('<a href="/post-1000-1#1" target="_self">#1</a> 价格不错，帮顶', '<a href="/post-1000-1#1" target="_self">#1</a><br>\n价格不错，帮顶')
		.replace('<a href="#1" class="floor-link">', '<svg title="置顶" class="iconpark-icon pined-comment-badge"><use href="#pin"></use></svg> <a href="#1" class="floor-link">')
		.replace("</article>", '</article><div><div class="risk-alert"><svg class="risk-alert__icon" viewBox="0 0 16 16"><path d="M8 1 15 14H1Z"></path></svg><span class="risk-alert__text">『温馨提醒』检测到楼主用户等级在lv1以下，交易需要通过中介，禁止发起拼车</span><button class="risk-alert__close"> × </button></div></div>');
	assert.ok(html.includes("pined-comment-badge") && html.includes("risk-alert") && html.includes("#1</a><br>"), "夹具改写生效");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-floor-box .nsmax-fb-who");
		await page.waitForSelector(".author-info > .nsmax-pin-tag");
		await wait(page, 400);
		const state = await page.evaluate(() => {
			const pin = document.querySelector(".author-info > .nsmax-pin-tag");
			const alert = document.querySelector(".risk-alert");
			const article = document.querySelector(".nsk-post article.post-content").getBoundingClientRect();
			const box = alert.getBoundingClientRect();
			const br = document.querySelector(".nsmax-floor-box br[data-nsmax-fb-lead]");
			const who = br?.closest("p")?.querySelector(".nsmax-fb-who");
			const range = document.createRange();
			const text = Array.from(br?.closest("p")?.childNodes || []).find((node) => node.nodeType === 3 && node.data.includes("价格不错"));
			if (text) range.selectNodeContents(text);
			return {
				badge: getComputedStyle(document.querySelector(".pined-comment-badge")).display,
				pin: { text: pin.textContent, bg: getComputedStyle(pin).backgroundColor, radius: parseFloat(getComputedStyle(pin).borderTopLeftRadius) >= 9 },
				br: br && getComputedStyle(br).display,
				sameLine: !!(who && text) && Math.abs(range.getBoundingClientRect().top - who.getBoundingClientRect().top) < 4,
				alert: { left: Math.round(box.left - article.left), right: Math.round(box.right - article.right), top: getComputedStyle(alert).marginTop, accent: getComputedStyle(alert).borderLeftWidth, radius: getComputedStyle(alert).borderTopLeftRadius }
			};
		});
		assert.equal(state.badge, "none", "站点的绿色圆底图钉藏起来");
		assert.deepEqual(state.pin, { text: "置顶", bg: "rgb(28, 28, 30)", radius: true }, "墨色小标（和黄色的「楼主」分得清）");
		assert.equal(state.br, "none", "「@某某 #楼号」后面的换行藏起来");
		assert.equal(state.sameLine, true, "内容接在「名字：」后面，不掉到下一行");
		assert.deepEqual(state.alert, { left: 0, right: 0, top: "12px", accent: "3px", radius: "8px" }, "温馨提醒和正文左右对齐，左边 3px 警示色");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第五批（2026-10-18）：侧栏卡片之间一样宽；回复框间距（2026-10-24 起照 sb.sb：标题栏下 14px、按钮下 8px、输入框下 22px、底 16px）；编辑器里的链接不是绿色；主帖「点赞」那一排先留好位置", async () => {
	const list = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, init: `if (window.top === window) localStorage.setItem("nsmax:recent:1", JSON.stringify([{ path: "/post-9000-1", title: "以前浏览的帖子" }]))` });
	try {
		await list.page.waitForSelector(".nsmax-hot-panel .nsmax-hot-text");
		await list.page.waitForSelector(".nsmax-recent-panel li");
		await wait(list.page, 400);
		const gaps = await list.page.evaluate(() => {
			const cards = Array.from(document.getElementById("nsk-right-panel-container").children).filter((el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0);
			return cards.slice(1).map((card, i) => Math.round(card.getBoundingClientRect().top - cards[i].getBoundingClientRect().bottom));
		});
		assert.ok(gaps.length >= 2, JSON.stringify(gaps));
		assert.equal(new Set(gaps).size, 1, `卡片之间一样宽：${gaps}`);
		assert.deepEqual(list.errors, []);
	} finally { await list.context.close(); }
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await post.page.waitForSelector(".md-editor .nsmax-editor-controls");
		await wait(post.page, 300);
		const state = await post.page.evaluate(() => {
			const editor = document.querySelector(".md-editor");
			const head = editor.querySelector(".nsmax-editor-head").getBoundingClientRect();
			const controls = editor.querySelector(".nsmax-editor-controls").getBoundingClientRect();
			const surface = editor.querySelector(".nsmax-editor-surface").getBoundingClientRect();
			editor.insertAdjacentHTML("beforeend", '<div class="CodeMirror cm-s-nsk nsmax-test-cm"><span class="cm-link">[#6]</span><span class="cm-url">(https://www.nodeseek.com/post-1-1#6)</span><span class="cm-header cm-header-1"># 标题</span></div>');
			const cm = editor.querySelector(".nsmax-test-cm");
			const colors = ["cm-link", "cm-url", "cm-header-1"].map((name) => getComputedStyle(cm.querySelector("." + name)).color);
			cm.remove();
			const op = document.querySelector(".nsk-post .content-item");
			op.insertAdjacentHTML("beforeend", '<div class="comment-menu-mount"></div>');
			const mount = op.querySelector(":scope > .comment-menu-mount");
			const reserved = Math.round(mount.getBoundingClientRect().height);
			mount.remove();
			const submit = editor.querySelector("button.submit").getBoundingClientRect();
			return { above: Math.round(controls.top - head.bottom), below: Math.round(surface.top - controls.bottom), toSubmit: Math.round(submit.top - surface.bottom), bottom: Math.round(editor.getBoundingClientRect().bottom - submit.bottom), colors, reserved };
		});
		// 2026-10-24 起照 sb.sb .reply-panel 量的：标题栏下 14px 是工具按钮，按钮下 8px 是输入框，输入框下 22px 是发送按钮，按钮下 16px
		assert.equal(state.above, 14);
		assert.equal(state.below, 8, "工具按钮和输入框之间 8px（sb.sb .grid）");
		assert.equal(state.toSubmit, 22, "输入框和发送按钮之间 22px");
		assert.ok(Math.abs(state.bottom - 16) <= 1, "发送按钮下面 16px：" + state.bottom);
		assert.ok(!state.colors.includes("rgb(13, 188, 121)") && !state.colors.includes("rgb(46, 164, 79)"), `不再是站点的绿色：${state.colors}`);
		assert.equal(state.reserved, 52, "站点的空占位按「点赞」那一排画好后的高度先撑开");
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
});

test("第五批（2026-10-18）：点「回复」时页面不跳；清空草稿先确认、提示「已清空草稿」；标题栏状态「提交中」「已回复」；打开时编辑器里有草稿提示「已恢复未发出的草稿」", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-floor-actions .menu-item[data-nsmax-action=reply]");
		await wait(page, 400);
		// 点楼层「回复」：编辑器挪到那一层下面；站点接着调用不带参数的 scrollIntoView()——编辑器看得见时不再把它顶到窗口最上面
		const reply = page.locator("ul.comments > li.content-item .nsmax-floor-actions .menu-item[data-nsmax-action=reply]").first();
		await reply.scrollIntoViewIfNeeded();
		await reply.click();
		await page.waitForSelector("ul.comments > li.content-item[data-nsmax-replying] .md-editor");
		await page.evaluate(() => document.querySelector(".md-editor").scrollIntoView({ block: "center", behavior: "instant" }));
		await wait(page, 200);
		const before = await page.evaluate(() => scrollY);
		await page.evaluate(() => document.querySelector(".md-editor").scrollIntoView());
		await wait(page, 700);
		assert.equal(await page.evaluate(() => scrollY), before, "编辑器整个看得见：不滚");
		await page.locator(".nsmax-reply-cancel").click();
		// 清空草稿：先问一句（站点的确认框；夹具里没有，退回浏览器确认框），确定后清空、提示「已清空草稿」
		const input = page.locator(".md-editor textarea").first();
		await input.fill("写了一半的回复");
		await page.locator(".nsmax-draft-clear").click({ trial: true });
		page.once("dialog", (dialog) => dialog.accept());
		await page.locator(".nsmax-draft-clear").click();
		await page.waitForFunction(() => document.querySelector(".nsmax-toast")?.textContent === "已清空草稿");
		assert.equal(await input.inputValue(), "");
		// 状态字：说两句 → 提交中（点发送）→ 已回复（站点发出去后清空编辑器）
		assert.equal(await page.locator(".nsmax-editor-status").innerText(), "说两句");
		await input.fill("测试回复内容");
		await page.locator(".md-editor :is(.topic-select, .submit-row) > button.submit").click();
		assert.equal(await page.locator(".nsmax-editor-status").innerText(), "提交中");
		await input.fill("");
		await page.waitForFunction(() => document.querySelector(".nsmax-editor-status")?.textContent === "已回复");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 打开时编辑器里已经有内容（站点放回了没发出去的草稿）：提示「已恢复未发出的草稿」
	const draft = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage().replace('<textarea placeholder="说点什么…" aria-label="回复内容"></textarea>', '<textarea placeholder="说点什么…" aria-label="回复内容">上次没发出去的草稿</textarea>'), viewport: { width: 1440, height: 900 } });
	try {
		await draft.page.waitForFunction(() => document.querySelector(".nsmax-toast")?.textContent === "已恢复未发出的草稿", null, { timeout: 5e3 });
		const toast = await draft.page.evaluate(() => { const t = document.querySelector(".nsmax-toast"); const cs = getComputedStyle(t); return { bottom: cs.bottom, radius: cs.borderTopLeftRadius, size: cs.fontSize, padding: cs.padding }; });
		assert.deepEqual(toast, { bottom: "24px", radius: "12px", size: "13.5px", padding: "9px 16px" }, "sb.sb .toast：屏幕下方 24px、12px 圆角、13.5px、9px 16px");
		assert.deepEqual(draft.errors, []);
	} finally { await draft.context.close(); }
});

// 2026-10-18 第六批
test("第六批（2026-10-18）：资料卡里有「管理记录」和「屏蔽」（确认后加进站点黑名单，脚本的屏蔽名单一起改，他的帖子马上藏起来）", async () => {
	const posted = [];
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(), viewport: { width: 1440, height: 900 },
		beforeNavigate: (p) => p.route("**/api/block-list/add", async (route) => {
			posted.push(route.request().postDataJSON());
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
		})
	});
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.locator("ul.post-list>li>a:has(img)").first().hover();
		await page.waitForSelector(".nsmax-person-pop dd");
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-block");
		const card = await page.evaluate(() => {
			const pop = document.querySelector(".nsmax-person-pop");
			const actions = Array.from(pop.querySelectorAll(".nsmax-person-actions > :is(a, button)"));
			return {
				labels: actions.map((el) => el.textContent.trim()),
				foot: Array.from(pop.querySelectorAll(".nsmax-person-foot > button"), (el) => el.textContent.trim()),
				oneRow: new Set(actions.map((el) => Math.round(el.getBoundingClientRect().top))).size === 1,
				widths: new Set(actions.map((el) => Math.round(el.getBoundingClientRect().width))).size
			};
		});
		assert.deepEqual(card.labels, ["关注", "私信", "主页"], "名字下面三个按钮（2026-10-18 第七批重排）");
		assert.deepEqual(card.foot, ["管理记录", "屏蔽"], "管理记录、屏蔽在底栏");
		assert.equal(card.oneRow, true);
		assert.equal(card.widths, 1, "三个按钮一样宽");
		assert.equal(await page.locator("ul.post-list > li.post-list-item").first().isVisible(), true);
		page.once("dialog", (dialog) => dialog.accept());
		await page.locator(".nsmax-person-pop .nsmax-person-block").click();
		await page.waitForFunction(() => document.querySelector(".nsmax-toast")?.textContent === "已屏蔽 user0");
		assert.deepEqual(posted, [{ block_member_name: "user0" }], "站点黑名单按用户名加上");
		assert.equal(await page.locator(".nsmax-person-pop .nsmax-person-block").innerText(), "已屏蔽");
		await page.waitForFunction(() => getComputedStyle(document.querySelector("ul.post-list > li.post-list-item")).display === "none" || document.querySelector("ul.post-list > li.post-list-item").hidden);
		assert.ok(calls["/api/block-list/list"] >= 1, "按站点黑名单显示屏蔽状态");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.39 个人主页加右栏（照 sb.sb /u/…/）：主栏 + 260px 右栏（自己的资料卡、今日热门），顶边和资料卡对齐；手机上不显示右栏、不撑出横向滚动", async () => {
	for (const width of [1440, 390]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".nsmax-space-top");
			await page.waitForSelector("#nsk-right-panel-container .user-card", { state: "attached" });
			if (width === 1440) await page.waitForSelector("#nsk-right-panel-container .nsmax-hot-panel");
			const layout = await page.evaluate(() => {
				const box = (el) => el.getBoundingClientRect();
				const side = document.getElementById("nsk-right-panel-container"), main = document.querySelector("#nsk-frame > .nsk-container"), head = document.querySelector(".head-container");
				return {
					visible: getComputedStyle(side).display !== "none",
					sideWidth: Math.round(box(side).width),
					gap: Math.round(box(side).left - box(main).right),
					topAligned: Math.abs(box(side).top - box(head).top) <= 1,
					card: side.querySelector(".user-card .Username")?.textContent,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			if (width === 1440) {
				assert.equal(layout.visible, true);
				assert.equal(layout.sideWidth, 260);
				assert.equal(layout.gap, 20, "主栏和右栏之间 20px");
				assert.equal(layout.topAligned, true, "右栏顶边和资料卡对齐");
				assert.equal(layout.card, "tester", "右栏是自己的资料卡（sb.sb 一样）");
			} else assert.equal(layout.visible, false, "手机上不显示右栏");
			assert.equal(layout.overflow, 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.39 个人主页统计照 sb.sb .user-stats：九格三列靠左，自己的主页能点进关注、粉丝、账簿、星辰明细、等级进度；等级进度按鸡腿算", async () => {
	const detail = { member_id: 1, member_name: "Steve", rank: 3, coin: 1257, stardust: 26, nPost: 100, nComment: 873, follows: 11, fans: 155, collectionCount: 42, created_at: new Date(Date.now() - 659 * 864e5 - 6e5).toISOString() };
	const read = () => {
		const block = document.querySelector(".head-container > .card-block");
		const cells = Array.from(block.children);
		return {
			cells: cells.map((c) => [c.querySelector(".nsmax-user-stat-label")?.textContent, c.querySelector(".nsmax-user-stat-value")?.textContent, c.getAttribute("href")]),
			columns: new Set(cells.map((c) => Math.round(c.getBoundingClientRect().left))).size,
			// 靠左：每格的数字从格子左边开始（格子比数字宽得多）
			left: cells.every((c) => { const value = c.querySelector(".nsmax-user-stat-value").getBoundingClientRect(), box = c.getBoundingClientRect(); return Math.abs(value.left - box.left) <= 1 && box.width > value.width + 20; }),
			progress: [".nsmax-space-progress-level", ".nsmax-space-progress-percent", ".nsmax-space-progress-next"].map((s) => document.querySelector(s).textContent),
			bar: document.querySelector(".nsmax-space-progress > i > b").style.width
		};
	};
	// 自己的主页（测试里登录的是 1 号）
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/1", { html: nativeSpacePage(), api: { "/api/account/getInfo/1": [{ status: 200, body: { success: true, detail } }] } });
		try {
			await page.waitForFunction(() => document.querySelector(".head-container .card-block .nsmax-user-stat-value")?.textContent === "11");
			const stats = await page.evaluate(read);
			assert.deepEqual(stats.cells, [
				["关注", "11", "/fans?type=follow"], ["粉丝", "155", "/fans?type=fans"], ["鸡腿", "1257", "/credit"],
				["星辰", "26", "/stardust/list"], ["主题", "100", "#/discussions"], ["回帖", "873", "#/comments"],
				["收藏", "42", "#/collections"], ["等级", "Lv.3", "/progress"], ["注册天数", "659", null]
			]);
			assert.equal(stats.columns, 3, "九格排三列");
			assert.equal(stats.left, true, "每格靠左（sb.sb .user-stat）");
			assert.deepEqual(stats.progress, ["Lv.3 渐入佳境", "51%", "Lv.4 小有成就 还差 343"], "Lv.3 要 900、Lv.4 要 1600：1257 走了 51%");
			assert.equal(stats.bar, "51%");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 别人的主页：只有主题、回帖能点（关注列表、账簿、星辰明细、等级进度站点只给看自己的）；接口没回来之前页面上有的五个数先写上
	{
		// 页面里记下九格第一次画出来时的样子（不靠测试轮询的时机：全量跑时页面慢，轮询到的时候接口可能已经回来了）
		const init = `(() => {
			window.__firstStats = null;
			new MutationObserver((records, observer) => {
				const cells = document.querySelectorAll(".head-container > .card-block > .nsmax-user-stat");
				if (!cells.length) return;
				window.__firstStats = Array.from(cells, (c) => [c.querySelector(".nsmax-user-stat-label").textContent, c.querySelector(".nsmax-user-stat-value").textContent]);
				observer.disconnect();
			}).observe(document, { childList: true, subtree: true });
		})();`;
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage(), init, api: { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail: { ...detail, member_id: 10 } }, delay: 1500 }] } });
		try {
			await page.waitForFunction(() => window.__firstStats);
			assert.deepEqual(await page.evaluate(() => window.__firstStats), [["关注", "—"], ["粉丝", "—"], ["鸡腿", "1257"], ["星辰", "—"], ["主题", "100"], ["回帖", "873"], ["收藏", "—"], ["等级", "Lv.3"], ["注册天数", "659"]], "九格一开始就排好，没有的先写「—」");
			await page.waitForFunction(() => document.querySelector(".head-container .card-block .nsmax-user-stat-value")?.textContent === "11");
			const stats = await page.evaluate(read);
			assert.deepEqual(stats.cells.filter(([, , href]) => href).map(([label, , href]) => [label, href]), [["主题", "#/discussions"], ["回帖", "#/comments"]]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.39 列表里「我的回复」那一行第一帧就在：页面解析时按本机记录放好，不等模块启动（以前第一帧之后才插，回复过的那几篇高出一截，下面整列往下跳）", async () => {
	const html = listPage();
	const ids = [...new Set(Array.from(html.matchAll(/href="\/post-(\d+)-1"/g), (m) => m[1]))].slice(0, 6);
	const seed = { "nspp:state:www.nodeseek.com:sb-my-replies": { "posts:1": { [ids[0]]: [3], [ids[2]]: [5, 12] } } };
	const init = `(() => {
		window.__atPrimary = -1;
		const mark = performance.mark.bind(performance);
		performance.mark = (name, ...rest) => { if (name === "nsmax:primary-ready") window.__atPrimary = document.querySelectorAll("ul.post-list .nsmax-my-replies").length; return mark(name, ...rest); };
		window.__shifts = [];
		new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ t: e.startTime, v: e.value }); }).observe({ type: "layout-shift", buffered: true });
	})();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, seed, init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => window.__atPrimary >= 0 && document.querySelectorAll("ul.post-list .nsmax-my-replies").length === 2);
		await page.waitForTimeout(600);
		const result = await page.evaluate(() => {
			const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime || 0;
			return {
				atPrimary: window.__atPrimary,
				rows: Array.from(document.querySelectorAll("ul.post-list .nsmax-my-replies"), (el) => [el.closest("li.post-list-item").querySelector(".post-title a").getAttribute("href"), el.textContent]),
				shifts: window.__shifts.filter((s) => s.t > fcp).reduce((sum, s) => sum + s.v, 0)
			};
		});
		assert.equal(result.atPrimary, 2, "模块启动之前（页面解析阶段）就放好了");
		assert.deepEqual(result.rows, [[`/post-${ids[0]}-1`, "我的回复#3"], [`/post-${ids[2]}-1`, "我的回复#5#12"]]);
		assert.equal(result.shifts, 0, "第一帧之后列表不再跳");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第六批（2026-10-18）：我的回复——帖子页记下自己的楼层，回复区标题栏「N 条回复」后面列出「我的回复 #1」，点了就地跳过去；列表里这一篇下面也有一行", async () => {
	const post = postPage().replaceAll('href="/space/11"', 'href="/space/1"');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: post, viewport: { width: 1440, height: 900 }, pages: { "/": listPage() } });
	try {
		await page.waitForSelector(".comment-container .nsmax-reply-title + .nsmax-my-replies a");
		const bar = await page.evaluate(() => {
			const row = document.querySelector(".comment-container .nsmax-my-replies");
			const head = row.parentElement, title = head.querySelector(":scope > .nsmax-reply-title");
			const box = (el) => el.getBoundingClientRect();
			const buttons = Array.from(head.querySelectorAll(":scope > :is(button, a.nsmax-jump-reply)"));
			return {
				text: row.textContent, links: Array.from(row.querySelectorAll("a"), (a) => a.getAttribute("href")),
				count: document.querySelectorAll(".nsmax-my-replies").length,
				inHead: head.matches(".comment-container > :first-child") && row.previousElementSibling === title,
				// 和标题同一行、紧跟在标题后面（标题栏的间距 10px），开关按钮还在最右边
				sameLine: Math.abs((box(row).top + box(row).bottom) / 2 - (box(title).top + box(title).bottom) / 2) <= 2,
				gap: Math.round(box(row).left - box(title).right),
				buttonsRight: buttons.every((button) => box(button).left > box(row).right + 40),
				headHeight: Math.round(box(head).height)
			};
		});
		assert.equal(bar.text, "我的回复#1");
		assert.deepEqual(bar.links, ["#1"], "这一楼已经在页面上：就地跳");
		assert.equal(bar.count, 1);
		assert.equal(bar.inHead, true, "在回复区标题栏里，接在「N 条回复」后面（2026-10-24：以前单独一行夹在两张卡片中间）");
		assert.equal(bar.sameLine, true, "和标题在同一行");
		assert.equal(bar.gap, 10);
		assert.equal(bar.buttonsRight, true, "只看楼主、直达底部、简洁模式还在右边");
		assert.ok(bar.headHeight <= 52, `标题栏没有被撑高：${bar.headHeight}px`);
		await page.setViewportSize({ width: 390, height: 844 });
		const narrow = await page.evaluate(() => {
			const row = document.querySelector(".comment-container .nsmax-my-replies"), head = row.parentElement;
			const box = (el) => el.getBoundingClientRect();
			return { inside: box(row).right <= box(head).right + 0.5 && box(row).left >= box(head).left - 0.5, overflow: head.scrollWidth - head.clientWidth, below: box(row).top >= box(head.querySelector(":scope > .nsmax-reply-title")).bottom };
		});
		assert.deepEqual(narrow, { inside: true, overflow: 0, below: true }, "手机上标题栏放不下：「我的回复」换到下面一行，不撑出横向滚动");
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("https://www.nodeseek.com/", { waitUntil: "domcontentloaded" });
		await page.waitForSelector("ul.post-list .nsmax-my-replies a");
		const row = await page.evaluate(() => {
			const item = document.querySelector("ul.post-list .nsmax-my-replies").closest("li.post-list-item");
			return { title: item.querySelector(".post-title a").getAttribute("href"), links: Array.from(item.querySelectorAll(".nsmax-my-replies a"), (a) => a.getAttribute("href")) };
		});
		assert.deepEqual(row, { title: "/post-1000-1", links: ["/post-1000-1#1"] });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第六批（2026-10-18）：标题后面的等级锁和标题文字中线对齐、离标题近一点；抽奖页不显示「搜索 抽奖」那一行", async () => {
	const lock = ' <span style="color: rgb(255 152 152); font-family: sans-serif;"><svg class="iconpark-icon" style="vertical-align: baseline"><use href="#lock"></use></svg>1 </span>';
	const html = listPage().replace("求推荐稳定的美西 VPS</a>", "求推荐稳定的美西 VPS</a>" + lock);
	assert.ok(html.includes("#lock"));
	const list = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 1440, height: 900 } });
	try {
		await list.page.waitForSelector(".post-title > span[data-nsmax-lock]");
		await wait(list.page, 300);
		const state = await list.page.evaluate(() => {
			const span = document.querySelector(".post-title > span[data-nsmax-lock]");
			const link = span.parentElement.querySelector("a");
			const range = document.createRange();
			range.selectNodeContents(link);
			const rects = Array.from(range.getClientRects());
			const last = rects[rects.length - 1];
			const box = span.getBoundingClientRect();
			return { gap: box.left - last.right, diff: (box.top + box.bottom) / 2 - (last.top + last.bottom) / 2 };
		});
		assert.ok(Math.abs(state.diff) <= 1, `和标题文字中线对齐：差 ${state.diff.toFixed(1)}px`);
		assert.ok(state.gap <= 8, `离标题近一点：${state.gap.toFixed(1)}px`);
		assert.deepEqual(list.errors, []);
	} finally { await list.context.close(); }
	const view = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { html: searchPage({ count: 3 }), viewport: { width: 1440, height: 900 } });
	try {
		await view.page.waitForSelector(".nsmax-kind-tab[data-kind=lottery][data-nsmax-on]");
		await wait(view.page, 400);
		const summary = await view.page.evaluate(() => { const p = document.querySelector(".nsmax-search-summary"); return p ? getComputedStyle(p).display : "none"; });
		assert.equal(summary, "none", "抽奖页是分类，不是搜索结果");
		assert.deepEqual(view.errors, []);
	} finally { await view.context.close(); }
});

// 2026-10-18 打开更快
test("打开更快（2026-10-18）：长列表只画看得见的行——屏幕外的帖子行先不算样式、不排版，滚到附近再画，行高和预留的一样；刷新时不用（浏览器要按原来的滚动位置恢复）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ count: 50 }), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("html[data-nsmax-cv]");
		await page.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length > 0);
		await wait(page, 300);
		const rowsState = () => page.evaluate(() => {
			const rows = Array.from(document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item"));
			const drawn = (li) => li.querySelector(".post-title a").checkVisibility({ contentVisibilityAuto: true });
			return {
				cv: getComputedStyle(rows[0]).contentVisibility,
				size: getComputedStyle(rows[0]).containIntrinsicHeight,
				first: drawn(rows[0]),
				last: drawn(rows[rows.length - 1]),
				heights: rows.map((li) => Math.round(li.getBoundingClientRect().height))
			};
		});
		const before = await rowsState();
		assert.equal(before.cv, "auto");
		assert.equal(before.size, "auto 73px");
		assert.equal(before.first, true, "屏幕上的行照常画");
		assert.equal(before.last, false, "最下面的行先不画");
		await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
		await wait(page, 300);
		const after = await rowsState();
		assert.equal(after.last, true, "滚到附近就画出来");
		assert.ok(after.heights.every((height) => Math.abs(height - 73) <= 4), `行高和预留的 73px 差不多（CI 的 Linux 字体会高一两像素）：${[...new Set(after.heights)]}`);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForSelector("html[data-nsmax-theme]");
		assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-nsmax-cv")), false, "刷新时不用");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("打开更快（2026-10-18）：页面迟迟解析不完（站点脚本下载慢）时，首帧最多等 1.2 秒，之后照常边解析边画", async () => {
	const html = listPage().replace('<div id="nsk-right-panel-container">', '<script src="/slow-sync.js"></script><div id="nsk-right-panel-container">');
	assert.ok(html.includes("/slow-sync.js"));
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html, viewport: { width: 1440, height: 900 },
		beforeNavigate: (p) => p.route("**/slow-sync.js", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 3000));
			await route.fulfill({ status: 200, contentType: "application/javascript", body: "window.__slowLoaded = performance.now();" });
		})
	});
	try {
		await page.waitForFunction(() => window.__slowLoaded, null, { timeout: 1e4 });
		const t = await page.evaluate(() => ({
			fcp: performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint")?.startTime,
			hold: performance.getEntriesByName("nsmax:render-hold")[0]?.startTime,
			loaded: window.__slowLoaded
		}));
		assert.ok(t.hold >= 0, "脚本在页面解析前运行，用了渲染阻塞");
		assert.ok(t.fcp < t.loaded, `首帧没等那个慢脚本：首帧 ${t.fcp?.toFixed(0)}ms，脚本 ${t.loaded.toFixed(0)}ms`);
		assert.ok(t.fcp - t.hold >= 1100 && t.fcp - t.hold < 2200, `解析没完时最多等 1.2 秒：${(t.fcp - t.hold).toFixed(0)}ms`);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("打开更快（2026-10-18）：油猴注入得晚（页面先画出来才运行）时，设置「关于」里说明这一页是晚注入、按哪条改；第三次碰到时提示一次，之后不再提示；正常注入时不提示", async () => {
	const late = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, injectAfterPaint: true, seed: { "nsmax:hint:late-injection": 2 } });
	try {
		await late.page.waitForFunction(() => document.querySelector(".nsmax-toast")?.textContent.includes("UserScripts API Dynamic"), null, { timeout: 1e4 });
		assert.equal(await late.page.evaluate(() => JSON.parse(localStorage.getItem("__gm__:nsmax:hint:late-injection"))), -1, "提示过就不再提示");
		await late.page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		const host = late.page.locator("#nspp-settings");
		await host.getByRole("tab", { name: "关于" }).click();
		const timing = host.locator(".about-timing");
		assert.match(await timing.innerText(), /画出来之后才运行/);
		assert.equal(await timing.evaluate((element) => element.hasAttribute("data-late")), true);
		assert.match(await host.locator(".about-features li").last().innerText(), /UserScripts API Dynamic/);
		assert.deepEqual(late.errors, []);
	} finally { await late.context.close(); }
	const normal = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, seed: { "nsmax:hint:late-injection": 2 } });
	try {
		await normal.page.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length > 0);
		await wait(normal.page, 3200);
		assert.equal(await normal.page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-toast"), (toast) => toast.textContent).some((text) => text.includes("UserScripts"))), false, "正常注入不提示");
		assert.equal(await normal.page.evaluate(() => JSON.parse(localStorage.getItem("__gm__:nsmax:hint:late-injection"))), 2);
		await normal.page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		const host = normal.page.locator("#nspp-settings");
		await host.getByRole("tab", { name: "关于" }).click();
		assert.match(await host.locator(".about-timing").innerText(), /画出来之前就运行了/);
		assert.deepEqual(normal.errors, []);
	} finally { await normal.context.close(); }
});

// 2026-10-18 第七批
test("第七批（2026-10-18）：管理记录在资料卡里点开就查——普通账号不能按名字搜（站点提示 Not allowed to search），弹窗从最新的记录往前翻，列出这个人的处理（写法和站点管理记录页一样）", async () => {
	const row = (id, uid, name, request, extra = {}) => ({ id, request: JSON.stringify(request), admin_member_id: 9, admin_member_name: "酒神", target_member_id: uid, target_member_name: name, post_id: -1, comment_id: -1, floor_index: -1, created_at: new Date(Date.now() - id * 6e4).toISOString(), ...extra });
	const filler = (start, count) => Array.from({ length: count }, (_, i) => row(start + i, 999, "other", { target: { uid: 999 }, coin: { coin_diff: -5, reason: "灌水" } }));
	const page1 = [...filler(100, 19), row(1, 10, "user0", { target: { uid: 10 }, coin: { coin_diff: -10, reason: "引战" }, suspend: { status: true, value: 3 } })];
	const page2 = [...filler(200, 19), row(2, 10, "user0", { target: {}, hideComment: { status: true } }, { post_id: 1000, floor_index: 12 })];
	const page3 = filler(300, 5);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(), viewport: { width: 1440, height: 900 },
		api: {
			"/api/admin/ruling/page-1": [{ status: 200, body: { success: true, data: page1, total: 45 } }],
			"/api/admin/ruling/page-2": [{ status: 200, body: { success: true, data: page2, total: 45 } }],
			"/api/admin/ruling/page-3": [{ status: 200, body: { success: true, data: page3, total: 45 } }]
		}
	});
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.locator("ul.post-list>li>a:has(img)").first().hover();
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-ruling");
		await page.locator(".nsmax-person-pop .nsmax-person-ruling").click();
		await page.waitForFunction(() => /已查完/.test(document.querySelector("dialog.nsmax-ruling-dialog .nsmax-ruling-status")?.textContent || ""));
		const state = await page.evaluate(() => {
			const dialog = document.querySelector("dialog.nsmax-ruling-dialog");
			return {
				open: dialog.open,
				title: dialog.querySelector("h3").textContent,
				items: Array.from(dialog.querySelectorAll(".nsmax-ruling-item"), (item) => ({ action: Array.from(item.querySelectorAll(".nsmax-ruling-action > div"), (div) => div.textContent), link: item.querySelector(".nsmax-ruling-meta a")?.getAttribute("href") || "" })),
				status: dialog.querySelector(".nsmax-ruling-status").textContent,
				moreHidden: dialog.querySelector(".nsmax-dialog-foot > button.nsmax-dialog-button").hidden
			};
		});
		assert.equal(state.open, true);
		assert.equal(state.title, "user0 的管理记录");
		assert.deepEqual(state.items, [
			{ action: ["因“引战”被-10鸡腿", "用户被禁言3天"], link: "" },
			{ action: ["隐藏内容"], link: "/post-1000-2#12" }
		]);
		assert.match(state.status, /已查完最近 45 条.*找到 2 条/);
		assert.equal(state.moreHidden, true, "翻到头了不再显示「再往前查」");
		await page.keyboard.press("Escape");
		await page.waitForFunction(() => !document.querySelector("dialog.nsmax-ruling-dialog"));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：抽奖帖到了开奖时间，列表里的标签照 sb.sb 换成细线框灰字的「抽奖」+「已结束」；还没开奖的是红底「抽奖」", async () => {
	const past = Date.now() - 36e5, future = Date.now() + 864e5;
	const init = `if (window.top === window) { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1000": "lottery", "1001": "lottery" })); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1000": 1, "1001": 1 })); localStorage.setItem("nsmax:lottery-times", JSON.stringify({ "1000": ${past}, "1001": ${future} })); }`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, init });
	try {
		await page.waitForSelector(".post-list-item .nsmax-prize-badge");
		await wait(page, 300);
		const rows = await page.evaluate(() => Object.fromEntries(["1000", "1001"].map((id) => {
			const title = document.querySelector(`.post-list-item .post-title a[href^="/post-${id}-"]`)?.closest(".post-title");
			const badge = title?.querySelector(".nsmax-prize-badge");
			return [id, { ended: !!badge?.hasAttribute("data-ended"), tags: Array.from(title?.querySelectorAll(":scope > :is(.nsmax-prize-badge, .nsmax-ended-badge)") || [], (el) => el.textContent), bg: badge ? getComputedStyle(badge).backgroundColor : "" }];
		})));
		assert.deepEqual(rows["1000"].tags, ["抽奖", "已结束"]);
		assert.equal(rows["1000"].ended, true);
		assert.notEqual(rows["1000"].bg, "rgb(224, 83, 59)", "结束的不是红底");
		assert.deepEqual(rows["1001"].tags, ["抽奖"]);
		assert.equal(rows["1001"].ended, false);
		assert.equal(rows["1001"].bg, "rgb(224, 83, 59)", "还没开奖：红底");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：发帖页照 sb.sb /t/new/——右边有侧栏（资料卡）；表单顺序 版块（下面一行说明）→ 标题 → 内容 → 阅读限制 → 发布帖子、一键抽奖；提示字是「写下正文…」；按钮下面不再空一大截", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/new-discussion", { html: newPostPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("#nsk-body > #nsk-right-panel-container .nsmax-sb-account");
		await page.waitForSelector("#editor > .md-editor > .nsmax-new-hint");
		await wait(page, 300);
		const state = await page.evaluate(() => {
			const top = (selector) => Math.round(document.querySelector(selector).getBoundingClientRect().top);
			const card = document.querySelector("#editor > .md-editor").getBoundingClientRect();
			const submit = document.querySelector(".md-editor button.submit").getBoundingClientRect();
			const lucky = document.querySelector(".md-editor .nsmax-lucky-trigger").getBoundingClientRect();
			const side = document.getElementById("nsk-right-panel-container").getBoundingClientRect();
			return {
				order: [top("label[for='category']"), top(".nsmax-new-hint"), top("select#category"), top("#mde-title"), top("#editor-body"), top("label[for='rank']"), top("select#rank"), top(".md-editor button.submit")],
				hint: document.querySelector(".nsmax-new-hint").textContent,
				rulesHidden: getComputedStyle(document.querySelector("#nsk-body-left > .post-content")).display,
				placeholder: document.querySelector(".md-editor textarea").placeholder,
				sameRow: Math.abs(submit.top - lucky.top) < 2 && lucky.left > submit.right,
				bottomGap: Math.round(card.bottom - submit.bottom),
				sideRight: side.left >= card.right
			};
		});
		for (let i = 1; i < state.order.length; i++) assert.ok(state.order[i] > state.order[i - 1], `字段顺序：${state.order}`);
		assert.match(state.hint, /^请选择正确的版块：.*内版.*推广版块/);
		assert.equal(state.rulesHidden, "none", "「重要提醒」卡片收起（规则写在版块下面）");
		assert.equal(state.placeholder, "写下正文…", "站点的「鼓励友善发言，禁止人身攻击」换掉");
		assert.equal(state.sameRow, true, "发布帖子、一键抽奖同一行");
		assert.ok(state.bottomGap <= 22, `按钮下面只留卡片内边距：${state.bottomGap}px`);
		assert.equal(state.sideRight, true, "右边是侧栏");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：一键抽奖发出去以后，新帖子里自动补上开奖链接（按新帖子的编号生成 /lucky?post=…，用站点的编辑接口改正文），然后刷新", async () => {
	const time = Date.now() + 864e5;
	const md = ["## 🎁 抽奖", "", "- **奖品**：50 鸡腿", "- **中奖人数**：3 人", "- **开奖链接**：发布后自动生成"].join(String.fromCharCode(10));
	const postData = { postId: 1000, postPage: 1, postPageCount: 1, title: "【抽奖】50 鸡腿", rank: 0, comments: [{ floorIndex: 0, commentId: 1, markdown: md, poster: { uid: 1, name: "tester", isMe: true } }] };
	const html = postPage().replace(/window\.__config__\.postData = \{.*?\};/, () => `window.__config__.postData = ${JSON.stringify(postData)};`);
	assert.ok(html.includes("发布后自动生成"));
	const init = `if (window.top === window && !sessionStorage.getItem("nsmax-test-seeded")) { sessionStorage.setItem("nsmax-test-seeded", "1"); localStorage.setItem("nsmax:lucky:pending", JSON.stringify({ title: "【抽奖】50 鸡腿", time: ${time}, count: 3, start: 1, duplicate: false, at: Date.now() })); }`;
	const posted = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
		html, init, viewport: { width: 1440, height: 900 },
		beforeNavigate: (p) => p.route("**/api/content/edit-discussion", async (route) => {
			posted.push({ body: route.request().postDataJSON(), token: route.request().headers()["csrf-token"] });
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
		})
	});
	try {
		for (let i = 0; i < 60 && !posted.length; i++) await wait(page, 100);
		assert.equal(posted.length, 1, "只编辑一次");
		// 补完以后 0.6 秒刷新：等那次刷新真的发生再检查（以前固定等 0.8 秒，新页面加载慢一点就正好撞上刷新）
		const reloaded = page.waitForEvent("domcontentloaded", { timeout: 8000 });
		const { body, token } = posted[0];
		assert.equal(body.mode, "edit-discussion");
		assert.equal(body.postId, 1000);
		assert.equal(body.title, "【抽奖】50 鸡腿");
		assert.equal(body.rank, 0);
		assert.ok(body.content.includes(`- **开奖链接**：[查看开奖](https://www.nodeseek.com/lucky?post=1000&time=${time}&count=3&start=1&duplicate=false)`), body.content);
		assert.ok(!body.content.includes("发布后自动生成"));
		assert.match(token, /^[0-9a-f]{16}$/, "和站点编辑器一样带一个随机的 csrf-token");
		await reloaded;
		await wait(page, 800);
		assert.equal(await page.evaluate(() => localStorage.getItem("nsmax:lucky:pending")), null, "补完就清掉，不会重复编辑");
		assert.equal(posted.length, 1);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：签到页照 sb.sb /checkin/——「每日签到」卡（连续签到天数、今日获得 / 今日排名 / 本月签到 / 今日签到人数、本月日历）；哪天签过从账簿「签到收益N个鸡腿」算；排行里鸡腿数是「+N 鸡腿」小胶囊", async () => {
	const day = (offset) => new Date(Date.now() + 8 * 36e5 - offset * 864e5).toISOString().slice(0, 10);
	const at = (offset) => new Date(day(offset) + "T01:00:00Z").toISOString();
	const credit = [[9, 100, "签到收益9个鸡腿", at(0)], [1, 91, "回帖奖励", at(0)], [4, 90, "签到收益4个鸡腿", at(1)], [6, 86, "签到收益6个鸡腿", at(2)], [2, 80, "签到收益2个鸡腿", at(4)]];
	const signed = [0, 1, 2, 4].map(day).filter((d) => d.slice(0, 7) === day(0).slice(0, 7));
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/board", {
		html: boardRealPage(), viewport: { width: 1440, height: 900 },
		api: {
			"/api/attendance/board": [{ status: 200, body: { success: true, list: [], record: { gain: 2 }, order: 11872, total: 10402 } }],
			"/api/account/credit/page-1": [{ status: 200, body: { success: true, data: credit } }]
		}
	});
	try {
		await page.waitForSelector(".board > .nsmax-checkin");
		await page.waitForFunction(() => document.querySelector(".nsmax-checkin .nsmax-checkin-streak > b")?.textContent === "3");
		await page.waitForFunction(() => document.querySelector('.nsmax-checkin-stats > [data-key="total"] > dd')?.textContent === "10402");
		const state = await page.evaluate(() => ({
			first: document.querySelector(".board").firstElementChild.className,
			headHidden: getComputedStyle(document.querySelector(".board > .head-info")).display,
			stats: Array.from(document.querySelectorAll(".nsmax-checkin-stats > div"), (cell) => [cell.querySelector("dt").textContent, cell.querySelector("dd").textContent]),
			button: (({ textContent, disabled }) => ({ textContent, disabled }))(document.querySelector(".nsmax-checkin-button")),
			signedTiles: document.querySelectorAll(".nsmax-checkin-day[data-signed]").length,
			today: (({ signed, today }) => ({ signed, today }))({ signed: !!document.querySelector(".nsmax-checkin-day[data-today][data-signed]"), today: document.querySelectorAll(".nsmax-checkin-day[data-today]").length }),
			weekdays: Array.from(document.querySelectorAll(".nsmax-checkin-weekday"), (el) => el.textContent).join(""),
			coins: getComputedStyle(document.querySelector(".board .rank-row .coins"), "::after").content
		}));
		assert.equal(state.first, "nsmax-checkin", "卡片在排行榜上面");
		assert.equal(state.headHidden, "none", "站点那一行收进卡片");
		assert.deepEqual(state.stats, [["今日获得", "2 鸡腿"], ["今日排名", "第 11872"], ["本月签到", `${signed.length} 天`], ["今日签到人数", "10402"]]);
		assert.deepEqual(state.button, { textContent: "今日已签到", disabled: true });
		assert.equal(state.signedTiles, signed.length);
		assert.deepEqual(state.today, { signed: true, today: 1 });
		assert.equal(state.weekdays, "一二三四五六日");
		assert.equal(state.coins, '" 鸡腿"');
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：右栏比屏幕高时卡片不被压扁（以前签到页资料卡的「发帖」按钮、今日热门最后几条只剩半截），右栏自己滚动", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/board", { html: boardRealPage(), viewport: { width: 1440, height: 560 } });
	try {
		await page.waitForSelector("#nsk-right-panel-container .nsmax-sb-account");
		await page.waitForSelector("#nsk-right-panel-container .nsmax-hot-panel");
		await wait(page, 800);
		const cards = await page.evaluate(() => Array.from(document.getElementById("nsk-right-panel-container").children).filter((el) => el.offsetHeight > 0).map((el) => ({ cls: el.className, clipped: el.scrollHeight - el.clientHeight })));
		assert.ok(cards.length >= 2);
		assert.ok(cards.every((card) => card.clipped <= 1), JSON.stringify(cards));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第七批（2026-10-18）：字号照 sb.sb 统一——通知每一条的名字和列表标题一样大（以前 14px，比别的页面小一截）；输入框聚焦时提示字（2026-10-24 起照 sb.sb 照样显示）；回复框挂在某一层下面时按 Esc 放回底部", async () => {
	const note = await open(browser, "https://www.nodeseek.com/notification", { html: notificationPage(), viewport: { width: 1440, height: 900 } });
	try {
		await note.page.waitForSelector(".nsmax-notice-row .nspp-messages-peer-title > strong");
		const sizes = await note.page.evaluate(() => ({
			name: getComputedStyle(document.querySelector(".nsmax-notice-row .nspp-messages-peer-title > strong")).fontSize,
			list: getComputedStyle(document.documentElement).getPropertyValue("--nsmax-list-title").trim(),
			time: getComputedStyle(document.querySelector(".nsmax-notice-row .nspp-messages-peer-title > time")).fontSize
		}));
		assert.equal(sizes.name, sizes.list, `通知名字 = 列表标题字号：${JSON.stringify(sizes)}`);
		assert.equal(sizes.time, "12.5px");
		assert.deepEqual(note.errors, []);
	} finally { await note.context.close(); }
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width: 1440, height: 900 } });
	try {
		await post.page.waitForSelector(".md-editor .nsmax-editor-head");
		await wait(post.page, 300);
		const input = post.page.locator(".md-editor textarea");
		await input.focus();
		// 2026-10-24 起照 sb.sb：聚焦时提示字照样显示（原生输入框就是这样；光标和字一样高，不再压在提示字上）
		assert.equal(await input.evaluate((el) => getComputedStyle(el, "::placeholder").color), "rgb(85, 90, 106)", "聚焦时提示字照样是 --text-muted");
		await post.page.evaluate(() => document.querySelector("li[id='3'] .menu-item[title='回复']").addEventListener("click", () => {
			const box = document.querySelector(".md-editor textarea");
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "@curious [#3](https://www.nodeseek.com/post-1000-1#3) ");
			box.dispatchEvent(new Event("input", { bubbles: true }));
		}));
		await post.page.locator("li[id='3'] .menu-item[title='回复']").click();
		await post.page.waitForFunction(() => !!document.querySelector(".md-editor").closest("li.content-item"));
		await input.focus();
		await post.page.keyboard.press("Escape");
		await post.page.waitForFunction(() => !document.querySelector(".md-editor").closest("li.content-item"));
		assert.equal(await input.inputValue(), "", "只有「@某某 #楼号」时一起清掉");
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
});

// 2026-10-18 第八批
test("第八批（2026-10-18）：帖子页第 9 层以后（2026-10-24 以前是第 4 层）屏幕外先不画（content-visibility:auto）；直接打开 #10 照样停在那一层；回复框挂在哪一层，那一层照常画", async () => {
	let html = postPage();
	const third = html.match(/<li class="content-item" id="3">[\s\S]*?<\/li>/)[0];
	html = html.replace(third, third + Array.from({ length: 9 }, (_, i) => third.replace(/id="3"/, `id="${i + 4}"`).replace(/href="#3"/g, `href="#${i + 4}"`).replace(/>#3</g, `>#${i + 4}<`)).join(""));
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1#10", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => performance.getEntriesByName("nsmax:deferred-start").length > 0);
		await wait(page, 800);
		const state = await page.evaluate(() => {
			const floor = (id) => document.querySelector(`ul.comments > li[id='${id}']`);
			const box = floor("10").getBoundingClientRect();
			return { first: getComputedStyle(floor("8")).contentVisibility, later: getComputedStyle(floor("9")).contentVisibility, inView: box.top < innerHeight && box.bottom > 0 };
		});
		assert.deepEqual(state, { first: "visible", later: "auto", inView: true });
		await page.locator("li[id='11'] .menu-item[title='回复']").scrollIntoViewIfNeeded();
		await page.locator("li[id='11'] .menu-item[title='回复']").click();
		await page.waitForFunction(() => document.querySelector("ul.comments > li[id='11']").hasAttribute("data-nsmax-replying"));
		assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("ul.comments > li[id='11']")).contentVisibility), "visible", "回复框所在的那一层照常画（表情面板、上传弹出框不被裁掉）");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第八批（2026-10-18）：顶栏 NQ 照 sb.sb「论坛应用」按钮是黄底深色字（深色模式下也看得清）；签到页站点写着今天签过了、账簿里还没读到时，连续签到和本月签到也算上今天", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/board", { html: boardRealPage(), viewport: { width: 1440, height: 900 }, colorScheme: "dark", seed: { "nspp:settings:www.nodeseek.com": { "modern-theme": { enabled: true, colorMode: "dark" } } } });
	try {
		await page.waitForSelector("#nsk-head .nsmax-nq-tab");
		await page.waitForSelector(".board > .nsmax-checkin");
		await page.waitForFunction(() => document.querySelector(".nsmax-checkin .nsmax-checkin-streak > b")?.textContent === "1");
		const state = await page.evaluate(() => ({
			dark: document.documentElement.hasAttribute("data-nsmax-dark"),
			nq: (({ backgroundColor, color }) => ({ backgroundColor, color }))(getComputedStyle(document.querySelector("#nsk-head .nsmax-nq-tab"))),
			month: document.querySelector('.nsmax-checkin-stats > [data-key="month"] > dd').textContent,
			today: !!document.querySelector(".nsmax-checkin-day[data-today][data-signed]")
		}));
		assert.equal(state.dark, true);
		assert.deepEqual(state.nq, { backgroundColor: "rgb(255, 208, 47)", color: "rgb(28, 28, 30)" });
		assert.equal(state.month, "1 天");
		assert.equal(state.today, true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第九批（2026-10-18）：一键抽奖、管理记录弹窗——站点给 footer 的 #333 底和 width:100% 不再套上（按钮不被切掉）；一键抽奖宽屏两栏、预览就是帖子里那张抽奖卡片，不再套一层滚动", async () => {
	const footState = () => {
		const dialog = document.querySelector("dialog.nsmax-dialog[open]");
		const box = dialog.getBoundingClientRect();
		const foot = dialog.querySelector(".nsmax-dialog-foot");
		return {
			tag: foot.tagName,
			bg: getComputedStyle(foot).backgroundColor,
			footRight: Math.round(foot.getBoundingClientRect().right),
			buttonsRight: Math.max(...Array.from(foot.querySelectorAll("button, a"), (el) => el.hidden ? 0 : Math.round(el.getBoundingClientRect().right))),
			dialogRight: Math.round(box.right),
			headShadow: getComputedStyle(dialog.querySelector(".nsmax-dialog-head")).boxShadow
		};
	};
	for (const [width, mobile] of [[1440, false], [390, true]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/new-discussion", { html: newPostPage({ mobile }), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector(".nsmax-lucky-trigger");
			await page.locator(".nsmax-lucky-trigger").click();
			await page.waitForSelector("dialog.nsmax-lucky-dialog[open] .nsmax-lottery[data-nsmax-preview]");
			await page.locator("dialog.nsmax-lucky-dialog .nsmax-lucky-field input").first().fill("50 鸡腿");
			await wait(page, 300);
			const foot = await page.evaluate(footState);
			assert.notEqual(foot.tag, "FOOTER");
			assert.equal(foot.bg, "rgba(0, 0, 0, 0)", "脚栏不是站点给 footer 的 #333 灰底");
			assert.ok(foot.buttonsRight <= foot.dialogRight - 8, JSON.stringify(foot));
			assert.ok(foot.footRight <= foot.dialogRight, JSON.stringify(foot));
			assert.equal(foot.headShadow, "none");
			const layout = await page.evaluate(() => {
				const dialog = document.querySelector("dialog.nsmax-lucky-dialog");
				const form = dialog.querySelector(".nsmax-lucky-form").getBoundingClientRect();
				const side = dialog.querySelector(".nsmax-lucky-side").getBoundingClientRect();
				const preview = dialog.querySelector(".nsmax-lucky-preview");
				return {
					sideBy: side.left >= form.right,
					previewScroll: preview.scrollHeight - preview.clientHeight,
					prize: dialog.querySelector(".nsmax-lottery-prize").textContent,
					clock: dialog.querySelectorAll(".nsmax-lottery-seg").length,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.equal(layout.sideBy, !mobile, JSON.stringify(layout));
			assert.ok(layout.previewScroll <= 1, `预览不再套一层滚动：${layout.previewScroll}`);
			assert.equal(layout.prize, "50 鸡腿");
			assert.equal(layout.clock, 4);
			assert.ok(layout.overflow <= 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	const row = (id, uid, name, request) => ({ id, request: JSON.stringify(request), admin_member_id: 9, admin_member_name: "酒神", target_member_id: uid, target_member_name: name, post_id: -1, comment_id: -1, floor_index: -1, created_at: new Date(Date.now() - id * 6e4).toISOString() });
	const filler = (start, count) => Array.from({ length: count }, (_, i) => row(start + i, 999, "other", { target: { uid: 999 }, coin: { coin_diff: -5, reason: "灌水" } }));
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(), viewport: { width: 1440, height: 900 },
		api: { "/api/admin/ruling/page-1": [{ status: 200, body: { success: true, data: filler(100, 20) } }], "/api/admin/ruling/page-2": [{ status: 200, body: { success: true, data: filler(200, 3) } }] }
	});
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.locator("ul.post-list>li>a:has(img)").first().hover();
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-ruling");
		await page.locator(".nsmax-person-pop .nsmax-person-ruling").click();
		await page.waitForFunction(() => /已查完/.test(document.querySelector("dialog.nsmax-ruling-dialog .nsmax-ruling-status")?.textContent || ""));
		const foot = await page.evaluate(footState);
		assert.equal(foot.bg, "rgba(0, 0, 0, 0)");
		assert.ok(foot.buttonsRight <= foot.dialogRight - 8, JSON.stringify(foot));
		assert.equal(await page.locator("dialog.nsmax-ruling-dialog .nsmax-ruling-empty").isVisible(), true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第九批（2026-10-18）：脚本里其他弹窗、面板里的 header / footer（浏览记录、帖子监控、帖子预览……）不被站点的通用样式套上阴影、#333 灰底和 width:100%", async () => {
	const { context, page } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 800 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		// 弹窗 / 面板的样式是首帧后按需注入的（overlay 段）：这里手动造弹窗，先等它注入完再量
			await page.mouse.move(8, 8);
		await page.waitForFunction(() => [...document.querySelectorAll("style")].some((tag) => (tag.textContent || "").includes(".nspp-post-preview")), null, { timeout: 4e3 });
			await page.waitForFunction(() => [...document.querySelectorAll("style")].some((tag) => (tag.textContent || "").includes("nspp-history")), null, { timeout: 4e3 });
		const state = await page.evaluate(() => Array.from(["nspp-monitor", "nspp-history", "nspp-post-preview", "nsmax-other"], (className) => {
			const dialog = document.createElement("dialog");
			dialog.className = className;
			dialog.innerHTML = "<header style='padding:0 20px'>头</header><footer style='padding:0 20px'>脚</footer>";
			document.body.append(dialog);
			dialog.show();
			const foot = dialog.querySelector("footer");
			const result = { className, footBg: getComputedStyle(foot).backgroundColor, footWider: foot.getBoundingClientRect().right > dialog.getBoundingClientRect().right, headShadow: getComputedStyle(dialog.querySelector("header")).boxShadow };
			dialog.remove();
			return result;
		}));
		for (const item of state) {
			assert.notEqual(item.footBg, "rgb(51, 51, 51)", JSON.stringify(item));
			assert.equal(item.footWider, false, JSON.stringify(item));
			assert.equal(item.headShadow, "none", JSON.stringify(item));
		}
	} finally { await context.close(); }
});

test("第九批（2026-10-18）：我的关注 / 粉丝——站点数据到之前是骨架占位（2026-10-21 改成列表骨架，不再是转圈 gif）；站点画出卡片的那一帧就已经是 sb.sb 成员卡片（不先闪原版再跳）；2026-10-24 起照 sb.sb .member-row：卡片一样宽一样高，按钮在卡片右边一排（手机上在名字下面一行）", async () => {
	for (const [width, mobile] of [[1440, false], [390, true]]) {
		// 占位被站点换成卡片的那一刻，在页面里记下它的样子（以前等占位出现后再过 0.3 秒去看，全量跑时页面慢，0.9 秒的占位已经换掉了，偶尔失败）
		const init = `(() => {
			const replaceWith = Element.prototype.replaceWith;
			Element.prototype.replaceWith = function (...args) {
				if (this.id === "fans-mount" && !window.__fansLoading) {
					const skeleton = this.querySelector(".nsmax-fans-skeleton");
					const line = skeleton?.querySelector(".nsmax-skeleton-line");
					window.__fansLoading = { rows: skeleton ? skeleton.querySelectorAll(".nsmax-fans-skeleton-row").length : 0, gif: this.querySelector(".loading-img") ? getComputedStyle(this.querySelector(".loading-img")).display : "removed", height: Math.round(this.getBoundingClientRect().height), animation: line ? getComputedStyle(line).animationName : "" };
				}
				return replaceWith.apply(this, args);
			};
		})();`;
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/fans?type=follow", { html: fansPage({ delayed: 900, mobile }), init, viewport: { width, height: 900 } });
		try {
			await page.waitForFunction(() => window.__fansLoading);
			const loading = await page.evaluate(() => window.__fansLoading);
			assert.ok(loading, "数据到之前还在加载占位");
			assert.equal(loading.rows, 6, "骨架行数");
			assert.equal(loading.gif, "removed", "站点的转圈 gif 不再出现");
			assert.equal(loading.animation, "nsmax-skeleton-sweep", "骨架条自己在扫");
			assert.ok(loading.height >= 300, JSON.stringify(loading));
			await page.waitForFunction(() => Array.isArray(window.__fansFirstFrame));
			assert.deepEqual(await page.evaluate(() => window.__fansFirstFrame), [true, true, true, true, true], "站点画出卡片的那一帧之前就改好了");
			await wait(page, 200);
			const rows = await page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-member"), (member) => {
				const name = member.querySelector(".nsmax-member-name").getBoundingClientRect();
				const body = member.querySelector(".nsmax-member-body").getBoundingClientRect();
				const card = member.getBoundingClientRect();
				const stats = member.querySelector(".nsmax-member-stats");
				const buttons = Array.from(member.querySelectorAll(".nsmax-member-actions > .btn"), (btn) => btn.getBoundingClientRect());
				return { tops: new Set(buttons.map((box) => Math.round(box.top))).size, belowName: buttons.every((box) => box.top > name.bottom), alignedLeft: Math.abs(Math.round(buttons[0].left - name.left)) <= 1, rightOfBody: buttons.every((box) => box.left >= body.right - 1), count: buttons.length, width: Math.round(card.width), height: Math.round(card.height), statLines: Math.round(stats.getBoundingClientRect().height / parseFloat(getComputedStyle(stats).lineHeight)) };
			}));
			assert.equal(rows.length, 5);
			// 2026-10-24：照 sb.sb .member-row——桌面上按钮在卡片右边一排（sb.sb .member-row-msg），手机上挪到名字下面一行、和名字左对齐；
			// 每张卡片一样宽、一样高（以前站点的 justify-items: center 让卡片按内容宽窄不一，统计折行的高一截）
			for (const row of rows) {
				if (mobile) assert.deepEqual({ tops: row.tops, belowName: row.belowName, alignedLeft: row.alignedLeft, count: row.count }, { tops: 1, belowName: true, alignedLeft: true, count: 3 });
				else assert.deepEqual({ tops: row.tops, rightOfBody: row.rightOfBody, count: row.count }, { tops: 1, rightOfBody: true, count: 3 });
				assert.equal(row.statLines, 1, "统计只占一行");
			}
			assert.equal(new Set(rows.map((row) => row.width)).size, 1, "卡片一样宽：" + rows.map((row) => row.width));
			assert.equal(new Set(rows.map((row) => row.height)).size, 1, "卡片一样高：" + rows.map((row) => row.height));
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十批（2026-10-18）：个人空间加入日期——站点页面上没有加入天数时用接口的注册时间补上，拿不到就不写（以前一律写「近期加入」，论坛最早那批账号也是）", async () => {
	const withoutDays = (options) => spaceTopicsPage(options).replace(/<div class="card-item"><div>加入天数<\/div><div>659<\/div><\/div>/, "");
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/1#/discussions", {
			html: withoutDays(), viewport: { width: 1440, height: 900 },
			api: { "/api/account/getInfo/1": [{ status: 200, body: { success: true, detail: { member_id: 1, member_name: "Steve", rank: 3, coin: 1257, nPost: 100, nComment: 873, created_at: "2022-11-20T08:00:00.000Z" } } }] }
		});
		try {
			await page.waitForFunction(() => /加入/.test(document.querySelector(".nsmax-space-join")?.textContent || ""));
			const join = await page.evaluate(() => { const el = document.querySelector(".nsmax-space-join"); return { text: el.textContent, shown: el.getClientRects().length > 0 }; });
			assert.deepEqual(join, { text: "2022-11-20 加入", shown: true });
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	{
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/1#/discussions", {
			html: withoutDays(), viewport: { width: 1440, height: 900 },
			api: { "/api/account/getInfo/1": [{ status: 200, body: { success: true, detail: { member_id: 1, rank: 3 } } }] }
		});
		try {
			await page.waitForSelector(".nsmax-space-join", { state: "attached" });
			await wait(page, 600);
			const join = await page.evaluate(() => { const el = document.querySelector(".nsmax-space-join"); return { text: el.textContent, shown: el.getClientRects().length > 0 }; });
			assert.equal(join.shown, false, JSON.stringify(join));
			assert.doesNotMatch(await page.locator(".head-container").innerText(), /近期加入/);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十批（2026-10-18）：手机侧滑菜单（≡）里的资料卡换成和右栏同一张 sb.sb 资料卡——四格统计、我的主页 / 我的通知 / 每日签到……、发帖按钮；站点原来那一列收起", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ mobile: true }), viewport: { width: 390, height: 844 } });
	try {
		await page.waitForSelector("#left-slide-panel .user-card .nsmax-sb-account");
		await page.locator("#toggle-left-panel").click();
		await wait(page, 500);
		const state = await page.evaluate(() => {
			const card = document.querySelector("#left-slide-panel .user-card");
			const account = card.querySelector(".nsmax-sb-account");
			const box = account.getBoundingClientRect();
			return {
				nativeShown: Array.from(card.children).filter((el) => el !== account && el.getClientRects().length > 0).map((el) => el.className),
				stats: Array.from(account.querySelectorAll(".nsmax-account-stat dt"), (dt) => dt.textContent),
				menu: Array.from(account.querySelectorAll(".nsmax-account-menu > a"), (a) => a.textContent.replace(/\d+$/, "").trim()),
				compose: account.querySelector(".nsmax-account-compose")?.getAttribute("href"),
				inside: box.left >= 0 && box.right <= 300 + 1,
				overflow: document.documentElement.scrollWidth - innerWidth
			};
		});
		assert.deepEqual(state.nativeShown, []);
		assert.deepEqual(state.stats, ["鸡腿", "星辰", "主题帖", "评论数"]);
		assert.deepEqual(state.menu, ["我的主页", "我的主题", "我的回帖", "我的收藏", "我的粉丝", "我的关注", "我的通知", "每日签到", "管理记录", "个人设置"]);
		assert.equal(state.compose, "/new-discussion");
		assert.equal(state.inside, true);
		assert.ok(state.overflow <= 0);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十批（2026-10-18）：手机上只看私信会话列表时卡片按会话多少变高（不再固定占满一屏）；打开聊天还是占满一屏", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=list", { html: nativeTalkPage({ mobile: true }), viewport: { width: 390, height: 844 } });
	try {
		await page.waitForSelector(".nspp-messages-peer");
		await wait(page, 400);
		const list = await page.evaluate(() => Math.round(document.querySelector(".nspp-messages").getBoundingClientRect().height));
		assert.ok(list < 500, `会话列表卡片 ${list}px`);
		await page.locator(".nspp-messages-peer").first().click();
		await page.waitForSelector(".nspp-messages.has-conversation .nspp-messages-composer textarea");
		await wait(page, 300);
		const chat = await page.evaluate(() => Math.round(document.querySelector(".nspp-messages").getBoundingClientRect().height));
		assert.ok(chat >= 600, `聊天卡片 ${chat}px`);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十批（2026-10-18）：站点页面里的红框大红字报错（管理记录页「用户未登录」等）排成 sb.sb 空状态，未登录时多一个「去登录」；「Not allowed to search」换成中文", async () => {
	for (const [error, text, login] of [["用户未登录", "用户未登录", true], ["Not allowed to search", "站点只给管理员按用户名搜索管理记录", false]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/ruling", { html: rulingPage({ error }), viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector("[data-nsmax-site-error]");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const box = document.querySelector("[data-nsmax-site-error]");
				const cs = getComputedStyle(box);
				return { text: box.firstChild.textContent.trim(), color: cs.color, fontSize: cs.fontSize, border: cs.borderTopColor, login: box.querySelector(".nsmax-site-error-login")?.getAttribute("href") || null };
			});
			assert.equal(state.text, text);
			assert.notEqual(state.color, "rgb(255, 0, 0)");
			assert.notEqual(state.border, "rgb(255, 0, 0)");
			assert.equal(state.fontSize, "14px");
			assert.equal(state.login, login ? "/signIn.html" : null);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：帖子页中等宽度（801～1000px，右栏还在）楼层也排成一列——作者栏在正文上面一行，正文不再被 180px 作者栏挤到 300px 左右；1000px 以上照旧左右两栏", async () => {
	for (const [width, stacked] of [[860, true], [1000, true], [1100, false]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector("ul.comments > li[id='1'] > .nsmax-author-col");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const floor = document.querySelector("ul.comments > li[id='1']");
				const col = floor.querySelector(":scope > .nsmax-author-col").getBoundingClientRect();
				const article = floor.querySelector(":scope > article").getBoundingClientRect();
				const main = document.querySelector("#nsk-body-left").getBoundingClientRect();
				return {
					above: col.bottom <= article.top + 1,
					left: col.right <= article.left + 1,
					avatar: Math.round(floor.querySelector(".nsmax-author-avatar").getBoundingClientRect().width),
					ratio: article.width / main.width,
					side: document.querySelector("#nsk-right-panel-container").getClientRects().length > 0,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.equal(state.side, true, `${width}：右栏还在`);
			if (stacked) {
				assert.equal(state.above, true, `${width}：作者栏在正文上面`);
				assert.equal(state.avatar, 40, `${width}：作者栏一行，40px 头像`);
				assert.ok(state.ratio > 0.9, `${width}：正文差不多占满主栏（${state.ratio.toFixed(2)}）`);
			} else {
				assert.equal(state.left, true, `${width}：作者栏在左边`);
				assert.equal(state.avatar, 88);
			}
			assert.ok(state.overflow <= 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：正文里列多的表格在窄屏（≤1000px）照 sb.sb 手机做法——按内容宽度、单元格不折行、在表格里左右滑动（以前挤成一列一个字，手机上最右几列还被楼层卡片裁掉）；宽屏照旧占满正文", async () => {
	const table = `<table><thead><tr>${Array.from({ length: 12 }, (_, i) => `<th>列标题${i + 1}很长很长</th>`).join("")}</tr></thead><tbody><tr>${Array.from({ length: 12 }, (_, i) => `<td>数据${i + 1}_ABCDEFGHIJ</td>`).join("")}</tr></tbody></table>`;
	const html = postPage().replace("<p>收了，私信你</p>", `<p>收了，私信你</p>${table}`);
	for (const width of [390, 860, 1440]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width, height: 900 } });
		try {
			await page.waitForSelector("ul.comments > li[id='1'] article table");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const table = document.querySelector("ul.comments > li[id='1'] article table");
				const article = table.closest("article").getBoundingClientRect();
				const box = table.getBoundingClientRect();
				const th = table.querySelector("th");
				return {
					display: getComputedStyle(table).display,
					scrolls: table.scrollWidth > table.clientWidth + 1,
					inside: box.left >= article.left - 1 && box.right <= article.right + 1,
					thLines: Math.round(th.getBoundingClientRect().height / parseFloat(getComputedStyle(th).lineHeight)),
					full: Math.abs(box.width - article.width) <= 1,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.equal(state.inside, true, `${width}：表格不超出正文`);
			assert.ok(state.overflow <= 0, `${width}：页面不被撑宽`);
			if (width <= 1000) {
				assert.equal(state.display, "block");
				assert.equal(state.scrolls, true, `${width}：表格里能左右滑动`);
				assert.ok(state.thLines <= 2, `${width}：表头不折行（${state.thLines}）`);
			} else {
				assert.equal(state.display, "table");
				assert.equal(state.full, true, "宽屏表格占满正文");
			}
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：电脑浏览器窗口窄到顶栏收起版块时，≡ 版块菜单最后一块是「论坛应用」，放 NQ（NodeQuality 测机）黄底按钮——以前 NQ 跟着版块一起藏了，窄窗口下找不到", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 820, height: 800 } });
	try {
		await page.waitForSelector("#nsk-head .nsmax-mobile-menu");
		await wait(page, 300);
		assert.equal(await page.evaluate(() => document.querySelector("#nsk-head ul.nav-menu a.nsmax-nq-tab")?.getClientRects().length || 0), 0, "顶栏里的 NQ 藏了");
		await page.locator("#nsk-head .nsmax-mobile-menu").click();
		await page.waitForSelector("dialog.nsmax-mobile-nav[open] .nsmax-mobile-nav-apps a.nsmax-nq-tab");
		const state = await page.evaluate(() => {
			const dialog = document.querySelector("dialog.nsmax-mobile-nav");
			const apps = dialog.querySelector(".nsmax-mobile-nav-apps");
			const nq = apps.querySelector("a.nsmax-nq-tab");
			const style = getComputedStyle(nq);
			return {
				last: dialog.lastElementChild === apps,
				title: getComputedStyle(apps, "::before").content,
				href: nq.href,
				target: nq.target,
				text: nq.textContent,
				bg: style.backgroundColor,
				shown: nq.getClientRects().length > 0
			};
		});
		assert.deepEqual(state, { last: true, title: '"论坛应用"', href: "https://nodequality.com/", target: "_blank", text: "NQ", bg: "rgb(255, 208, 47)", shown: true });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十一批（2026-10-19）：正文折叠块（<details>）换成 sb.sb 折叠条——细线框、次底色、8px 圆角，标题 500 字重，展开后标题下一道细线；深色下不再是站点的 #3b3b3b 灰底", async () => {
	const body = `<p>收了，私信你</p><details><summary>点击展开配置详情</summary><p>CPU：2 核</p></details><details open><summary>已展开的折叠块</summary><p>展开后的内容</p></details>`;
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ dark }).replace("<p>收了，私信你</p>", body), viewport: { width: 1440, height: 900 }, colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector("ul.comments > li[id='1'] article details");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const [closed, opened] = document.querySelectorAll("ul.comments > li[id='1'] article details");
				const probe = document.createElement("div");
				probe.style.background = "var(--panel-alt)";
				document.body.append(probe);
				const panelAlt = getComputedStyle(probe).backgroundColor;
				probe.remove();
				const s = getComputedStyle(closed);
				return {
					bg: s.backgroundColor === panelAlt,
					border: `${s.borderTopWidth} ${s.borderTopStyle}`,
					radius: s.borderTopLeftRadius,
					weight: getComputedStyle(closed.querySelector("summary")).fontWeight,
					closedLine: getComputedStyle(closed.querySelector("summary")).borderBottomStyle,
					openLine: getComputedStyle(opened.querySelector("summary")).borderBottomStyle,
					gray: s.backgroundColor === "rgb(59, 59, 59)"
				};
			});
			assert.deepEqual(state, { bg: true, border: "1px solid", radius: "8px", weight: "500", closedLine: "none", openLine: "solid", gray: false }, dark ? "深色" : "浅色");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：页脚各列不再被站点的 width:33% / 50% 挤窄——880px 时「相关网站」不再一字一行、链接不再只剩「L…」，手机上每列占满半行；链接 400 字重、列标题没有 0.25em 字距（sb.sb .footer-col-title）", async () => {
	for (const width of [390, 880, 950, 1440]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/credit#/p-1", { html: creditPage({ mobile: width < 700 }), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector("body > footer .nsmax-footer-brand");
			await page.locator("body > footer").scrollIntoViewIfNeeded();
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const contain = document.querySelector("body > footer .contain");
				const cols = [...contain.querySelectorAll(":scope > .col")].filter((col) => col.getClientRects().length);
				const cell = (contain.clientWidth - 32) / getComputedStyle(contain).gridTemplateColumns.split(" ").length;
				const head = cols[0].querySelector(".group-head-link");
				return {
					count: cols.length,
					narrow: cols.filter((col) => col.getBoundingClientRect().width < Math.min(cell * 0.9, 100)).length,
					headLines: Math.round(head.getBoundingClientRect().height / parseFloat(getComputedStyle(head).lineHeight)),
					cut: cols.flatMap((col) => [...col.querySelectorAll("a")]).filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
					weight: getComputedStyle(cols[0].querySelector("li")).fontWeight,
					spacing: getComputedStyle(head).letterSpacing,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.equal(state.count, 5, `${width}：五列都在`);
			assert.equal(state.narrow, 0, `${width}：没有被挤窄的列`);
			assert.equal(state.headLines, 1, `${width}：列标题一行`);
			assert.deepEqual(state.cut, [], `${width}：链接没有被省略`);
			assert.equal(state.weight, "400");
			assert.equal(state.spacing, "normal");
			assert.ok(state.overflow <= 0);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：正文选项卡（nsk-magic-tabs）换成主题配色——外框次底色细线框、当前标签和内容区面板底（深色下不再是站点的 #3b3b3b / #2f2f2f 灰块）；外框四边都有、和后面的正文隔开", async () => {
	const tabs = `<p>收了，私信你</p><div class="nsk-magic-tabs enabled"><div class="nsk-magic-tab-title is-active">YABS</div><div class="nsk-magic-tab-body"><p>第一页</p></div><div class="nsk-magic-tab-title">融合怪</div><div class="nsk-magic-tab-body"><p>第二页</p></div></div><p>后面一段正文。</p>`;
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage({ dark }).replace("<p>收了，私信你</p>", tabs), viewport: { width: 1440, height: 900 }, colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector("ul.comments > li[id='1'] .nsk-magic-tabs");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const color = (value) => { const probe = document.createElement("div"); probe.style.background = value; document.body.append(probe); const out = getComputedStyle(probe).backgroundColor; probe.remove(); return out; };
				const box = document.querySelector("ul.comments > li[id='1'] .nsk-magic-tabs");
				const [active, idle] = box.querySelectorAll(".nsk-magic-tab-title");
				const body = box.querySelector(".nsk-magic-tab-body");
				const next = box.nextElementSibling.getBoundingClientRect();
				return {
					box: getComputedStyle(box).backgroundColor === color("var(--panel-alt)"),
					active: getComputedStyle(active).backgroundColor === color("var(--panel)"),
					body: getComputedStyle(body).backgroundColor === color("var(--panel)"),
					hidden: getComputedStyle(idle.nextElementSibling).display,
					bottom: getComputedStyle(box).borderBottomStyle,
					gap: Math.round(next.top - box.getBoundingClientRect().bottom)
				};
			});
			assert.deepEqual({ ...state, gap: state.gap >= 8 }, { box: true, active: true, body: true, hidden: "none", bottom: "solid", gap: true }, dark ? "深色" : "浅色");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：顶栏版块照 sb.sb .forum-nav——一行放不下的整个藏起来（不再横向滚动、把最后一个切成半个字），这时左边亮出 ≡，藏起来的版块和 NQ 都在 ≡ 菜单里；放得下时没有 ≡", async () => {
	// 940px 时版块放不下（Linux 上字体宽，1024px 就放不下）：≡ 排在版块后面，Logo 仍和帖子列表左边对齐
	for (const [width, html] of [[940, listPage()], [1440, listPage()]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width, height: 800 } });
		try {
			await page.waitForSelector("#nsk-head .nsmax-mobile-menu", { state: "attached" });
			await wait(page, 400);
			const state = await page.evaluate(() => {
				const head = document.querySelector("#nsk-head");
				const nav = head.querySelector(":scope > ul.nav-menu");
				const box = nav.getBoundingClientRect();
				const items = [...nav.children].filter((li) => li.getClientRects().length);
				const inRow = (li) => li.getBoundingClientRect().top < box.bottom - 1;
				return {
					cut: items.filter((li) => inRow(li) && li.getBoundingClientRect().right > box.right + 1).map((li) => li.textContent.trim()),
					hidden: items.filter((li) => !inRow(li)).map((li) => li.textContent.trim()),
					menu: getComputedStyle(head.querySelector(".nsmax-mobile-menu")).display,
					scroll: getComputedStyle(nav).overflowX,
					logoX: Math.round(head.querySelector(".site-title").getBoundingClientRect().x),
					leftX: Math.round(document.querySelector("#nsk-body-left").getBoundingClientRect().x),
					menuBox: [Math.round(head.querySelector(".nsmax-mobile-menu").getBoundingClientRect().left), Math.round(head.querySelector(".nsmax-mobile-menu").getBoundingClientRect().right)],
					navRight: Math.round(box.right),
					searchX: Math.round(head.querySelector(".search-box").getBoundingClientRect().x)
				};
			});
			assert.deepEqual(state.cut, [], `${width}：没有被切掉半截的版块`);
			assert.equal(state.scroll, "hidden", "不再是横向滚动条");
			assert.equal(state.logoX, state.leftX, `${width}：Logo（${state.logoX}px）和帖子列表（${state.leftX}px）左边对齐`);
			if (width < 1440) {
				assert.ok(state.hidden.includes("NQ"), `${width}：NQ 放不下（${state.hidden}）`);
				assert.equal(state.menu, "flex", "有版块藏起来时亮出 ≡");
				assert.ok(state.menuBox[0] >= state.navRight - 1 && state.menuBox[1] <= state.searchX + 1, `${width}：≡ 在版块后面、搜索框前面（${state.menuBox} / ${state.navRight} / ${state.searchX}）`);
				await page.locator("#nsk-head .nsmax-mobile-menu").click();
				await page.waitForSelector("dialog.nsmax-mobile-nav[open]");
				const listed = await page.evaluate(() => [...document.querySelectorAll("dialog.nsmax-mobile-nav[open] a")].map((a) => a.textContent.trim()));
				for (const name of state.hidden) assert.ok(listed.includes(name), `≡ 菜单里有「${name}」（${listed}）`);
			} else {
				assert.deepEqual(state.hidden, [], "宽屏全部放得下");
				assert.equal(state.menu, "none", "放得下时没有 ≡");
				// 窗口拖窄：版块挪到第二行只是位置变了，≡ 也要跟着亮出来；再拖宽收回去
				await page.setViewportSize({ width: 940, height: 800 });
				await page.waitForFunction(() => getComputedStyle(document.querySelector("#nsk-head .nsmax-mobile-menu")).display === "flex", null, { timeout: 3000 });
				await page.setViewportSize({ width: 1440, height: 800 });
				await page.waitForFunction(() => getComputedStyle(document.querySelector("#nsk-head .nsmax-mobile-menu")).display === "none", null, { timeout: 3000 });
			}
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十一批（2026-10-19）：热评排在评论最前面、它回复的那层后来才加载出来时，楼中楼不再一层套一层——收进外层框时自带的楼中楼框摊平、按楼号排，外层才有的作者栏去掉，「回复 某某」跟着新的外层重新判断", async () => {
	const base = postPage();
	const li3 = base.match(/<li class="content-item" id="3">[\s\S]*?<\/li>/)[0];
	const floor = (n, text) => li3.replace('id="3"', `id="${n}"`).replace('href="#3" class="floor-link">#3<', `href="#${n}" class="floor-link">#${n}<`).replace("<p>线路怎么样？晚高峰丢包吗？</p>", `<p>${text}</p>`);
	const reply = (name, n, text) => `<a href="/member?t=${name}">@${name}</a> <a href="/post-1000-1#${n}" target="_self">#${n}</a> ${text}`;
	// 真站 post-893437 的样子：热评 #8（回复 #5）、#9（回复 #8）排在最前面，#5（回复 #1）在后面的页里，翻页加载后才出现
	const html = base.replace('<ul class="comments">', `<ul class="comments">${floor(8, reply("curious", 5, "第八层"))}${floor(9, reply("curious", 8, "第九层"))}`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("li[id='8'] > .nsmax-floor-box li[id='9']");
		await page.evaluate((markup) => document.querySelector("#nsk-body-left ul.comments").insertAdjacentHTML("beforeend", markup), floor(5, reply("buyer", 1, "第五层")));
		await page.waitForFunction(() => document.querySelectorAll("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li").length === 3, null, { timeout: 5000 });
		await wait(page, 300);
		const state = await page.evaluate(() => {
			const box = document.querySelector("li[id='1'] > .nsmax-floor-box");
			const items = [...box.querySelectorAll(":scope > .nsmax-nested-replies > li")];
			const who = (id) => document.querySelector(`li[id='${id}'] .nsmax-fb-who`)?.textContent;
			return {
				order: items.map((li) => li.id),
				deep: document.querySelectorAll(".nsmax-floor-box .nsmax-floor-box").length,
				col: !!document.querySelector("li[id='8'] > .nsmax-author-col"),
				who5: who(5),
				who8: who(8),
				who9: who(9),
				count: box.querySelector(".nsmax-fb-count").textContent,
				narrow: items.filter((li) => li.getBoundingClientRect().width < box.getBoundingClientRect().width * 0.8).map((li) => li.id)
			};
		});
		assert.deepEqual(state.order, ["5", "8", "9"], "都收进 #1 的框、按楼号排");
		assert.equal(state.deep, 0, "框里不再套框");
		assert.equal(state.col, false, "收进框里的楼层没有外层的作者栏");
		assert.equal(state.who5, "curious：", "回复的就是层主时只写名字");
		assert.equal(state.who8, "curious回复curious：");
		assert.equal(state.who9, "curious回复curious：", "原来回复的是当时的外层 #8，摊平后写「回复」");
		assert.equal(state.count, "共 3 条回复");
		assert.deepEqual(state.narrow, [], "每条都是整行宽");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十一批（2026-10-19）：楼中楼一条在框窄时（≤1200px，左边还有作者栏）时间和操作换到内容下面一行，内容占满整行；宽屏照旧同一行", async () => {
	for (const width of [880, 1100, 1440]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width, height: 900 } });
		try {
			await page.waitForSelector("li[id='1'] > .nsmax-floor-box li[id='2'] > .nsmax-floor-actions");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const item = document.querySelector("li[id='1'] > .nsmax-floor-box li[id='2']");
				const box = item.closest(".nsmax-floor-box").getBoundingClientRect();
				const article = item.querySelector(":scope > article").getBoundingClientRect();
				const actions = item.querySelector(":scope > .nsmax-floor-actions").getBoundingClientRect();
				return { below: actions.top >= article.bottom - 1, wide: article.width / box.width };
			});
			if (width <= 1200) {
				assert.equal(state.below, true, `${width}：操作在内容下面一行`);
				assert.ok(state.wide > 0.85, `${width}：内容占满整行（${state.wide.toFixed(2)}）`);
			} else assert.equal(state.below, false, "宽屏操作和内容同一行");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

// 第十二批（2026-10-19）
// DeepFlood 首页：顶栏版块是它自己的（AI、摸鱼、情感……），站点配置里的版块表也是 DeepFlood 的
const deepFloodList = () => listPage()
	.replace(/<ul class="nav-menu">[\s\S]*?<\/ul>/, `<ul class="nav-menu"><!----> <!----> <li><a href="/categories/ai">AI</a></li><li><a href="/categories/daily">摸鱼</a></li><li><a href="/categories/emotion">情感</a></li><li><a href="/categories/stream">影音</a></li><li><a href="/categories/sports">运动</a></li><li><a href="/categories/coupon">羊毛</a></li><li><a href="/categories/promotion">推广</a></li> <li><a href="https://www.nodeseek.com" target="_blank">NodeSeek</a></li> <!----></ul>`)
	.replace('<span class="title-text" style="vertical-align: middle;">NodeSeek</span>', '<span class="title-text" style="vertical-align: middle;">DeepFlood</span>')
	.replace(/allCategory: \[[^\]]*\]/, "allCategory: " + JSON.stringify([["ai", "人工智能"], ["daily", "摸鱼闲聊"], ["emotion", "情感八卦"], ["stream", "影音图文"], ["sports", "运动赛事"], ["game", "游戏同好"], ["coupon", "羊毛福利"], ["promotion", "服务推广"], ["sandbox", "沙盒测试"]].map(([key, cn_text]) => ({ key, cn_text, showInNav: true, adminOnly: false }))));

test("第十二批（2026-10-19）：DeepFlood 宽屏顶栏照样有版块（AI、摸鱼、情感……）——以前只认 NodeSeek 的版块名，整排被当成杂项藏掉；推广和指向 NodeSeek 的外链照旧不显示", async () => {
	const { context, page, errors } = await open(browser, "https://www.deepflood.com/", { html: deepFloodList(), viewport: { width: 1440, height: 800 } });
	try {
		await page.waitForSelector("#nsk-head .nsmax-mobile-menu", { state: "attached" });
		await wait(page, 400);
		const state = await page.evaluate(() => {
			const nav = document.querySelector("#nsk-head > ul.nav-menu");
			return {
				shown: nav.getClientRects().length > 0,
				items: [...nav.children].filter((li) => li.getClientRects().length).map((li) => li.textContent.trim())
			};
		});
		assert.equal(state.shown, true, "顶栏版块这一排显示");
		assert.deepEqual(state.items, ["AI", "摸鱼", "情感", "影音", "运动", "羊毛", "NQ"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十二批（2026-10-19）：合作商家（/providers）、友站链接（/friends）照 sb.sb 页面卡片——不再是土黄渐变底、居中大标题；商家 logo 放在中间灰底板上（白字、深色字都看得清），友站照 sb.sb .link-card：头像 + 名字 + 域名，坏掉的头像换成首字占位", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/providers", { html: providersPage({ dark }), viewport: { width: 1280, height: 800 }, colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector(".nsk-providers .provider img");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const color = (value) => { const probe = document.createElement("div"); probe.style.background = value; document.body.append(probe); const out = getComputedStyle(probe).backgroundColor; probe.remove(); return out; };
				const box = document.querySelector(".nsk-providers");
				const s = getComputedStyle(box);
				const title = getComputedStyle(box.querySelector(":scope > h2"));
				const tile = box.querySelector(".provider");
				const tiles = [...box.querySelectorAll(".provider")].map((el) => el.getBoundingClientRect());
				return {
					panel: s.backgroundColor === color("var(--panel)"),
					gradient: s.backgroundImage !== "none",
					border: s.borderTopWidth,
					title: [title.fontSize, title.textAlign],
					grid: getComputedStyle(box.querySelector(".provider-grid-container")).display,
					tile: getComputedStyle(tile).backgroundColor === color("color-mix(in srgb, var(--text) 40%, var(--panel))"),
					sameRow: tiles.filter((r) => Math.abs(r.top - tiles[0].top) < 1).length,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.deepEqual({ ...state, sameRow: state.sameRow >= 5 }, { panel: true, gradient: false, border: "1px", title: ["15px", "left"], grid: "grid", tile: true, sameRow: true, overflow: 0 }, dark ? "深色" : "浅色");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/friends", { html: friendsPage(), viewport: { width: 1280, height: 800 } });
	try {
		await page.waitForSelector(".nsk-friends .nsmax-friend-host");
		await page.waitForFunction(() => document.querySelectorAll(".nsk-friends .nsmax-friend-avatar").length === 2);
		const state = await page.evaluate(() => {
			const cards = [...document.querySelectorAll(".nsk-friends .friends-container > div > a")];
			const card = (name) => cards.find((a) => a.querySelector("p").textContent === name);
			return {
				display: getComputedStyle(cards[0]).display,
				host: card("EdNovas的小站").querySelector(".nsmax-friend-host").textContent,
				hostWww: card("非主流论坛").querySelector(".nsmax-friend-host").textContent,
				broken: ["Low Level News", "DR导航"].map((name) => [card(name).querySelector(".nsmax-friend-avatar")?.textContent, card(name).querySelector("img").hidden]),
				nameSize: getComputedStyle(cards[0].querySelector("p")).fontSize,
				avatar: Math.round(cards[0].querySelector("img").getBoundingClientRect().width),
				ellipsis: getComputedStyle(card("一个名字特别特别长的友站博客").querySelector("p")).textOverflow
			};
		});
		assert.deepEqual(state, { display: "grid", host: "ednovas.xyz", hostWww: "example.org", broken: [["L", true], ["D", true]], nameSize: "14.5px", avatar: 36, ellipsis: "ellipsis" });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十二批（2026-10-19）：没登录时的「用户未登录」统一排成 sb.sb 空状态卡片 + 「去登录」——邀请好友页的居中 h2、账簿页的空 div（以前一行孤零零的字）", async () => {
	for (const [url, html, selector] of [["https://www.nodeseek.com/invite", invitePage(), ".invite-panel > h2"], ["https://www.nodeseek.com/credit#/p-1", creditGuestPage(), ".credit-table > div"]]) {
		const { context, page, errors } = await open(browser, url, { html, viewport: { width: 1280, height: 700 } });
		try {
			await page.waitForSelector(`${selector}[data-nsmax-site-error] > .nsmax-site-error-login`);
			const state = await page.evaluate((sel) => {
				const box = document.querySelector(sel);
				const s = getComputedStyle(box);
				return { login: box.querySelector(".nsmax-site-error-login").getAttribute("href"), border: s.borderTopWidth, align: s.textAlign, size: s.fontSize };
			}, selector);
			assert.deepEqual(state, { login: "/signIn.html", border: "1px", align: "center", size: "14px" }, url);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十二批（2026-10-19）：签到页没登录时只写「登录后才能签到」和一个「登录后签到」按钮；连续签到、统计、日历不显示（以前照样摆着「签到」按钮和「今天还没签到」）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/board", { html: boardRealPage({ guest: true }), viewport: { width: 1280, height: 800 } });
	try {
		await page.waitForSelector(".nsmax-checkin[data-guest] .nsmax-checkin-actions a");
		const state = await page.evaluate(() => {
			const card = document.querySelector(".nsmax-checkin");
			const shown = (sel) => !!card.querySelector(sel)?.getClientRects().length;
			return {
				action: [...card.querySelectorAll(".nsmax-checkin-actions > *")].map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute("href") || ""} ${el.textContent}`),
				note: card.querySelector(".nsmax-checkin-note").textContent,
				streak: shown(".nsmax-checkin-streak"),
				stats: shown(".nsmax-checkin-stats"),
				calendar: shown(".nsmax-checkin-calendar")
			};
		});
		assert.deepEqual(state.action, ["a /signIn.html 登录后签到"]);
		assert.match(state.note, /^登录后才能签到/);
		assert.deepEqual([state.streak, state.stats, state.calendar], [false, false, false]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十二批（2026-10-19）：没登录时打开通知、设置、关注页，站点只弹「用户未登录」、点掉后整页空白——放一张空状态卡片：一句话 + 「去登录」；登录后不出现", async () => {
	for (const [url, html, text] of [["https://www.nodeseek.com/notification#/atMe", notificationGuestPage(), "登录后才能查看通知和私信"], ["https://www.nodeseek.com/setting", settingGuestPage(), "登录后才能修改个人设置"], ["https://www.nodeseek.com/fans", fansGuestPage(), "登录后才能查看关注和粉丝"]]) {
		const { context, page, errors } = await open(browser, url, { html, viewport: { width: 1280, height: 700 } });
		try {
			await page.waitForSelector(".nsmax-guest-empty > .nsmax-site-error-login");
			const state = await page.evaluate(() => {
				const box = document.querySelector(".nsmax-guest-empty");
				const r = box.getBoundingClientRect();
				return { text: box.firstChild.textContent, login: box.querySelector("a").getAttribute("href"), centered: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2, count: document.querySelectorAll(".nsmax-guest-empty").length };
			});
			assert.equal(state.text, text, url);
			assert.equal(state.login, "/signIn.html");
			assert.equal(state.centered, true, `${url}：卡片居中`);
			assert.equal(state.count, 1);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	const { context, page } = await open(browser, "https://www.nodeseek.com/setting#/profile", { html: settingPage(), viewport: { width: 1280, height: 700 } });
	try {
		await page.waitForSelector("#user-setting-panel");
		await wait(page, 500);
		assert.equal(await page.locator(".nsmax-guest-empty").count(), 0, "登录后不出现");
	} finally { await context.close(); }
});

test("第十二批（2026-10-19）：站点直接返回 JSON 的地址（没登录打开发帖页是 {\"message\":\"USER NOT FOUND\"}）脚本不动：不套主题、不加按钮", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/new-discussion", { pages: { "/new-discussion": { body: "{\"message\":\"USER NOT FOUND\",\"status\":404,\"success\":false}", contentType: "application/json" } }, viewport: { width: 1280, height: 700 } });
	try {
		await wait(page, 800);
		const state = await page.evaluate(() => ({ theme: document.documentElement.hasAttribute("data-nsmax-theme"), tools: !!document.getElementById("nspp-tools"), styles: document.querySelectorAll("style").length }));
		assert.deepEqual(state, { theme: false, tools: false, styles: 0 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 第十三批（2026-10-19）
test("第十三批（2026-10-19）：搜索面板照 sb.sb 搜索条重做——标签只留文字；输入框和「搜索」按钮是一个框（框里一个放大镜，按钮只写字，不再两个放大镜）；聚焦时品牌色边框；手机上是贴顶的抽屉、高度跟内容走", async () => {
	for (const [width, dark] of [[1280, false], [1280, true], [390, false]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: searchOverlayPage({ dark, mobile: width < 700 }), viewport: { width, height: 760 }, colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector(".search-overlay .glass-card");
			await page.mouse.move(8, 8);
			await wait(page, 400);
			const state = await page.evaluate(() => {
				const card = document.querySelector(".search-overlay .glass-card");
				const group = card.querySelector(".glass-input-group");
				const input = group.querySelector("input");
				const button = group.querySelector(".glass-search-btn");
				const box = (el) => el.getBoundingClientRect();
				const g = box(group), i = box(input), b = box(button), c = box(card);
				const groupStyle = getComputedStyle(group), buttonStyle = getComputedStyle(button);
				return {
					tabIcons: [...card.querySelectorAll(".tab-btn svg")].filter((svg) => svg.getClientRects().length).length,
					tabs: [...card.querySelectorAll(".tab-btn")].filter((btn) => btn.getClientRects().length).map((btn) => btn.textContent.trim()),
					groupBorder: groupStyle.borderTopWidth,
					inputBorder: getComputedStyle(input).borderTopWidth,
					buttonInside: b.left >= g.left && b.right <= g.right + 0.5 && b.top >= g.top && b.bottom <= g.bottom + 0.5,
					inputInside: i.left >= g.left && i.right <= b.left + 1,
					buttonIcon: !!button.querySelector("svg")?.getClientRects().length,
					buttonText: getComputedStyle(button.querySelector("span")).display !== "none" ? button.textContent.trim() : "",
					magnifier: getComputedStyle(group, "::before").content !== "none",
					// 「搜索」是框里贴着右沿的一段：外框才有圆角（8px），按钮自己没有圆角、被框裁掉右边两个角；
					// 以前按钮是独立的小胶囊（9999px），和外框的圆角对不上
					groupRadius: groupStyle.borderRadius,
					groupOverflow: groupStyle.overflow,
					buttonRadius: buttonStyle.borderRadius,
					buttonFlushRight: Math.abs(g.right - b.right) <= 1.5,
					buttonFullHeight: Math.abs(g.height - b.height) <= 2.5,
					buttonDivider: buttonStyle.borderLeftWidth,
					buttonBackground: buttonStyle.backgroundColor,
					card: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)],
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			assert.equal(state.tabIcons, 0, "标签只留文字");
			assert.deepEqual(state.tabs, ["帖子", "用户"]);
			assert.equal(state.groupBorder, "1px", "输入框和按钮外面是一个框");
			assert.equal(state.inputBorder, "0px", "输入框自己不再有框");
			assert.equal(state.buttonInside, true, "「搜索」按钮在框里");
			assert.equal(state.inputInside, true);
			assert.equal(state.buttonIcon, false, "按钮里不再有放大镜");
			assert.equal(state.buttonText, "搜索");
			assert.equal(state.magnifier, true, "框里左边一个放大镜");
			// 框和按钮的圆角是同一个：框 8px 圆角 + overflow:hidden，按钮自己没有圆角、贴着右沿，
			// 右边两个角由框裁出来（以前按钮是 9999px 小胶囊，和框的圆角对不上）
			assert.equal(state.groupRadius, "8px");
			assert.equal(state.groupOverflow, "hidden");
			assert.equal(state.buttonRadius, "0px");
			assert.equal(state.buttonFlushRight, true, "「搜索」贴着框的右沿");
			assert.equal(state.buttonFullHeight, true, "「搜索」和框一样高（右边两个角被裁成框的圆角）");
			assert.equal(state.buttonDivider, "1px", "和输入之间一条细线");
			assert.equal(state.buttonBackground, "rgba(0, 0, 0, 0)", "按钮是透明的，不再是独立实底胶囊");
			if (width < 700) {
				assert.deepEqual(state.card.slice(0, 3), [0, 0, width], "手机：贴着屏幕顶、宽度占满");
				assert.ok(state.card[3] < 400, `手机：高度跟内容走（${state.card[3]}）`);
			} else {
				assert.equal(state.card[2], 600);
				assert.equal(state.card[0], (width - 600) / 2, "居中");
			}
			assert.ok(state.overflow <= 0);
			await page.locator(".search-overlay .glass-input-group input").focus();
			await wait(page, 350);
			const focus = await page.evaluate(() => {
				const probe = document.createElement("div");
				probe.style.borderColor = "var(--brand-border)";
				document.body.append(probe);
				const brand = getComputedStyle(probe).borderTopColor;
				probe.remove();
				return getComputedStyle(document.querySelector(".search-overlay .glass-input-group")).borderTopColor === brand;
			});
			assert.equal(focus, true, "聚焦时框换成品牌色边框");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十三批（2026-10-19）：普通搜索结果里不放「精华」「抽奖」（首页列表的筛选，点了就离开搜索结果）；首页照旧有", async () => {
	for (const [url, html, expected] of [["https://www.nodeseek.com/search?q=vps", searchPage({ count: 3 }), 0], ["https://www.nodeseek.com/", listPage(), 2]]) {
		const { context, page, errors } = await open(browser, url, { html, viewport: { width: 1280, height: 760 } });
		try {
			await page.waitForSelector("#nsk-body-left > .post-list-controler > .sorter");
			await wait(page, 500);
			assert.equal(await page.locator("#nsk-body-left .nsmax-kind-tabs > a").count(), expected, url);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十三批（2026-10-19）：没登录时页面一打开站点就弹的「用户未登录」提示框（脚本装好之前就弹出来了）也换成 toast，不再挡在「登录后才能……」卡片前面", async () => {
	const alert = `<div class="msc-confirm" style="display: block;"><div class="msc-overlay"><button class="msc-close">×</button></div><div class="msc-content"><h3 class="msc-title">用户未登录</h3><div class="msc-body"><p class="msc-sub"></p></div><div class="msc-action"><button class="msc-ok">OK</button></div></div></div><script>document.querySelector(".msc-confirm .msc-ok").addEventListener("click", (event) => event.target.closest(".msc-confirm").remove());</script>`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/setting", { html: settingGuestPage().replace("</body>", `${alert}</body>`), viewport: { width: 1280, height: 700 } });
	try {
		await page.waitForSelector(".nsmax-guest-empty");
		await page.waitForSelector(".nsmax-toast[data-nsmax-shown]");
		assert.equal(await page.locator(".msc-confirm").count(), 0, "提示框关掉了");
		assert.equal(await page.locator(".nsmax-toast").innerText(), "用户未登录");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十四批（2026-10-19）：只有一页时的页码（上一页、下一页都禁用，全是 span）只画一个「1」——外面那层 div[role=navigation] 不再也被当成一格，画成圆角框套着圆", async () => {
	const single = `<div role="navigation" aria-label="pagination"><span aria-disabled="true" class="pager-prev"><div class="triangle-left"></div></span> <!----> <span href="/categories/inside/page-1" aria-label="page1" aria-current="page" class="pager-pos pager-cur">1</span> <!----> <span aria-disabled="true" class="pager-next"><div class="triangle-right"></div></span></div>`;
	const html = listPage({ count: 6 }).replace(/<div class="nsk-pager (pager-top|pager-bottom)">[\s\S]*?<\/div><\/div>/g, (match, which) => `<div class="nsk-pager ${which}">${single}</div>`);
	for (const colorScheme of ["light", "dark"]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/categories/inside", { html, colorScheme, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-pager.pager-bottom [data-nsmax-pg-cur]");
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const pager = document.querySelector(".nsk-pager.pager-bottom");
				const nav = pager.querySelector("[role=navigation]");
				const framed = Array.from(pager.querySelectorAll("*")).filter((el) => el.getClientRects().length && parseFloat(getComputedStyle(el).borderTopWidth) > 0);
				return { navMarked: nav.hasAttribute("data-nsmax-pg") || nav.hasAttribute("data-nsmax-pg-cur"), framed: framed.map((el) => `${el.className}:${el.textContent.trim()}`), current: pager.querySelector("[data-nsmax-pg-cur]")?.textContent.trim() };
			});
			assert.equal(state.navMarked, false, `${colorScheme}：外层不是一格页码`);
			assert.deepEqual(state.framed, ["pager-pos pager-cur:1"], `${colorScheme}：只有「1」一个圈`);
			assert.equal(state.current, "1");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十四批（2026-10-19）：帖子回复总数——多页的帖子以前标题栏取到楼中楼框底「共 1 条回复」里的 1；现在用列表上的回复数（就是最后一楼的楼号），没有就后台打开最后一页看最大楼号；只有一页时数这一页最大的楼号；抽奖卡片的「N 条回复」同一个数", async () => {
	// 列表上的回复数记在本机：<span title="N comments" class="info-comments-count">
	const list = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 800 } });
	try {
		await list.page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("nsmax:reply-counts") || "{}")["1005"]?.[0] === 15; } catch { return false; } }, null, { timeout: 5e3 });
		assert.deepEqual(list.errors, []);
	} finally { await list.context.close(); }
	// 3 楼回复 1 楼：1 楼底下出现楼中楼框「共 1 条回复」（以前标题栏就取到这个 1）
	const nested = (html) => html.replace("线路怎么样？晚高峰丢包吗？", '<a href="/space/11">@buyer</a> <a href="/post-1000-1#1">#1</a> 线路怎么样？');
	const withLottery = (html) => html.replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=1893456000000&amp;count=1">开奖</a></p></article>');
	const multi = withLottery(nested(postPage())).replace('"postPageCount":1', '"postPageCount":70');
	const read = (page) => page.evaluate(() => ({
		stat: document.querySelector(".nsk-post .nsmax-post-stats .nsmax-post-stat-item:last-child > span")?.textContent.trim(),
		heading: document.querySelector(".nsmax-reply-title")?.textContent.trim(),
		lottery: document.querySelector(".nsmax-lottery [data-nsmax-replies]")?.textContent.trim() ?? null,
		box: document.querySelector('li[id="1"] .nsmax-fb-count')?.textContent.trim() ?? null
	}));
	// 1. 记下过（10 分钟内）：直接用，不去开最后一页
	const requested = [];
	const cached = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: multi, viewport: { width: 1280, height: 800 }, init: `if (window.top === window) localStorage.setItem("nsmax:reply-counts", JSON.stringify({ "1000": [699, Date.now()] }));`, beforeNavigate: (page) => page.on("request", (request) => requested.push(new URL(request.url()).pathname)) });
	try {
		await cached.page.waitForSelector(".nsmax-lottery [data-nsmax-replies]");
		await wait(cached.page, 600);
		assert.deepEqual(await read(cached.page), { stat: "699", heading: "699 条回复", lottery: "699 条回复", box: "共 1 条回复" });
		assert.ok(!requested.includes("/post-1000-70"), "记下过就不再开最后一页");
		assert.deepEqual(cached.errors, []);
	} finally { await cached.context.close(); }
	// 2. 没记下过：后台打开最后一页（/post-1000-70），最大楼号就是回复总数，拿到后标题栏、评论区标题、抽奖卡片一起更新
	const last = postPage().replace(/<ul class="comments">[\s\S]*?<\/ul>/, `<ul class="comments">${[697, 698, 699].map((floor) => `<li class="content-item" id="${floor}"><article class="post-content"><p>第 ${floor} 楼</p></article></li>`).join("")}</ul>`);
	const fresh = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: multi, viewport: { width: 1280, height: 800 }, pages: { "/post-1000-70": last } });
	try {
		await fresh.page.waitForFunction(() => document.querySelector(".nsmax-reply-title")?.textContent.trim() === "699 条回复", null, { timeout: 5e3 });
		await fresh.page.waitForFunction(() => document.querySelector(".nsmax-lottery [data-nsmax-replies]")?.textContent.trim() === "699 条回复", null, { timeout: 5e3 });
		assert.equal((await read(fresh.page)).stat, "699");
		// 记下来，下次直接用（合在一起写，晚 0.3 秒）
		await fresh.page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("nsmax:reply-counts") || "{}")["1000"]?.[0] === 699; } catch { return false; } }, null, { timeout: 3e3 });
		assert.deepEqual(fresh.errors, []);
	} finally { await fresh.context.close(); }
	// 3. 只有一页：这一页最大的楼号（3），不是楼中楼框底的 1
	const single = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: nested(postPage()), viewport: { width: 1280, height: 800 } });
	try {
		await single.page.waitForSelector('li[id="1"] .nsmax-fb-count');
		await wait(single.page, 400);
		const state = await read(single.page);
		assert.equal(state.stat, "3");
		assert.equal(state.heading, "3 条回复");
		assert.deepEqual(single.errors, []);
	} finally { await single.context.close(); }
});

test("第十四批（2026-10-19）：抽奖帖识别（2026-10-24 起页面加载完以后一篇一篇查、前后隔开，不再几篇一起，免得站点限流）；楼主在标题或正文里标了结束（【已开奖】、已结束、恭喜 @… 中奖）的，标签马上换成「抽奖」「已结束」，不用等到开奖时间", async () => {
	const future = Date.now() + 7 * 864e5;
	const lucky = (id, note = "") => postPage().replace("</article>", `<p>${note}</p><p><a href="https://www.nodeseek.com/lucky?post=${id}&amp;time=${future}&amp;count=1">开奖</a></p></article>`);
	// 8 篇标题像抽奖的：1000、1001 正文里写了结束，1002 标题写了【已开奖】，1003 还在进行（规则里的「恭喜中奖的朋友」不算结束），其余四篇不是抽奖
	const titles = ["抽奖送 VPS 一台", "抽 3 个鸡腿红包", "【已开奖】抽奖送域名", "新人抽奖 送年付小鸡", "抽奖：签到领鸡腿", "开奖啦 求推荐", "抽两个 Plus", "giveaway 送 Netcup"];
	const html = listPage({ count: 8 }).replace(/(<div role="heading" aria-level="3" class="post-title"><a href="\/post-(\d+)-1"[^>]*>)[^<]*/g, (match, head, id) => head + titles[Number(id) - 1000]);
	const pages = {
		"/post-1000-1": lucky(1000, "已开奖，恭喜 @buyer @passerby 中奖，请私信我"),
		"/post-1001-1": lucky(1001, "活动已结束，谢谢大家"),
		"/post-1002-1": lucky(1002),
		"/post-1003-1": lucky(1003, "开奖后恭喜中奖的朋友请私信我"),
		"/post-1004-1": postPage(), "/post-1005-1": postPage(), "/post-1006-1": postPage(), "/post-1007-1": postPage()
	};
	const started = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, seed: NO_PREVIEW, viewport: { width: 1440, height: 900 }, pages, beforeNavigate: (page) => page.on("request", (request) => { if (/^\/post-10\d\d-1$/.test(new URL(request.url()).pathname)) started.push(Date.now()); }) });
	try {
		// 8 篇全都查到（以前每次打开页面最多查 6 篇）
		await page.waitForFunction(() => { try { const checked = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return Array.from({ length: 8 }, (_, i) => String(1000 + i)).every((id) => id in checked); } catch { return false; } }, null, { timeout: 20e3 });
		await wait(page, 300);
		assert.ok(started.length >= 8, "每篇查一次：" + started.length);
		const gaps = started.slice(1).map((at, i) => at - started[i]);
		assert.ok(Math.min(...gaps) >= 500, `一篇一篇查、前后至少隔 0.5 秒（以前三篇同时开始）：${gaps.join()}`);
		const rows = await page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item .post-title"), (title) => [title.querySelector("a").textContent.trim(), title.querySelector(".nsmax-prize-badge") ? (title.querySelector(".nsmax-prize-badge").hasAttribute("data-ended") ? "ended" : "open") : "-", !!title.querySelector(".nsmax-ended-badge")]));
		assert.deepEqual(rows, [
			["抽奖送 VPS 一台", "ended", true],
			["抽 3 个鸡腿红包", "ended", true],
			["【已开奖】抽奖送域名", "ended", true],
			["新人抽奖 送年付小鸡", "open", false],
			["抽奖：签到领鸡腿", "-", false],
			["开奖啦 求推荐", "-", false],
			["抽两个 Plus", "-", false],
			["giveaway 送 Netcup", "-", false]
		]);
		assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("nsmax:lottery-ended") || "[]").sort()), ["1000", "1001"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 认出来、还没结束的抽奖帖：过了 30 分钟再打开列表时重新查一次，楼主后来在正文里改成已开奖的也能跟上
	const recheck = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1440, height: 900 }, pages: { "/post-1003-1": lucky(1003, "已开奖，恭喜 @buyer 中奖") }, init: `if (window.top === window) { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1003": "lottery" })); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1003": Date.now() - 31 * 60e3 })); localStorage.setItem("nsmax:lottery-times", JSON.stringify({ "1003": ${future} })); }` });
	try {
		const title = recheck.page.locator("ul.post-list > li.post-list-item .post-title").nth(3);
		await title.locator(".nsmax-prize-badge").waitFor();
		await title.locator(".nsmax-ended-badge").waitFor({ timeout: 12e3 });
		assert.equal(await title.locator(".nsmax-prize-badge").getAttribute("data-ended"), "");
		assert.deepEqual(recheck.errors, []);
	} finally { await recheck.context.close(); }
	// 打开帖子本身：楼主正文里写了已开奖，标题前的标签也是「已结束」
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: lucky(1000, "已开奖，恭喜 @buyer 中奖"), viewport: { width: 1280, height: 800 } });
	try {
		await post.page.waitForSelector(".nsk-post .post-title h1 .nsmax-ended-badge", { timeout: 5e3 });
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
});

test("第十四批（2026-10-19）：多页评论区加载更快——页面停下来以后先在后台把下一页取好（不接上）；往下看时离底部还有一屏多就接上，用的是取好的那份，不再请求一次", async () => {
	const first = postPage().replaceAll("/page-2", "/post-1000-2");
	const second = postPage().replace('id="1"', 'id="4"').replace('id="2"', 'id="5"').replace('id="3"', 'id="6"').replaceAll('class="pager-pos pager-cur">1', 'class="pager-pos pager-cur">2').replaceAll('class="pager-next"', 'class="pager-end"');
	const requested = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: first, viewport: { width: 1280, height: 500 }, pages: { "/post-1000-2": second }, beforeNavigate: (page) => page.on("request", (request) => requested.push(new URL(request.url()).pathname)) });
	try {
		await page.waitForSelector("button.nspp-action");
		await page.waitForFunction(() => document.readyState === "complete");
		await wait(page, 2200);
		assert.equal(requested.filter((path) => path === "/post-1000-2").length, 1, "没滚动也先取好下一页");
		assert.equal(await page.locator("ul.comments li.content-item").count(), 3, "没往下看时不接上");
		await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
		await page.waitForSelector('li[id="4"]', { state: "attached", timeout: 5e3 });
		assert.equal(await page.locator("ul.comments li.content-item").count(), 6);
		assert.equal(requested.filter((path) => path === "/post-1000-2").length, 1, "接上时用取好的那份");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十四批（2026-10-19）：正文 Markdown 再对一遍 sb.sb——站点自己加的代码复制按钮和脚本的「复制」只留一个（站点偏好一直显示时脚本的也一直显示）；代码块占满正文宽（站点限成 724px，以前脚本的「复制」跑到代码块外面）；列表只有一个方块符号、品牌色；行内代码 0.875em；站点的彩色卡片换成提示块样式；@用户用正文强调色", async () => {
	const body = `<p>行内 <code>docker ps</code>，<a href="/member?t=tester">@tester</a> <a href="/post-1000-1#3">#3</a></p><ul><li>第一项</li><li>第二项</li></ul><pre><code class="language-bash">bash &lt;(curl -fsSL https://raw.githubusercontent.com/x/y/master/install.sh)</code></pre><div class="card warning"><p>卡片 warning</p></div>`;
	// 站点 index.js 的做法：页面加载后给 pre > code 加一个 button.code-copy-btn（.always 是站点偏好「一直显示」）
	const siteCopy = `<script>document.addEventListener("DOMContentLoaded", () => setTimeout(() => { for (const code of document.querySelectorAll("article.post-content pre > code")) { code.dataset.hasCopyButton = "1"; const pre = code.parentElement; pre.classList.add("code-copy-wrapper"); const button = document.createElement("button"); button.className = "code-copy-btn always"; button.type = "button"; button.innerHTML = '<svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8"></rect></svg>'; pre.append(button); } }, 300));</script>`;
	let html = postPage();
	const start = html.indexOf('<article class="post-content">') + '<article class="post-content">'.length;
	html = (html.slice(0, start) + body + html.slice(html.indexOf("</article>", start))).replace("</body>", siteCopy + "</body>");
	for (const colorScheme of ["light", "dark"]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, colorScheme, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-post pre[data-nsmax-copy-always]", { state: "attached", timeout: 5e3 });
			await wait(page, 300);
			const state = await page.evaluate(() => {
				const art = document.querySelector(".nsk-post article.post-content");
				const pre = art.querySelector("pre");
				const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
				const copy = art.querySelector("[data-nspp-copy]");
				const li = art.querySelector("ul > li");
				const token = (name) => { const probe = document.createElement("span"); probe.style.color = `var(${name})`; art.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; };
				const card = getComputedStyle(art.querySelector(".card.warning"));
				const a = copy.getBoundingClientRect(), b = pre.getBoundingClientRect();
				return {
					copies: Array.from(art.querySelectorAll(".code-copy-btn, [data-nspp-copy]")).filter(shown).map((el) => el.className),
					copyOpacity: getComputedStyle(copy).opacity,
					fill: Math.round(b.width) === Math.round(art.getBoundingClientRect().width),
					copyInside: a.right <= b.right + 0.5 && a.top >= b.top - 0.5,
					before: getComputedStyle(li, "::before").content,
					marker: getComputedStyle(li, "::marker").color === token("--brand"),
					codeSize: getComputedStyle(art.querySelector("p > code")).fontSize,
					card: [card.borderLeftWidth, card.borderRadius, card.paddingLeft],
					mention: getComputedStyle(art.querySelector("a[href^='/member']")).color === token("--text-strong"),
					floorLink: getComputedStyle(art.querySelector("a[href='/post-1000-1#3']")).color === token("--link")
				};
			});
			assert.deepEqual(state.copies, ["nspp-copy-button"], `${colorScheme}：只剩脚本的「复制」`);
			assert.equal(state.copyOpacity, "1", "站点偏好一直显示：脚本的「复制」也一直显示");
			assert.equal(state.fill, true, "代码块占满正文宽");
			assert.equal(state.copyInside, true, "「复制」在代码块右上角里面");
			assert.equal(state.before, "none", "站点 li::before 的「•」去掉");
			assert.equal(state.marker, true, "方块符号是品牌色");
			assert.equal(state.codeSize, "13.125px", "行内代码 0.875em");
			assert.deepEqual(state.card, ["3px", "8px", "14px"], "卡片：左边 3px 类型色、输入框圆角");
			assert.equal(state.mention, true, "@用户：正文强调色");
			assert.equal(state.floorLink, true, "楼层链接还是链接色");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第十四批（2026-10-19）：进帖子不再一卡一卡——页面一解析完（站点的模块脚本还没跑、第一帧之前）楼中楼、作者栏、面包屑就排好；作者栏的等级和帖子 / 鸡腿 / 星辰一开始就占好位置，本机记下过的人直接显示，读到资料只换字，第一帧之后页面不再跳", async () => {
	const signature = '<div class="signature"><p><a href="https://example.com/">探针</a><br><a href="https://t.me/x">BOT</a>|面板</p></div>';
	let html = postPage()
		.replace("线路怎么样？晚高峰丢包吗？", '<a href="/space/11">@buyer</a> <a href="/post-1000-1#1">#1</a> 线路怎么样？')
		.replace(/(<li class="content-item" id="\d+">[\s\S]*?<article class="post-content">[\s\S]*?<\/article>)/g, (match) => match + signature);
	// 照真站：站点配置在页面最后；站点的模块脚本在解析完、DOMContentLoaded 之前执行（这里忙 200ms），执行时记下页面的样子
	const start = html.indexOf("<script>window.__config__");
	const end = html.indexOf("</script>", start) + "</script>".length;
	const config = html.slice(start, end);
	const moduleScript = `<script type="module">window.__atModule = { crumb: !!document.querySelector(".nsmax-crumb"), nested: !!document.querySelector('li[id="1"] > .nsmax-floor-box li[id="3"]'), cols: document.querySelectorAll(".nsmax-author-col").length, opStats: Array.from(document.querySelectorAll(".nsk-post .nsmax-author-stats b"), (b) => b.textContent).join(","), opLevel: document.querySelector(".nsk-post .nsmax-author-level")?.textContent, pending: document.querySelectorAll(".nsmax-author-level[data-nsmax-pending]").length }; const t0 = performance.now(); while (performance.now() - t0 < 200) {}</script>`;
	html = (html.slice(0, start) + moduleScript + html.slice(end)).replace("</body>", config + "</body>");
	const init = `if (window.top === window) {
		localStorage.setItem("nsmax:members", JSON.stringify({ "10": { at: Date.now(), rank: 5, coin: 2048, stardust: 30, nPost: 12, nComment: 88 } }));
		window.__shifts = []; window.__fcp = 0;
		new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === "first-contentful-paint") window.__fcp = e.startTime; }).observe({ type: "paint", buffered: true });
		new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__shifts.push([e.startTime, e.value]); }).observe({ type: "layout-shift", buffered: true });
	}`;
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-author-col[data-nsmax-filled]").length === 3, null, { timeout: 6e3 });
		await wait(page, 600);
		const state = await page.evaluate(() => ({
			atModule: window.__atModule,
			fcp: window.__fcp > 0,
			late: +window.__shifts.filter(([time]) => time > window.__fcp).reduce((sum, [, value]) => sum + value, 0).toFixed(4),
			reply: [document.querySelector('li[id="1"] > .nsmax-author-col .nsmax-author-level')?.textContent, Array.from(document.querySelectorAll('li[id="1"] > .nsmax-author-col .nsmax-author-stats b'), (b) => b.textContent).join(",")],
			stored: Object.keys(JSON.parse(localStorage.getItem("nsmax:members") || "{}")).sort()
		}));
		assert.deepEqual(state.atModule, { crumb: true, nested: true, cols: 3, opStats: "100,2048,30", opLevel: "Lv.5", pending: 2 }, "站点模块脚本跑之前：面包屑、楼中楼、作者栏都在；楼主（本机记下过）的等级和数字已经是完整的，另外两位先占着位置");
		assert.equal(state.fcp, true);
		assert.ok(state.late < 0.001, "第一帧之后页面不再跳：" + state.late);
		assert.deepEqual(state.reply, ["Lv.3", "913,1107,19"], "读到资料后换上");
		assert.deepEqual(state.stored, ["10", "11", "12"], "读过的人记在本机，下次直接显示");
		assert.ok((calls["/api/account/getInfo/11"] || 0) + (calls["/api/account/getInfo/12"] || 0) === 2 && !calls["/api/account/getInfo/10"], "记下过（10 分钟内）的不再读：" + JSON.stringify(calls));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十五批（2026-10-20）：点开帖子之前先备好——鼠标在列表标题上停 0.25 秒以上，就在后台准备好这篇帖子的作者资料、作者头像和前几张图（点开时作者栏第一帧就是完整的，图片直接出来）；悬停预览同一篇只取一次网页（以前取两遍）；扫过不停留的不准备", async () => {
	const imagePost = postPage().replace("</article>", '<p><img src="https://img.example.org/a.png" alt="图一"></p><p><img src="https://img.example.org/b.png" alt="图二"></p></article>');
	const requests = [];
	const init = `if (window.top === window) document.addEventListener("DOMContentLoaded", () => { window.__atDcl = { filled: document.querySelectorAll(".nsmax-author-col[data-nsmax-filled]").length, pending: document.querySelectorAll(".nsmax-author-level[data-nsmax-pending]").length, level: document.querySelector(".nsk-post .nsmax-author-level")?.textContent || "" }; });`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init: init + CHECKED_INIT, viewport: { width: 1440, height: 900 }, pages: { "/post-1000-1": imagePost, "/post-1001-1": postPage() }, beforeNavigate: (page) => page.on("request", (request) => requests.push([request.url(), request.resourceType()])) });
	try {
		await page.waitForSelector("ul.post-list > li.post-list-item .post-title a[href='/post-1001-1']");
		await wait(page, 600);
		const titles = page.locator("ul.post-list > li.post-list-item .post-title a");
		// 1001：扫过（不到 0.25 秒）——只取预览用的网页，不准备作者和图片
		await titles.nth(1).hover();
		await page.waitForTimeout(120);
		await page.mouse.move(5, 5);
		await page.waitForTimeout(500);
		const stored = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("nsmax:members") || "{}")).sort());
		assert.deepEqual(await stored(), [], "扫过的不准备作者资料");
		// 1000：停 0.6 秒——作者资料（楼主 + 三层回复的作者）、头像、前两张图都在后台取好
		await titles.nth(0).hover();
		await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("nsmax:members") || "{}")).length >= 4, null, { timeout: 5e3 });
		await page.waitForTimeout(300);
		assert.deepEqual(await stored(), ["10", "11", "12", "13"]);
		const urls = requests.map(([url]) => url);
		assert.ok(urls.includes("https://img.example.org/a.png") && urls.includes("https://img.example.org/b.png"), "前几张图提前下载");
		assert.ok(["/avatar/10.png", "/avatar/11.png"].every((path) => urls.includes("https://www.nodeseek.com" + path)), "作者头像提前下载");
		assert.equal(requests.filter(([url, type]) => url === "https://www.nodeseek.com/post-1000-1" && (type === "fetch" || type === "xhr")).length, 1, "预览和准备共用一次请求");
		assert.deepEqual(errors, []);
		// 点开：作者栏在页面解析完（DOMContentLoaded）时已经是完整的，没有「等级先空着、再闪出来」
		await titles.nth(0).click();
		await page.waitForURL("https://www.nodeseek.com/post-1000-1");
		await page.waitForFunction(() => window.__atDcl);
		const atDcl = await page.evaluate(() => window.__atDcl);
		assert.equal(atDcl.pending, 0, "没有等着读的等级");
		assert.ok(atDcl.filled >= 3, "作者栏一出来就是完整的：" + JSON.stringify(atDcl));
		assert.equal(atDcl.level, "Lv.3");
	} finally { await context.close(); }
});

test("第十五批（2026-10-20）：帖子页首屏以外楼层的作者资料，页面加载完空下来就低优先级读好（以前要滚到附近才读，滚得快时等级晚一步才出来）；读到之前等级看不见、数字淡色「—」，读到后淡入", async () => {
	// 12 层回复、各是不同的人：前 5 位（楼主 + 4 层）马上读，其余加载完再读
	const floors = Array.from({ length: 12 }, (_, i) => `<li class="content-item" id="${i + 1}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><a href="/space/${200 + i}"><img src="/avatar/${200 + i}.png" class="avatar-normal"></a></div> <div><div class="author-info"><a href="/space/${200 + i}" class="author-name">u${200 + i}</a></div> <div class="content-info"><span class="date-created"><time datetime="2026-10-03T04:00:00.000Z">1h ago</time></span></div></div> <div class="floor-link-wrapper"><a href="#${i + 1}" class="floor-link">#${i + 1}</a></div></div> <article class="post-content"><p>第 ${i + 1} 楼</p></article></li>`).join("");
	const html = postPage().replace(/<ul class="comments">[\s\S]*?<\/ul>/, `<ul class="comments">${floors}</ul>`);
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-author-col[data-nsmax-filled]").length === 13, null, { timeout: 8e3 });
		const state = await page.evaluate(() => {
			const last = document.querySelector('li[id="12"] > .nsmax-author-col');
			return { pending: document.querySelectorAll(".nsmax-author-level[data-nsmax-pending], .nsmax-author-stats[data-nsmax-pending]").length, opacity: getComputedStyle(last.querySelector(".nsmax-author-level")).opacity, transition: getComputedStyle(last.querySelector(".nsmax-author-level")).transitionProperty, scrolled: scrollY };
		});
		assert.equal(state.scrolled, 0, "没滚动也都读好了");
		assert.equal(state.pending, 0);
		assert.equal(state.opacity, "1");
		assert.equal(state.transition, "opacity", "等级徽章淡入");
		const read = Object.keys(calls).filter((key) => key.startsWith("/api/account/getInfo/2")).length;
		assert.equal(read, 12, "每位作者都读了：" + read);
		assert.ok(Object.entries(calls).filter(([key]) => key.startsWith("/api/account/getInfo/2")).every(([, count]) => count === 1), "每位只读一次：" + JSON.stringify(calls));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 第十六批（2026-10-20）
test("第十六批（2026-10-20）：在新标签页打开的帖子链接，悬停时也用浏览器原生预取（Speculation Rules，新标签页里也用得上）；不再插 <link rel=prefetch>（站点网页没有缓存头，点开时用不上，每次悬停白取一遍）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await wait(page, 1200);
		const link = page.locator("ul.post-list .post-title a").nth(1);
		await link.evaluate((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
		const href = await link.evaluate((a) => a.href);
		await link.hover();
		await wait(page, 400);
		const state = await page.evaluate((href) => ({
			rules: Array.from(document.querySelectorAll("script[type=speculationrules]")).some((s) => (JSON.parse(s.textContent).prefetch || []).some((rule) => rule.urls.includes(href))),
			links: document.querySelectorAll("link[rel=prefetch]").length
		}), href);
		assert.equal(state.rules, true, "新标签页打开的也用 Speculation Rules 预取");
		assert.equal(state.links, 0, "不再插 <link rel=prefetch>");
		// 中键（在新标签页打开）按下时也先开始取
		const other = page.locator("ul.post-list .post-title a").nth(3);
		const otherHref = await other.evaluate((a) => a.href);
		await other.evaluate((a) => a.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 1 })));
		assert.equal(await page.evaluate((href) => Array.from(document.querySelectorAll("script[type=speculationrules]")).some((s) => s.textContent.includes(href)), otherHref), true, "中键按下也预取");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十六批（2026-10-20）：帖子预览卡取网页用普通优先级（以前和「点开之前先备好」一样是低优先级，页面上图片多时卡片要排在图片后面）", async () => {
	const pages = {};
	for (let i = 0; i < 6; i++) pages[`/post-${1000 + i}-1`] = postPage();
	const init = "window.__fetches = []; const nsmaxOriginalFetch = window.fetch; window.fetch = function (input, options) { try { const url = new URL(input instanceof Request ? input.url : String(input), location.href); if (/^\\/post-\\d+/.test(url.pathname)) window.__fetches.push([url.pathname, (options && options.priority) || 'auto']); } catch {} return nsmaxOriginalFetch.apply(this, arguments); };";
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages, init: init + CHECKED_INIT, viewport: { width: 1280, height: 900 } });
	try {
		await wait(page, 1200);
		await page.locator("ul.post-list .post-title a").first().hover();
		await page.waitForFunction(() => window.__fetches.some(([path]) => path === "/post-1000-1"), null, { timeout: 5e3 });
		await wait(page, 500);
		const fetches = await page.evaluate(() => window.__fetches.filter(([path]) => path === "/post-1000-1"));
		assert.equal(fetches.length, 1, "预览和准备共用一次请求：" + JSON.stringify(fetches));
		assert.equal(fetches[0][1], "auto", "预览卡用普通优先级");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十六批（2026-10-20）：多页评论区的下一页预取、首屏以外楼层的作者资料，不再等页面上所有图片下完（load）——图床慢的帖子以前要多等好几秒", async () => {
	// 12 层回复、各是不同的人，每层很高（后几层离首屏很远）；主帖里一张图一直下不完，页面的 load 一直不来
	const floors = Array.from({ length: 12 }, (_, i) => `<li class="content-item" id="${i + 1}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><a href="/space/${200 + i}"><img src="/avatar/${200 + i}.png" class="avatar-normal"></a></div> <div><div class="author-info"><a href="/space/${200 + i}" class="author-name">u${200 + i}</a></div> <div class="content-info"><span class="date-created"><time datetime="2026-10-03T04:00:00.000Z">1h ago</time></span></div></div> <div class="floor-link-wrapper"><a href="#${i + 1}" class="floor-link">#${i + 1}</a></div></div> <article class="post-content"><p style="height:320px">第 ${i + 1} 楼</p></article></li>`).join("");
	const first = postPage().replaceAll("/page-2", "/post-1000-2").replace(/<ul class="comments">[\s\S]*?<\/ul>/, `<ul class="comments">${floors}</ul>`).replace("</article>", '<p><img src="https://img.example.org/hang.png" alt="慢图"></p></article>');
	const second = postPage().replace('id="1"', 'id="21"').replace('id="2"', 'id="22"').replace('id="3"', 'id="23"').replaceAll('class="pager-pos pager-cur">1', 'class="pager-pos pager-cur">2').replaceAll('class="pager-next"', 'class="pager-end"');
	const requested = [];
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
		html: first, viewport: { width: 1280, height: 900 }, pages: { "/post-1000-2": second },
		beforeNavigate: (p) => {
			p.on("request", (request) => requested.push(new URL(request.url()).pathname));
			return p.route("https://img.example.org/hang.png", () => {});
		}
	});
	try {
		await page.waitForSelector("button.nspp-action");
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-author-col").length >= 13);
		const start = Date.now();
		while (Date.now() - start < 6e3) {
			const authors = Object.keys(calls).filter((key) => key.startsWith("/api/account/getInfo/2")).length;
			if (authors === 12 && requested.includes("/post-1000-2")) break;
			await wait(page, 200);
		}
		assert.equal(await page.evaluate(() => document.readyState), "interactive", "图片还没下完，load 没来");
		assert.equal(requested.filter((path) => path === "/post-1000-2").length, 1, "没等 load 就取好了下一页");
		const authors = Object.keys(calls).filter((key) => key.startsWith("/api/account/getInfo/2"));
		assert.equal(authors.length, 12, "没等 load 就读好了每位作者：" + authors.join());
		assert.equal(await page.locator("ul.comments > li.content-item").count(), 12, "没往下看时不接上下一页");
		assert.deepEqual(errors.filter((e) => !/hang\.png|ERR_|net::/i.test(e)), []);
	} finally { await context.close(); }
});

test("第十六批（2026-10-20）：帖子地址打开的是站点出错页（502、帖子不存在，页面上没有 .nsk-post）时脚本不报错——以前找主帖时用了不合法的选择器 .content-item#0，直接抛错，整轮整理中断；2026-10-21 起整页换成分栏出错卡片", async () => {
	const html = "<!doctype html><html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>";
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-9999-1", { html, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-error-split", { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const card = document.querySelector(".nsmax-error-split");
			return {
				code: card.querySelector(".nsmax-error-code").textContent,
				title: card.querySelector(".nsmax-error-title").textContent,
				primary: card.querySelector(".nsmax-error-primary").textContent,
				secondary: card.querySelector(".nsmax-error-secondary").textContent,
				searchAction: card.querySelector(".nsmax-error-form")?.getAttribute("action"),
				columns: getComputedStyle(card).gridTemplateColumns.split(" ").length
			};
		});
		assert.deepEqual(state, { code: "502", title: "出错了", primary: "回到首页", secondary: "返回上一页", searchAction: "/search", columns: 2 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十六批（2026-10-20）：在后台打开的多页帖子（中键一次开好几篇），页面不可见时不预取下一页；切到这个标签页时马上取好，不用等开始滚动", async () => {
	const first = postPage().replaceAll("/page-2", "/post-1000-2");
	const second = postPage().replace('id="1"', 'id="4"').replace('id="2"', 'id="5"').replace('id="3"', 'id="6"').replaceAll('class="pager-pos pager-cur">1', 'class="pager-pos pager-cur">2').replaceAll('class="pager-next"', 'class="pager-end"');
	// 模拟后台标签页：document.hidden 先是 true，之后切到前台
	const init = "window.__fakeHidden = true; Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return window.__fakeHidden; } }); Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { return window.__fakeHidden ? 'hidden' : 'visible'; } });";
	const requested = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: first, init, viewport: { width: 1280, height: 500 }, pages: { "/post-1000-2": second }, beforeNavigate: (p) => p.on("request", (request) => requested.push(new URL(request.url()).pathname)) });
	try {
		await page.waitForSelector("button.nspp-action");
		await wait(page, 3200);
		assert.equal(requested.filter((path) => path === "/post-1000-2").length, 0, "后台时不预取");
		await page.evaluate(() => { window.__fakeHidden = false; document.dispatchEvent(new Event("visibilitychange")); });
		await wait(page, 600);
		assert.equal(requested.filter((path) => path === "/post-1000-2").length, 1, "切到前台就取好下一页");
		assert.equal(await page.locator("ul.comments li.content-item").count(), 3, "没往下看时不接上");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("元信息（2026-10-20）：@include 都是能解析出站点的写法（篡改猴「站点」列不再是问号）", () => {
	const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "nodeseek-max.user.js"), "utf8");
	const header = source.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==/m)[0];
	const includes = [...header.matchAll(/^\/\/ @include\s+(\S+)\s*$/gm)].map((match) => match[1]);
	// 篡改猴只有在脚本带 @include 时才按 @include 画「站点」列；正则写法解析不出域名，那一格就只剩一个问号
	assert.deepEqual(includes.filter((line) => line.startsWith("/")), [], "正则 @include 会让「站点」列显示问号，改成 * 通配写法");
	assert.equal(includes.includes("*://www.google.*/url*"), true, "Google 跳转页还要能匹配");
	assert.match(header, /^\/\/ @match\s+https:\/\/www\.nodeseek\.com\/\*$/m);
	assert.match(header, /^\/\/ @include\s+https:\/\/www\.nodeseek\.com\/\*$/m, "保留站内 @include，「站点」列才画 NodeSeek 的图标");
});

test("主题 CSS 短名化（2026-10-21）：特异度垫片不再用长名字、样式仍是合法 CSS", () => {
	const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "nodeseek-max.user.js"), "utf8");
	const themeLine = source.split("\n").find((line) => line.startsWith("\tvar nsmax_theme_segments = "));
	const line = JSON.parse(themeLine.slice("\tvar nsmax_theme_segments = ".length, -1)).map(([, css]) => css).join("");
	assert.equal(/#nsmax-(?:u|lv|b|c|d|s|a|e)\b/.test(line), false, "垫片 ID 要短名化成 #x，不然每条选择器白占几个字节");
	assert.equal(/\.nsmax-s\b/.test(line), false, "垫片类要短名化成 .x");
	assert.equal(line.includes("[data-nsmax-palette=claude]"), false, "palette 门控恒真，换成 :root");
	assert.ok(line.includes(":is(#x, *)") || line.includes("#x#x#x), *"), "特异度垫片还在（只是变短了）");
});


test("手机分页（2026-10-20）：≤560px 页码缩到 30px、上一页 / 下一页只画箭头，读屏仍有名称；宽屏不变", async () => {
	const html = listPage().replaceAll('<span aria-disabled="true" class="pager-prev"><div class="triangle-left"></div></span>', '<a class="pager-prev" href="/page-1"><div class="triangle-left"></div></a>');
	const readPager = (page) => page.evaluate(() => {
		const pager = document.querySelector(".nsk-pager.pager-bottom");
		const one = (el) => {
			if (!el) return null;
			const style = getComputedStyle(el);
			const before = getComputedStyle(el, "::before");
			return { text: el.textContent.trim(), label: el.getAttribute("aria-label"), font: style.fontSize, minWidth: style.minWidth, before: before.content, mask: before.maskImage || before.webkitMaskImage, height: Math.round(el.getBoundingClientRect().height) };
		};
		return { next: one(pager?.querySelector("a.pager-next")), prev: one(pager?.querySelector("a.pager-prev")), gap: pager?.firstElementChild ? getComputedStyle(pager.firstElementChild).gap : "", number: Math.round(pager?.querySelector(".pager-pos")?.getBoundingClientRect().height || 0) };
	});
	const phone = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 420, height: 900 } });
	try {
		await phone.page.waitForSelector("html[data-nsmax-theme]");
		await wait(phone.page);
		const state = await readPager(phone.page);
		assert.ok(state.next && state.prev, "手机上两个翻页按钮都要在");
		assert.equal(state.next.text, "下一页");
		assert.equal(state.prev.text, "上一页");
		assert.equal(state.next.label, "下一页");
		assert.equal(state.prev.label, "上一页");
		assert.equal(state.next.font, "0px", "文字藏起来，只留箭头");
		assert.equal(state.next.before, '"\u203a"');
		assert.equal(state.prev.before, '"\u2039"');
		// 2026-10-23\uff1a\u7bad\u5934\u53ea\u662f\u8fd9\u4e2a\u5b57\u7b26\u2014\u2014\u65e7\u7684\u73b0\u4ee3\u4e3b\u9898\u5c42\u7ed9\u5b83\u53e0\u7684 16px \u906e\u7f69\u6e05\u6389\uff08iPhone \u4e0a\u7bad\u5934\u4e0a\u4e0b\u591a\u51fa\u4e24\u9053\u7ebf\uff09\uff1b\u548c\u6570\u5b57\u4e00\u6837\u9ad8
		assert.equal(state.next.mask, "none");
		assert.equal(state.prev.mask, "none");
		assert.equal(state.next.height, state.number, "\u7bad\u5934\u90a3\u9897\u548c\u6570\u5b57\u9875\u7801\u4e00\u6837\u9ad8");
		assert.equal(state.next.minWidth, "30px");
		assert.equal(state.gap, "4px");
		assert.deepEqual(phone.errors, []);
	} finally { await phone.context.close(); }
	const desktop = await open(browser, "https://www.nodeseek.com/", { html, viewport: { width: 1280, height: 900 } });
	try {
		await desktop.page.waitForSelector("html[data-nsmax-theme]");
		await wait(desktop.page);
		const state = await readPager(desktop.page);
		assert.equal(state.next.text, "下一页");
		assert.notEqual(state.next.font, "0px", "宽屏还是文字");
		assert.equal(state.next.before, "none");
		assert.equal(state.next.label, "下一页", "读屏名称在宽屏也保留");
		assert.deepEqual(desktop.errors, []);
	} finally { await desktop.context.close(); }
});

test("第十五批（2026-10-20）：代码高亮对象键用 sb.sb 的颜色、分页外层 8px、禁用箭头不留空胶囊、站点「..」收掉", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForSelector("html[data-nsmax-theme]");
		await wait(page);
		const colors = await page.evaluate(() => {
			const code = document.querySelector("pre code");
			code.innerHTML = '<span class="hljs-attr">"key"</span>: <span class="hljs-meta">x</span> <span class="hljs-string">"v"</span>';
			const pick = (selector) => getComputedStyle(code.querySelector(selector)).color;
			return { attr: pick(".hljs-attr"), meta: pick(".hljs-meta"), string: pick(".hljs-string") };
		});
		assert.equal(colors.attr, "rgb(228, 86, 73)", "对象键要用 --code-name（sb.sb #e45649），不是高亮模块的绿色");
		assert.equal(colors.meta, "rgb(85, 90, 106)", "标点 / 元信息用 --text-muted");
		assert.equal(colors.string, "rgb(80, 161, 79)", "字符串色不变");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	const wrap = await open(browser, "https://www.nodeseek.com/", { html: listPage({ pagerMode: "wrapped" }), viewport: { width: 1280, height: 900 } });
	try {
		await wrap.page.waitForSelector("html[data-nsmax-theme]");
		await wait(wrap.page);
		const state = await wrap.page.evaluate(() => {
			const pager = document.querySelector(".nsk-pager.pager-bottom");
			const more = pager.querySelector(".pager-more > span:not([class])");
			const off = pager.querySelector("[data-nsmax-pg-off]");
			return { gap: getComputedStyle(pager).gap, moreHidden: more ? more.hidden : null, offHidden: off ? getComputedStyle(off).display === "none" : null };
		});
		assert.equal(state.gap, "8px", "分页外层自己也要 8px（站点把页码包在 span 里时取的是外层的间距）");
		assert.equal(state.moreHidden, true, "站点在 .pager-more 里写死的「..」要收掉，不然和「…」连成「..…」");
		assert.ok(state.offHidden === null || state.offHidden === true, "禁用的上一页 / 下一页不留空胶囊");
		assert.deepEqual(wrap.errors, []);
	} finally { await wrap.context.close(); }
});

test("悬停预览（2026-10-21）：读到主帖 </article> 就渲染，不等后面的回复；前几张图不等可见判定、直接高优先级开取", async () => {
	// 站点把主帖和整页回复塞在同一份 HTML 里；这里让回复永远「还在路上」，预览仍要马上出正文
	const head = '<!doctype html><html><head><title>NodeSeek</title></head><body><section id="nsk-frame"><div id="nsk-body-left"><div class="nsk-post"><article class="post-content"><p>主帖正文，只有这一段。</p><img src="/avatar/1.png" alt="a"><img src="/avatar/2.png" alt="b"><img src="/avatar/3.png" alt="c"><img src="/avatar/4.png" alt="d"></article>';
	const init = `(() => {
		const real = window.fetch.bind(window);
		window.__previewStream = { opened: 0, cancelled: 0 };
		window.fetch = (input, options) => {
			const raw = input && input.url ? input.url : String(input);
			let path = raw;
			try { path = new URL(raw, location.href).pathname; } catch {}
			if (path !== "/post-1000-1") return real(input, options);
			window.__previewStream.opened++;
			const stream = new ReadableStream({
				start(controller) { controller.enqueue(new TextEncoder().encode(${JSON.stringify(head)})); },
				cancel() { window.__previewStream.cancelled++; }
			});
			return Promise.resolve(new Response(stream, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
		};
	})();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.locator(".post-list-item .post-title a").first().hover();
		await page.waitForSelector("dialog.nspp-post-preview .nspp-preview-content p", { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const content = document.querySelector("dialog.nspp-post-preview .nspp-preview-content");
			return {
				text: content.textContent.trim(),
				images: [...content.querySelectorAll("img")].map((image) => ({ loading: image.loading, priority: image.fetchPriority, decoding: image.decoding })),
				stream: window.__previewStream
			};
		});
		assert.match(state.text, /主帖正文/, "读到 </article> 就渲染，不等整页回复");
		assert.equal(state.stream.opened, 1);
		assert.equal(state.stream.cancelled, 1, "读到主帖后要取消后面的回复下载");
		assert.deepEqual(state.images.slice(0, 3).map((image) => [image.loading, image.priority]), [["eager", "high"], ["eager", "high"], ["eager", "high"]]);
		assert.equal(state.images[3].loading, "lazy", "后面的图仍然懒加载");
		assert.equal(state.images[0].decoding, "async");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第十七批（2026-10-21）：登录 / 注册页密码框右侧的「显示 / 隐藏」（照 sb.sb），按钮在输入框里、点了不提交表单", async () => {
	const init = 'window.__submitted = 0; document.addEventListener("submit", () => { window.__submitted++; }, true);';
	for (const [path, render] of [["/signIn.html", signInPage], ["/register.html", registerPage]]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com" + path, { html: render(), init, viewport: { width: 1280, height: 900 } });
		try {
			await page.waitForSelector("input[data-nsmax-password]");
			await page.waitForTimeout(300);
			const toggle = page.locator(".nsmax-password-toggle").first();
			const input = page.locator("input[data-nsmax-password]").first();
			assert.equal(await toggle.innerText(), "显示");
			assert.equal(await input.getAttribute("type"), "password");
			const aligned = await page.evaluate(() => {
				const field = document.querySelector("input[data-nsmax-password]").getBoundingClientRect();
				const button = document.querySelector(".nsmax-password-toggle").getBoundingClientRect();
				return { dy: Math.round((button.top + button.height / 2) - (field.top + field.height / 2)), inside: button.right <= field.right + 0.5 && button.left > field.left };
			});
			assert.ok(Math.abs(aligned.dy) <= 2, "「显示」要在输入框的垂直中线上：" + JSON.stringify(aligned));
			assert.equal(aligned.inside, true, "「显示」要落在输入框内（fieldset 的 legend 会把绝对定位的包含块往下推）");
			await toggle.click();
			assert.equal(await input.getAttribute("type"), "text");
			assert.equal(await toggle.innerText(), "隐藏");
			await toggle.click();
			assert.equal(await input.getAttribute("type"), "password");
			assert.equal(await toggle.innerText(), "显示");
			assert.equal(await page.evaluate(() => window.__submitted), 0, "点「显示」不能提交表单");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("第二十批（2026-10-21）：加载状态不再是一条白色扫光——悬停预览是「小转圈 + 弱化文字」，骨架条自己扫，aria-busy 的高光关掉", async () => {
	const head = '<!doctype html><html><head><title>NodeSeek</title></head><body><section id="nsk-frame"><div id="nsk-body-left"><div class="nsk-post"><article class="post-content"><p>正文来了。</p></article>';
	const init = `(() => {
		const real = window.fetch.bind(window);
		window.fetch = async (input, options) => {
			const raw = input && input.url ? input.url : String(input);
			let path = raw; try { path = new URL(raw, location.href).pathname; } catch {}
			if (path !== "/post-1000-1") return real(input, options);
			await new Promise((resolve) => setTimeout(resolve, 700));
			return new Response(${JSON.stringify(head)}, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
		};
	})();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.locator(".post-list-item .post-title a").first().hover();
		await page.waitForSelector("dialog.nspp-post-preview .nsmax-spinner", { timeout: 5e3 });
		const loading = await page.evaluate(() => {
			const status = document.querySelector("dialog.nspp-post-preview .nsmax-loading");
			const spinner = status.querySelector(".nsmax-spinner");
			const style = getComputedStyle(status);
			const line = document.createElement("span");
			line.className = "nsmax-skeleton-line";
			document.body.append(line);
			const lineStyle = getComputedStyle(line);
			// 先取值再移除：getComputedStyle 是活的，元素一旦离开文档就读不到动画了
			const skeleton = lineStyle.animationName;
			const skeletonBg = lineStyle.backgroundColor;
			line.remove();
			return { busy: status.getAttribute("aria-busy"), sweep: style.animationName, background: style.backgroundImage, spin: getComputedStyle(spinner).animationName, skeleton, skeletonBg };
		});
		assert.equal(loading.busy, "true");
		assert.equal(loading.sweep, "none", "加载中的文字上不再有白色扫光");
		assert.equal(loading.background, "none");
		assert.equal(loading.spin, "nsmax-spin", "加载中是一个小转圈");
		assert.equal(loading.skeleton, "nsmax-skeleton-sweep", "骨架条自己在扫");
		assert.notEqual(loading.skeletonBg, "rgba(0, 0, 0, 0)");
		const skeletonBox = await page.evaluate(() => {
			const box = document.querySelector("dialog.nspp-post-preview .nspp-preview-skeleton");
			return box ? { lines: box.querySelectorAll(".nsmax-skeleton-line").length, widths: [...box.children].map((line) => line.style.width), height: Math.round(box.getBoundingClientRect().height) } : null;
		});
		assert.equal(skeletonBox.lines, 3, "正文没到时先摆 3 行骨架，不是一片空白");
		assert.deepEqual(skeletonBox.widths, ["100%", "76%", "48%"]);
		assert.ok(skeletonBox.height >= 50, JSON.stringify(skeletonBox));
		await page.waitForSelector("dialog.nspp-post-preview .nspp-preview-content p", { timeout: 5e3 });
		assert.equal(await page.evaluate(() => !!document.querySelector("dialog.nspp-post-preview .nsmax-spinner")), false, "加载完转圈收掉");
		assert.equal(await page.evaluate(() => !!document.querySelector("dialog.nspp-post-preview .nspp-preview-skeleton")), false, "加载完骨架收掉");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第二十一批（2026-10-21）：不存在的帖子站点只回 text/plain 的「not found」时，整页换成 sb.sb 的分栏出错卡片（404）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-9999-1", { html: { body: "not found", contentType: "text/plain; charset=utf-8" }, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-error-split", { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const card = document.querySelector(".nsmax-error-split");
			const hero = card.querySelector(".nsmax-error-hero");
			return {
				theme: document.documentElement.hasAttribute("data-nsmax-theme"),
				title: document.title,
				code: card.querySelector(".nsmax-error-code").textContent,
				heading: card.querySelector(".nsmax-error-title").textContent,
				message: card.querySelector(".nsmax-error-message").textContent,
				places: [...card.querySelectorAll(".nsmax-error-places a")].map((link) => link.textContent),
				columns: getComputedStyle(card).gridTemplateColumns.split(" ").length,
				heroBg: getComputedStyle(hero).backgroundColor,
				border: getComputedStyle(card).borderTopWidth,
				searchAction: card.querySelector(".nsmax-error-form")?.getAttribute("action")
			};
		});
		assert.equal(state.theme, true, "主题属性挂上了");
		assert.equal(state.title, "页面不存在 - NodeSeek");
		assert.equal(state.code, "404");
		assert.equal(state.heading, "页面不存在");
		assert.match(state.message, /没有对应的页面/);
		assert.deepEqual(state.places, ["全部主题", "精华", "排行榜", "合作商家"]);
		assert.equal(state.columns, 2, "宽屏是左右分栏");
		assert.equal(state.heroBg, "rgb(255, 208, 47)", "左边是黄底");
		assert.equal(state.border, "1px", "主题样式注入进来了");
		assert.equal(state.searchAction, "/search");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第二十二批（2026-10-21）：楼主信息右边的操作胶囊（引用 回复 编辑 举报）和正文右边缘对齐——经典 / 简洁两种布局、宽窄两种窗口都是，四个胶囊都不会越出正文", async () => {
	for (const simple of [false, true]) {
		for (const width of [1280, 1600]) {
			const init = simple ? "if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}" : "";
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width, height: 900 }, init });
			try {
				await page.waitForSelector(".nsmax-op-actions");
				const state = await page.evaluate(() => {
					const op = document.querySelector(".nsk-post > .content-item");
					const actions = op.querySelector(".nsmax-op-actions");
					// 自己的帖子会多一个「编辑」（站点菜单里有编辑按钮时由脚本补进来）
					if (!actions.querySelector(".nsmax-op-edit")) {
						const edit = document.createElement("a");
						edit.className = "nsmax-op-action nsmax-op-edit";
						edit.textContent = "编辑";
						actions.append(edit);
					}
					const content = op.querySelector(".post-content").getBoundingClientRect();
					const rect = actions.getBoundingClientRect();
					const pills = [...actions.children].map((pill) => pill.getBoundingClientRect());
					return {
						layout: document.documentElement.getAttribute("data-nsmax-post-layout"),
						rows: new Set(pills.map((pill) => Math.round(pill.top))).size,
						count: pills.length,
						gapFromContent: Math.round(content.right - rect.right),
						pillsLeftOfContent: pills.every((pill) => pill.right <= content.right + 1 && pill.left >= content.left - 1),
						aboveContent: rect.top < content.top
					};
				});
				assert.equal(state.layout, simple ? "simple" : "classic");
				assert.equal(state.count, 4);
				assert.equal(state.rows, 1, "四个胶囊在一行");
				assert.ok(Math.abs(state.gapFromContent) <= 1, `${state.layout} ${width}: 和正文右边缘差 ${state.gapFromContent}px`);
				assert.equal(state.pillsLeftOfContent, true, "胶囊不越出正文");
				assert.equal(state.aboveContent, true, "操作胶囊在正文上面（楼主信息那一行）");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	}
});

test("第二十三批（2026-10-21）：私信里粘贴图片——上传成功提示 1.6 秒后自己消失，不会一直挂在编辑器上", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/message?mode=talk&to=7", { html: nativeTalkPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nspp-messages textarea:visible");
		await page.locator('.nspp-message-editor input[type="file"][accept="image/*"]').setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
		await page.waitForFunction(() => /图片已插入草稿/.test(document.querySelector(".nspp-message-editor-status")?.textContent || ""), null, { timeout: 5e3 });
		assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".nspp-message-editor-status")).display), "block");
		assert.match(await page.locator(".nspp-messages textarea").inputValue(), /!\[image\]\(<https:\/\/api\.nodeimage\.com/);
		await page.waitForFunction(() => (document.querySelector(".nspp-message-editor-status")?.textContent || "") === "", null, { timeout: 4e3 });
		assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".nspp-message-editor-status")).display), "none", "提示消失后不占高度");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("第二十四批（2026-10-21）：悬停预览的标题太长时最多两行（超出省略号，全文在 title 属性里）", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		const longTitle = "【已出】出 mkcloud 广港 iepl 308元出 358元那款 11月19日到期 现在只用了 10g 流量 需要的朋友联系我 谢谢支持 走过路过不要错过";
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.evaluate((text) => { document.querySelector(".post-list-item .post-title a").textContent = text; }, longTitle);
		await page.locator(".post-list-item .post-title a").first().hover();
		await page.waitForSelector("dialog.nspp-post-preview:not([hidden])", { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const link = document.querySelector("dialog.nspp-post-preview > header > a");
			const style = getComputedStyle(link);
			return { clamp: style.webkitLineClamp, display: style.display, clipped: link.scrollHeight > link.clientHeight + 1, title: link.getAttribute("title"), text: link.textContent, lines: Math.round(link.getBoundingClientRect().height / parseFloat(style.lineHeight)) };
		});
		assert.equal(state.clamp, "2");
		assert.ok(state.display === "-webkit-box" || state.display === "flow-root", state.display);
		assert.equal(state.clipped, true, "长标题被截成两行");
		assert.equal(state.lines, 2);
		assert.equal(state.title, state.text, "全文在 title 属性里");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.26 提速：主题 CSS 按页面分块注入——每页只解析当前页面需要的段，样式和整份注入逐元素一致", async () => {
	const snapshot = async (html, path, full) => {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com" + path + (full ? (path.includes("?") ? "&" : "?") + "nsmax-all-css=1" : ""), { html, viewport: { width: 1280, height: 900 } });
		await page.waitForSelector("html[data-nsmax-theme]");
		// 浮层样式是首帧后按需注入的：先动一下鼠标，保证两边的浮层段都已经注入再比
		await page.mouse.move(8, 8);
		await wait(page, 1200);
		const state = await page.evaluate(() => {
			const tags = [...document.querySelectorAll("style")].filter((tag) => (tag.textContent || "").includes("data-nsmax-theme"));
			const css = tags.map((tag) => tag.textContent).join("");
			const label = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.classList.length ? "." + [...el.classList].slice(0, 3).join(".") : ""}`;
			// 悬浮工具条（#nspp-tools）里的签到按钮等是异步状态，两次打开的时机可能不同，不比它
			const styles = [...document.body.querySelectorAll("*")].filter((el) => !el.closest("#nspp-tools")).map((el) => {
				const s = getComputedStyle(el);
				return [label(el), s.display, s.position, s.color, s.backgroundColor, s.borderTopWidth, s.borderTopColor, s.borderTopStyle, s.borderRadius, s.padding, s.margin, s.fontSize, s.fontWeight, s.lineHeight, s.height, s.width, s.overflow, s.boxShadow, s.textDecorationLine, s.gap, s.flexDirection, s.alignItems, s.justifyContent, s.gridTemplateColumns, s.textAlign].join("|");
			});
			return { bytes: css.length, styles };
		});
		await context.close();
		return { ...state, errors };
	};
	const pages = [
		["list", "/", listPage()],
		["post", "/post-1000-1", postPage()],
		["notification", "/notification", notificationPage()],
		["setting", "/setting", settingPage()],
		["space", "/space/10", nativeSpacePage()],
		["auth", "/signIn.html", signInPage()],
		["board", "/board", boardRealPage()],
		["fans", "/fans?type=follow", fansPage()],
		["lucky", "/lucky", luckyPage()],
		["search", "/search?q=vps", searchPage()],
		["credit", "/credit", creditPage()]
	];
	for (const [name, path, html] of pages) {
		const chunked = await snapshot(html, path, false);
		const full = await snapshot(html, path, true);
		assert.equal(chunked.errors.length, 0, `${name}: ${chunked.errors[0] || ""}`);
		assert.ok(chunked.bytes < full.bytes * 0.8, `${name}: 分块后注入 ${Math.round(chunked.bytes / 1024)}KB，整份 ${Math.round(full.bytes / 1024)}KB，应该明显更少`);
		assert.equal(chunked.styles.length, full.styles.length, `${name}: 元素数量一致`);
		let diff = -1;
		for (let index = 0; index < full.styles.length; index++) if (chunked.styles[index] !== full.styles[index]) { diff = index; break; }
		assert.equal(diff, -1, `${name}: 第 ${diff} 个元素和整份注入不一致：\n分块 ${chunked.styles[diff]}\n整份 ${full.styles[diff]}`);
	}
});
test("v1.8.28 提速：浮层样式（弹窗 / 用户卡 / 搜索面板 / toast）首帧不注入，首帧后自动补、打开前显式补", async () => {
	const readCss = (page) => page.evaluate(() => [...document.querySelectorAll("style")].filter((tag) => (tag.textContent || "").includes("data-nsmax-theme")).map((tag) => tag.textContent).join(""));
	// 1) ?nsmax-no-overlay-css：完全不注入浮层段（连 toast / 预览的显式补注入也关掉），
	//    不依赖"注入时机"判断，避免自动签到等早期 toast 让断言偶发失败
	const off = await open(browser, "https://www.nodeseek.com/?nsmax-no-overlay-css=1", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await off.page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await off.page.mouse.move(16, 16);
		await wait(off.page, 300);
		const css = await readCss(off.page);
		assert.equal(css.includes(".search-overlay"), false, "关掉浮层注入时，浮层段确实没有注入");
		// 正文样式里有「不在预览卡里」的 :not(.nspp-post-preview …)，那是首帧样式；预览卡本身的样式都写成 dialog.nspp-post-preview
		assert.equal(css.includes("dialog.nspp-post-preview"), false);
		// 2026-10-23：顶栏的 ≡、正文代码块的样式不算浮层（以前被误放进浮层段，首帧之后才补上：≡ 先露出来再藏、代码块变一下样子）
		assert.equal(css.includes(".nsmax-mobile-menu"), true, "顶栏 ≡ 的样式在首帧样式里");
		assert.equal(await off.page.evaluate(() => getComputedStyle(document.querySelector("#nsk-head .nsmax-mobile-menu")).display), "none", "版块放得下：≡ 不显示");
		assert.deepEqual(off.errors, []);
	} finally { await off.context.close(); }
	// 2) 正常页面：没有交互，首帧后空闲时也会自动补上浮层段
	const auto = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await auto.page.waitForFunction(() => [...document.querySelectorAll("style")].some((tag) => (tag.textContent || "").includes(".search-overlay")), null, { timeout: 4e3 });
		assert.deepEqual(auto.errors, []);
	} finally { await auto.context.close(); }
	// 3) 交互打开浮层（悬停预览）：样式完整，卡片圆角 12px
	const preview = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await preview.page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await preview.page.locator(".post-list-item .post-title a").first().hover();
		await preview.page.waitForSelector("dialog.nspp-post-preview:not([hidden])", { timeout: 5e3 });
		const radius = await preview.page.evaluate(() => getComputedStyle(document.querySelector("dialog.nspp-post-preview")).borderRadius);
		assert.equal(radius, "12px");
		const css = await readCss(preview.page);
		assert.equal(css.includes(".nspp-post-preview"), true, "悬停预览的浮层样式已注入");
		assert.deepEqual(preview.errors, []);
	} finally { await preview.context.close(); }
});
test("发布产物压缩（2026-10-22）：用户脚本头部原样保留、注释和空白去掉、语法合法、体积至少小 10%", async () => {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const { execFileSync } = require("node:child_process");
	const root = path.join(__dirname, "..");
	const target = path.join(os.tmpdir(), `nsmax-min-${process.pid}-${Date.now()}.user.js`);
	execFileSync(process.execPath, [path.join(root, "scripts", "minify.mjs"), "--out", target], { cwd: root, stdio: "pipe" });
	try {
		const source = fs.readFileSync(path.join(root, "nodeseek-max.user.js"), "utf8");
		const minified = fs.readFileSync(target, "utf8");
		const header = (content) => content.slice(content.indexOf("// ==UserScript=="), content.indexOf("// ==/UserScript==") + "// ==/UserScript==".length);
		assert.equal(header(minified), header(source), "用户脚本头部要原样保留（Tampermonkey 靠它识别脚本）");
		assert.ok(minified.length < source.length * 0.9, `压缩后 ${minified.length} 字节，应小于源码的 90%（${source.length}）`);
		assert.equal(minified.includes("=== 侧栏热榜"), false, "正文里的注释要去掉");
		// 语法合法
		new (require("node:vm").Script)(minified);
	} finally {
		fs.rmSync(target, { force: true });
	}
});
test("v1.8.34 Telegram 放在资料卡「私信」旁边（同一个按钮样式）：帖子里签名不再重复插标签", async () => {
	const html = postPage().replace("签名：机器不跑路", "联系我 tg: @nodeseekmax 或 ");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		// 签名里不再多插一行（以前会重复）
		assert.equal(await page.locator(".signature .nsmax-signature-contacts, .signature .nsmax-tg").count(), 0, "签名里不再插 Telegram 标签");
		const author = page.locator(".nsk-post .nsmax-author-col a[href*='/space/']").first();
		await author.hover();
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-tg-btn", { timeout: 5e3 });
		const tg = page.locator(".nsmax-person-pop .nsmax-person-tg-btn");
		assert.equal((await tg.innerText()).trim(), "TG", "按钮上只写 TG（2026-10-24）");
		assert.equal(await tg.getAttribute("aria-label"), "Telegram");
		assert.equal(await tg.getAttribute("href"), "https://t.me/nodeseekmax");
		// 顺序：关注 / 私信 / Telegram / 主页；和「私信」同一个按钮样式（同高同字号同 padding）
		const layout = await page.evaluate(() => {
			const pop = document.querySelector(".nsmax-person-pop");
			const items = [...pop.querySelectorAll(".nsmax-person-actions > a, .nsmax-person-actions > button")];
			const tg = pop.querySelector(".nsmax-person-tg-btn");
			const dm = items.find((item) => item.textContent.trim() === "私信");
			const style = (el) => { const cs = getComputedStyle(el); const box = el.getBoundingClientRect(); return { height: Math.round(box.height), font: cs.fontSize, pad: cs.padding, radius: cs.borderTopLeftRadius }; };
			return { order: items.map((item) => item.textContent.trim()), tg: tg ? style(tg) : null, dm: dm ? style(dm) : null, rowLeft: pop.querySelector(".nsmax-person-tg") ? 1 : 0 };
		});
		assert.deepEqual(layout.order, ["关注", "私信", "TG", "主页"]);
		assert.deepEqual(layout.tg, layout.dm, "Telegram 和私信按钮样式一致");
		assert.equal(layout.rowLeft, 0, "不再有统计和底栏之间那一行（不会多一条分割线）");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
test("v1.8.29 列表预览提速：页面空下来先把首屏可见的几篇主帖取好，悬停时直接用、不再等请求", async () => {
	const pages = {};
	for (let index = 0; index < 4; index++) pages[`/post-${1000 + index}-1`] = postPage();
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), pages, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		// 空闲时预取（最多 4 篇）：不用悬停就已经发出主帖请求
		await page.waitForFunction(() => performance.getEntriesByType("resource").filter((entry) => /\/post-\d+-1(?:\.html)?$/.test(entry.name)).length > 0, null, { timeout: 5e3 });
		const prefetched = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\/post-\d+-1(?:\.html)?$/.test(entry.name)).length);
		assert.ok(prefetched <= 4, `预取 ${prefetched} 篇，应不超过 4 篇`);
		// 悬停第一篇：卡片内容直接出来，同一篇不会再请求第二次
		const target = page.locator(".post-list-item .post-title a").first();
		const started = Date.now();
		await target.hover();
		await page.waitForSelector("dialog.nspp-post-preview:not([hidden]) .nspp-preview-content article", { timeout: 5e3 });
		assert.ok(Date.now() - started < 1500, "悬停到预览正文出现应在 1.5 秒内");
		const again = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\/post-1000-1(?:\.html)?$/.test(entry.name)).length);
		assert.equal(again, 1, "同一篇只取一次网页");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.29 私信不用刷新：面板开着时自动读到新消息（轮询间隔可用 ?nsmax-msg-poll=1 缩短）", async () => {
	const old = { id: 21, sender_id: 10, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "在吗？", viewed: 1, created_at: new Date(Date.now() - 36e5).toISOString() };
	const fresh = { id: 24, sender_id: 10, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "刚发的新消息", viewed: 0, created_at: new Date().toISOString() };
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/notification?nsmax-msg-poll=1#/message?mode=talk&to=10", {
		html: nativeTalkPage(),
		viewport: { width: 1280, height: 900 },
		api: {
			"/api/notification/message/with/10": [
				{ status: 200, body: { success: true, talkTo: { member_id: 10, member_name: "friend" }, msgArray: [old] } },
				{ status: 200, body: { success: true, talkTo: { member_id: 10, member_name: "friend" }, msgArray: [old, fresh] } }
			]
		}
	});
	try {
		await page.waitForSelector(".nspp-messages textarea:visible");
		await page.waitForFunction(() => (document.querySelector(".nspp-messages-thread")?.textContent || "").includes("在吗"));
		// 不刷新、不点击：等自动轮询把新消息读进来
		await page.waitForFunction(() => (document.querySelector(".nspp-messages-thread")?.textContent || "").includes("刚发的新消息"), null, { timeout: 8e3 });
		assert.ok(calls["/api/notification/message/with/10"] >= 2, "轮询确实又请求了一次会话");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.29 资料页不再闪：站点整块重画主栏时，换上来的原样资料卡在下一帧之前就改好（2026-10-23 起不用再遮一帧）", async () => {
	// 站点原样的主栏（还没被脚本整理过）
	const native = nativeSpacePage().match(/<section id="nsk-frame">([\s\S]*?)<\/section>/)[1];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", { html: nativeSpacePage(), viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-space-top");
		await wait(page, 300);
		const state = await page.evaluate((html) => new Promise((resolve) => {
			// 模拟站点水合：主栏整块换成站点原样画的（原来的节点被移除、新的节点加进来）
			const frame = document.querySelector("#nsk-frame");
			const fresh = document.createElement("template");
			fresh.innerHTML = html;
			frame.replaceChildren(...fresh.content.childNodes);
			requestAnimationFrame(() => resolve({
				top: !!document.querySelector(".head-container > .nsmax-space-top"),
				raw: !!document.querySelector(".head-container > img"),
				masked: document.documentElement.hasAttribute("data-nsmax-space-swap"),
				opacity: getComputedStyle(frame).opacity
			}));
		}), native);
		assert.equal(state.top, true, "下一帧之前就是 sb.sb 资料卡");
		assert.equal(state.raw, false, "原样的头像不露出来");
		assert.equal(state.masked, false, "已经改好了，不用遮");
		assert.equal(state.opacity, "1");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
test("v1.8.29 自动翻页 + 楼中楼 + 回复：接上来的下一页当场收进楼中楼，回复框不被卷进去", async () => {
	const first = postPage().replaceAll("/page-2", "/post-1000-2");
	// 第二页：一条回复第 1 层的楼中楼（站点原文是「@某某 #1」两个链接），没有下一页
	let second = postPage();
	const start = second.indexOf('<ul class="comments">') + '<ul class="comments">'.length;
	second = second.slice(0, start) + '<li class="content-item" id="4"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><a href="/space/14"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjY2NjIi8+PC9zdmc+" alt="replier" class="avatar-normal"></a></div><div><div class="author-info"><a href="/space/14" class="author-name">replier</a></div></div></div><article class="post-content"><p><a href="/post-1000-1#1">@buyer</a> <a href="/post-1000-1#1">#1</a> 我也是</p></article></li>' + second.slice(second.indexOf("</ul>", start));
	second = second.replace(/<div class="nsk-pager post-top-pager">[\s\S]*?<\/div>/, '<div class="nsk-pager post-top-pager"></div>').replace(/<div class="nsk-pager post-bottom-pager">[\s\S]*?<\/div>/, '<div class="nsk-pager post-bottom-pager"></div>');
	const requested = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: first, viewport: { width: 1280, height: 500 }, pages: { "/post-1000-2": second }, beforeNavigate: async (browserPage) => { browserPage.on("request", (request) => { if (/\/post-\d+-\d+$/.test(new URL(request.url()).pathname)) requested.push(new URL(request.url()).pathname); }); } });
	try {
		await page.waitForSelector("button.nspp-action");
		await page.waitForFunction(() => document.readyState === "complete");
		await wait(page, 2200);
		await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
		await page.waitForSelector('li[id="4"]', { state: "attached", timeout: 5e3 });
		// 接上来时就已在楼中楼里：不是先平铺、过一会儿再收
		assert.equal(await page.locator('ul.comments > li.content-item[id="4"]').count(), 0, "第 4 楼应直接进楼中楼");
		assert.equal(await page.locator('li.content-item[id="1"] > .nsmax-floor-box .nsmax-nested-replies > li.content-item[id="4"]').count(), 1);
		assert.equal(await page.locator('li.content-item[id="1"] > .nsmax-floor-box .nsmax-fb-count').first().innerText(), "共 1 条回复");
		// 回复框仍在评论区底部，没有被楼中楼或自动翻页卷进去
		const reply = await page.evaluate(() => {
			const editor = document.querySelector(".md-editor, textarea");
			if (!editor) return { found: false };
			const list = document.querySelector("ul.comments");
			return { found: true, inNested: !!editor.closest(".nsmax-nested-replies"), afterList: !!(list && (list.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING)), floors: document.querySelectorAll("ul.comments > li.content-item").length, total: document.querySelectorAll("ul.comments li.content-item").length };
		});
		assert.equal(reply.found, true);
		assert.equal(reply.inNested, false);
		assert.equal(reply.afterList, true, "回复框还在评论区下面");
		assert.equal(reply.floors, 3, "顶层楼层：原来的 3 条 + 第 4 楼已收进楼中楼");
		assert.equal(reply.total, 4);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.30 主帖头部：站点原生的纯文字「编辑」收起（只留操作胶囊里那个）；时间 / 编辑于 / 编辑 同一行 12.5px", async () => {
	let html = postPage();
	// 模拟站点真实的登录态主帖头部：content-info 里有一个纯文字「编辑」链接；comment-menu 里也有一个编辑按钮
	html = html.replace(/<div class="content-info">/, '<div class="content-info"><a href="/edit-discussion/1000" class="edit-link">编辑</a>');
	html = html.replace(/<div class="comment-menu">/, '<div class="comment-menu"><a class="menu-item" data-nsmax-action="edit" title="编辑">编辑</a>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-op-edit");
		const state = await page.evaluate(() => {
			const meta = document.querySelector(".nsk-post > .content-item > .nsk-content-meta-info");
			const info = meta?.querySelector(".content-info");
			const inline = info?.querySelector("a.edit-link");
			const pill = meta?.querySelector(".nsmax-op-edit");
			const sizes = [...(info?.children || [])].filter((el) => el.getBoundingClientRect().height > 0).map((el) => ({ text: el.textContent.trim().slice(0, 8), size: getComputedStyle(el).fontSize, top: Math.round(el.getBoundingClientRect().top) }));
			return {
				inlineDisplay: inline ? getComputedStyle(inline).display : "missing",
				pillText: pill?.textContent?.trim(),
				pillVisible: !!pill && getComputedStyle(pill).display !== "none",
				visibleEdits: [...document.querySelectorAll(".nsk-post > .content-item a, .nsk-post > .content-item button")].filter((el) => el.textContent.trim() === "编辑" && getComputedStyle(el).display !== "none").length,
				sizes,
				rowTops: [...new Set(sizes.map((item) => item.top))].length
			};
		});
		assert.equal(state.inlineDisplay, "none", "站点自带的纯文字「编辑」要收起来");
		assert.equal(state.pillVisible, true);
		assert.equal(state.pillText, "编辑");
		assert.equal(state.visibleEdits, 1, "整块头部只留一个「编辑」");
		assert.ok(state.sizes.every((item) => item.size === "12.5px"), JSON.stringify(state.sizes));
		assert.equal(state.rowTops, 1, "时间 / 编辑于 / 编辑 在同一基线上");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.34 列表页悬停 / 个人主页资料卡：接口返回的纯文字 Telegram 也能直接打开（与私信同排按钮）", async () => {
	const post = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		viewport: { width: 1280, height: 900 },
		api: { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail: { member_id: 10, member_name: "user0", rank: 3, coin: 100, nPost: 2, nComment: 3, signature: "电报：@iamvicliu", created_at: new Date(Date.now() - 864e5 * 30).toISOString() } } }] }
	});
	try {
		const avatar = post.page.locator(".post-list > li").first().locator("a[href*='/space/']").first();
		await avatar.hover();
		await post.page.waitForSelector(".nsmax-person-pop .nsmax-person-tg-btn", { timeout: 5e3 });
		assert.equal(await post.page.locator(".nsmax-person-pop .nsmax-person-tg-btn").getAttribute("href"), "https://t.me/iamvicliu");
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
	const space = await open(browser, "https://www.nodeseek.com/space/10", {
		html: nativeSpacePage(),
		viewport: { width: 1440, height: 900 },
		api: { "/api/account/getInfo/10": [{ status: 200, body: { success: true, detail: { member_id: 10, member_name: "Steve", rank: 3, coin: 100, nPost: 2, nComment: 3, signature: "电报：@steve_tg", created_at: new Date(Date.now() - 864e5 * 30).toISOString() } } }] }
	});
	try {
		await space.page.waitForSelector(".nsmax-space-top");
		await space.page.waitForSelector(".nsmax-space-tg-btn", { timeout: 5e3 });
		const btn = space.page.locator(".nsmax-space-tg-btn");
		assert.equal(await btn.getAttribute("href"), "https://t.me/steve_tg");
		assert.equal((await btn.innerText()).trim(), "TG", "资料页按钮只写 TG，不再写全 Telegram（太挤）");
		const prev = await btn.evaluate((el) => el.previousElementSibling?.textContent?.trim() || "");
		assert.equal(prev, "私信", "Telegram 紧跟「私信」按钮");
		assert.deepEqual(space.errors, []);
	} finally { await space.context.close(); }
});
test("v1.8.33 楼中楼一条的头部：时间 / #楼号 / 回复引用点赞… 同一行同一基线，字号行高一致", async () => {
	const first = postPage().replaceAll("/page-2", "/post-1000-2");
	const second = postPage().replace('id="1"', 'id="4"').replace('id="2"', 'id="5"').replace('id="3"', 'id="6"').replace("收了，私信你", '<a href="/space/11">@buyer</a> <a href="/post-1000-1#1">#1</a> 本地楼中楼').replaceAll('class="pager-pos pager-cur">1', 'class="pager-pos pager-cur">2').replace(/<a[^>]*class="pager-next"[^>]*>.*?<\/a>/, "");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: first, pages: { "/post-1000-2": second }, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("button.nspp-action");
		await page.locator("button.nspp-action").filter({ hasText: "加载下一页" }).click({ force: true });
		await page.waitForSelector('li[id="1"]>.nsmax-floor-box>.nsmax-nested-replies>li[id="4"]');
		await page.waitForTimeout(400);
		const state = await page.evaluate(() => {
			const row = document.querySelector('li[id="1"]>.nsmax-floor-box>.nsmax-nested-replies>li[id="4"]');
			const parts = [row.querySelector(".content-info time"), row.querySelector(".nsmax-floor-actions .floor-link"), ...row.querySelectorAll(".nsmax-floor-actions .comment-menu .menu-item")].filter(Boolean);
			const box = (el) => el.getBoundingClientRect();
			return {
				count: parts.length,
				fonts: [...new Set(parts.map((el) => getComputedStyle(el).fontSize))],
				lines: [...new Set(parts.map((el) => getComputedStyle(el).lineHeight))],
				tops: parts.map((el) => Math.round(box(el).top * 10) / 10),
				heights: [...new Set(parts.map((el) => Math.round(box(el).height)))]
			};
		});
		assert.ok(state.count >= 7, "时间 + #楼号 + 5 个操作都量到");
		assert.deepEqual(state.fonts, ["12px"]);
		assert.deepEqual(state.lines, ["21px"]);
		assert.ok(Math.max(...state.tops) - Math.min(...state.tops) <= 1, "同一基线：" + JSON.stringify(state.tops));
		assert.deepEqual(state.heights, [21]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.35 列表页资料卡：帖子外面也有 Telegram（从他最近一篇主帖 / 回复的签名里找到，记住 30 天，换页不再查）；关注 / 私信 / Telegram / 主页 四个按钮排一行", async () => {
	// user0（10）：发过主帖，签名里有 t.me 链接；user1（11）：没发过主帖，最近一条回复在第 12 楼（第 2 页），签名是纯文字「电报：@buyer_tg」
	const opPost = postPage().replace("签名：机器不跑路", '联系 <a href="https://t.me/seller_tg">Telegram</a> ');
	const replyPage = postPage().replace('<li class="content-item" id="1">', '<li class="content-item" id="12">').replace("<p>收了，私信你</p></article>", '<p>收了，私信你</p></article><div class="signature">电报：@buyer_tg</div>');
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(),
		pages: { "/post-2000-1": opPost, "/post-3000-2": replyPage },
		viewport: { width: 1280, height: 900 },
		api: {
			"/api/content/list-discussions": [{ status: 200, body: { success: true, discussions: [{ rank: 0, title: "出一台小鸡", post_id: 2000 }] } }, { status: 200, body: { success: true, discussions: [] } }],
			"/api/content/list-comments": [{ status: 200, body: { success: true, comments: [{ post_id: 3000, title: "收一台小鸡", rank: 0, floor_id: 12, text: "收了，私信你" }] } }]
		}
	});
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const hover = async (index) => {
			await page.mouse.move(5, 5);
			await page.waitForFunction(() => !document.querySelector(".nsmax-person-pop:not([hidden])"), null, { timeout: 3e3 }).catch(() => {});
			await page.locator(".post-list > li").nth(index).locator("a[href*='/space/']").first().hover();
			await page.waitForSelector(".nsmax-person-pop .nsmax-person-tg-btn", { timeout: 5e3 });
			return page.locator(".nsmax-person-pop .nsmax-person-tg-btn").getAttribute("href");
		};
		assert.equal(await hover(0), "https://t.me/seller_tg", "主帖签名里的 Telegram");
		const row = await page.evaluate(() => {
			const items = [...document.querySelectorAll(".nsmax-person-pop .nsmax-person-actions > :is(a, button)")];
			return { order: items.map((el) => el.textContent.trim()), rows: new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size, clipped: items.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim()), heights: [...new Set(items.map((el) => Math.round(el.getBoundingClientRect().height)))] };
		});
		assert.deepEqual(row.order, ["关注", "私信", "TG", "主页"]);
		assert.equal(row.rows, 1, "四个按钮在同一行，不再 3 + 1 换行");
		assert.deepEqual(row.clipped, [], "按钮里的字完整显示");
		assert.equal(row.heights.length, 1, "四个按钮一样高");
		assert.equal(await hover(1), "https://t.me/buyer_tg", "没发过主帖的：读最近一条回复所在那一页的签名");
		// 记下来了（localStorage），换一页再悬停不再查
		await page.waitForFunction(() => { const saved = JSON.parse(localStorage.getItem("nsmax:telegram") || "{}"); return saved["10"]?.c?.length === 1 && saved["11"]?.c?.length === 1; }, null, { timeout: 3e3 });
		const before = { discussions: calls["/api/content/list-discussions"], comments: calls["/api/content/list-comments"] };
		assert.deepEqual(before, { discussions: 2, comments: 1 });
		await page.goto("https://www.nodeseek.com/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		assert.equal(await hover(0), "https://t.me/seller_tg");
		assert.deepEqual({ discussions: calls["/api/content/list-discussions"], comments: calls["/api/content/list-comments"] }, before, "记住的不再请求");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.35 编辑增强：Ctrl+B / I / K / E（再按取消、能撤回）；列表、引用回车续行，空行回车结束；列表行 Tab 缩进；选中文字粘贴网址变链接；输入 @ 提示这一页的人；Ctrl+Enter 提交", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const input = page.locator(".md-editor textarea").first();
		const value = () => input.inputValue();
		const select = (start, end) => input.evaluate((ta, [a, b]) => ta.setSelectionRange(a, b), [start, end]);
		await input.click();
		// 加粗：没选字时插入 **粗体** 并选中「粗体」，直接打字替换；选中带标记的字再按一次去掉
		await page.keyboard.press("Control+b");
		assert.equal(await value(), "**粗体**");
		await page.keyboard.type("重点");
		assert.equal(await value(), "**重点**");
		await select(2, 4);
		await page.keyboard.press("Control+b");
		assert.equal(await value(), "重点");
		await page.keyboard.press("Control+z");
		assert.equal(await value(), "**重点**", "Ctrl+Z 撤回");
		// 斜体 / 行内代码 / 链接
		await input.fill("看这里");
		await select(0, 3);
		await page.keyboard.press("Control+i");
		assert.equal(await value(), "*看这里*");
		await input.fill("npm i");
		await select(0, 5);
		await page.keyboard.press("Control+e");
		assert.equal(await value(), "`npm i`");
		await input.fill("文档");
		await select(0, 2);
		await page.keyboard.press("Control+k");
		assert.equal(await value(), "[文档](https://)");
		assert.equal(await input.evaluate((ta) => ta.value.slice(ta.selectionStart, ta.selectionEnd)), "https://", "选中 https:// 方便直接粘贴网址");
		// 列表续行：- / 1. / 任务列表；只有符号的空行回车结束列表
		await input.fill("");
		await page.keyboard.type("- 第一项");
		await page.keyboard.press("Enter");
		await page.keyboard.type("第二项");
		assert.equal(await value(), "- 第一项\n- 第二项");
		await page.keyboard.press("Tab");
		assert.equal(await value(), "- 第一项\n  - 第二项", "列表行 Tab 缩进");
		await page.keyboard.press("Shift+Tab");
		assert.equal(await value(), "- 第一项\n- 第二项");
		await page.keyboard.press("Enter");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "- 第一项\n- 第二项\n", "空的列表行回车：结束列表");
		await input.fill("");
		await page.keyboard.type("1. 甲");
		await page.keyboard.press("Enter");
		await page.keyboard.type("乙");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "1. 甲\n2. 乙\n3. ");
		await input.fill("");
		await page.keyboard.type("- [x] 做完了");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "- [x] 做完了\n- [ ] ");
		await input.fill("");
		await page.keyboard.type("> 引用一句");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "> 引用一句\n> ");
		// 代码块里回车照常
		await input.fill("```\n- 不是列表");
		await page.keyboard.press("End");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "```\n- 不是列表\n");
		// 选中文字粘贴网址：变成 [文字](网址)
		await input.fill("项目主页");
		await select(0, 4);
		await input.evaluate((ta) => { const data = new DataTransfer(); data.setData("text/plain", "https://example.com/repo"); ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); });
		assert.equal(await value(), "[项目主页](https://example.com/repo)");
		// @ 提示：这一页出现过的人（楼主排第一，不含自己），上下键选，回车填进去
		await input.fill("");
		await page.keyboard.type("谢谢 @");
		await page.waitForSelector(".nsmax-mention:not([hidden]) .nsmax-mention-item");
		const menu = await page.evaluate(() => {
			const box = document.querySelector(".nsmax-mention").getBoundingClientRect();
			const ta = document.querySelector(".md-editor textarea").getBoundingClientRect();
			return { names: [...document.querySelectorAll(".nsmax-mention-item")].map((item) => item.textContent.trim()), inside: box.left >= ta.left - 1 && box.top >= ta.top, position: getComputedStyle(document.querySelector(".nsmax-mention")).position };
		});
		assert.equal(menu.names[0], "seller", "楼主排第一");
		assert.ok(menu.names.includes("buyer") && !menu.names.includes("tester"), JSON.stringify(menu.names));
		assert.equal(menu.inside, true, "提示框在光标下面");
		assert.equal(menu.position, "fixed");
		await page.keyboard.type("bu");
		await page.waitForFunction(() => [...document.querySelectorAll(".nsmax-mention-item")].map((item) => item.textContent.trim()).join() === "buyer");
		await page.keyboard.press("Enter");
		assert.equal(await value(), "谢谢 @buyer ");
		assert.equal(await page.locator(".nsmax-mention").isHidden(), true);
		await page.keyboard.type("@pa");
		await page.waitForSelector(".nsmax-mention:not([hidden])");
		await page.keyboard.press("Escape");
		assert.equal(await page.locator(".nsmax-mention").isHidden(), true, "Esc 只关提示框");
		assert.equal(await input.isVisible(), true, "回复框还在");
		// Ctrl+Enter 提交（点站点自己的「发布评论」）
		await input.fill("测试回复内容");
		await page.keyboard.press("Control+Enter");
		assert.equal(await page.locator(".nsmax-editor-status").innerText(), "提交中");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-10-23 第二十二批：新页面打开后不卡
test("v1.8.35 打开页面不卡：列表首屏预取不再逐个读标题位置（content-visibility 的行不被逼着当场排版）；滚动把标题带到鼠标下面时不弹预览、不预取，鼠标真的动了才弹", async () => {
	const pages = {};
	for (let index = 0; index < 30; index++) pages[`/post-${1000 + index}-1`] = postPage();
	// 数一数脚本对列表标题读了几次位置
	const init = `(() => { if (window.top !== window) return; window.__titleRects = 0; const original = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { if (this.matches && this.matches(".post-list-item .post-title a")) window.__titleRects++; return original.call(this); }; })();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ count: 30 }), pages, init: init + CHECKED_INIT, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		// 标题带「抽奖」的另有后台核对也会取帖子，专门等首屏那 4 篇（2026-10-24 起和别的后台请求一样一篇一篇来、前后隔开）
		await page.waitForFunction(() => new Set(performance.getEntriesByType("resource").map((entry) => entry.name.match(/\/post-(100[0-3])-1(?:\.html)?$/)?.[1]).filter(Boolean)).size === 4, null, { timeout: 10e3 });
		await wait(page, 300);
		const prefetched = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\/post-\d+-1(?:\.html)?$/.test(entry.name)).map((entry) => new URL(entry.name).pathname));
		assert.ok(prefetched.includes("/post-1000-1"), `首屏第一篇预取了：${prefetched}`);
		// 标题带「抽奖」的（每 6 篇一篇）另有后台核对，不算；其余屏幕外的不预取
		const offscreen = prefetched.filter((path) => { const index = Number(path.match(/post-(\d+)/)[1]) - 1000; return index >= 8 && index % 6 !== 3; });
		assert.deepEqual(offscreen, [], "只预取首屏那几篇");
		assert.equal(await page.evaluate(() => window.__titleRects), 0, "预取不读标题位置");
		// 鼠标放在第 2 篇标题上（真的移过去）：预览打开；按 Esc 收起（鼠标还停在标题上）
		const titles = page.locator("ul.post-list > li.post-list-item .post-title a");
		const box = await titles.nth(1).boundingBox();
		await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 4 });
		await page.waitForSelector("dialog.nspp-post-preview:not([hidden])", { timeout: 3e3 });
		await page.keyboard.press("Escape");
		await page.waitForSelector("dialog.nspp-post-preview", { state: "hidden", timeout: 3e3 });
		const opened = () => page.evaluate(() => { const dialog = document.querySelector("dialog.nspp-post-preview"); return !!dialog && !dialog.hidden; });
		const fetched = () => page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\/post-1002-1$/.test(entry.name)).length);
		const before = await fetched();
		// 鼠标不动，页面往下滚一行：第 3 篇的标题滑到鼠标下面——不算悬停，不弹预览、不去取它
		const step = await page.evaluate(() => { const links = document.querySelectorAll("ul.post-list > li.post-list-item .post-title a"); return links[2].getBoundingClientRect().top - links[1].getBoundingClientRect().top; });
		await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "instant" }), step);
		await wait(page, 700);
		const hovered = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".post-title a")?.getAttribute("href"), [box.x + 20, box.y + box.height / 2]);
		assert.equal(hovered, "/post-1002-1", "鼠标下面换成了第 3 篇");
		assert.equal(await opened(), false, "滚动带过来的不弹预览");
		assert.equal(await fetched(), before, "也不预取");
		// 鼠标在上面真的动一下：弹出第 3 篇的预览
		await page.mouse.move(box.x + 24, box.y + box.height / 2);
		await page.waitForSelector("dialog.nspp-post-preview:not([hidden])", { timeout: 3e3 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.35 打开页面不卡：抽奖帖的抽奖卡片、代码块「复制」那一条第一帧就在（以前第一帧之后才插进正文，整篇往下一推）；顶栏 ≡ 在版块放得下时一开始就不显示（以前先露出来、把搜索框挤开再藏回去）", async () => {
	let html = postPage().replace("</article>", '<p><a href="https://www.nodeseek.com/lucky?post=1000&amp;time=1893456000000&amp;count=2">开奖</a></p></article>');
	// 站点 index.js：页面加载后给 pre > code 加 button.code-copy-btn（.always：站点偏好「一直显示」）
	html = html.replace("</body>", `<script>document.addEventListener("DOMContentLoaded", () => setTimeout(() => { for (const code of document.querySelectorAll("article.post-content pre > code")) { const pre = code.parentElement; pre.classList.add("code-copy-wrapper"); const button = document.createElement("button"); button.className = "code-copy-btn always"; button.type = "button"; pre.append(button); } }, 300));</script></body>`);
	// 页面一解析完（DOMContentLoaded，第一帧之前）就记下正文里有什么；之后记下第一帧之后的布局跳动
	const init = `(() => { if (window.top !== window) return; window.__shifts = []; new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__shifts.push({ t: entry.startTime, v: entry.value }); }).observe({ type: "layout-shift", buffered: true }); document.addEventListener("DOMContentLoaded", () => { const pre = document.querySelector(".nsk-post article pre"); window.__atDcl = { lottery: !!document.querySelector(".nsk-post article.post-content .nsmax-lottery"), copy: !!pre && pre.hasAttribute("data-nsmax-copy") && pre.hasAttribute("data-nsmax-copy-always"), pad: pre ? getComputedStyle(pre).paddingTop : "" }; }); })();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1?nsmax-no-lazy-overlay", { html, init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.waitForSelector(".nsk-post .nsmax-code [data-nspp-copy]");
		await wait(page, 600);
		const state = await page.evaluate(() => {
			const fcp = performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint")?.startTime || 0;
			const menu = document.querySelector("#nsk-head .nsmax-mobile-menu");
			return { atDcl: window.__atDcl, pad: getComputedStyle(document.querySelector(".nsk-post article pre")).paddingTop, shifts: window.__shifts.filter((entry) => entry.t > fcp).reduce((sum, entry) => sum + entry.v, 0), menu: menu ? getComputedStyle(menu).display : "missing", overflow: document.getElementById("nsk-head").hasAttribute("data-nsmax-nav-overflow") };
		});
		assert.equal(state.atDcl.lottery, true, "抽奖卡片第一帧就在正文里");
		assert.equal(state.atDcl.copy, true, "代码块第一帧就标好「复制」一直显示");
		assert.equal(state.atDcl.pad, "38px", "代码块顶上放「复制」的那一条第一帧就留好");
		assert.equal(state.pad, "38px", "站点的按钮加上以后还是那一条");
		// 抽奖卡片晚插进来、「复制」那一条晚留出来，都是 0.05 以上的跳动
		assert.ok(state.shifts < 0.005, `第一帧之后正文不跳：${state.shifts}`);
		assert.equal(state.overflow, false);
		assert.equal(state.menu, "none", "版块放得下：≡ 不显示（浮层样式还没补上也一样）");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.35 打开页面不卡：模块启动时顶栏版块、分页的标记按差异改（结果一样就一个属性都不动，以前先全清掉再打上，整排重算样式）", async () => {
	// 页面解析完以后，顶栏版块和分页上的这些属性有没有被删了又加
	const init = `(() => { if (window.top !== window) return; window.__churn = []; document.addEventListener("readystatechange", () => { if (document.readyState !== "interactive") return; new MutationObserver((records) => { for (const record of records) window.__churn.push(record.attributeName + ":" + record.oldValue + "→" + record.target.getAttribute(record.attributeName)); }).observe(document.documentElement, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["data-nsmax-header-cat", "data-nsmax-header-hide", "data-nsmax-header-cat-on", "data-nsmax-pg", "data-nsmax-pg-cur", "data-nsmax-pg-wrap", "data-nsmax-pager"] }); }); })();`;
	for (const url of ["https://www.nodeseek.com/", "https://www.nodeseek.com/post-1000-1"]) {
		const { context, page, errors } = await open(browser, url, { html: url.endsWith("/") ? listPage() : postPage(), init, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
			await wait(page, 800);
			assert.equal(await page.locator("#nsk-head [data-nsmax-header-cat]").count() > 0, true, "版块标好了");
			// 页面解析完时第一次打上（从无到有）可以；已经打上的又被删掉、重打一遍就不行
			const churn = await page.evaluate(() => window.__churn);
			assert.deepEqual(churn.filter((record) => !record.includes(":null→")), [], `${url}：已经打上的标记不再删了重打`);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("v1.8.35 打开页面不卡：个人主页的资料卡是站点前端画的——画出来的那一帧就改成 sb.sb 资料卡（以前原样先露一下）；站点写着「没有找到readme」时第一帧就不放「介绍」标签（以前等接口回来才藏，标签栏跳一下）；画出来之前页脚不贴在顶栏下面", async () => {
	// 照真站：服务器只给空的主栏，站点脚本拿到资料后（这里 DOMContentLoaded 后 300ms）才把资料卡画进去
	const html = nativeSpacePage().replace(/<section id="nsk-frame">([\s\S]*?)<\/section>/, (match, inner) => `<section id="nsk-frame"><template id="later">${inner}</template></section>`)
		.replace("</body>", `<script>document.addEventListener("DOMContentLoaded", () => setTimeout(() => { const later = document.getElementById("later"); later.replaceWith(later.content.cloneNode(true)); }, 300));</script></body>`);
	const init = `(() => { if (window.top !== window) return; document.addEventListener("DOMContentLoaded", () => { const footer = document.querySelector("footer.footer"); window.__pending = { attr: document.documentElement.hasAttribute("data-nsmax-space-pending"), footerTop: footer ? footer.getBoundingClientRect().top : -1 }; }); new MutationObserver((records, observer) => { if (!document.querySelector(".head-container")) return; observer.disconnect(); requestAnimationFrame(() => { const intro = document.querySelector('.selector a.select-item[data-nsmax-tab="general"]'); window.__first = { top: !!document.querySelector(".head-container > .nsmax-space-top"), raw: !!document.querySelector(".head-container > img"), intro: !!intro && !intro.hidden && getComputedStyle(intro).display !== "none", pending: document.documentElement.hasAttribute("data-nsmax-space-pending") }; }); }).observe(document, { childList: true, subtree: true }); })();`;
	// 资料接口慢（2 秒才回）：「介绍」标签要靠站点画出来的「没有找到readme」判断
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10", {
		html, init, viewport: { width: 1440, height: 900 },
		beforeNavigate: (p) => p.route("**/api/account/getInfo/**", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, detail: { member_id: 10, member_name: "Steve", rank: 3, coin: 1257, nPost: 100, nComment: 873, created_at: new Date(Date.now() - 659 * 864e5).toISOString() } }) });
		})
	});
	try {
		await page.waitForFunction(() => window.__first, null, { timeout: 5e3 });
		const state = await page.evaluate(() => ({ pending: window.__pending, first: window.__first }));
		assert.equal(state.pending.attr, true, "资料卡画出来之前给主栏留一屏高");
		assert.ok(state.pending.footerTop >= 900, `页脚在屏幕外（${state.pending.footerTop}）`);
		assert.equal(state.first.top, true, "画出来的那一帧就是 sb.sb 资料卡");
		assert.equal(state.first.raw, false, "原样的头像不再露出来");
		assert.equal(state.first.intro, false, "没写介绍：第一帧就不放「介绍」标签");
		assert.equal(state.first.pending, false, "画出来就撤掉留的高度");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-10-23 第二十三批：打开页面更快（脚本启动少做事、样式按页面拆得更细）
test("v1.8.36 打开页面更快：看图库（Viewer.js）和它的样式等第一次点开图片才加载——打开页面时不注入，点开帖子里的图片照常看大图，Esc 关掉", async () => {
	const html = postPage().replace("</article>", '<p><img src="/avatar/77.png" alt="帖子配图" width="320" height="200"></p></article>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await wait(page, 500);
		const viewerCss = () => page.evaluate(() => [...document.querySelectorAll("style")].some((tag) => (tag.textContent || "").includes("Viewer.js v1.14.0")));
		assert.equal(await viewerCss(), false, "打开页面时不注入看图样式");
		await page.locator(".nsk-post article.post-content img[alt='帖子配图']").click();
		await page.waitForSelector("dialog.nspp-image-preview[open] .viewer-container", { timeout: 5e3 });
		assert.equal(await viewerCss(), true, "点开图片时才注入");
		await page.waitForSelector("dialog.nspp-image-preview .viewer-canvas img", { timeout: 5e3 });
		await page.keyboard.press("Escape");
		await page.waitForSelector("dialog.nspp-image-preview", { state: "detached", timeout: 3e3 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.36 中文时间（不再走 date-fns 的通用格式化，结果和以前逐字一样）：刚刚 / N 分钟前 / N 小时前 / N 天前；超过 30 天和将来的时间显示完整时间", async () => {
	const now = Date.now();
	const iso = (ms) => new Date(now - ms).toISOString();
	const full = (ms) => { const d = new Date(now - ms); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
	const cases = [[20e3, "刚刚"], [90e3, "1 分钟前"], [30 * 6e4 + 15e3, "30 分钟前"], [61 * 6e4, "1 小时前"], [5 * 36e5 + 10 * 6e4, "5 小时前"], [864e5 + 36e5, "1 天前"], [3 * 864e5 + 2 * 36e5, "3 天前"], [40 * 864e5, null], [-5 * 6e4, null]];
	const html = postPage().replace("</article>", cases.map(([ms], i) => `<p><time id="t${i}" datetime="${iso(ms)}">x</time></p>`).join("") + "</article>");
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const texts = await page.evaluate((n) => Array.from({ length: n }, (_, i) => document.getElementById("t" + i).textContent), cases.length);
		assert.deepEqual(texts, cases.map(([ms, text]) => text ?? full(ms)));
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.36 主题样式按页面拆得更细：只在列表页用的那段（帖子列表、列表工具条）帖子页不再解析，列表页照常有", async () => {
	const themeCss = (page) => page.evaluate(() => [...document.querySelectorAll("style")].map((tag) => tag.textContent || "").filter((text) => text.includes("data-nsmax-theme")).join(""));
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1280, height: 900 } });
	try {
		await post.page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const css = await themeCss(post.page);
		assert.equal(css.includes("nsmax-kind-tab"), false, "帖子页没有列表工具条的样式");
		assert.equal(css.includes(".nsk-post"), true, "帖子页自己的样式在");
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
	const list = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await list.page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		assert.equal((await themeCss(list.page)).includes("nsmax-kind-tab"), true, "列表页有列表工具条的样式");
		assert.deepEqual(list.errors, []);
	} finally { await list.context.close(); }
});

test("v1.8.36 签到成功：右下角的签到按钮先弹一下再往上淡出、收起（改用浏览器自带的动画，不再打包 GSAP）", async () => {
	// 按钮的标题变成「已签到」的那一刻（和开始动画在同一段代码里），记下它身上的动画
	const init = `(() => { if (window.top !== window) return; new MutationObserver((records) => { for (const record of records) { const el = record.target; if (el.title === "已签到" && !window.__checkin) window.__checkin = { animations: el.getAnimations().map((a) => a.playState), hidden: el.hidden }; } }).observe(document, { subtree: true, attributes: true, attributeFilter: ["title"] }); })();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage(), init, viewport: { width: 1280, height: 900 },
		api: { "/api/attendance": [{ status: 200, body: { success: true, message: "签到成功，获得 5 个鸡腿", gain: 5 } }] }
	});
	try {
		await page.waitForFunction(() => window.__checkin, null, { timeout: 5e3 });
		// 点下去那一下的回弹（0.2 秒）可能还没放完，所以可能有两个
		const state = await page.evaluate(() => window.__checkin);
		assert.equal(state.hidden, false);
		assert.ok(state.animations.includes("running"), `显示「已签到」时正在播放动画：${JSON.stringify(state.animations)}`);
		await page.waitForFunction(() => { const el = document.querySelector("#nspp-tools .nspp-tool-icon[title='已签到']"); return el && el.hidden && el.getAnimations().length === 0; }, null, { timeout: 4e3 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-10-23 第二十四批：各功能的实现再省一些（页面变动后少做无用的整页整理）
test("v1.8.37 外链直达：正文里的站内跳转链接（/jump?to=…）换成直达地址，帖子链接按站点偏好处理，其他链接不动", async () => {
	const html = postPage().replace("</article>", '<p><a id="j2" href="https://www.nodeseek.com/jump?to=https%3A%2F%2Fexample.org%2Fa%3Fx%3D1%26y%3D2">带参数</a> <a id="js" href="javascript:void(0)">按钮</a> <a id="space" href="/space/11">buyer</a> <a id="post" href="/post-2000-1">别的帖子</a></p></article>');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await page.waitForFunction(() => document.querySelector(".nsk-post article a[href*='example.com/docs']"), null, { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const article = document.querySelector(".nsk-post article.post-content");
			return {
				docs: [...article.querySelectorAll("a")].find((a) => a.textContent === "外部链接")?.getAttribute("href"),
				withQuery: document.getElementById("j2").getAttribute("href"),
				js: document.getElementById("js").getAttribute("href"),
				space: [document.getElementById("space").getAttribute("href"), document.getElementById("space").getAttribute("target")],
				post: document.getElementById("post").getAttribute("href")
			};
		});
		assert.equal(state.docs, "https://example.com/docs", "跳转链接换成直达地址");
		assert.equal(state.withQuery, "https://example.org/a?x=1&y=2", "带参数的也原样还原");
		assert.equal(state.js, "javascript:void(0)", "不是网页链接的不动");
		assert.deepEqual(state.space, ["/space/11", null], "个人主页链接不动");
		assert.equal(state.post, "/post-2000-1", "帖子链接地址不动（是否新标签页跟随站点偏好，见别的测试）");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.37 页面变动后少做无用的整页整理：首页置顶轮播换条、作者栏填等级和数字都不再让所有模块重新整理一遍；真的新内容照常整理", async () => {
	const carousel = '<div class="topic-carousel-wrapper"><ul class="post-list topic-carousel-panel"><li class="post-list-item topic-carousel-item"><div class="post-list-content"><div class="post-title"><a href="/post-9000-1">置顶公告</a></div></div></li></ul></div>';
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage().replace('<ul class="post-list">', carousel + '<ul class="post-list">'), viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await wait(page, 1200);
		const batches = () => page.evaluate(() => performance.getEntriesByName("nsmax:batch").length);
		const before = await batches();
		// 站点的轮播：每隔几秒把一条换成新的一条（Vue 过渡：旧的移走、新的插进来）
		for (let i = 0; i < 5; i++) {
			await page.evaluate((n) => { const panel = document.querySelector(".topic-carousel-panel"); const item = panel.firstElementChild.cloneNode(true); item.querySelector("a").textContent = "置顶公告 " + n; panel.replaceChildren(item); }, i);
			await wait(page, 150);
		}
		await wait(page, 700);
		assert.equal(await batches(), before, "轮播换条不触发整页整理");
		// 列表里真的多了一行：照常整理（这一行补上图标、换中文时间）
		await page.evaluate(() => { const list = document.querySelector("ul.post-list:not(.topic-carousel-panel)"); list.append(list.lastElementChild.cloneNode(true)); });
		await page.waitForFunction((n) => performance.getEntriesByName("nsmax:batch").length > n, before, { timeout: 3e3 });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 帖子页：作者栏读到资料后填等级和数字，不触发整页整理
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: postPage(), viewport: { width: 1280, height: 900 } });
	try {
		await post.page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await wait(post.page, 1200);
		const count = () => post.page.evaluate(() => performance.getEntriesByName("nsmax:batch").length);
		const before = await count();
		await post.page.evaluate(() => { for (const level of document.querySelectorAll(".nsmax-author-col .nsmax-author-level")) level.textContent = "Lv.3"; for (const value of document.querySelectorAll(".nsmax-author-col .nsmax-author-stats b")) value.textContent = "12"; });
		await wait(post.page, 900);
		assert.equal(await count(), before, "作者栏换字不触发整页整理");
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
});

test("2026-10-24 「抽奖」分类识别不再把站点刷到限流：同时只有一个请求、前后隔开（v1.8.37 六篇一起查，真站十秒里二十多个请求，站点回 429，页面、图片都跟着变慢）", async () => {
	const lucky = (id) => postPage().replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=${id}&amp;time=1893456000000&amp;count=1">开奖</a></p></article>`);
	const pages = {};
	for (let i = 0; i < 6; i++) pages[`/post-${1000 + i}-1`] = i % 3 === 0 ? lucky(1000 + i) : postPage();
	const starts = [];
	let active = 0, most = 0;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
		html: searchPage({ count: 6 }), viewport: { width: 1280, height: 900 }, pages,
		init: `if (window.top === window) localStorage.setItem("nsmax:lottery-index-at", String(Date.now()));`,
		// 每篇帖子晚 300ms 才回来（真站一篇要几百毫秒）
		beforeNavigate: (p) => p.route(/\/post-10\d\d-1$/, async (route) => {
			active++;
			most = Math.max(most, active);
			starts.push(Date.now());
			await new Promise((resolve) => setTimeout(resolve, 300));
			await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: pages[new URL(route.request().url()).pathname] });
			active--;
		})
	});
	try {
		await page.waitForFunction(() => document.querySelector(".nsmax-lottery-status")?.hidden === true, null, { timeout: 20e3 });
		assert.equal(starts.length, 6, "6 篇各取一次（和帖子预览共用一份）");
		assert.equal(most, 1, "同时只有一个请求在路上");
		const gaps = starts.slice(1).map((at, i) => at - starts[i]);
		assert.ok(Math.min(...gaps) >= 550, "前后至少隔 0.55 秒：" + gaps.join());
		const visible = await page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).filter((li) => getComputedStyle(li).display !== "none").map((li) => li.querySelector(".post-title a").getAttribute("href")));
		assert.deepEqual(visible, ["/post-1000-1", "/post-1003-1"]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 普通页面不再在后台成批取帖子（v1.8.37：标题不像抽奖的每页另查 60 篇，登录后每 30 分钟还要读「抽奖」搜索和「新帖子」列表再查几十篇）：标题不像抽奖的不取，像的等页面加载完再一篇一篇查、一页最多 12 篇", async () => {
	const titles = Array.from({ length: 20 }, (_, i) => i < 15 ? `抽奖送 VPS 第 ${i + 1} 台` : `普通帖子 ${i + 1}`);
	const html = listPage({ count: 20 }).replace(/(<div role="heading" aria-level="3" class="post-title"><a href="\/post-(\d+)-1"[^>]*>)[^<]*/g, (match, head, id) => head + titles[Number(id) - 1000]);
	const pages = {};
	for (let i = 0; i < 20; i++) pages[`/post-${1000 + i}-1`] = postPage();
	const asked = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", {
		html, seed: NO_PREVIEW, viewport: { width: 1280, height: 900 }, pages,
		beforeNavigate: (p) => p.on("request", (request) => {
			const url = new URL(request.url());
			if (url.pathname === "/search" || url.pathname === "/" && url.search || /^\/post-\d+-1$/.test(url.pathname)) asked.push([url.pathname + url.search, Date.now()]);
		})
	});
	try {
		await page.waitForFunction(() => document.readyState === "complete");
		const loadedAt = await page.evaluate(() => performance.timeOrigin + performance.getEntriesByType("navigation")[0].loadEventStart);
		await page.waitForFunction(() => { try { return Object.keys(JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}")).length >= 12; } catch { return false; } }, null, { timeout: 25e3 });
		await page.waitForTimeout(2500);
		const paths = asked.map(([path]) => path);
		assert.deepEqual(paths.filter((path) => !path.startsWith("/post-")), [], "不读搜索、不读「新帖子」列表");
		const posts = [...new Set(paths)];
		assert.equal(posts.length, 12, "标题像抽奖的一页最多查 12 篇：" + posts.join());
		assert.deepEqual(posts.filter((path) => Number(path.match(/post-(\d+)/)[1]) >= 1015), [], "标题不像抽奖的不取");
		assert.ok(asked[0][1] >= loadedAt - 50, "页面加载完以后才开始取");
		const gaps = asked.slice(1).map(([, at], i) => at - asked[i][1]);
		assert.ok(Math.min(...gaps) >= 500, "一篇一篇来、前后隔开：" + gaps.join());
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 站点限流（429 / 503）时后台的活马上停下：不重试，本机所有页面停 10 分钟；「抽奖」分类页说「站点限流」、给「重试」，点了接着查", async () => {
	const lucky = (id) => postPage().replace("</article>", `<p><a href="https://www.nodeseek.com/lucky?post=${id}&amp;time=1893456000000&amp;count=1">开奖</a></p></article>`);
	const pages = {};
	for (let i = 0; i < 4; i++) pages[`/post-${1000 + i}-1`] = i === 2 ? lucky(1002) : postPage();
	let hits = 0, limited = true;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
		html: searchPage({ count: 4 }), viewport: { width: 1280, height: 900 }, pages,
		init: `if (window.top === window) localStorage.setItem("nsmax:lottery-index-at", String(Date.now()));`,
		beforeNavigate: (p) => p.route(/\/post-10\d\d-1$/, (route) => {
			hits++;
			if (limited) return route.fulfill({ status: 429, contentType: "text/plain", body: "slow down" });
			return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: pages[new URL(route.request().url()).pathname] });
		})
	});
	try {
		await page.waitForFunction(() => /站点限流/.test(document.querySelector(".nsmax-lottery-status")?.textContent || ""), null, { timeout: 10e3 });
		await page.waitForTimeout(2500);
		assert.equal(hits, 1, "第一篇被限流以后不再接着取：" + hits);
		const left = await page.evaluate(() => Number(localStorage.getItem("nsmax:bg-pause-until")) - Date.now());
		assert.ok(left > 9 * 60e3 && left <= 10 * 60e3, "后台停 10 分钟：" + left);
		// 「重试」：马上接着查（站点的冷却过了以后）
		limited = false;
		await page.evaluate(() => localStorage.removeItem("__gm__:nspp:request-cooldown:www.nodeseek.com"));
		await page.locator(".nsmax-lottery-status .nsmax-lottery-retry").click();
		await page.waitForFunction(() => document.querySelector(".nsmax-lottery-status")?.hidden === true, null, { timeout: 25e3 });
		const visible = await page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).filter((li) => getComputedStyle(li).display !== "none").map((li) => li.querySelector(".post-title a").getAttribute("href")));
		assert.deepEqual(visible, ["/post-1002-1"]);
		assert.equal(await page.evaluate(() => localStorage.getItem("nsmax:bg-pause-until")), null, "「重试」解除了后台暂停");
		assert.deepEqual(errors.filter((error) => !/429|Too Many Requests|Failed to load resource/i.test(error)), []);
	} finally { await context.close(); }
});

test("2026-10-24 按内容认抽奖帖（标题里没写「抽奖」的）：只在「抽奖」分类页上后台读「新帖子」列表第一页、一篇一篇查——开奖链接在主帖里、或者在评论里（指向这一篇）都算，评论里别的帖子的开奖链接不算；认出来的并进「抽奖」分类。点开帖子时也按内容认", async () => {
	const link = (id) => `<a href="https://www.nodeseek.com/lucky?post=${id}&amp;time=1893456000000&amp;count=3">https://www.nodeseek.com/lucky?post=${id}</a>`;
	const pages = {
		"/": listPage(),
		// 1000：标题「出一台香港 CN2 GIA 小鸡」，主帖里有开奖链接
		"/post-1000-1": postPage().replace("</article>", `<p>回复本帖参与 ${link(1000)}</p></article>`),
		// 1002：主帖只说「评论区随机送出 3 份」，开奖链接是楼主贴在评论里的
		"/post-1002-1": postPage().replace('href="/post-1000-1" class="post-title-link', 'href="/post-1002-1" class="post-title-link').replace("这是一段正文", "庆祝脚本上线，评论区随机送出 3 份").replace("收了，私信你", `开奖链接 ${link(1002)}`),
		// 1004：主帖也说送，评论里贴的是别的帖子的开奖链接
		"/post-1004-1": postPage().replace("这是一段正文", "评论区随机送出 1 份").replace("收了，私信你", `上次那个 ${link(777)}`)
	};
	for (const id of [1001, 1003, 1005]) pages[`/post-${id}-1`] = postPage();
	const asked = [];
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
		html: searchPage({ count: 0 }), viewport: { width: 1280, height: 900 }, pages,
		beforeNavigate: (p) => p.on("request", (request) => { const url = new URL(request.url()); if (url.pathname === "/") asked.push(url.search); })
	});
	try {
		await page.waitForFunction(() => { try { const c = JSON.parse(localStorage.getItem("nsmax:special-checked") || "{}"); return ["1000", "1001", "1002", "1003", "1004", "1005"].every((id) => id in c); } catch { return false; } }, null, { timeout: 30e3 });
		assert.deepEqual(asked, ["?sortBy=postTime"], "读的是「新帖子」列表");
		await page.waitForFunction(() => document.querySelectorAll("li[data-nsmax-lottery-merged]").length === 2, null, { timeout: 5e3 });
		const state = await page.evaluate(() => ({
			merged: Array.from(document.querySelectorAll("li[data-nsmax-lottery-merged]"), (li) => li.querySelector(".post-title a").getAttribute("href")).sort(),
			rows: Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem("nsmax:lottery-rows") || "{}")).map(([id, row]) => [id, row.t]))
		}));
		assert.deepEqual(state.merged, ["/post-1000-1", "/post-1002-1"], "标题没写「抽奖」的也认出来、并进来了；评论里别的帖子的开奖链接不算");
		assert.deepEqual(state.rows, { "1000": "出一台香港 CN2 GIA 小鸡，年付 99", "1002": "分享一个 Docker 一键部署脚本" }, "认出来的记下列表上的样子");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 打开帖子本身：开奖链接在评论里，标题前也挂「抽奖」
	const post = await open(browser, "https://www.nodeseek.com/post-1002-1", { html: pages["/post-1002-1"], viewport: { width: 1280, height: 800 } });
	try {
		await post.page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("nsmax:special-posts") || "{}")["1002"] === "lottery"; } catch { return false; } }, null, { timeout: 5e3 });
		await post.page.locator(".nsk-post .post-title .nsmax-prize-badge").waitFor({ timeout: 3e3 });
		assert.deepEqual(post.errors, []);
	} finally { await post.context.close(); }
});
test("v1.8.37 「抽奖」分类不只靠搜标题：本机按内容认出来、搜索没搜到的抽奖帖按编号并进第一页（比这一页最旧的还旧的不并）", async () => {
	const rows = {
		"1010": { t: "庆祝上线，评论区送 3 台年付", u: "30", n: "boss", v: "88", r: "12", lu: "31", ln: "lucky", th: "/post-1010-1#12", td: "2026-10-03T05:00:00.000Z", tt: "2026-10-03 13:00:00", c: "/categories/daily", cn: "日常" },
		"900": { t: "很早以前的一次", u: "32", n: "old", v: "5", r: "1", lu: "", ln: "", th: "", td: "", tt: "", c: "", cn: "" }
	};
	const init = `if (window.top === window) { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1010": "lottery", "900": "lottery", "1001": "lottery" })); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1000": 1, "1001": 1, "1002": 1, "1010": 1, "900": 1 })); localStorage.setItem("nsmax:lottery-rows", ${JSON.stringify(JSON.stringify(rows))}); localStorage.setItem("nsmax:lottery-index-at", String(Date.now())); }`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { html: searchPage({ count: 3 }), viewport: { width: 1280, height: 900 }, init });
	try {
		await page.waitForFunction(() => document.querySelector(".nsmax-lottery-status")?.hidden === true, null, { timeout: 5e3 });
		const state = await page.evaluate(() => {
			const shown = Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).filter((li) => getComputedStyle(li).display !== "none");
			const merged = document.querySelector("li[data-nsmax-lottery-merged]");
			return {
				shown: shown.map((li) => li.querySelector(".post-title a").getAttribute("href")),
				merged: merged && { title: merged.querySelector(".post-title a").textContent.trim(), author: merged.querySelector(".info-author a")?.textContent.trim(), category: merged.querySelector(".nsmax-inline-category")?.textContent.trim(), badge: !!merged.querySelector(".nsmax-prize-badge"), time: merged.querySelector("time")?.textContent.trim() }
			};
		});
		assert.deepEqual(state.shown, ["/post-1010-1", "/post-1001-1"], "1010 比这一页的都新，排最前；900 比这一页最旧的还旧，不并");
		assert.equal(state.merged.title, "庆祝上线，评论区送 3 台年付");
		assert.equal(state.merged.author, "boss");
		assert.equal(state.merged.category, "日常", "并进来的行和别的行一样换图标、加行内版块");
		assert.equal(state.merged.badge, true, "标题前也挂「抽奖」");
		assert.notEqual(state.merged.time, "2026-10-03 13:00:00", "时间也换成中文相对时间");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 简洁模式照 sb.sb：没有楼中楼，回复一层一层按原来的先后排；按钮写「退出简洁模式」，点了回到左右分栏、楼中楼收回去；切换时按钮不跟着跳走；名字那一行 25.5px", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li[id='3']");
		const toggle = page.locator(".comment-container .nsmax-layout-toggle");
		assert.equal((await toggle.innerText()).trim(), "简洁模式");
		await toggle.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
		const before = await toggle.boundingBox();
		await toggle.click();
		await page.waitForFunction(() => !document.querySelector(".nsmax-floor-box"));
		const flat = await page.evaluate(() => {
			const second = document.querySelector("#nsk-body-left ul.comments > li[id='2']");
			const name = second.querySelector(":scope > .nsk-content-meta-info .author-name").getBoundingClientRect();
			const body = second.querySelector(":scope > article").getBoundingClientRect();
			return {
				order: Array.from(document.querySelectorAll("#nsk-body-left ul.comments > li.content-item"), (li) => li.id),
				who: Array.from(document.querySelectorAll("#nsk-body-left ul.comments .nsmax-fb-who"), (el) => getComputedStyle(el).display),
				lead: Array.from(document.querySelectorAll("#nsk-body-left ul.comments a[data-nsmax-fb-lead]"), (el) => getComputedStyle(el).display),
				label: document.querySelector(".nsmax-layout-toggle").textContent,
				pressed: document.querySelector(".nsmax-layout-toggle").getAttribute("aria-pressed"),
				stored: localStorage.getItem("nsmax:post-layout"),
				nameTop: Math.round(name.top - second.getBoundingClientRect().top),
				bodyGap: Math.round(body.top - name.bottom)
			};
		});
		assert.deepEqual(flat.order, ["1", "2", "3"], "楼中楼摊平，按原来的先后排");
		assert.ok(flat.who.every((display) => display === "none"), "摊平后不再显示楼中楼那一行的「名字：」");
		assert.ok(flat.lead.length && flat.lead.every((display) => display !== "none"), "开头的「@某某 #楼号」照常显示");
		assert.equal(flat.label, "退出简洁模式");
		assert.equal(flat.pressed, "true");
		assert.equal(flat.stored, "simple");
		assert.equal(flat.nameTop, 16, "名字和头像顶边对齐（以前头部那一行 32px，名字往下挪 3px）");
		assert.ok(flat.bodyGap <= 5, "正文紧接着名字下面：" + flat.bodyGap);
		const after = await toggle.boundingBox();
		assert.ok(Math.abs(after.y - before.y) <= 2, `按钮不跟着跳走：${before.y} → ${after.y}`);
		// 退出简洁模式：回到左右分栏，楼中楼收回第 1 层的框里
		await toggle.click();
		await page.waitForSelector("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li[id='3']", { timeout: 5e3 });
		const back = await page.evaluate(() => ({
			top: Array.from(document.querySelectorAll("#nsk-body-left ul.comments > li.content-item"), (li) => li.id),
			nested: Array.from(document.querySelectorAll("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li"), (li) => li.id),
			who: Array.from(document.querySelectorAll(".nsmax-floor-box .nsmax-fb-who"), (el) => el.textContent),
			label: document.querySelector(".nsmax-layout-toggle").textContent,
			layout: document.documentElement.dataset.nsmaxPostLayout
		}));
		assert.deepEqual(back, { top: ["1"], nested: ["2", "3"], who: ["passerby：", "curious回复passerby："], label: "简洁模式", layout: "classic" });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
	// 一打开就是简洁模式：楼中楼从一开始就不收进框里
	const simple = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: floorPost(), viewport: { width: 1440, height: 900 }, init: 'if (window.top === window) localStorage.setItem("nsmax:post-layout", "simple");' });
	try {
		await simple.page.waitForSelector(".comment-container .nsmax-layout-toggle");
		await wait(simple.page, 300);
		assert.equal(await simple.page.locator(".nsmax-floor-box").count(), 0);
		assert.deepEqual(await simple.page.evaluate(() => Array.from(document.querySelectorAll("#nsk-body-left ul.comments > li.content-item"), (li) => li.id)), ["1", "2", "3"]);
		assert.equal((await simple.page.locator(".comment-container .nsmax-layout-toggle").innerText()).trim(), "退出简洁模式");
		assert.deepEqual(simple.errors, []);
	} finally { await simple.context.close(); }
});

test("2026-10-24 等级进度（/progress）照 sb.sb「我的烧饼」：第一帧就是卡片（数字先是「—」），站点画好以后读数——鸡腿、等级、升级进度（满级封顶、写「已是最高等级」）、今日四项小进度条；站点自己那块（橙红标题、黄条）不显示；资料卡的等级小标签链到这里", async () => {
	for (const dark of [false, true]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/progress", { html: progressPage({ dark, delay: 800 }), viewport: { width: 1440, height: 900 }, colorScheme: dark ? "dark" : "light" });
		try {
			await page.waitForSelector(".nsmax-progress");
			const early = await page.evaluate(() => ({ coin: document.querySelector('.nsmax-progress [data-key="coin"] .nsmax-progress-counter-value').textContent, mount: !!document.querySelector("#progress-mount") }));
			assert.deepEqual(early, { coin: "—", mount: true }, "站点还没画出来时卡片已经在了");
			await page.waitForSelector(".nsmax-progress[data-ready]", { timeout: 5e3 });
			const state = await page.evaluate(() => {
				const panel = document.querySelector(".nsmax-progress");
				const text = (sel) => panel.querySelector(sel)?.textContent.trim();
				const width = (el) => el.querySelector(".nsmax-progress-fill").style.width;
				return {
					coin: text('[data-key="coin"] .nsmax-progress-counter-value'),
					level: panel.querySelector('[data-key="level"] .nsmax-progress-counter-value').getAttribute("data-nsmax-level"),
					head: [text(".nsmax-progress-from"), text(".nsmax-progress-pct"), text(".nsmax-progress-to")],
					note: text(".nsmax-progress-note"),
					levelWidth: width(panel.querySelector(".nsmax-progress-level")),
					items: Array.from(panel.querySelectorAll(".nsmax-progress-item"), (item) => [item.dataset.key, item.querySelector(".nsmax-progress-item-num").textContent, width(item)]),
					total: text(".nsmax-progress-daily-total"),
					nativeShown: getComputedStyle(document.querySelector("[data-nsmax-progress-native]")).display !== "none",
					cardBorder: getComputedStyle(panel).borderTopStyle,
					columns: getComputedStyle(panel.querySelector(".nsmax-progress-daily-list")).gridTemplateColumns.split(" ").length,
					rank: document.querySelector("#nsk-right-panel-container .nsmax-account-rank")?.getAttribute("href")
				};
			});
			assert.equal(state.coin, "4531");
			assert.equal(state.level, "6");
			assert.deepEqual(state.head, ["Lv.6", "100%", "最高等级"], "满级：进度条封顶（站点画的是 184%）");
			assert.equal(state.note, "已是最高等级 Lv.6（4531 个鸡腿）");
			assert.equal(state.levelWidth, "100%");
			assert.deepEqual(state.items, [["post", "0 / 4 帖 · +0 / 20", "0%"], ["comment", "8 / 20 条 · +8 / 20", "40%"], ["checkin", "已签到 · +6", "100%"], ["feed", "0 / 5 次", "0%"]]);
			assert.equal(state.total, "+14", "今天已经得了 0 + 8 + 6 个鸡腿");
			assert.equal(state.nativeShown, false, "站点自己画的那块不显示");
			assert.equal(state.cardBorder, "solid");
			assert.equal(state.columns, 3, "宽屏一排三项（sb.sb .points-daily-list）");
			assert.equal(state.rank, "/progress", "资料卡的等级小标签链到等级进度");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
	// 还没满级：Lv.3 → Lv.4（900 → 1600 个鸡腿），还没签到
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/progress", { html: progressPage({ coin: 1200, rank: 3, checkin: 0, posts: 2 }), viewport: { width: 390, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-progress[data-ready]", { timeout: 5e3 });
		const state = await page.evaluate(() => ({
			head: Array.from(document.querySelectorAll(".nsmax-progress-head > span"), (span) => span.textContent),
			note: document.querySelector(".nsmax-progress-note").textContent,
			checkin: document.querySelector('.nsmax-progress-item[data-key="checkin"] .nsmax-progress-item-num').textContent,
			post: document.querySelector('.nsmax-progress-item[data-key="post"] .nsmax-progress-item-num').textContent,
			overflow: document.documentElement.scrollWidth - innerWidth
		}));
		assert.deepEqual(state.head, ["Lv.3", "42%", "Lv.4"]);
		assert.equal(state.note, "距离 Lv.4 还差 400 个鸡腿（1200 / 1600）");
		assert.equal(state.checkin, "未签到");
		assert.equal(state.post, "2 / 4 帖 · +10 / 20");
		assert.equal(state.overflow, 0);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 引用排成引用卡片：头上一行「名字 · #楼号 · 时间 · 编辑过」（站点那一行 @某某 #楼号 发布于… 拿掉），内容弱化字、次底色、左边细线；超过 8 行先收起，头上「展开」", async () => {
	const long = Array.from({ length: 14 }, (_, i) => `第 ${i + 1} 行被引用的内容`).join("<br>\n");
	const quote = (body) => `<blockquote><p><a href="/member?t=seller">@seller</a> <a href="/post-1000-1#0">#0</a> 发布于7/10/2026, 8:57:13 AM，编辑于8/25/2026, 5:19:21 PM<br>\n${body}</p></blockquote>`;
	const html = postPage()
		.replace("<p>价格不错，帮顶</p>", `${quote("短的一句")}<p>我也觉得不错</p>`)
		.replace("<p>线路怎么样？晚高峰丢包吗？</p>", `${quote(long)}<p>同问</p>`);
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("blockquote[data-nsmax-quote]");
		await page.locator("li[id='3']").scrollIntoViewIfNeeded();
		await page.waitForSelector("li[id='3'] blockquote[data-nsmax-quote-long]", { timeout: 5e3 });
		const state = await page.evaluate(() => Array.from(document.querySelectorAll("blockquote[data-nsmax-quote]"), (quote) => {
			const head = quote.querySelector(":scope > .nsmax-quote-head");
			const body = quote.querySelector(":scope > .nsmax-quote-body");
			const cs = getComputedStyle(quote);
			return {
				head: Array.from(head.children, (el) => el.textContent),
				toggle: getComputedStyle(head.querySelector(".nsmax-quote-toggle")).visibility,
				body: body.textContent.trim().slice(0, 12),
				leftover: /发布于|@seller/.test(body.textContent),
				bg: cs.backgroundColor,
				border: cs.borderLeftWidth,
				clipped: body.scrollHeight > body.clientHeight + 4
			};
		}));
		assert.equal(state.length, 2);
		// 时间和页面上别的时间一样交给中文时间处理（久的写完整时间，近的写「N 小时前」）
		assert.deepEqual([state[0].head[0], state[0].head[1], state[0].head[3], state[0].head[4]], ["seller", "#0", "编辑过", "展开"]);
		assert.match(state[0].head[2], /^2026-07-10 08:57/);
		assert.equal(state[0].toggle, "hidden", "短的不显示「展开」");
		assert.equal(state[0].body, "短的一句");
		assert.equal(state[0].leftover, false, "站点那一行拿掉了");
		assert.equal(state[0].bg, "rgb(250, 251, 252)", "次底色（sb.sb .notify-quote-card）");
		assert.equal(state[0].border, "3px");
		assert.equal(state[1].toggle, "visible", "长的头上有「展开」");
		assert.equal(state[1].clipped, true, "长的先收起");
		await page.locator("li[id='3'] .nsmax-quote-toggle").click();
		const opened = await page.evaluate(() => { const body = document.querySelector("li[id='3'] .nsmax-quote-body"); return { clipped: body.scrollHeight > body.clientHeight + 4, label: document.querySelector("li[id='3'] .nsmax-quote-toggle").textContent }; });
		assert.deepEqual(opened, { clipped: false, label: "收起" });
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 列表帖子页码（sb.sb .topic-pages）：回复两页以上的帖子标题后面一排小页码，超过 6 页写 2、3、…、最后三页（正好 6 页全列出来），点了直接进那一页；一页以内的不加；悬停小页码不弹帖子预览", async () => {
	// 第 1 篇 35 条回复（4 页），第 2 篇 95 条（10 页），第 3 篇 10 条（1 页），第 4 篇 58 条（6 页）
	let n = 0;
	const counts = [35, 95, 10, 58];
	const html = listPage().replace(/<span title="\d+ comments" class="info-item info-comments-count">([\s\S]*?)<span title="\d+ comments">\d+<\/span>/g, (match, mid) => {
		const count = counts[n++] ?? 0;
		return `<span title="${count} comments" class="info-item info-comments-count">${mid}<span title="${count} comments">${count}</span>`;
	});
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html, init: CHECKED_INIT, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector(".nsmax-topic-pages");
		const rows = await page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).slice(0, 4).map((li) => {
			const pages = li.querySelector(".post-title > .nsmax-topic-pages");
			return pages ? { text: pages.textContent, hrefs: Array.from(pages.querySelectorAll("a"), (a) => a.getAttribute("href")), sameLine: Math.abs(pages.getBoundingClientRect().top - li.querySelector(".post-title > a").getBoundingClientRect().top) < 12 } : null;
		}));
		assert.deepEqual(rows[0], { text: "234", hrefs: ["/post-1000-2", "/post-1000-3", "/post-1000-4"], sameLine: true });
		assert.equal(rows[1].text, "23…8910");
		assert.deepEqual(rows[1].hrefs, ["/post-1001-2", "/post-1001-3", "/post-1001-8", "/post-1001-9", "/post-1001-10"]);
		assert.equal(rows[2], null, "一页以内的不加");
		assert.equal(rows[3].text, "23456", "正好 6 页：中间没有跳过的页，全列出来、不写省略号");
		await page.locator("ul.post-list > li.post-list-item .nsmax-topic-pages a").first().hover();
		await page.waitForTimeout(600);
		assert.equal(await page.locator("dialog.nspp-post-preview:not([hidden])").count(), 0, "悬停小页码不弹帖子预览");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("2026-10-24 楼号悬停预览（sb.sb .quote-hover）：帖子里「#楼号」停一下弹出那一层「#楼号 作者」和正文；不在这一页的去取那一页；找不到的写已被删除；移开收起", async () => {
	const third = postPage().replace('id="1"', 'id="21"').replace('id="2"', 'id="22"').replace('id="3"', 'id="23"');
	const html = postPage().replace("<p>价格不错，帮顶</p>", '<p>看 <a href="/post-1000-1#1">#1</a> 说的，还有 <a href="/post-1000-3#22">#22</a>，以及 <a href="/post-1000-9#88">#88</a></p>');
	const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, pages: { "/post-1000-3": third } });
	try {
		await page.waitForSelector(".nsmax-editor-controls");
		const hover = async (text) => {
			const link = page.locator("li[id='2'] article a", { hasText: text });
			await link.scrollIntoViewIfNeeded();
			await link.hover();
			await page.waitForFunction((no) => { const card = document.querySelector(".nsmax-floor-hover"); return card && !card.hidden && card.querySelector(".nsmax-floor-hover-head").textContent.startsWith(no); }, text, { timeout: 5e3 });
			return page.evaluate(() => { const card = document.querySelector(".nsmax-floor-hover"); return { head: card.querySelector(".nsmax-floor-hover-head").textContent, body: card.querySelector(".nsmax-floor-hover-body").textContent, below: card.getBoundingClientRect().top > 0 }; });
		};
		assert.deepEqual(await hover("#1"), { head: "#1 buyer", body: "收了，私信你", below: true });
		const far = await hover("#22");
		assert.equal(far.head, "#22 passerby", "不在这一页的取第 3 页");
		assert.equal(far.body, "价格不错，帮顶");
		assert.deepEqual(await hover("#88"), { head: "#88", body: "这一层不存在或已被删除", below: true });
		await page.mouse.move(5, 5);
		await page.waitForTimeout(500);
		assert.equal(await page.locator(".nsmax-floor-hover:not([hidden])").count(), 0, "移开收起");
		assert.deepEqual(errors.filter((e) => !/404|Failed to load resource/.test(e)), []);
	} finally { await context.close(); }
});

// 2026-10-24 第二十七批：小动作更快（对话框、鼠标划过、整页重算样式）
test("v1.8.40 对话框不用 showModal（模态会让整页每个元素重算一次样式）：设置面板以弹出层打开，照样有 open、在最上层；Esc 关掉，焦点回到设置按钮", async () => {
	const init = `(() => { window.__modalCalls = 0; const orig = HTMLDialogElement.prototype.showModal; HTMLDialogElement.prototype.showModal = function (...a) { window.__modalCalls++; return orig.apply(this, a); }; })();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init, viewport: { width: 1280, height: 800 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const button = page.locator(".nsmax-header-action[data-nsmax-own-header='settings']").first();
		await button.click();
		await page.waitForFunction(() => document.getElementById("nspp-settings")?.shadowRoot?.querySelector("dialog")?.open);
		const opened = await page.evaluate(() => {
			const dialog = document.getElementById("nspp-settings").shadowRoot.querySelector("dialog");
			const box = dialog.getBoundingClientRect();
			const top = document.elementFromPoint(box.left + box.width / 2, box.top + 20);
			return { popover: dialog.matches(":popover-open"), modal: dialog.matches(":modal"), open: dialog.open, attr: dialog.hasAttribute("open"), onTop: top === document.getElementById("nspp-settings"), focusInside: document.activeElement === document.getElementById("nspp-settings"), modalCalls: window.__modalCalls };
		});
		assert.deepEqual(opened, { popover: true, modal: false, open: true, attr: true, onTop: true, focusInside: true, modalCalls: 0 });
		await page.keyboard.press("Escape");
		await page.waitForFunction(() => !document.getElementById("nspp-settings").shadowRoot.querySelector("dialog").open);
		const closed = await page.evaluate(() => {
			const dialog = document.getElementById("nspp-settings").shadowRoot.querySelector("dialog");
			return { popover: dialog.matches(":popover-open"), visible: dialog.getClientRects().length > 0, focusBack: document.activeElement?.matches(".nsmax-header-action[data-nsmax-own-header='settings']") ?? false };
		});
		assert.deepEqual(closed, { popover: false, visible: false, focusBack: true }, "Esc 关掉、焦点回到设置按钮");
		// 再开一次照样能开
		await button.click();
		await page.waitForFunction(() => document.getElementById("nspp-settings").shadowRoot.querySelector("dialog").open);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.40 鼠标在标题、头像上划过时不读 scrollX / scrollY（页面刚改过时会逼浏览器当场排版）：滚动位置从鼠标事件里算", async () => {
	const init = `(() => {
		window.__scrollReads = 0; window.__countScroll = false;
		for (const key of ["scrollX", "scrollY", "pageXOffset", "pageYOffset"]) {
			const desc = Object.getOwnPropertyDescriptor(window, key);
			Object.defineProperty(window, key, { ...desc, get() { if (window.__countScroll) window.__scrollReads++; return desc.get.call(this); } });
		}
	})();`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), init: CHECKED_INIT + init, viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		await wait(page, 600);
		await page.evaluate(() => { window.__countScroll = true; });
		for (let i = 2; i <= 5; i++) {
			const title = page.locator(`ul.post-list > li.post-list-item:nth-child(${i}) .post-title > a`).first();
			const box = await title.boundingBox();
			await page.mouse.move(box.x + 5, box.y + box.height / 2, { steps: 4 });
			await page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 4 });
		}
		await wait(page, 300);
		assert.equal(await page.evaluate(() => window.__scrollReads), 0, "划过的时候一次都没读");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("v1.8.40 页面切换动画的伪元素规则都写上 html（不写的话每次重算样式页面上每个元素都要试一遍）；列表信息行、正文选项卡里没有「每个元素都要试」的旧规则", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage(), viewport: { width: 1280, height: 900 } });
	try {
		await page.waitForFunction(() => !document.documentElement.hasAttribute("data-nsmax-mounting"));
		const selectors = await page.evaluate(() => {
			const out = [];
			const walk = (rules) => { for (const rule of rules) { if (rule.cssRules && !rule.selectorText) walk(rule.cssRules); else if (rule.selectorText) out.push(rule.selectorText); } };
			for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
			return out;
		});
		const transitions = selectors.filter((s) => s.includes("::view-transition"));
		assert.ok(transitions.length >= 3, "有过渡规则");
		assert.deepEqual(transitions.filter((s) => s.split(",").some((part) => !/^\s*html::view-transition/.test(part))), [], "都以 html 开头");
		assert.deepEqual(selectors.filter((s) => /\.post-info \*?::(before|after)\s*$/.test(s) || /\.post-info \*::(before|after)/.test(s)), [], "列表信息行没有 *::before / *::after");
		assert.deepEqual(selectors.filter((s) => /nsmax-tabs-container/.test(s)), [], "没有给 .tabs / .tabset 的旧规则");
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
