"use strict";
// 冒烟测试工具：在 Chromium 中以 document-start 时机注入用户脚本，并用本地路由模拟站点与接口。
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SCRIPT = fs.readFileSync(path.join(ROOT, "nodeseek-max.user.js"), "utf8");

const hotPosts = (kind) => ({
	updated_at: Math.floor(Date.now() / 1e3) - 120,
	posts: Array.from({ length: 15 }, (_, index) => ({
		score: 5e3 - index * 300,
		post: {
			id: 3000 + index,
			title: `${kind === "hot" ? "实时" : kind === "daily" ? "日榜" : "周榜"}热帖 ${index + 1}：甲骨文免费机器又开放注册了`,
			author: `author${index}`,
			author_id: 100 + index,
			views: 1000 - index * 20,
			comments: 50 - index
		}
	}))
});

// 油猴 API 垫片：存储落到 localStorage，跨域请求只放行热榜与更新检查。
const gmShim = (seed, fontFiles) => `(() => {
	const PREFIX = "__gm__:";
	const seed = ${JSON.stringify(seed || {})};
	for (const [key, value] of Object.entries(seed)) if (localStorage.getItem(PREFIX + key) === null) localStorage.setItem(PREFIX + key, JSON.stringify(value));
	window.GM_getValue = (key, fallback) => {
		const raw = localStorage.getItem(PREFIX + key);
		return raw === null ? fallback : JSON.parse(raw);
	};
	window.GM_setValue = (key, value) => localStorage.setItem(PREFIX + key, JSON.stringify(value));
	window.GM_addStyle = (css) => {
		const style = document.createElement("style");
		style.textContent = css;
		(document.head || document.documentElement).append(style);
		return style;
	};
	window.__gmMenus = {};
	window.GM_registerMenuCommand = (name, callback) => { window.__gmMenus[name] = callback; };
	window.GM_notification = () => {};
	window.unsafeWindow = window;
	window.__gmRequests = [];
	window.GM_xmlhttpRequest = (details) => {
		window.__gmRequests.push(details.url);
		const hot = details.url.match(/^https:\\/\\/api\\.bimg\\.eu\\.org\\/(hot|daily|weekly)\\.json/);
		setTimeout(() => {
			if (hot) details.onload?.({ status: 200, responseText: JSON.stringify(window.__hotPosts(hot[1])) });
			else if (details.url.startsWith("https://cdn.jsdelivr.net/")) {
				// 字体：提供了真实文件就返回真实内容，否则返回一段伪造数据，验证签名/哈希校验会拒绝它。
				const encoded = ${JSON.stringify(fontFiles || {})}[details.url.split("/").pop()];
				const bytes = encoded ? Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)) : new Uint8Array(20000).fill(7);
				details.onload?.({ status: 200, response: bytes.buffer });
			}
			else if (details.url.includes("raw.githubusercontent.com")) details.onload?.({ status: 200, responseText: "// ==UserScript==\\n// @version      1.0.0\\n// ==/UserScript==\\n" });
			else if (details.url.startsWith("https://image.110726.com/")) {
				window.__uploads = (window.__uploads || []).concat({ url: details.url, headers: details.headers, anonymous: details.anonymous });
				details.onload?.({ status: 201, response: { duplicate: false, image: { name: "shot.png", originalUrl: "/api/i/abc123.png" } } });
			}
			else details.onerror?.({});
		}, 30);
		return { abort() {} };
	};
	window.__hotPosts = ${hotPosts.toString()};
})();`;

const apiResponses = {
	"/api/block-list/list": { success: true, data: [{ block_member_id: 42, block_member_name: "spammer" }] },
	"/api/notification/unread-count": { success: true, unreadCount: { atMe: 1, reply: 1, message: 1 } },
	"/api/notification/at-me/list": { success: true, atList: [
		{ id: 1, post_id: 2001, commenter_id: 42, commenter_name: "spammer", post_title: "垃圾广告", content: "<p>@tester 快来买</p>", viewed: 0, created_at: new Date().toISOString() },
		{ id: 2, post_id: 2002, commenter_id: 7, commenter_name: "friend", post_title: "正常讨论", content: "<p>@tester 你怎么看</p>", viewed: 1, created_at: new Date().toISOString() }
	] },
	"/api/notification/reply-to-me/list": { success: true, replyList: [] },
	"/api/account/getInfo/": { success: true, detail: { member_id: 10, member_name: "user0", rank: 3, coin: 1107, stardust: 19, nPost: 46, nComment: 867, follows: 0, fans: 0, created_at: new Date(Date.now() - 65 * 864e5).toISOString() } },
	"/api/notification/message/with/": { success: true, talkTo: { member_id: 7, member_name: "friend" }, msgArray: [
		{ id: 21, sender_id: 7, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "在吗？周末一起测速", viewed: 1, created_at: new Date(Date.now() - 36e5).toISOString() },
		{ id: 22, sender_id: 1, receiver_id: 7, sender_name: "tester", receiver_name: "friend", content: "好啊，用 NodeQuality 跑一遍", viewed: 1, created_at: new Date(Date.now() - 35e5).toISOString() },
		{ id: 23, sender_id: 7, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "行，结果发我", viewed: 0, created_at: new Date(Date.now() - 6e5).toISOString() }
	] },
	"/api/notification/message/list": { success: true, msgArray: [
		{ id: 11, sender_id: 42, receiver_id: 1, sender_name: "spammer", receiver_name: "tester", content: "加我微信", viewed: 0, created_at: new Date().toISOString() },
		{ id: 12, sender_id: 7, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "周末一起测速", viewed: 1, created_at: new Date().toISOString() }
	] }
};

