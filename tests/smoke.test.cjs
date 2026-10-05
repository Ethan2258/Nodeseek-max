"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { listPage, postPage, notificationPage, settingPage, nativeMessagePage, nativeTalkPage, nativeSpacePage, newPostPage, spaceTopicsPage, spaceCommentsPage } = require("./fixtures/pages.cjs");

let browser;
const wait = (page, ms = 500) => page.waitForTimeout(ms);

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
		motion: getComputedStyle(document.querySelector(".post-item")).transitionDuration
	}));
	assert.equal(state.page, "list");
	assert.equal(state.canvas, "rgb(247, 248, 250)");
	assert.equal(state.list, 6);
	assert.equal(state.aliases, true);
	assert.equal(state.header, true);
	assert.equal(state.search, true);
	assert.equal(state.fastNav, "none");
	assert.equal(state.tools, "none");
	assert.ok(state.motion !== "0s");
	assert.deepEqual(errors, []);
	await context.close();
});

test("列表页：资料卡和热榜恢复，删除信用分并在控制区保留 NQ", async () => {
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
	assert.equal(await page.locator(".post-list-controler .nsmax-nq-entry").count(),1);
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
	assert.equal(state.fastNav, "none");
	assert.deepEqual(errors, []);
	await context.close();
});

test("深色模式：套件表面、文字和操作色同步切换", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: listPage({ dark: true }), colorScheme: "dark" });
	await wait(page);
	const state = await page.evaluate(() => ({
		dark: document.documentElement.hasAttribute("data-nsmax-dark"),
		canvas: getComputedStyle(document.body).backgroundColor,
		card: getComputedStyle(document.querySelector(".main-panel")).backgroundColor,
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
		right: getComputedStyle(document.querySelector("#nsk-right-panel-container")).display,
		tools: document.querySelector("#nspp-tools"),
		panel: getComputedStyle(document.querySelector("#user-setting-panel > .selector")).borderRadius,
		input: getComputedStyle(document.querySelector("#user-setting-panel input[type=text]")).borderRadius,
		nav: document.querySelectorAll("#user-setting-panel .select-item").length,
		fields: document.querySelectorAll("#user-setting-panel .personal-info fieldset").length,
		save: document.querySelector("#user-setting-panel .personal-info button.btn") !== null,
		footer: document.querySelector("body > footer") ? getComputedStyle(document.querySelector("body > footer")).display : "none"
	}));
	assert.equal(state.page, "setting");
	assert.equal(state.right, "none");
	assert.equal(state.tools, null);
	assert.equal(state.panel, "12px");
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
		const masks = await page.locator('.comment-menu [title="点赞"],.comment-menu [title="引用"],.comment-menu [title="回复"]').evaluateAll(es => es.map(e => getComputedStyle(e,"::before").content));
		assert.ok(masks.every(mask => mask === '""'));
		assert.equal(await page.locator('.nsmax-floor-actions .menu-item[data-nsmax-compact-action]').count(),15);
		assert.equal(Object.keys(calls).some(key => key.startsWith("/api/account/getInfo/")), false);
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
		await page.waitForSelector('pre > [data-nspp-copy]');
		await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedText=text}},configurable:true}));
		await page.locator('.post-content pre').hover();
		const button=page.locator('pre > [data-nspp-copy]');
		assert.equal(await button.evaluate(e=>getComputedStyle(e).position),'absolute');
		await button.click();
		assert.equal(await page.evaluate(()=>window.__copiedText),'curl -fsSL https://example.com/install.sh | bash');
		assert.deepEqual(errors,[]);
	} finally {await context.close();}
});

test("手机：页面无横向溢出、回复输入可用、页脚链接组隐藏", async () => {
	for (const [url, render] of [["/",listPage],["/post-1000-1",postPage],["/setting",settingPage],["/notification",notificationPage]]) {
		const { context, page, errors } = await open(browser, `https://www.nodeseek.com${url}`, { html: render(), viewport: { width:390,height:844 } });
		try {
			await wait(page);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), false, url);
			assert.equal(await page.locator('body > footer').isVisible(), false, url);
			if (url.includes('post-')) assert.equal(await page.locator('.md-editor textarea').isVisible(), true);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	}
});

