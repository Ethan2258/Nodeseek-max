"use strict";
// 2026-11-22 电脑端两类问题逐页走查（Yiheng 先后报了搜索历史「xjetry」j/y 被裁、帖子页「已回复」比标题字高 2.6px）：
// 1. 字被裁：小行高（line-height: 1 之类）配 overflow: hidden / 省略号，下伸部分（j y g p、汉字最下面一笔）露不全；
// 2. 小标不居中：文字旁边的小标 / 图标的正中和字的字心差超过 1px。
// 测试机只有文泉驿，度量和 Windows 的微软雅黑 UI 不一样（同样的错只有 0.5px 左右，看不出来），所以照
// 雅黑 UI 的升部 / 降部（2080 / 521，2048 单位）给文泉驿套上 ascent-override / descent-override，再按雅黑 UI 的汉字字心
// （基线上 722/2048 em）量。字被裁按「国jgyp」的墨迹（下伸至少 0.215em）算，名字、备注这些内容换成什么字都不能被裁
const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");

const FONT_CSS = `@font-face{font-family:"FakeUI";src:local("WenQuanYi Zen Hei");ascent-override:101.56%;descent-override:25.44%}
html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*):is(#x,#y,#z,*), html[data-nsmax-theme]:is(#x,#y,#z,*):is(#x,#y,#z,*) body:is(#x,#y,#z,*) { --font-sans: "FakeUI", sans-serif !important; }`;
const settings = { attendance: { enabled: false } };
// 列表和帖子页带上「已回复 / 已参与 / 抽奖」小标
const markers = {
	seed: { "nspp:settings:www.nodeseek.com": settings, "nspp:state:www.nodeseek.com:sb-my-replies": { "posts:1": { 1000: [3], 1002: [5, 12] }, "joined:1": {}, "posts:1:synced": Date.now(), "posts:1:done": true } },
	init: `localStorage.setItem("nsmax:lottery-rules", ${JSON.stringify(JSON.stringify({ 1000: [{ start: 1, time: Date.now() + 864e5 }] }))});localStorage.setItem("nsmax:special-posts",JSON.stringify({"1000":"lottery"}));`
};
const plain = { seed: { "nspp:settings:www.nodeseek.com": settings } };

