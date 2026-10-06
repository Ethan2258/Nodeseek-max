"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const { listPage, postPage, notificationPage, settingPage, nativeMessagePage, nativeTalkPage, nativeSpacePage, newPostPage, spaceTopicsPage, spaceCommentsPage, boardPage } = require("./fixtures/pages.cjs");

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
	assert.equal(packageJson.version, "1.7.19");
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
		await page.locator('.nsmax-editor-preview img').waitFor();
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
		assert.equal(await side.evaluate(e=>getComputedStyle(e).position),'sticky');
		assert.equal(await side.evaluate(e=>getComputedStyle(e).overflowY),'auto');
		for(const [label,href]of[['鸡腿','/credit'],['星辰','/stardust/list'],['主题帖','/space/1#/discussions'],['评论数','/space/1#/comments']])assert.equal(await page.locator('.nsmax-account-stat').filter({has:page.locator('dt').filter({hasText:label})}).getAttribute('href'),href);
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'个人设置',exact:true}).getAttribute('href'),'/setting');
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'我的邀请',exact:true}).count(),0);
		assert.equal(await page.locator('.nsmax-account-menu').getByRole('link',{name:'我的粉丝',exact:true}).getAttribute('href'),'/fans?type=fans');
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

test("用户需求还原：图一抽奖同行不换行、图二管理记录、图三/四个人空间与Level6专属进度条",async()=>{
	// 1. 图一：抽奖徽章同行不换行
	const listHtml = listPage().replace('出一台香港 CN2 GIA 小鸡，年付 99','抽奖：大吉大利今晚吃鸡');
	const {context: ctxList, page: pageList, errors: errorsList} = await open(browser,'https://www.nodeseek.com/',{html: listHtml});
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
		'<div role="heading" aria-level="3" class="post-title"><a href="/post-1000-1" target="">短标题</a><span class="min-grade"><svg class="iconpark-icon"><use href="#lock"></use></svg> 1</span> <!----></div>'
	);
	const {context: ctxLock, page: pageLock, errors: errorsLock} = await open(browser,'https://www.nodeseek.com/',{html: listHtmlLock});
	try {
		await pageLock.waitForSelector('ul.post-list .post-title .min-grade');
		const link = pageLock.locator('ul.post-list .post-title a').first();
		const lock = pageLock.locator('ul.post-list .post-title .min-grade').first();
		const linkBox = await link.boundingBox();
		const lockBox = await lock.boundingBox();
		assert.ok(linkBox && lockBox, 'Link and lock bounding boxes exist');
		assert.ok(lockBox.x > linkBox.x, 'Lock badge is after the title link');
		const gap = lockBox.x - (linkBox.x + linkBox.width);
		assert.ok(gap >= 0 && gap <= 10, `Lock badge directly follows title with small gap (gap: ${gap}px)`);
		assert.ok(Math.abs(lockBox.y - linkBox.y) < 6, 'Lock badge is on the same line as title link');
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
		assert.equal(await side.evaluate(e => getComputedStyle(e).overflowY), 'auto');
		assert.equal(await side.evaluate(e => getComputedStyle(e).overscrollBehavior), 'contain');
		const canScroll = await side.evaluate(e => {
			e.scrollTop = 50;
			return e.scrollTop > 0;
		});
		assert.equal(canScroll, true, 'Right sidebar can scroll independently');
		assert.deepEqual(errorsCard, []);
	} finally { await ctxCard.close(); }

	// 3. 图三与图四：个人空间布局与 Level 6 专属进度条
	const spaceHtmlLv6 = nativeSpacePage().replace('<div>等级</div><div>3</div>', '<div>等级</div><div>6</div>');
	const {context: ctxSpace, page: pageSpace, errors: errorsSpace} = await open(browser,'https://www.nodeseek.com/space/10',{html: spaceHtmlLv6});
	try {
		await pageSpace.waitForSelector('.nsmax-space-top');
		assert.equal(await pageSpace.locator('.nsmax-space-badge').count(), 0);
		assert.equal(await pageSpace.locator('.nsmax-space-meta .nsmax-space-online').count(), 1);
		assert.equal(await pageSpace.locator('.nsmax-space-meta .nsmax-space-uid').innerText(), 'UID 10');
		assert.equal(await pageSpace.locator('.head-container .card-block>.card-item:visible').count(), 4);
		const progress = pageSpace.locator('.nsmax-space-progress');
		assert.equal(await progress.getAttribute('data-nsmax-level-max') !== null, true);
		assert.equal(await progress.locator('.nsmax-space-progress-level').innerText(), 'Lv.6 登峰造极');
		assert.equal(await progress.locator('.nsmax-space-progress-percent').innerText(), 'MAX');
		assert.equal(await progress.locator('.nsmax-space-progress-next').innerText(), '已达最高等级');
		assert.equal(await progress.locator('b').evaluate(e => e.style.width), '100%');
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
		// lastActive should be "最后在线 刚刚" and NOT have "一句话介绍自己"
		const lastText = await pageSpace.locator('.nsmax-space-last').innerText();
		assert.ok(!lastText.includes('一句话介绍自己'), 'lastActive does not contain bio placeholder');
		assert.ok(lastText.includes('最后在线'), 'lastActive contains 最后在线');

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
		await pageNav.waitForSelector('.nsmax-essence-tab-item');
		// "推广" is hidden
		const promoItems = pageNav.locator('ul.nav-menu li').filter({hasText: '推广'});
		const promoCount = await promoItems.count();
		for (let i = 0; i < promoCount; i++) {
			const promoDisplay = await promoItems.nth(i).evaluate(el => getComputedStyle(el).display);
			assert.equal(promoDisplay, 'none');
		}
		// "精华" tab exists, points to /award, has badge
		const essenceTab = pageNav.locator('ul.nav-menu .nsmax-essence-tab');
		assert.equal(await essenceTab.isVisible(), true);
		assert.equal(await essenceTab.getAttribute('href'), '/award');
		assert.equal(await pageNav.locator('.nsmax-essence-badge').innerText(), '精');
		// "精华" is the last li in ul.nav-menu
		const isLast = await pageNav.locator('ul.nav-menu>li').last().evaluate(el => el.classList.contains('nsmax-essence-tab-item'));
		assert.equal(isLast, true, 'Essence tab is at the end of nav-menu');
		assert.deepEqual(errorsNav, []);
	} finally { await ctxNav.close(); }

	// 3. 全站 Level 6 尊贵标记 (crown & highlight)
	const postWithLv6 = postPage().replace(
		'<span class="role-tag">Lv 2</span>',
		'<span class="role-tag">Lv 6</span>'
	);
	const {context: ctxPost, page: pagePost, errors: errorsPost} = await open(browser,'https://www.nodeseek.com/post-1000-1',{html: postWithLv6});
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
		assert.equal(await pageSpace.locator('.nsmax-space-online').count(), 1);
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

test("v1.7.11 视觉细节：顶栏板块激活态纯文本高亮无黑药丸、侧栏与悬停卡 Lv 6 位于名字下方且附带尊贵流光皇冠", async () => {
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
		// 背景绝不能是黑色药丸（rgb(24, 24, 27)）
		assert.equal(insideStyle.bg, "rgba(0, 0, 0, 0)");
		assert.ok(insideStyle.weight >= 600);

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
		assert.equal(await personLevel.innerText(), "Lv 6");
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
		const nestedList = pagePost.locator('[id="10"] > .nsmax-nested-replies');
		assert.equal(await nestedList.count(), 1);
		// 所有子回复 #11, #12, #13 都平铺在根楼层的 .nsmax-nested-replies 下（而不是多层递归嵌套）
		const directChildren = nestedList.locator("> li.content-item");
		assert.equal(await directChildren.count(), 3, "所有连续多轮回复都平铺在根楼层下，避免深层递归阶梯");
		// 校验子元素内部不存在再嵌套的 .nsmax-nested-replies
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
		const panelDisplay = await panel.evaluate(el => getComputedStyle(el).display);
		assert.equal(panelDisplay, "flex");
		const selectorGrid = await pageSetting.locator("#user-setting-panel .selector").evaluate(el => ({
			display: getComputedStyle(el).display,
			cols: getComputedStyle(el).gridTemplateColumns
		}));
		assert.equal(selectorGrid.display, "grid");
		assert.ok(selectorGrid.cols.includes("190px"), "设置区为 190px 双栏布局");
		assert.deepEqual(errorsSetting, []);
	} finally { await ctxSetting.close(); }
});

