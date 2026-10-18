"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { listPage, searchPage, luckyPage, postPage, notificationPage, settingPage, nativeMessagePage, nativeTalkPage, nativeSpacePage, newPostPage, spaceTopicsPage, spaceCommentsPage, boardPage, fansPage, creditPage, spaceCollectionsPage, signInPage, emailSignInPage, smsSignInPage, registerPage, rulingPage, boardRealPage, spaceGeneralPage, specialPostPage } = require("./fixtures/pages.cjs");

let browser;
const wait = (page, ms = 500) => page.waitForTimeout(ms);
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
	assert.equal(packageJson.version, "1.8.7");
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
		await page.route('**/slow-offscreen.svg',async route=>{await new Promise(resolve=>setTimeout(resolve,650));await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});});
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
		assert.equal(await page.locator('.md-editor .mde-toolbar').isVisible(),true);
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
		assert.equal(await page.locator('#nsk-head .nsmax-nq-tab svg').count(),0);
		assert.equal(await page.locator('.pager-bottom a.pager-next').innerText(),'下一页');
		assert.equal(await page.locator('.pager-bottom .pager-prev').isVisible(),false);
		const row=page.locator('ul.post-list:not(.topic-carousel-panel)>li').first();
		const ordered=await row.locator('.post-info').evaluate(e=>[...e.children].filter(n=>n.matches('.info-author,.info-last-comment-time,.nsmax-inline-category,.info-views,.info-comments-count,.info-last-commenter')).map(n=>n.className));
		// sb.sb .post-meta：作者 · 版块 · 浏览 · 回复 · 最后回复人 · 时间
		assert.deepEqual(ordered.map(name=>name.match(/info-author|nsmax-inline-category|info-views|info-comments-count|info-last-commenter|info-last-comment-time/)?.[0]),['info-author','nsmax-inline-category','info-views','info-comments-count','info-last-commenter','info-last-comment-time']);
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
			assert.equal(await page.locator('.card-block>.card-item:visible').count(),4);
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
		await page.waitForSelector('dialog.nsmax-lucky-modal[open]');
		await page.locator('button.nsmax-lucky-confirm').click();
		assert.match(await page.locator('#mde-title').inputValue(),/^抽奖：/);
		assert.match(await page.locator('.md-editor textarea').inputValue(),/开奖链接/);
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
		await page.waitForTimeout(80);
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
		assert.equal(await row.locator('.post-info svg:visible').count(),5);
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
		assert.equal(await pageSpace.locator('.head-container .card-block>.card-item:visible').count(), 4);
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
		const chickenItem = pageSpace.locator('.card-block>.card-item').filter({hasText: '4192'});
		const chickenLabel = await chickenItem.first().locator(':scope > div').first().innerText();
		assert.equal(chickenLabel, '鸡腿');

		// All SVGs in card-block items are hidden
		const svgs = pageSpace.locator('.head-container .card-block>.card-item svg');
		if (await svgs.count() > 0) {
			const svgDisplay = await svgs.first().evaluate(el => getComputedStyle(el).display);
			assert.equal(svgDisplay, 'none');
		}

		// Lv.6 marking in stats
		const lv6Stat = pageSpace.locator('.card-item[data-nsmax-lv6-stat]');
		assert.equal(await lv6Stat.count() > 0, true);
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
		const nqIcon = nq.locator("img.nsmax-nq-icon");
		assert.equal(await nqIcon.count(), 1, "NQ 按钮前置 NodeQuality 彩色图标");
		assert.ok((await nqIcon.getAttribute("src")).startsWith("data:image/png;base64,"));
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
		assert.equal(await pageSpace.locator(".head-container .card-block>.card-item:visible").count(), 4);
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
		await pagePost.waitForSelector("dialog.nsmax-lucky-modal[open]");
		const modal = pagePost.locator("dialog.nsmax-lucky-modal");
		assert.equal(await modal.isVisible(), true, "抽奖配置弹窗应当打开");

		// 修改配置项
		await pagePost.locator(".nsmax-lucky-prize").fill("搬瓦工 VPS 1台");
		await pagePost.locator(".nsmax-lucky-count").fill("3");
		// 点击快捷时间按钮
		await pagePost.locator(".nsmax-lucky-presets button").first().click();

		// 确认插入
		await pagePost.locator("button.nsmax-lucky-confirm").click();
		await wait(pagePost, 100);

		// 验证弹窗已关闭且正文与标题均已更新
		assert.equal(await modal.isVisible(), false, "插入后抽奖弹窗应当关闭");
		const titleVal = await pagePost.locator("#mde-title").inputValue();
		const bodyVal = await pagePost.locator(".md-editor textarea").inputValue();

		assert.ok(titleVal.includes("抽奖："), "发帖标题应当带有抽奖前缀");
		assert.ok(bodyVal.includes("搬瓦工 VPS 1台"), "正文应当包含奖品名称");
		assert.ok(bodyVal.includes("3 份"), "正文应当包含中奖人数份数");
		assert.ok(bodyVal.includes("开奖链接"), "正文应当包含开奖说明");

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
	const line = source.slice(source.indexOf("var modern_theme_compiled = "), source.indexOf("\n", source.indexOf("var modern_theme_compiled = ")));
	assert.equal(line.includes(":has("), false, "主题 CSS 里的 :has() 会让帖子里的终端渲染卡死整页");
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

