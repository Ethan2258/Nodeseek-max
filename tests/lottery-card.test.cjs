"use strict";
// 抽奖卡片（2026-11-23 重做）：参与人数、我在哪一楼、发起人 / 未登录、开奖后直接算出中奖名单（和站点抽奖页同一套算法）。
const test = require("node:test"), assert = require("node:assert/strict");
const { webkit } = require("playwright");
const { launch, open } = require("./harness.cjs");
const P = require("./fixtures/pages.cjs");

// 真站 post-1074328（2026-11-23 开奖，3 个名额、从 1 楼起、楼层去重）：楼层名单和那一轮 drand 随机数；站点抽奖页给出的中奖楼层是 2、7、25
const RAND = "e05ac09719c85bf738fad5bd6ff7b1e4e62046760c56de477cf00adb8a3784d6";
const UIDS = "62552,61293,35076,76555,77429,70019,11674,70298,74084,4589,66622,76758,27781,33103,58464,51276,74458,22878,76718,62552,69317,72381,40604,39085,53277,56326,42123,23093,50716,40241,49408,74362,77527,40752,22151,30556,59074,40078,72926,72593,76510,57994,77575,71191,39589,13641,40545,64812,77208,62552,66557,1494,73308".split(",").map(Number);
const floors = ({ me, op = 62552 } = {}) => UIDS.map((uid, i) => ({ member_id: i === 0 ? op : i === me ? 1 : uid, member_name: i === 0 ? "op" : i === me ? "tester" : "m" + i, floor_id: i }));
const floorApi = (data) => ({ "/api/content/floor-data": Array.from({ length: 6 }, () => ({ status: 200, body: { success: true, data } })) });
const link = (time, { count = 3, start = 1, duplicate = "false", post = 1000 } = {}) => `https://www.nodeseek.com/lucky?post=${post}&amp;time=${time}&amp;count=${count}&amp;start=${start}${duplicate === null ? "" : `&amp;duplicate=${duplicate}`}`;
const withLink = (html, body) => html.replace("<h2>配置说明</h2>", () => body + "<h2>配置说明</h2>");
const settle = (page) => page.waitForFunction(() => { const p = document.querySelector(".nsk-post .nsmax-lottery-people"); return p && (p.parentElement.hidden || !/统计中/.test(p.textContent)); }, null, { timeout: 8e3 });