async function launch() {
	// NSMAX_CHROMIUM：本地没有 Playwright 自带的 Chromium 时，指向已安装的 Chrome / Edge 可执行文件
	const defaultChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
	const executablePath = process.env.NSMAX_CHROMIUM || (fs.existsSync(defaultChrome) ? defaultChrome : undefined);
	return chromium.launch({ executablePath, args: ["--disable-gpu"] });
}

// 打开一个页面：所有请求都在本地处理，外部网络一律拒绝。
// api：按接口路径给出依次返回的响应 [{ status, headers, body }]，用完后回到默认模拟数据；calls 记录每个接口被请求的次数。
// injectWhenRoot：等 <html> 元素出现后再执行脚本（Tampermonkey 在 Chrome 上的实际注入时机），默认在文档创建时执行。
async function open(browser, url, { html, seed, fontFiles, colorScheme = "light", viewport = { width: 1280, height: 900 }, pages = {}, script = true, css = "", api = {}, init = "", injectWhenRoot = false, beforeNavigate, scriptSource = SCRIPT } = {}) {
	const calls = {};
	const context = await browser.newContext({ colorScheme, viewport, deviceScaleFactor: 1 });
	const errors = [];
	const body = `${gmShim(seed, fontFiles)}\n;(function () {\n${scriptSource}\n})();`;
	if (script) await context.addInitScript({ content: injectWhenRoot ? `(() => { const run = () => { try { (0, eval)(${JSON.stringify(body)}); } catch (error) { window.__injectError = String(error); throw error; } }; if (document.documentElement) run(); else new MutationObserver((records, observer) => { if (!document.documentElement) return; observer.disconnect(); run(); }).observe(document, { childList: true }); })();` : body });
	if (init) await context.addInitScript({ content: init });
	if (css) await context.addInitScript({ content: `document.addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = ${JSON.stringify(css)}; document.head.append(style); });` });
	await context.route("**/*", async (route) => {
		const request = route.request();
		const target = new URL(request.url());
		if (target.hostname === "www.nodeseek.com") {
			const key = target.pathname.replace(/\/$/, "") || "/";
			if (key.startsWith("/api/")) {
				calls[key] = (calls[key] || 0) + 1;
				const scripted = api[key]?.[calls[key] - 1];
				if (scripted) return route.fulfill({ status: scripted.status, headers: { "content-type": "application/json", ...scripted.headers }, body: JSON.stringify(scripted.body ?? {}) });
				const body = Object.entries(apiResponses).find(([prefix]) => key === prefix || key.startsWith(`${prefix}`))?.[1] ?? { success: true, data: [] };
				return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
			}
			const page = pages[target.pathname] ?? (target.pathname === new URL(url).pathname ? html : undefined);
			if (page) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: page });
			if (/^\/avatar\//.test(target.pathname)) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='#9aa5b1'/></svg>" });
			return route.fulfill({ status: 404, body: "not found" });
		}
		if (["example.com", "example.org", "link.zhihu.com"].includes(target.hostname)) return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><title>${target.hostname}</title><p>${target.href}</p>` });
		return route.abort();
	});
	const page = await context.newPage();
	page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		if (message.type() === "error" && !/Failed to load resource|net::ERR_FAILED/.test(message.text())) errors.push(`console: ${message.text()}`);
	});
	if (beforeNavigate) await beforeNavigate(page);
	await page.goto(url, { waitUntil: "domcontentloaded" });
	return { context, page, errors, calls };
}

module.exports = {
	launch,
	open,
	ROOT
};