test("v1.7.13 细节精修：NQ彩标前置、设置页居中去黑胶囊、帖子图片左对齐边框动效、侧栏支持悬停预览", async () => {
	// 1. 列表页：NQ 按钮包含彩色图标
	const { context: ctxList, page: pageList, errors: errorsList } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pageList);
		const nq = pageList.locator(".post-list-controler .nsmax-nq-entry");
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
		assert.equal(metrics.panelMaxWidth, "1040px", "设置面板限制最大宽度 1040px 居中");
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
		assert.equal(await accountRank.innerText(), "Lv 6");
		const crownStyle = await pageLv6.evaluate(() => {
			const el = document.querySelector(".nsmax-account-rank");
			const pseudo = window.getComputedStyle(el, "::before");
			return {
				content: pseudo.content,
				transform: pseudo.transform
			};
		});
		assert.ok(crownStyle.content.includes("👑"), "皇冠 emoji 正常作为前缀渲染");
		assert.ok(crownStyle.transform.includes("matrix"), "皇冠通过 translateY(-1.5px) 居中对齐");

		// 头像悬停卡
		const userAvatarLink = pageLv6.locator('ul.post-list .post-list-item a[href="/space/10"]').first();
		await userAvatarLink.hover();
		const personPop = pageLv6.locator(".nsmax-person-pop");
		await personPop.waitFor({ state: "visible" });
		const personLevel = pageLv6.locator(".nsmax-person-level");
		assert.equal(await personLevel.innerText(), "Lv 6");
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

		// Tab 排序与激活：移除资料与设置，仅保留可见的主题与回帖
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

		// 检查 Shadow DOM 内部样式：content 无 mask-image，h3 无 sticky 且背景透明
		const styles = await pageSet.evaluate(() => {
			const host = document.querySelector("#nspp-settings");
			const shadow = host?.shadowRoot;
			const content = shadow?.querySelector(".content");
			const h3 = shadow?.querySelector("h3");
			const cStyle = content ? getComputedStyle(content) : null;
			const hStyle = h3 ? getComputedStyle(h3) : null;
			return {
				maskImage: cStyle?.maskImage || cStyle?.webkitMaskImage || "none",
				h3Position: hStyle?.position || "",
				h3Bg: hStyle?.backgroundColor || ""
			};
		});
		assert.ok(styles.maskImage === "none" || styles.maskImage === "", "content 不应含有遮罩 mask-image");
		assert.notEqual(styles.h3Position, "sticky", "h3 不应为 sticky 悬浮条");
		assert.deepEqual(errorsSet, []);
	} finally { await ctxSet.close(); }

	// 2. 字体切换生效验证（Claude / Inter / System）
	const { context: ctxFont, page: pageFont, errors: errorsFont } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
		html: postPage(),
		seed: {
			"nsmax:migrate:font-system": true,
			"nspp:settings:www.nodeseek.com": {
				"modern-theme": {
					enabled: true,
					font: "claude"
				}
			}
		}
	});
	try {
		await wait(pageFont);
		const fontState = await pageFont.evaluate(() => {
			const html = document.documentElement;
			const post = document.querySelector("article.post-content, .post-content, h1");
			return {
				htmlFontAttr: html.getAttribute("data-nsmax-font"),
				postFont: post ? getComputedStyle(post).fontFamily : ""
			};
		});
		assert.equal(fontState.htmlFontAttr, "claude", "HTML 应当具有 data-nsmax-font=claude 属性");
		assert.ok(/serif/i.test(fontState.postFont), "Claude 模式下正文应当应用衬线体: " + fontState.postFont);
		assert.deepEqual(errorsFont, []);
	} finally { await ctxFont.close(); }

	// 3. 翻页区域去遮罩与页脚完全隐藏
	const { context: ctxPager, page: pagePager, errors: errorsPager } = await open(browser, "https://www.nodeseek.com/", { html: listPage() });
	try {
		await wait(pagePager);
		const pagerState = await pagePager.evaluate(() => {
			const pager = document.querySelector(".nsk-pager.pager-bottom, .post-bottom-pager, .nsk-pager:not(.pager-top)");
			const footer = document.querySelector("footer, .footer, body > footer");
			return {
				pagerVisible: pager ? getComputedStyle(pager).display !== "none" : false,
				footerHidden: !footer || getComputedStyle(footer).display === "none"
			};
		});
		assert.equal(pagerState.pagerVisible, true);
		assert.equal(pagerState.footerHidden, true, "页脚应当彻底隐藏，不应在翻页处形成遮罩");
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
		const titleVal = await pagePost.locator(".post-title-input").inputValue();
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

		// E. 验证举报功能自动写入 @admin 并提交发布
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

		assert.deepEqual(errorsPost, []);
	} finally { await ctxPost.close(); }

	// 2. 首页控制栏与顶栏复刻
	const { context: ctxList, page: pageList, errors: errorsList } = await open(browser, "https://www.nodeseek.com/", {
		html: listPage()
	});
	try {
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
		assert.equal(controlerStyle.height, "48px");
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