for (const engine of (process.env.NSMAX_MOBILE_ENGINES || "chromium,webkit").split(",")) {
	let browser;
	test.before(async () => { browser = engine === "webkit" ? await webkit.launch() : await launch(); });
	test.after(async () => { await browser?.close(); });

	test(`${engine} 开奖前：参与人数来自站点楼层名单（按人去重），我在名单里就显示「你已参与 · 第 N 楼」，不再给「回复参与」`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() + 864e5)}">开奖</a></p>`);
		for (const me of [undefined, 37]) {
			const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me })) });
			try {
				await settle(page);
				const card = page.locator(".nsk-post .nsmax-lottery");
				// 1~52 楼 52 层、62552 回复了三次：51 人
				assert.equal(await card.locator(".nsmax-lottery-people").textContent(), "51 人");
				if (me) {
					await page.waitForSelector('.nsmax-lottery-me[data-tone="joined"]');
					assert.match(await card.locator(".nsmax-lottery-me").textContent(), /^你已参与 · 第 37 楼$/);
					assert.equal(await card.locator(".nsmax-lottery-me a").getAttribute("href"), "/post-1000-4#37", "没加载的楼层跳到它那一页");
					assert.equal(await card.getByRole("button", { name: "回复参与" }).count(), 0);
				} else {
					assert.equal(await card.getByRole("button", { name: "回复参与", exact: true }).isVisible(), true);
					assert.equal(await card.locator(".nsmax-lottery-me").isVisible(), false);
				}
				assert.equal(calls["/api/content/floor-data"], 1, "一张卡片只取一次楼层名单");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 未登录给「登录后参与」，发起人看到「你发起的抽奖」，帖子锁了不给回复按钮`, async () => {
		const time = Date.now() + 864e5;
		const cases = [
			["guest", { html: withLink(P.postPage({ guest: true }), `<p><a href="${link(time)}">开奖</a></p>`) }],
			["op", { html: withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p>`), api: floorApi(floors({ op: 1 })) }],
			["locked", { html: withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p>`), init: 'document.addEventListener("DOMContentLoaded",()=>{window.__config__.postData={...(window.__config__.postData||{}),locked:1};});' }]
		];
		for (const [kind, options] of cases) {
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { viewport: { width: 1440, height: 900 }, ...options });
			try {
				await settle(page);
				const card = page.locator(".nsk-post .nsmax-lottery");
				if (kind === "guest") {
					assert.equal(await card.getByRole("link", { name: "登录后参与", exact: true }).getAttribute("href"), "/signIn.html");
					assert.equal(await card.getByRole("button", { name: "回复参与" }).isVisible(), false);
				} else {
					await page.waitForFunction(() => !document.querySelector(".nsk-post .nsmax-lottery-me").hidden);
					assert.equal(await card.locator(".nsmax-lottery-me").textContent(), kind === "op" ? "你发起的抽奖" : "帖子已锁定，不能再回复");
					assert.equal(await card.locator(".nsmax-lottery-actions").isVisible(), false);
				}
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 开奖后：用楼层名单 + drand 随机数算出和站点抽奖页一样的中奖楼层，自己中了标绿，结果记在本机`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
		for (const me of [7, 9]) {
			let drand = 0;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me })), external: { "api.drand.sh": () => { drand++; return { round: 1, randomness: RAND }; } } });
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
				const card = page.locator(".nsk-post .nsmax-lottery");
				assert.deepEqual(await card.locator(".nsmax-lottery-winner .nsmax-lottery-floor").allTextContents(), ["#2", "#7", "#25"]);
				assert.equal(await card.locator(".nsmax-lottery-winner[data-nsmax-me]").count(), me === 7 ? 1 : 0);
				assert.match(await card.locator(".nsmax-lottery-me").textContent(), me === 7 ? /^恭喜，你中奖了 · 第 7 楼$/ : /^这次没中，谢谢参与 · 第 9 楼$/);
				assert.equal(await card.getAttribute("data-nsmax-result"), "ok");
				assert.equal(await card.locator(".nsmax-lottery-view").textContent(), "查看开奖");
				assert.notEqual(await card.locator(".nsmax-lottery-view").evaluate(e => getComputedStyle(e).backgroundColor), "rgb(28, 28, 30)", "算出结果后「查看开奖」只是一个弱化的链接");
				assert.equal(drand, 1);
				// 再打开：直接用记下的结果，不再取 drand
				await page.reload();
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
				assert.equal(drand, 1, "开过的奖记在本机");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 开奖后拿不到随机数：不瞎猜，「查看开奖」变成主按钮；参与过的照样写「你已参与」`, async () => {
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me: 9 })) });
		try {
			await page.waitForFunction(() => document.querySelector(".nsk-post .nsmax-lottery")?.getAttribute("data-nsmax-result") === "failed", null, { timeout: 8e3 });
			const card = page.locator(".nsk-post .nsmax-lottery");
			assert.equal(await card.locator(".nsmax-lottery-winner").count(), 0);
			assert.match(await card.locator(".nsmax-lottery-winners").textContent(), /去开奖页看/);
			await page.waitForFunction(() => getComputedStyle(document.querySelector(".nsk-post .nsmax-lottery-view")).backgroundColor === "rgb(28, 28, 30)", null, { timeout: 3e3 });
			assert.match(await card.locator(".nsmax-lottery-me").textContent(), /^你已参与 · 第 9 楼$/);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} 链接细节：没写 duplicate 就是可以重复中奖；「奖品：」只取那一行；一键抽奖那种带名目的列表项整行收起、卡片放在列表后面；不足一小时不写「时」`, async () => {
		const html = withLink(P.postPage(), `<p>奖品：一台小鸡<br>开奖时间：今晚</p><ul><li><strong>中奖人数</strong>：1 人</li><li><strong>开奖链接</strong>：<a href="${link(Date.now() + 30 * 6e4, { count: 1, duplicate: null })}">查看开奖</a></li></ul>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-post .nsmax-lottery");
			const state = await page.evaluate(() => {
				const card = document.querySelector(".nsk-post .nsmax-lottery");
				const li = [...document.querySelectorAll(".nsk-post article li")].find((el) => /开奖链接/.test(el.textContent));
				return {
					rules: card.querySelector(".nsmax-lottery-rules").textContent,
					prize: card.querySelector(".nsmax-lottery-prize").textContent,
					liHidden: getComputedStyle(li).display,
					inList: !!card.closest("ul, ol"),
					afterList: card.previousElementSibling?.tagName,
					segs: [...card.querySelectorAll(".nsmax-lottery-seg")].filter((s) => getComputedStyle(s).display !== "none").map((s) => s.querySelector("i").textContent)
				};
			});
			assert.match(state.rules, /可以重复中奖/);
			assert.equal(state.prize, "一台小鸡");
			assert.equal(state.liHidden, "none", "「开奖链接：」那一行整行收起，不留一个空名目");
			assert.equal(state.inList, false);
			assert.equal(state.afterList, "UL");
			assert.deepEqual(state.segs, ["分", "秒"]);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} 只画一张：同一个抽奖贴两次只画一张，别人回复里转贴的开奖链接不画卡片`, async () => {
		const time = Date.now() + 864e5;
		const html = withLink(P.postPage(), `<p><a href="${link(time)}">开奖</a></p><p>再贴一次：<a href="${link(time)}">开奖</a></p>`).replace("线路怎么样？晚高峰丢包吗？", `<a href="${link(time + 1000)}">我也贴一个</a>`);
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, viewport: { width: 1440, height: 900 } });
		try {
			await page.waitForSelector(".nsk-post .nsmax-lottery");
			await page.waitForTimeout(400);
			assert.equal(await page.locator(".nsmax-lottery").count(), 1);
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} v1.9.81 抽奖卡片紧凑布局：已开奖未参与不再底部空一大截，顶部合流单行，附中奖率、实底中奖胶囊、公开随机数核验与一键复制 @名单`, async () => {
		const html = withLink(P.postPage({ dark: true }), `<p>奖品：3个优惠码。euk 2C2G50G 独立高防IPv4 半价15r/month</p><p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
		const customFloors = UIDS.map((uid, i) => ({ member_id: uid, member_name: i === 2 ? "children009" : i === 7 ? "忍者猫小七" : i === 25 ? "iDaNaNaN" : "m" + i, floor_id: i }));
		const init = `window.__copied = ""; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } });`;
		const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
			html, viewport: { width: 1440, height: 900 }, colorScheme: "dark", init,
			api: floorApi(customFloors),
			external: { "api.drand.sh": () => ({ round: 1, randomness: RAND }) }
		});
		try {
			await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
			const state = await page.evaluate(() => {
				const card = document.querySelector(".nsk-post .nsmax-lottery");
				const top = card.querySelector(".nsmax-lottery-top");
				const foot = card.querySelector(".nsmax-lottery-foot");
				const verify = card.querySelector(".nsmax-lottery-verify");
				const winner = card.querySelector(".nsmax-lottery-winner");
				const people = card.querySelector(".nsmax-lottery-people");
				return {
					cardH: Math.round(card.getBoundingClientRect().height),
					topH: Math.round(top.getBoundingClientRect().height),
					footH: Math.round(foot.getBoundingClientRect().height),
					footMode: card.dataset.nsmaxFoot,
					verifyVisible: !verify.hidden && verify.getBoundingClientRect().height > 0,
					verifyTitle: verify.title,
					odds: people.dataset.nsmaxOdds,
					winnerBg: getComputedStyle(winner).backgroundColor,
					overflow: card.scrollWidth > card.clientWidth + 1
				};
			});
			assert.equal(state.footMode, "verify");
			assert.ok(state.topH <= 28, "已开奖顶部合并为单行：" + JSON.stringify(state));
			assert.ok(state.footH <= 24, "无按钮底栏紧凑不撑死高：" + JSON.stringify(state));
			assert.ok(state.cardH <= 235, "整张卡片紧凑无底部大片留白：" + JSON.stringify(state));
			assert.equal(state.verifyVisible, true);
			assert.match(state.verifyTitle, /drand 第 \d+ 轮/);
			assert.equal(state.odds, "中奖率 5.9%");
			assert.notEqual(state.winnerBg, "rgba(0, 0, 0, 0)", "中奖胶囊使用实底而不是透明底");
			assert.equal(state.overflow, false);
			await page.locator(".nsk-post .nsmax-lottery-copy").click();
			assert.equal(await page.evaluate(() => window.__copied), "@children009 @忍者猫小七 @iDaNaNaN");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} v1.9.81 多中奖者折叠展开、drand 备用节点容错、失败后卡片内重新核对与切号补查参与状态`, async () => {
		const past = Date.now() - 36e5;
		// 1) count=15：超过 12 人自动折叠，主节点失败时自动回退到 drand.cloudflare.com
		const html15 = withLink(P.postPage(), `<p><a href="${link(past, { count: 15 })}">开奖</a></p>`);
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html: html15, viewport: { width: 1440, height: 900 },
				api: floorApi(floors({ me: 52 })),
				external: { "drand.cloudflare.com": () => ({ round: 1, randomness: RAND }) }
			});
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery-winners-toggle");
				assert.equal(await page.locator(".nsk-post .nsmax-lottery-winner").count(), 12);
				assert.equal(await page.locator(".nsk-post .nsmax-lottery-winners-toggle").textContent(), "展开全部 15 位");
				await page.locator(".nsk-post .nsmax-lottery-winners-toggle").click();
				assert.equal(await page.locator(".nsk-post .nsmax-lottery-winner").count(), 15);
				assert.equal(await page.locator(".nsk-post .nsmax-lottery-winners-toggle").textContent(), "收起");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		// 2) 首次失败后点「重新核对」直接成功，无需刷新页面
		const html3 = withLink(P.postPage(), `<p><a href="${link(past)}">开奖</a></p>`);
		{
			let allow = false;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html: html3, viewport: { width: 1440, height: 900 },
				api: floorApi(floors({ me: 7 })),
				external: { "api.drand.sh": () => allow ? { round: 1, randomness: RAND } : undefined }
			});
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery[data-nsmax-result=failed] .nsmax-lottery-retry-card");
				allow = true;
				await page.locator(".nsk-post .nsmax-lottery-retry-card").click();
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner");
				assert.equal(await page.locator(".nsk-post .nsmax-lottery[data-nsmax-won]").count(), 1);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		// 3) 访客先缓存开奖结果，登录后再打开：立即出中奖名单、不重查 drand、补查楼层显示个人未中状态
		{
			let drand = 0;
			const key = `1000:${past}:3:1:0`;
			const seeded = { [key]: { w: [{ floor: 2, uid: "35076", name: "m2" }, { floor: 7, uid: "70298", name: "m7" }, { floor: 25, uid: "56326", name: "m25" }], s: { people: 51, floors: 52, mine: [], op: "62552" }, u: "", r: 1 } };
			const init = `if (window.top === window) localStorage.setItem("nsmax:lottery-results", ${JSON.stringify(JSON.stringify(seeded))});`;
			const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html: html3, viewport: { width: 1440, height: 900 }, init,
				api: floorApi(floors({ me: 9 })),
				external: { "api.drand.sh": () => { drand++; return { round: 1, randomness: RAND }; } }
			});
			try {
				await page.waitForFunction(() => /这次没中，谢谢参与 · 第 9 楼/.test(document.querySelector(".nsk-post .nsmax-lottery-me")?.textContent || ""), null, { timeout: 8e3 });
				assert.equal(drand, 0, "切号补查参与状态时不重复请求 drand");
				assert.equal(calls["/api/content/floor-data"], 1);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} v1.9.81 一键抽奖「填入正文」与占位符回填、抽奖分类「只看进行中」及 /lucky 中奖横幅可见`, async () => {
		// 1) 一键抽奖「填入正文」：不自动提交，保留 pending，改标题后也能按占位符自动补全链接
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/new-discussion", { html: P.newPostPage(), viewport: { width: 1440, height: 900 } });
			try {
				await page.locator(".nsmax-lucky-trigger").click();
				const dialog = page.getByRole("dialog", { name: "一键抽奖", exact: true });
				await dialog.getByRole("textbox", { name: "奖品", exact: true }).fill("88 鸡腿");
				await dialog.getByRole("button", { name: "48 小时后", exact: true }).click();
				assert.equal(await dialog.getByRole("button", { name: "48 小时后", exact: true }).getAttribute("aria-pressed"), "true");
				await dialog.getByRole("button", { name: "填入正文", exact: true }).click();
				await page.waitForFunction(() => !document.querySelector("dialog.nsmax-lucky-dialog"));
				const state = await page.evaluate(() => ({
					title: document.querySelector("#mde-title")?.value,
					body: document.querySelector(".md-editor textarea")?.value,
					pending: JSON.parse(localStorage.getItem("nsmax:lucky:pending") || "null")
				}));
				assert.equal(state.title, "【抽奖】88 鸡腿");
				assert.match(state.body, /- \*\*开奖链接\*\*：发布后自动生成/);
				assert.equal(state.pending?.title, "【抽奖】88 鸡腿");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		// 2) 抽奖分类「只看进行中」筛选 + 悬停开奖时间提示
		{
			const future = Date.now() + 864e5, past = Date.now() - 864e5;
			const init = `if (window.top === window) { localStorage.setItem("nsmax:special-posts", JSON.stringify({ "1000": "lottery", "1001": "lottery" })); localStorage.setItem("nsmax:special-checked", JSON.stringify({ "1000": 1, "1001": 1, "1002": 1 })); localStorage.setItem("nsmax:lottery-times", JSON.stringify({ "1000": ${future}, "1001": ${past} })); }`;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", { html: P.searchPage({ count: 3 }), viewport: { width: 1440, height: 900 }, init });
			try {
				await page.waitForSelector(".nsmax-lottery-active-only");
				const visible = () => page.evaluate(() => Array.from(document.querySelectorAll("ul.post-list > li.post-list-item")).filter((li) => getComputedStyle(li).display !== "none").map((li) => li.querySelector(".post-title a").getAttribute("href")));
				assert.deepEqual(await visible(), ["/post-1000-1", "/post-1001-1"]);
				assert.match(await page.locator(".post-list-item:first-child .nsmax-prize-badge").getAttribute("title") || "", /距开奖约/);
				await page.locator(".nsmax-lottery-active-only").click();
				assert.deepEqual(await visible(), ["/post-1000-1"], "开启「只看进行中」后隐藏已开奖旧帖");
				await page.locator(".nsmax-lottery-active-only").click();
				assert.deepEqual(await visible(), ["/post-1000-1", "/post-1001-1"]);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		// 3) /lucky 查看页 .board > .head-info 中奖结果横幅不再被签到页规则误藏
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/lucky?post=1000&mode=view", { html: P.luckyPage({ view: true, dark: true }), viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
			try {
				await page.waitForSelector(".sample-panel .board > .head-info");
				const info = await page.evaluate(() => {
					const el = document.querySelector(".sample-panel .board > .head-info");
					return { display: getComputedStyle(el).display, h: el.getBoundingClientRect().height, text: el.textContent.trim() };
				});
				assert.notEqual(info.display, "none", "/lucky 页中奖提示横幅必须可见");
				assert.ok(info.h > 24, JSON.stringify(info));
				assert.equal(info.text, "你没有中奖");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});
}