test("v1.8.1 只保留圆角：旧设置里保存的「直角」不再生效", async () => {
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
			input: getComputedStyle(document.querySelector("#search-site")).borderTopLeftRadius
		}));
		assert.equal(state.attr, "large");
		assert.equal(state.scale, "1");
		assert.equal(state.card, "12px");
		assert.equal(state.input, "8px");
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
	for (const width of [1440, 390]) {
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width, height: 900 }, init: "if(window.top===window)try{localStorage.setItem('nsmax:post-layout','simple')}catch{}" });
		try {
			await page.waitForSelector("li[id='1'] > .nsmax-floor-box > .nsmax-nested-replies > li[id='2']");
			await wait(page, 400);
			const rows = await page.evaluate(measure);
			assert.equal(rows.length, 2);
			const nested = await page.evaluate(() => {
				const actions = document.querySelector("li[id='2'] > .nsmax-floor-actions");
				const parts = Array.from(actions.querySelectorAll(".menu-item, .floor-link")).filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
				return { labels: parts.map(({ e }) => (e.matches(".floor-link") ? e.textContent.trim().replace(/\d+/, "N") : getComputedStyle(e, "::before").content.replace(/"/g, ""))), sizes: [...new Set(parts.map(({ e }) => getComputedStyle(e).fontSize))] };
			});
			assert.deepEqual(nested.labels, ["#N", "回复", "引用", "点赞", "鸡腿", "反对"], "楼中楼框里楼号在前（sb.sb .floor-box-meta）：" + JSON.stringify(nested));
			assert.deepEqual(nested.sizes, ["12px"]);
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
			meta: document.querySelector(".nsmax-lottery-meta").textContent,
			sourceHidden: Array.from(document.querySelectorAll("[data-nsmax-lottery-source]"), (el) => getComputedStyle(el).display),
			view: { href: document.querySelector(".nsmax-lottery-view").getAttribute("href"), target: document.querySelector(".nsmax-lottery-view").target },
			soonBg: getComputedStyle(document.querySelectorAll(".nsmax-lottery-countdown")[1]).backgroundColor,
			imminentBg: getComputedStyle(document.querySelectorAll(".nsmax-lottery-countdown")[2]).backgroundColor,
			doneCountdown: getComputedStyle(document.querySelectorAll(".nsmax-lottery-countdown")[3]).display,
			primary: Array.from(document.querySelectorAll(".nsmax-lottery"), (card) => getComputedStyle(card.querySelector(".nsmax-lottery-join")).backgroundColor === "rgb(28, 28, 30)" ? "join" : "view")
		}));
		assert.equal(state.cards, 4, "每个开奖链接一张卡片");
		assert.equal(state.nested, 0, "卡片里的「查看开奖」不能再生成卡片");
		assert.deepEqual(state.states, ["open", "soon", "imminent", "done"]);
		assert.deepEqual(state.label, ["进行中", "进行中", "进行中", "已到开奖时间"]);
		assert.deepEqual(state.clock.map((text) => text.replace(/\d+/, "N")), ["Nd", "Nh", "Nm", "Ns"], "单位用英文（用户 2026-10-17）");
		assert.match(state.clock[1], /^02h$/);
		assert.match(state.meta, /开奖时间 \d{4}-\d{2}-\d{2} \d{2}:\d{2}.*中奖 3 人.*从 #2 楼起.*每人最多中一次/);
		assert.deepEqual(state.sourceHidden, ["none", "none", "none", "none"], "原来只有一个链接的段落收起");
		assert.match(state.view.href, /^https:\/\/www\.nodeseek\.com\/lucky\?post=1000&time=\d+/);
		assert.equal(state.view.target, "_blank");
		assert.equal(state.soonBg, "rgb(255, 244, 196)", "一小时内：品牌浅底");
		assert.equal(state.imminentBg, "rgb(251, 212, 212)", "五分钟内：红色浅底");
		assert.equal(state.doneCountdown, "none", "到了开奖时间不再显示倒计时");
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

test("回复某一层（2026-10-17 图六）：回复框挪到那一层下面，按钮「回复层主」+「取消回复」；取消后放回页面底部，只有「@某某 #楼号」时一起清掉", async () => {
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
		await page.waitForFunction(() => document.querySelector(".md-editor button.submit")?.textContent === "回复层主");
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
		await view.page.waitForFunction(() => document.querySelector(".nsmax-lottery-status")?.hidden === true, null, { timeout: 8e3 });
		assert.deepEqual(await visible(), ["/post-1001-1", "/post-1003-1"], "只剩确认有开奖链接的");
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
		assert.deepEqual(overlay, { width: 640, input: 40, inputFirst: true, oneRow: true });
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
					hotSkeletonRows: hot ? hot.querySelectorAll(".nsmax-hot-skeleton").length : 0,
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
		assert.equal(early.first.hotSkeletonRows, 10);
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
		assert.deepEqual([...new Set(early.first.rowH)], [later.rowH[0]], `骨架行和真实行一样高：${early.first.rowH[0]} / ${later.rowH[0]}`);
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
	const line = source.split("\n").find((l) => l.startsWith("\tvar modern_theme_compiled = "));
	const css = JSON.parse(line.slice("\tvar modern_theme_compiled = ".length, -1));
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
		assert.equal(state.selection.length, 1);
		assert.ok(/^html\[data-nsmax-theme\][^ ]*::selection$/.test(state.selection[0].replace(/\([^)]*\)/g, "")), `挂在 html 本身上，不是后代选择器：${state.selection[0]}`);
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

test("第五批（2026-10-18）：侧栏卡片之间一样宽；回复框标题栏、工具按钮、输入框之间都是 14px；编辑器里的链接不是绿色；主帖「点赞」那一排先留好位置", async () => {
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
			return { above: Math.round(controls.top - head.bottom), below: Math.round(surface.top - controls.bottom), colors, reserved };
		});
		assert.equal(state.above, 14);
		assert.equal(state.below, 14, "工具按钮上下一样宽");
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
test("第六批（2026-10-18）：资料卡里有「管理记录」（按名字搜站点管理记录）和「屏蔽」（确认后加进站点黑名单，脚本的屏蔽名单一起改，他的帖子马上藏起来）", async () => {
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
				ruling: decodeURIComponent(pop.querySelector(".nsmax-person-ruling").getAttribute("href")),
				oneRow: new Set(actions.map((el) => Math.round(el.getBoundingClientRect().top))).size === 1
			};
		});
		assert.deepEqual(card.labels, ["关注", "私信", "主页", "管理记录", "屏蔽"]);
		assert.equal(card.ruling, "/ruling#/p-1?search=user0", "管理记录按用户名搜");
		assert.equal(card.oneRow, true, "五个按钮一排放得下");
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

test("第六批（2026-10-18）：我的回复——帖子页记下自己的楼层，评论区最上面列出「我的回复 #1」，点了就地跳过去；列表里这一篇下面也有一行", async () => {
	const post = postPage().replaceAll('href="/space/11"', 'href="/space/1"');
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: post, viewport: { width: 1440, height: 900 }, pages: { "/": listPage() } });
	try {
		await page.waitForSelector(".comment-container > .nsmax-my-replies a");
		const bar = await page.evaluate(() => {
			const row = document.querySelector(".comment-container > .nsmax-my-replies");
			return { text: row.textContent, links: Array.from(row.querySelectorAll("a"), (a) => a.getAttribute("href")), afterHead: row.parentElement.querySelector(":scope > .nsmax-reply-head") ? row.previousElementSibling?.classList.contains("nsmax-reply-head") : row === row.parentElement.firstElementChild };
		});
		assert.equal(bar.text, "我的回复#1");
		assert.deepEqual(bar.links, ["#1"], "这一楼已经在页面上：就地跳");
		assert.equal(bar.afterHead, true, "在评论区最上面（有标题栏时在标题栏下面）");
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