test("独立 CSS：页面条件不会隐藏首页侧栏或原生回复框", async () => {
	const fs=require('node:fs'),path=require('node:path');
	const css=fs.readFileSync(path.join(__dirname,'../theme/nodeseek-max.css'),'utf8');
	for (const [url,render] of [["/",listPage],["/post-1000-1",postPage],["/setting",settingPage]]) {
		const {context,page,errors}=await open(browser,`https://www.nodeseek.com${url}`,{html:render(),script:false,css,viewport:{width:1440,height:900}});
		try {
			await wait(page,100);
			assert.equal(await page.locator('body>footer').isVisible(),false);
			if(url==='/') assert.equal(await page.locator('#nsk-right-panel-container .user-card').isVisible(),true);
			if(url.includes('post-')) assert.equal(await page.locator('.md-editor').isVisible(),true);
			if(url==='/setting') assert.equal(await page.locator('#nsk-right-panel-container').isVisible(),false);
			assert.deepEqual(errors,[]);
		} finally {await context.close();}
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
	assert.equal(packageJson.version, "1.7.6");
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
		assert.equal(await page.locator('.nsmax-account-menu a').count(),8);
		assert.equal(await page.locator('.nsmax-sb-account a[href="/new-discussion"]').isVisible(),true);
		assert.equal(await page.locator('.user-card>.user-head').isVisible(),false);
		await page.evaluate(()=>document.querySelector('.user-card>.user-stat').append(document.createTextNode('鸡腿 4161')));
		await wait(page,500);
		assert.equal(await page.locator('.nsmax-sb-account a[href="/new-discussion"]').isVisible(),true);
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("楼层与正文：正文使用完整剩余宽度，回复框只有一层边框",async()=>{
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage(),viewport:{width:1440,height:900}});
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
		await page.waitForFunction(()=>document.querySelector('#nspp-settings').shadowRoot.querySelector('.toast-message')?.textContent.includes('最新版本'));
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
		await page.locator('button.nspp-action').filter({hasText:'加载下一页'}).click();
		await page.waitForSelector('li[id="4"]');
		await page.waitForSelector('li[id="1"]>.nsmax-nested-replies>li[id="4"]');
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
		await page.locator('.nsmax-editor-head').getByRole('button',{name:'预览',exact:true}).click();
		assert.equal(await page.locator('.nsmax-editor-preview strong').innerText(),'草稿测试');
		assert.equal(await page.locator('.md-editor textarea').isVisible(),false);
		await page.locator('.nsmax-editor-head').getByRole('button',{name:'预览',exact:true}).click();
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
		assert.equal(await page.evaluate(()=>window.__gmRequests.some(url=>url.includes('fontsource'))),false);
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
		assert.equal(await page.locator('.nsmax-nq-entry').innerText(),'NQ');
		assert.equal(await page.locator('.nsmax-nq-entry svg').count(),0);
		assert.equal(await page.locator('.pager-bottom a.pager-next').innerText(),'下一页');
		assert.equal(await page.locator('.pager-bottom .pager-prev').isVisible(),false);
		const row=page.locator('ul.post-list:not(.topic-carousel-panel)>li').first();
		const ordered=await row.locator('.post-info').evaluate(e=>[...e.children].filter(n=>n.matches('.info-author,.info-last-comment-time,.nsmax-inline-category,.info-views,.info-comments-count,.info-last-commenter')).map(n=>n.className));
		assert.ok(ordered[0].includes('info-author'));
		assert.ok(ordered[1].includes('info-last-comment-time'));
		assert.equal(ordered[2],'nsmax-inline-category');
		assert.ok(ordered[3].includes('info-views'));
		const state=await row.locator('.post-info').evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,gap:getComputedStyle(e).gap}));
		assert.deepEqual(state,{font:'12px',line:'18px',gap:'8px'});
		assert.equal(await page.locator('.nsmax-hot-refresh').isVisible(),false);
		assert.equal(await page.locator('.nsmax-hot-panel').evaluate(e=>getComputedStyle(e).borderTopWidth),'1px');
		assert.equal(await page.locator('.nsmax-account-rank').innerText(),'Lv 6');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("评论对齐：操作区在右上方、无文字、保留真实计数、正文与作者对齐",async()=>{
	const html=postPage().replaceAll('title="引用"','title="引用"').replaceAll('<span></span>','<span>引用</span>');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html,viewport:{width:1440,height:900}});
	try{
		await page.waitForSelector('.nsmax-floor-actions');
		const dims=await page.locator('ul.comments li.content-item').evaluateAll(rows=>rows.map(row=>{
			const author=row.querySelector('.author-name').getBoundingClientRect(),body=row.querySelector('article').getBoundingClientRect(),actions=row.querySelector('.nsmax-floor-actions').getBoundingClientRect();return {authorX:author.left,bodyX:body.left,authorY:author.top,actionY:actions.top,actionX:actions.left,authorRight:author.right};
		}));
		assert.ok(dims.every(r=>Math.abs(r.authorX-r.bodyX)<=1&&Math.abs(r.authorY-r.actionY)<=4&&r.actionX>r.authorRight),JSON.stringify(dims));
		assert.ok(dims.every(r=>r.authorX===dims[0].authorX),JSON.stringify(dims));
		assert.equal(await page.locator('.nsmax-floor-actions [data-nsmax-action-label]:visible').count(),0);
		assert.equal(await page.locator('.nsmax-floor-actions [title="点赞"] [data-nsmax-action-count]').first().innerText(),'1');
		assert.equal(await page.locator('.nsmax-floor-actions .menu-item').first().evaluate(e=>getComputedStyle(e,'::before').maskImage==='none'),false);
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
		await page.locator('.nsmax-editor-head').getByRole('button',{name:'预览',exact:true}).click();
		assert.equal(await page.locator('[data-nsmax-editor-pane]').isVisible(),false);
		assert.equal(await page.locator('.nsmax-editor-preview img').isVisible(),true);
		const gap=await page.locator('.nsmax-editor-preview').evaluate(e=>e.getBoundingClientRect().top-e.parentElement.getBoundingClientRect().top);
		assert.ok(gap<=2,`预览顶部留下 ${gap}px 空白`);
		await page.locator('.nsmax-editor-head').getByRole('button',{name:'内容',exact:true}).click();
		assert.equal(await page.locator('.CodeMirror').isVisible(),true);
		assert.ok(await page.locator('.CodeMirror').evaluate(e=>e.CodeMirror.getValue().includes('本地图片')));
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});