// 页面里量：返回被裁的字、和字心差超过 1px 的小标 / 图标
const measure = () => {
	const cv = document.createElement("canvas").getContext("2d");
	const YAHEI_CENTRE = 722 / 2048;
	const roots = [document.body];
	for (const e of document.querySelectorAll("*")) if (e.shadowRoot) roots.push(e.shadowRoot);
	const up = (a) => a.parentElement || (a.parentNode instanceof ShadowRoot ? a.parentNode.host : null);
	const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && el.checkVisibility(); };
	const name = (el) => `${up(el)?.className || ""} > ${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
	const hidden = (el) => { for (let a = el; a; a = up(a)) { const c = getComputedStyle(a); if (c.overflow !== "visible" && a.getBoundingClientRect().height < 4) return true; } return false; };
	const clip = [], off = [], texts = [];
	for (const root of roots) {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		for (let n; (n = walker.nextNode());) {
			const el = n.parentElement;
			if (!n.data.trim() || !el || el.closest("script,style,svg,textarea,option,noscript,template") || !shown(el) || hidden(el)) continue;
			const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), yahei = /FakeUI/.test(cs.fontFamily);
			cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
			const probe = cv.measureText("国jgyp"), cjk = cv.measureText("国");
			const range = document.createRange(); range.selectNodeContents(n);
			const lines = [...range.getClientRects()].filter((r) => r.width > 0.5).map((rect) => {
				const baseline = rect.top + Math.round(probe.fontBoundingBoxAscent);
				return { rect, top: baseline - probe.actualBoundingBoxAscent, bottom: baseline + Math.max(probe.actualBoundingBoxDescent, yahei ? fs * 0.215 : 0), centre: yahei ? baseline - fs * YAHEI_CENTRE : baseline - (cjk.actualBoundingBoxAscent - cjk.actualBoundingBoxDescent) / 2 };
			});
			texts.push({ n, el, lines });
			for (let a = el; a && a !== document.documentElement; a = up(a)) {
				const c = getComputedStyle(a);
				if (c.overflowX === "visible" && c.overflowY === "visible") continue;
				if (/auto|scroll/.test(c.overflowY) && a.scrollHeight > a.clientHeight + 1) continue; // 滚动区边上露半行是正常的
				const box = a.getBoundingClientRect(), top = box.top + a.clientTop, bottom = top + a.clientHeight;
				for (const line of lines) {
					if (line.rect.right < box.left + 1 || line.rect.left > box.right - 1 || line.bottom <= top || line.top >= bottom) continue;
					const cut = Math.max(top - line.top, line.bottom - bottom);
					if (cut > 0.5) clip.push(`${name(el)}「${n.data.trim().slice(0, 12)}」被 ${name(a)} 裁掉 ${cut.toFixed(2)}px`);
				}
			}
		}
	}
	const decorated = roots.flatMap((r) => [...r.querySelectorAll("*")]).filter((el) => {
		if (el.tagName === "IMG" || el.closest("script,style,template") || (el.tagName === "svg" && up(el)?.closest("svg")) || !shown(el)) return false;
		const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
		if (r.height < 6 || r.height > 26 || r.width > 160) return false;
		if (el.tagName === "svg") return true;
		return el.textContent.trim().length <= 12 && (!/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0);
	});
	for (const el of decorated) {
		const r = el.getBoundingClientRect(), middle = (r.top + r.bottom) / 2;
		let best = null;
		for (let a = up(el), level = 0; a && level < 4 && !best; a = up(a), level++) {
			for (const t of texts) {
				if (el.contains(t.n) || !a.contains(t.n) || decorated.some((d) => d !== el && d.contains(t.n) && !d.contains(el))) continue;
				for (const line of t.lines) {
					if (line.rect.bottom < r.top || line.rect.top > r.bottom) continue;
					const gap = Math.max(line.rect.left - r.right, r.left - line.rect.right, 0);
					if (gap <= 40 && (!best || gap < best.gap)) best = { gap, line, text: t.n.data.trim().slice(0, 12) };
				}
			}
		}
		if (best && Math.abs(middle - best.line.centre) > 1) off.push(`${name(el)}「${el.textContent.trim().slice(0, 8)}」比旁边「${best.text}」的字心${middle > best.line.centre ? "低" : "高"} ${Math.abs(middle - best.line.centre).toFixed(2)}px`);
		// 小标里自己的字也要在正中（帖子标题小标：1px 描边 + 行高 18px 时字低 1.1px）
		const own = el.tagName !== "svg" && el.textContent.trim().length <= 6 && texts.filter((t) => el.contains(t.n));
		if (own?.length === 1 && own[0].lines.length === 1 && Math.abs(own[0].lines[0].centre - middle) > 1) off.push(`${name(el)}「${el.textContent.trim()}」里的字偏${own[0].lines[0].centre > middle ? "下" : "上"} ${Math.abs(own[0].lines[0].centre - middle).toFixed(2)}px`);
	}
	return { clip: [...new Set(clip)], off: [...new Set(off)], texts: texts.length };
};

const pages = [
	["列表页", "https://www.nodeseek.com/", () => P.listPage(), markers],
	["帖子页", "https://www.nodeseek.com/post-1000-1", () => P.postPage(), markers],
	["帖子页资料卡", "https://www.nodeseek.com/post-1000-1", () => P.postPage(), plain, async (page) => {
		await page.locator(".nsmax-author-col .nsmax-author-name").first().hover();
		await page.waitForSelector(".nsmax-person-pop dd", { timeout: 5000 });
	}],
	["搜索浮层", "https://www.nodeseek.com/", () => P.searchOverlayPage({}), plain],
	["通知", "https://www.nodeseek.com/notification#/atMe", () => P.notificationPage({}), plain],
	["私信列表", "https://www.nodeseek.com/notification#/message?mode=list", () => P.messageCenterPage({}), plain],
	["个人主页", "https://www.nodeseek.com/space/10#/discussions", () => P.spaceTopicsPage({}), plain],
	["粉丝页", "https://www.nodeseek.com/fans?type=fans", () => P.fansPage({}), plain],
	["设置面板", "https://www.nodeseek.com/", () => P.listPage(), plain, async (page) => {
		await page.getByRole("button", { name: "NodeSeek Max 设置", exact: true }).click();
		await page.waitForTimeout(600);
	}]
];

let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });

for (const [label, url, html, extra, act] of pages) {
	test(`电脑端${label}：按微软雅黑 UI 度量，没有被裁的字，小标和旁边的字同一条中线`, async () => {
		const { context, page, errors } = await open(browser, url, { html: html(), css: FONT_CSS, viewport: { width: 1440, height: 900 }, ...extra });
		try {
			await page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-theme") && !document.documentElement.hasAttribute("data-nsmax-mounting") && performance.getEntriesByName("nsmax:deferred-start").length);
			await page.evaluate(() => document.fonts.load('17px "FakeUI"', "国"));
			await page.waitForTimeout(800);
			if (act) await act(page);
			assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /FakeUI/, "字体模拟生效");
			const result = await page.evaluate(measure);
			assert.ok(result.texts > 10, `量到了字：${result.texts}`);
			assert.deepEqual(result.clip, [], "被裁的字");
			assert.deepEqual(result.off, [], "不居中的小标");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});
}

test("电脑端：帖子标题小标在 18px 一档、字在小标正中；通知「未读」18px 高、和「@了你」同一条中线；资料卡备注字行高够放下下伸部分", async () => {
	const post = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: P.postPage(), css: FONT_CSS, viewport: { width: 1440, height: 900 }, ...markers });
	try {
		await post.page.waitForSelector(".post-title h1 > .nsmax-replied-badge", { timeout: 5000 });
		const badge = await post.page.evaluate(() => { const cs = getComputedStyle(document.querySelector(".post-title h1 > .nsmax-replied-badge")); return [cs.height, cs.borderTopWidth, cs.lineHeight]; });
		assert.deepEqual(badge, ["18px", "1px", "16px"], "1px 描边里只剩 16px，行高跟着 16px");
		await post.page.locator(".nsmax-author-col .nsmax-author-name").first().hover();
		await post.page.waitForSelector(".nsmax-person-pop .nsmax-person-note > span", { timeout: 5000 });
		const note = await post.page.evaluate(() => { const cs = getComputedStyle(document.querySelector(".nsmax-person-pop .nsmax-person-note > span")); return parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); });
		assert.ok(note >= 1.35, `备注行高 ${note}`);
	} finally { await post.context.close(); }
	const notice = await open(browser, "https://www.nodeseek.com/notification#/atMe", { html: P.notificationPage({}), css: FONT_CSS, viewport: { width: 1440, height: 900 }, ...plain });
	try {
		await notice.page.waitForSelector(".nsmax-notice-unread", { timeout: 5000 });
		const unread = await notice.page.evaluate(() => getComputedStyle(document.querySelector(".nsmax-notice-unread")).height);
		assert.equal(unread, "18px");
	} finally { await notice.context.close(); }
});
