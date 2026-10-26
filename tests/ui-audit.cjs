"use strict";
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { webkit, devices } = require("playwright");
const { launch, open, ROOT } = require("./harness.cjs");
const { listPage, postPage, notificationPage, settingPage, newPostPage, nativeMessagePage, nativeTalkPage, nativeSpacePage } = require("./fixtures/pages.cjs");

async function main() {
	const browser = process.env.NSMAX_AUDIT_ENGINE === "webkit" ? await webkit.launch() : await launch();
	const output = process.env.NSMAX_AUDIT_DIR || path.join(ROOT, "docs", "validation");
	mkdirSync(output, { recursive: true });
	const reports = [];
	const selected = process.env.NSMAX_AUDIT_PAGES?.split(",");
	const settleDrawer = page => page.locator("#left-slide-panel").evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
	try {
		for (const [name, url, render] of [["home", "/", listPage], ["home-50", "/", o=>listPage({...o,count:50})], ["post", "/post-1000-1", postPage], ["notification", "/notification", notificationPage], ["messages", "/notification#/message?mode=list", nativeMessagePage], ["talk", "/notification#/message?mode=talk&to=10", nativeTalkPage], ["setting", "/setting", settingPage], ["new", "/new-discussion", newPostPage], ["space", "/space/10", nativeSpacePage]]) {
			if (selected && !selected.includes(name)) continue;
			for (const [width, dark] of [[1440, false], [1440, true], [390, false]]) {
				const { context, page, errors, calls } = await open(browser, `https://www.nodeseek.com${url}`, {
					html: render({ dark, mobile: width < 700 }), viewport: { width, height: 900 }, colorScheme: dark ? "dark" : "light",
					device: width < 700 ? { ...devices["iPhone 13"], viewport: { width, height: 844 } } : {},
					manager: width < 700 ? { type: "userscripts", delay: 10 } : undefined,
					seed: { "nsmax:migrate:font-sbsb": true, "nspp:settings:www.nodeseek.com": { attendance: { enabled: false }, "modern-theme": { font: "system" } } },
					init: `window.__auditTasks=[];window.__auditCLS=0;new PerformanceObserver(l=>window.__auditTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__auditCLS+=e.value}).observe({type:'layout-shift',buffered:true});`
				});
				try {
					await page.waitForSelector("html[data-nsmax-theme]");
					await page.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
					const state = await page.evaluate(() => {
						const visible = s => { const e = document.querySelector(s); return !!e && !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden"; };
						return { canvas: getComputedStyle(document.body).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth + 1,
							card: visible("#nsk-right-panel-container .user-card"), hot: visible(".nsmax-hot-panel"), reply: visible(".md-editor"), footer: visible("body>footer"), trust: document.querySelectorAll(".nspp-trust").length,
							longTasks: window.__auditTasks, cls: window.__auditCLS, paints: performance.getEntriesByType("paint").map(e=>({name:e.name,ms:e.startTime})), profileRequests: performance.getEntriesByType("resource").filter(e=>e.name.includes("/api/account/getInfo/")).length,
							styles: [...document.styleSheets].reduce((n,s)=>{try{return n+s.cssRules.length}catch{return n}},0) };
					});
					await page.screenshot({ path: path.join(output, `${name}-${width}-${dark ? "dark" : "light"}.png`), fullPage: true });
					if (name === "post") await page.locator(".md-editor").screenshot({ path: path.join(output, `reply-${width}-${dark ? "dark" : "light"}.png`), timeout: 1000 }).catch(()=>{});
					if (name === "post") {
						await page.locator('.md-editor textarea').fill('**回复预览**\n\n![本地图片](https://www.nodeseek.com/avatar/test)');
						await page.locator('.nsmax-editor-controls').getByRole('button',{name:'预览',exact:true}).click();
						await page.locator('.md-editor').screenshot({path:path.join(output,`reply-preview-${width}-${dark?'dark':'light'}.png`)});
					}
					if (name === "home") {
						const start = performance.now();
						await page.getByRole('button',{name:'NodeSeek Max 设置',exact:true}).click();
						state.settingsOpenMs = Math.round(performance.now()-start);
						await page.screenshot({path:path.join(output,`script-settings-${width}-${dark?'dark':'light'}.png`)});
						if(width < 700) {
							await page.locator("#nspp-settings").getByRole("button",{name:"关闭",exact:true}).tap();
							await page.getByRole("button",{name:"打开菜单",exact:true}).tap();
							await settleDrawer(page);
							await page.screenshot({path:path.join(output,"mobile-menu.png")});
							await page.locator("#left-slide-panel").getByRole("button",{name:"热榜",exact:true}).tap();
							await page.waitForSelector("#left-slide-panel .nsmax-hot-list a");
							await settleDrawer(page);
							await page.screenshot({path:path.join(output,"mobile-hot.png")});
							await page.locator("#left-slide-panel").getByRole("button",{name:"最近浏览",exact:true}).tap();
							await settleDrawer(page);
							await page.screenshot({path:path.join(output,"mobile-recent.png")});
						}
					}
					reports.push({ name, width, dark, ...state, calls, errors });
				} finally { await context.close(); }
			}
		}
	} finally { await browser.close(); }
	writeFileSync(path.join(output, "audit.json"), JSON.stringify(reports, null, 2) + "\n");
	console.log(JSON.stringify(reports, null, 2));
	if(reports.some(report=>report.errors.length||report.overflow))process.exitCode=1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