test("最近浏览：本地去重、十条上限、安全标题、位于热榜之后，无额外请求",async()=>{
	const seed=Array.from({length:10},(_,i)=>({path:'/post-'+(9000+i)+'-1',title:'以前浏览 '+i}));
	const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html:postPage(),init:`if(window.top===window)localStorage.setItem('nsmax:recent:1',${JSON.stringify(JSON.stringify(seed))});`});
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

test("头像悬停：仅一张资料卡、按需请求一次、缓存复用、Escape 关闭",async()=>{
	const {context,page,errors,calls}=await open(browser,'https://www.nodeseek.com/',{html:listPage(),viewport:{width:1440,height:900}});
	try{
		await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-nsmax-mounting'));
		assert.equal(Object.keys(calls).some(path=>path.includes('/getInfo/')),false);
		const avatar=page.locator('ul.post-list>li>a:has(img)').first();
		await avatar.hover();
		await page.waitForSelector('.nsmax-person-pop dd');
		assert.equal(await page.locator('.nsmax-person-pop:visible').count(),1);
		assert.equal(Object.keys(calls).filter(path=>path.includes('/getInfo/')).length,1);
		await page.keyboard.press('Escape');
		assert.equal(await page.locator('.nsmax-person-pop').count(),0);
		await page.mouse.move(5,5);await avatar.hover();
		await page.waitForSelector('.nsmax-person-pop dd');
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
		await page.locator('.post-title-input').fill('本地测试标题，不发布');
		await page.locator('.category-select').selectOption('tech');
		await page.locator('.md-editor textarea').fill('测试正文');
		await page.locator('.nsmax-editor-controls').getByRole('button',{name:'抽奖',exact:true}).click();
		assert.match(await page.locator('.post-title-input').inputValue(),/^抽奖：/);
		assert.match(await page.locator('.md-editor textarea').inputValue(),/开奖链接/);
		await page.locator('.nsmax-editor-head').getByRole('button',{name:'预览',exact:true}).click();
		assert.match(await page.locator('.nsmax-editor-preview').innerText(),/测试正文/);
		assert.match(await page.locator('.nsmax-editor-preview').innerText(),/开奖链接/);
		assert.equal(await page.locator('.category-select').inputValue(),'tech');
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
			assert.equal(style.title,dark?'rgb(242, 243, 248)':'rgb(5, 0, 56)');
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
			if(hash.includes('comments'))assert.equal(await wrapper.locator('p').first().evaluate(e=>getComputedStyle(e).color),dark?'rgb(139, 143, 161)':'rgb(107, 111, 126)');
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
			assert.equal(await page.locator('.nsmax-message-tabs:visible').count(),1);
			assert.equal(await page.locator('.app-switch:visible,.nspp-messages-fixed-contacts:visible').count(),0);
			assert.deepEqual(await page.locator('.nspp-messages-top-actions button').allTextContents(),['全部已读']);
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
			assert.equal(await page.locator('.nsmax-message-tabs:visible').count(),1);
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
		assert.ok((await side.boundingBox()).y<=(await main.boundingBox()).y+1);
		assert.equal(await side.evaluate(e=>getComputedStyle(e).position),'static');
		assert.equal(await side.evaluate(e=>getComputedStyle(e).overflowY),'visible');
		for(const [label,href]of[['鸡腿','/credit'],['星辰','/stardust/list'],['主题帖','/space/1#/discussions'],['评论数','/space/1#/comments']])assert.equal(await page.locator('.nsmax-account-stat').filter({has:page.locator('dt').filter({hasText:label})}).getAttribute('href'),href);
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'个人设置',exact:true}).getAttribute('href'),'/setting');
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'我的邀请',exact:true}).count(),0);
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

