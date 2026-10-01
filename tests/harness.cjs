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
	window.GM_registerMenuCommand = () => {};
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
	"/api/notification/message/list": { success: true, msgArray: [
		{ id: 11, sender_id: 42, receiver_id: 1, sender_name: "spammer", receiver_name: "tester", content: "加我微信", viewed: 0, created_at: new Date().toISOString() },
		{ id: 12, sender_id: 7, receiver_id: 1, sender_name: "friend", receiver_name: "tester", content: "周末一起测速", viewed: 1, created_at: new Date().toISOString() }
	] }
};

async function launch() {
	return chromium.launch({ args: ["--disable-gpu"] });
}

// 打开一个页面：所有请求都在本地处理，外部网络一律拒绝。
async function open(browser, url, { html, seed, fontFiles, colorScheme = "light", viewport = { width: 1280, height: 900 }, pages = {} } = {}) {
	const context = await browser.newContext({ colorScheme, viewport, deviceScaleFactor: 1 });
	const errors = [];
	await context.addInitScript({ content: `${gmShim(seed, fontFiles)}\n;(function () {\n${SCRIPT}\n})();` });
	await context.route("**/*", async (route) => {
		const request = route.request();
		const target = new URL(request.url());
		if (target.hostname === "www.nodeseek.com") {
			const key = target.pathname.replace(/\/$/, "") || "/";
			if (key.startsWith("/api/")) {
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
	await page.goto(url, { waitUntil: "domcontentloaded" });
	return { context, page, errors };
}

module.exports = {
	launch,
	open,
	ROOT
};
