"use strict";
// 2026-11-21 Yiheng：
// 1. 悬停资料卡里同一个头衔中英文各出一个（banned + 违规禁止、fraud + 骗子）——接口 roles 是 {name, display_text}，以前取的是英文 name；
// 2. 从首页点「我的收藏 / 我的回帖 / 我的主题」进个人主页闪一下——站点先把 #user-space-mount（连骨架）拿掉，过一会儿才放上内容，中间主栏是空的；
// 3. 帖子页大标题前的「已回复」比标题字高——标题链接 vertical-align: middle 把行框撑高了
const test = require("node:test");
const assert = require("node:assert/strict");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");
let browser;
test.before(async () => { browser = await launch(); });
test.after(async () => { await browser?.close(); });
const ready = (page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-nsmax-theme") && !document.documentElement.hasAttribute("data-nsmax-mounting") && performance.getEntriesByName("nsmax:deferred-start").length);
const days = (n) => new Date(Date.now() - n * 864e5 - 6e5).toISOString();

test("悬停资料卡：接口头衔用中文显示名，和页面上的同名头衔只出一次", async () => {
	const html = P.postPage().replace('<span class="is-poster role-tag nsk-badge">楼主</span>', '<span class="is-poster role-tag nsk-badge">楼主</span><span class="role-tag">违规禁止</span><span class="role-tag">骗子</span>');
	const detail = { member_id: 10, member_name: "seller", rank: 1, coin: 10, nPost: 2, nComment: 28, created_at: days(60), roles: [
		{ id: 7, name: "banned", display_text: "违规禁止" },
		{ id: 10, name: "fraud", display_text: "骗子" },
		{ id: 11, name: "suspend" }
	] };
	const reply = { status: 200, body: { success: true, detail } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, api: { "/api/account/getInfo/10": [reply, reply, reply] }, viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		await page.locator('.nsmax-author-col[data-nsmax-uid="10"] .nsmax-author-name').first().hover();
		await page.waitForSelector(".nsmax-person-pop .nsmax-person-role");
		const roles = await page.evaluate(() => Array.from(document.querySelectorAll(".nsmax-person-pop .nsmax-person-role"), (el) => [el.textContent, el.dataset.tone]));
		assert.deepEqual(roles, [["违规禁止", "danger"], ["骗子", "danger"], ["临时禁言", "danger"]]);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 照真站逐帧记录的顺序：服务器给 #user-space-mount（脚本放骨架）→ 站点先整块拿掉 → 600ms 后才放上 .nsk-container
const spaceGap = () => {
	const html = P.spaceTopicsPage({}), m = html.match(/<section id="nsk-frame">([\s\S]*?)<\/section>/);
	return html.replace(m[0], `<section id="nsk-frame"><div id="user-space-mount"><img src="/avatar/1.png" alt class="loading-img"><span>Loading</span></div><script>setTimeout(()=>{document.getElementById("user-space-mount").remove();setTimeout(()=>{const t=document.createElement("template");t.innerHTML=${JSON.stringify(m[1])};document.getElementById("nsk-frame").append(t.content);},600);},700);</script></section>`);
};
test("个人主页：站点拿掉主栏到放上内容的空档里骨架不消失，内容一到骨架就撤", async () => {
	const init = `window.__spaceLog=[];const tick=()=>{const f=document.getElementById("nsk-frame");if(f&&document.documentElement.hasAttribute("data-nsmax-theme")){const skel=f.querySelector(".nsmax-space-skeleton"),head=f.querySelector(".head-container");window.__spaceLog.push({skel:!!skel&&skel.getClientRects().length>0,head:!!head,both:!!skel&&!!head,h:skel?Math.round(skel.querySelector(".nsmax-space-skel-head").getBoundingClientRect().top):null});}requestAnimationFrame(tick)};requestAnimationFrame(tick);`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/space/10#/collections", { html: spaceGap(), init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForSelector("#nsk-frame .head-container .nsmax-space-top", { timeout: 6000 });
		await page.waitForTimeout(200);
		const log = await page.evaluate(() => window.__spaceLog);
		const first = log.findIndex((e) => e.skel);
		const done = log.findIndex((e) => e.head);
		assert.ok(first >= 0 && done > first, "先有骨架，后有内容");
		const gaps = log.slice(first, done).filter((e) => !e.skel);
		assert.equal(gaps.length, 0, `空档里有 ${gaps.length} 帧主栏是空的`);
		assert.equal(log.filter((e) => e.both).length, 0, "内容到了骨架同一帧撤掉");
		const tops = [...new Set(log.slice(first, done).map((e) => e.h))];
		assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `骨架位置不动：${tops}`);
		assert.equal(await page.locator(".nsmax-space-hold").count(), 0);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

test("帖子页大标题前的「已回复」和标题字同一条中线（标题链接按基线排）", async () => {
	const seed = { "nspp:state:www.nodeseek.com:sb-my-replies": { "posts:10": { 1000: [3] } } };
	const init = `localStorage.setItem("nsmax:account", JSON.stringify({ id: 10 }));`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: P.postPage(), seed, init, viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		const badge = await page.waitForSelector(".post-title h1 > .nsmax-replied-badge", { timeout: 4000 }).catch(() => null);
		const state = await page.evaluate(() => {
			const h1 = document.querySelector(".nsk-post > .post-title h1"), link = h1.querySelector("a.post-title-link");
			const lh = parseFloat(getComputedStyle(h1).lineHeight);
			return { va: getComputedStyle(link).verticalAlign, h1: h1.getBoundingClientRect().height, lh };
		});
		assert.equal(state.va, "baseline");
		assert.ok(Math.abs(state.h1 - state.lh) <= 0.5, `单行标题高度等于行高：${JSON.stringify(state)}`);
		if (badge) {
			const d = await page.evaluate(() => {
				const b = document.querySelector(".post-title h1 > .nsmax-replied-badge").getBoundingClientRect(), h1 = document.querySelector(".nsk-post > .post-title h1").getBoundingClientRect();
				return (b.top + b.bottom) / 2 - (h1.top + h1.bottom) / 2;
			});
			assert.ok(Math.abs(d) <= 0.5, `小标在行框正中：差 ${d}`);
		}
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 关注 / 粉丝页同样的空档（真站逐帧记录）：站点把 #fans-mount 换成标签栏 + 空列表，约 0.3 秒后卡片才进来
test("关注 / 粉丝页：换上空列表到卡片进来的空档里骨架接着显示，卡片一来就撤", async () => {
	const html = P.fansPage({ delayed: 600 }).replace('document.getElementById("fans-mount").replaceWith(root);', 'const box = root.querySelector(".user-card-wrapper-container"); const kids = [...box.children]; box.replaceChildren(); document.getElementById("fans-mount").replaceWith(root); setTimeout(() => box.append(...kids), 600);');
	assert.ok(html.includes("box.replaceChildren()"), "夹具改写生效");
	const init = `window.__fansLog=[];const tick=()=>{const f=document.getElementById("nsk-frame");if(f&&document.documentElement.hasAttribute("data-nsmax-theme")){const skel=[...f.querySelectorAll(".nsmax-fans-skeleton")].some((e)=>e.getClientRects().length);const cards=f.querySelectorAll(".user-card-wrapper").length;window.__fansLog.push({skel,cards});}requestAnimationFrame(tick)};requestAnimationFrame(tick);`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/fans?type=fans", { html, init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => document.querySelectorAll(".user-card-wrapper .nsmax-member").length >= 5, null, { timeout: 6000 });
		await page.waitForTimeout(200);
		const log = await page.evaluate(() => window.__fansLog);
		const first = log.findIndex((e) => e.skel), done = log.findIndex((e) => e.cards);
		assert.ok(first >= 0 && done > first, "先骨架后卡片");
		assert.equal(log.slice(first, done).filter((e) => !e.skel).length, 0, "空档里骨架一直在");
		assert.equal(log.filter((e) => e.skel && e.cards).length, 0, "卡片来了骨架同一帧撤掉");
		assert.equal(await page.locator(".nsmax-fans-hold").count(), 0);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 通知页：第一次加载时列表先空着只写「正在加载…」，几十行再一下子冒出来；现在照通知行放骨架，和真行同高
// （真站接口不带 content，一行只有名字和所在帖子两行字，71px）
test("通知页：第一次加载时是和通知行同高的骨架，数据到了换成真行", async () => {
	const atList = Array.from({ length: 8 }, (_, i) => ({ id: 60 + i, post_id: 4300 + i, floor_id: i + 2, commenter_id: 7, commenter_name: "friend", post_title: `帖子 ${i}`, viewed: 1, created_at: new Date().toISOString() }));
	const html = P.nativeTalkPage({});
	const seed = { "nspp:settings:www.nodeseek.com": { attendance: { enabled: false } } };
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/notification#/atMe", { html, seed, viewport: { width: 1440, height: 900 }, api: { "/api/notification/at-me/list": [{ delay: 900, status: 200, body: { success: true, atList } }] } });
	try {
		await page.waitForSelector(".nsmax-notice-skel", { timeout: 6000 });
		const skel = await page.evaluate(() => {
			const rows = [...document.querySelectorAll(".nsmax-notice-skel")];
			const status = document.querySelector(".nspp-notice-workspace .nspp-messages-list-status");
			return { count: rows.length, height: rows[0].getBoundingClientRect().height, statusVisible: status.getBoundingClientRect().width > 2, statusText: status.textContent };
		});
		assert.equal(skel.count, 6);
		assert.equal(skel.statusVisible, false, "状态字只给读屏");
		assert.match(skel.statusText, /正在加载/);
		await page.waitForSelector(".nsmax-notice-main", { timeout: 6000 });
		const real = await page.evaluate(() => ({ skel: document.querySelectorAll(".nsmax-notice-skel").length, height: document.querySelector(".nsmax-notice-row:not(.nsmax-notice-skel)").getBoundingClientRect().height }));
		assert.equal(real.skel, 0);
		assert.ok(Math.abs(real.height - skel.height) <= 2, `骨架行 ${skel.height}px，真行 ${real.height}px`);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-11-21 Yiheng：搜索面板「搜索历史」里 j、y 这类字母的下半截看不到（关键词 overflow: hidden + 继承了 line-height: 1）
test("搜索历史胶囊：关键词的行框装得下字母下伸部分", async () => {
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/", { html: P.searchOverlayPage({ history: [["xjetry", "用户"], ["gypjq", "全部"]] }), viewport: { width: 1440, height: 900 } });
	try {
		await ready(page);
		const items = await page.evaluate(() => [...document.querySelectorAll(".search-overlay .history-item")].map((item) => {
			const kw = item.querySelector(".history-keyword"), cs = getComputedStyle(kw);
			return { h: item.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight), fs: parseFloat(cs.fontSize), box: kw.getBoundingClientRect().height };
		}));
		assert.ok(items.length >= 2);
		for (const item of items) {
			assert.ok(item.box < item.h, `关键词在胶囊里：${JSON.stringify(item)}`);
			assert.ok(item.lh >= item.fs * 1.3 && item.box >= item.fs * 1.3, `关键词行框 ${item.box}px（字号 ${item.fs}px）`);
		}
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 2026-11-21 Yiheng：成员卡片点了「关注」以后别的按钮全没了，按钮还一直跳。站点（Vue）点完会重画按钮、粉丝数 +1：
// 以前把站点的按钮节点挪进卡片，整排重建时连按钮一起删掉。现在卡片里是转发点击的按钮，站点的按钮原地藏着
test("成员卡片：点关注后站点重画按钮、粉丝数变化，卡片里三个按钮都还在，字跟着变", async () => {
	// 模拟站点：点关注 → 粉丝数 +1、按钮组整组重画（关注 ↔ 取关）
	const init = `document.addEventListener("click", (event) => {
		const btn = event.target.closest?.(".usercard-button-group > .btn");
		if (!btn || !/关注|取关/.test(btn.textContent)) return;
		const card = btn.closest(".user-card"), group = btn.parentElement;
		const fans = [...card.querySelectorAll(".user-stat span")].find((s) => /粉丝/.test(s.textContent));
		const follow = btn.textContent.trim() === "关注";
		if (fans) fans.textContent = fans.textContent.replace(/\d+/, (n) => String(Number(n) + (follow ? 1 : -1)));
		const labels = [...group.children].map((b) => b.textContent.trim() === btn.textContent.trim() ? (follow ? "取关" : "关注") : b.textContent.trim());
		group.replaceChildren(...labels.map((label) => { const a = document.createElement("a"); a.className = "btn"; a.textContent = label; return a; }));
		window.__siteClicks = (window.__siteClicks || 0) + 1;
	}, true);`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/fans?type=fans", { html: P.fansPage({}), init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-member .nsmax-member-actions > .btn").length >= 15);
		const labels = () => page.evaluate(() => [...document.querySelector(".nsmax-member .nsmax-member-actions").children].map((b) => b.textContent.trim()));
		const before = await labels();
		assert.equal(before.length, 3);
		const first = before[0];
		await page.locator(".nsmax-member").first().locator(".nsmax-member-actions > .btn").first().click();
		await page.waitForFunction((first) => document.querySelector(".nsmax-member .nsmax-member-actions > .btn")?.textContent.trim() !== first, first, { timeout: 3000 });
		const after = await labels();
		assert.equal(after.length, 3, `点完还有三个按钮：${after}`);
		assert.equal(after[0], first === "关注" ? "取关" : "关注");
		assert.equal(await page.evaluate(() => window.__siteClicks), 1, "点击转给了站点的按钮一次");
		// 之后不再来回改：半秒内卡片按钮不变
		const mutations = await page.evaluate(() => new Promise((resolve) => { let n = 0; const o = new MutationObserver((r) => { n += r.length; }); o.observe(document.querySelector(".user-card-wrapper-container"), { subtree: true, childList: true }); setTimeout(() => { o.disconnect(); resolve(n); }, 600); }));
		assert.equal(mutations, 0, "按钮不再跳动");
		assert.equal(await page.locator(".usercard-button-group > .btn").evaluateAll((els) => els.filter((el) => el.getClientRects().length).length), 0);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});

// 同一类问题的后续（2026-11-22 排查）：点完关注粉丝数一变，脚本整排重建——按着的那个按钮被换成新节点，用键盘按的焦点掉回页面开头、
// 头像换成新的 <img>。现在只换中间那块字，头像和按钮原地改
test("成员卡片：用键盘点关注 / 取关，焦点留在按钮上，头像和按钮节点不换", async () => {
	const init = `document.addEventListener("click", (event) => {
		const btn = event.target.closest?.(".usercard-button-group > .btn");
		if (!btn || !/关注|取关/.test(btn.textContent)) return;
		const card = btn.closest(".user-card");
		const fans = [...card.querySelectorAll(".user-stat span")].find((s) => /粉丝/.test(s.textContent));
		const follow = btn.textContent.trim() === "关注";
		if (fans) fans.textContent = fans.textContent.replace(/\\d+/, (n) => String(Number(n) + (follow ? 1 : -1)));
		btn.textContent = follow ? "取关" : "关注";
	}, true);`;
	const { context, page, errors } = await open(browser, "https://www.nodeseek.com/fans?type=fans", { html: P.fansPage({}), init, viewport: { width: 1440, height: 900 } });
	try {
		await page.waitForFunction(() => document.querySelectorAll(".nsmax-member .nsmax-member-actions > .btn").length >= 15);
		await page.evaluate(() => {
			const row = document.querySelector(".nsmax-member");
			window.__row = { row, img: row.querySelector(".nsmax-member-avatar img"), btn: row.querySelector(".nsmax-member-actions > .btn"), stats: row.querySelector(".nsmax-member-stats").textContent };
			window.__row.btn.focus();
		});
		const first = await page.evaluate(() => window.__row.btn.textContent);
		for (const [key, label] of [["Enter", first === "关注" ? "取关" : "关注"], ["Space", first]]) {
			await page.keyboard.press(key);
			await page.waitForFunction((label) => window.__row.btn.textContent === label, label, { timeout: 3000 });
			await page.waitForTimeout(200);
			const state = await page.evaluate(() => {
				const row = document.querySelector(".nsmax-member");
				return {
					sameRow: row === window.__row.row,
					sameImg: row.querySelector(".nsmax-member-avatar img") === window.__row.img,
					sameBtn: row.querySelector(".nsmax-member-actions > .btn") === window.__row.btn,
					focused: document.activeElement === window.__row.btn,
					count: row.querySelectorAll(".nsmax-member-actions > .btn").length,
					stats: row.querySelector(".nsmax-member-stats").textContent
				};
			});
			const { stats, ...nodes } = state;
			assert.deepEqual(nodes, { sameRow: true, sameImg: true, sameBtn: true, focused: true, count: 3 }, `${key}：${JSON.stringify(state)}`);
			if (key === "Enter") assert.notEqual(stats, await page.evaluate(() => window.__row.stats), "粉丝数跟着更新");
		}
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
});