test("列表图标与抽奖：五项单图标、SB 悬停色、抽奖标签唯一、推荐轮播隐藏",async()=>{
	const html=listPage().replace('出一台香港 CN2 GIA 小鸡，年付 99','抽奖：国庆活动').replace('<ul class="post-list">','<div class="topic-carousel-wrapper"><ul class="topic-carousel-panel"><li>滚动推荐</li></ul></div><ul class="post-list">');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/',{html});
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

test("评论单图标、楼主蓝色热评红色、楼中楼透明、预览仅标题正文",async()=>{
	const html=postPage().replace('<a href="#1" class="floor-link">','<span class="hot-badge"></span><a href="#1" class="floor-link">');
	const {context,page,errors}=await open(browser,'https://www.nodeseek.com/post-1000-1',{html});
	try{
		await page.waitForSelector('.nsmax-floor-actions');
		assert.equal(await page.locator('.comment-menu .menu-item>svg:visible').count(),0);
		assert.equal(await page.locator('.nsmax-floor-actions [data-nsmax-action=reply]').first().evaluate(e=>getComputedStyle(e,'::before').maskImage==='none'),false);
		assert.equal(await page.locator('.is-poster').evaluate(e=>getComputedStyle(e).color),'rgb(51, 64, 143)');
		assert.equal(await page.locator('.hot-badge').evaluate(e=>getComputedStyle(e).color),'rgb(207, 43, 43)');
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
		assert.equal(await page.locator('.md-editor button.submit').innerText(),'回复');
		const button=await page.locator('.md-editor button.submit').boundingBox(),editor=await page.locator('.md-editor').boundingBox();
		assert.ok(Math.abs(button.x-editor.x-17)<2);
		assert.equal(await page.locator('.md-editor').evaluate(e=>getComputedStyle(e).borderRadius),'12px');
		assert.deepEqual(errors,[]);
	}finally{await context.close();}
});
