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
				assert.equal(await card.locator(".nsmax-lottery-people").textContent(), "51 人参与");
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

	test(`${engine} 一次没取到不放弃：楼层名单 / 随机数第一次失败，过一会儿自己再取，不用刷新`, async () => {
		// 把重试的等待（15 秒起）缩短，测试里不用真等
		const init = "(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...rest) => st(fn, ms >= 15e3 && ms <= 12e4 ? 200 : ms, ...rest); })();";
		const failOnce = (data) => ({ "/api/content/floor-data": [{ status: 500, body: {} }, ...Array.from({ length: 5 }, () => ({ status: 200, body: { success: true, data } }))] });
		{
			const html = withLink(P.postPage(), `<p><a href="${link(Date.now() + 864e5)}">开奖</a></p>`);
			const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, init, viewport: { width: 1440, height: 900 }, api: failOnce(floors({ me: 37 })) });
			try {
				await page.waitForFunction(() => document.querySelector(".nsk-post .nsmax-lottery-people")?.textContent === "51 人参与", null, { timeout: 8e3 });
				assert.equal(await page.locator(".nsk-post [data-nsmax-fact=people]").isVisible(), true);
				assert.match(await page.locator(".nsk-post .nsmax-lottery-me").textContent(), /你已参与/);
				assert.equal(calls["/api/content/floor-data"], 2);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		{
			let drand = 0;
			const html = withLink(P.postPage(), `<p><a href="${link(Date.now() - 36e5)}">开奖</a></p>`);
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, init, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me: 7 })), external: { "api.drand.sh": () => (++drand === 1 ? undefined : { round: 1, randomness: RAND }) } });
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner", { timeout: 8e3 });
				assert.deepEqual(await page.locator(".nsk-post .nsmax-lottery-winner .nsmax-lottery-floor").allTextContents(), ["#2", "#7", "#25"]);
				assert.equal(await page.locator(".nsk-post .nsmax-lottery").getAttribute("data-nsmax-result"), "ok");
				assert.equal(drand, 2);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} 首页后台扫描被站点限流（后台暂停 10 分钟）时，帖子里的抽奖卡片照样取自己的楼层名单，「参与」不空着`, async () => {
		const init = "try { localStorage.setItem('nsmax:bg-pause-until', String(Date.now() + 6e5)); } catch {}";
		const html = withLink(P.postPage(), `<p><a href="${link(Date.now() + 864e5)}">开奖</a></p>`);
		const { context, page, errors, calls } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html, init, viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me: 37 })) });
		try {
			await page.waitForFunction(() => document.querySelector(".nsk-post .nsmax-lottery-people")?.textContent === "51 人参与", null, { timeout: 8e3 });
			assert.match(await page.locator(".nsk-post .nsmax-lottery-me").textContent(), /你已参与 · 第 37 楼/);
			assert.equal(calls["/api/content/floor-data"], 1);
			assert.ok(Number(await page.evaluate(() => localStorage.getItem("nsmax:bg-pause-until"))) > Date.now(), "后台暂停本身不动");
			assert.deepEqual(errors, []);
		} finally { await context.close(); }
	});

	test(`${engine} 2026-11-27 排版：宽屏倒计时在右边票根里（虚线隔开、宽度固定），窄窗口和手机上下排；已开奖收成右上角一行`, async () => {
		const measure = (page) => page.evaluate(() => {
			const card = document.querySelector(".nsk-post .nsmax-lottery");
			const top = card.querySelector(".nsmax-lottery-top");
			const prize = card.querySelector(".nsmax-lottery-prize");
			const people = card.querySelector("[data-nsmax-fact=people]");
			const rules = card.querySelector("[data-nsmax-fact=rules]") || card.querySelector(".nsmax-lottery-rules");
			const r = (el) => el.getBoundingClientRect();
			const cs = getComputedStyle(top);
			return {
				border: cs.borderLeftStyle,
				topW: Math.round(r(top).width),
				topRightOfPrize: r(top).left >= r(prize).right - 1,
				topAbovePrize: r(top).bottom <= r(prize).top + 1,
				topH: Math.round(r(top).height),
				cardRight: Math.round(r(card).right), topRight: Math.round(r(top).right),
				peopleOwnLine: people && rules ? r(people).top >= r(rules).bottom - 1 : null,
				peopleDot: people ? getComputedStyle(people, "::before").content : null,
				overflow: card.scrollWidth > card.clientWidth + 1
			};
		});
		const html = (t) => withLink(P.postPage(), `<p>奖品：3 个 euk 2C2G50G 独立高防 IPv4 半价优惠码（15r/月）</p><p><a href="${link(t)}">开奖</a></p>`);
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(Date.now() + 864e5 + 36e5), viewport: { width: 1440, height: 900 }, api: floorApi(floors()) });
			try {
				await settle(page);
				const wide = await measure(page);
				assert.equal(wide.border, "dashed", JSON.stringify(wide));
				assert.ok(wide.topRightOfPrize && wide.topW >= 220 && Math.abs(wide.topRight - wide.cardRight) <= 1, "票根贴着卡片右边：" + JSON.stringify(wide));
				assert.equal(wide.overflow, false);
				// 少了「天」那一段，票根宽度不变
				await page.evaluate(() => { const d = document.querySelector(".nsk-post .nsmax-lottery-seg"); if (d) d.hidden = true; });
				assert.equal((await measure(page)).topW, wide.topW, "倒计时变短票根不变窄");
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		for (const [label, opts] of [["窄窗口 760", { viewport: { width: 760, height: 900 } }], ["手机 390", { viewport: { width: 390, height: 844 }, device: { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } }]]) {
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(Date.now() + 864e5 + 36e5), ...opts, api: floorApi(floors()) });
			try {
				await settle(page);
				const narrow = await measure(page);
				assert.notEqual(narrow.border, "dashed", label + JSON.stringify(narrow));
				assert.ok(narrow.topAbovePrize, label + " 倒计时在奖品上面：" + JSON.stringify(narrow));
				assert.equal(narrow.overflow, false, label);
				if (label.startsWith("手机")) {
					assert.equal(narrow.peopleOwnLine, true, "手机上参与人数另起一行：" + JSON.stringify(narrow));
					assert.ok(/none|normal/.test(narrow.peopleDot), "另起一行时行首不落「·」：" + narrow.peopleDot);
					assert.ok(narrow.topH <= 56, "倒计时最多两行（数字一行，开奖时刻和链接一行）：" + JSON.stringify(narrow));
				}
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", { html: html(Date.now() - 36e5), viewport: { width: 1440, height: 900 }, api: floorApi(floors({ me: 7 })), external: { "api.drand.sh": () => ({ round: 1, randomness: RAND }) } });
			try {
				await page.waitForSelector(".nsk-post .nsmax-lottery-winner", { timeout: 8e3 });
				const done = await measure(page);
				assert.notEqual(done.border, "dashed", "已开奖不要票根：" + JSON.stringify(done));
				assert.ok(done.topAbovePrize && done.topH <= 26, "收成右上角一行：" + JSON.stringify(done));
				assert.match(await page.locator(".nsk-post .nsmax-lottery-top").textContent(), /已于 .* 开奖.*查看开奖/);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
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
			assert.ok(state.footH <= 40, "无按钮底栏一行（上面一道细线隔开中奖名单），不撑死高：" + JSON.stringify(state));
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

	test(`${engine} v1.9.83 抽奖帖子页进入零伸缩：进行中/已开奖/多中奖/名单失败/纯文本与贴图评论首帧即就位，异步数据到达前后卡片与评论区零跳动`, async () => {
		const measureInit = `(() => {
			window.__frames = [];
			const capture = () => {
				const card = document.querySelector(".nsk-post .nsmax-lottery");
				const cc = document.querySelector(".comment-container");
				const foot = card?.querySelector(".nsmax-lottery-foot");
				window.__frames.push({
					cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
					ccTop: cc ? Math.round(cc.getBoundingClientRect().top) : null,
					footH: foot ? Math.round(foot.getBoundingClientRect().height) : null,
					state: card?.dataset?.state || null,
					footMode: card?.dataset?.nsmaxFoot || null
				});
			};
			requestAnimationFrame(() => { capture(); requestAnimationFrame(capture); });
		})();`;
		const snap = (page) => page.evaluate(() => {
			const card = document.querySelector(".nsk-post .nsmax-lottery");
			const cc = document.querySelector(".comment-container");
			const foot = card?.querySelector(".nsmax-lottery-foot");
			return {
				cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
				ccTop: cc ? Math.round(cc.getBoundingClientRect().top) : null,
				footH: foot ? Math.round(foot.getBoundingClientRect().height) : null,
				topH: card ? Math.round(card.querySelector(".nsmax-lottery-top").getBoundingClientRect().height) : null,
				result: card?.dataset?.nsmaxResult || ""
			};
		});
		const future = Date.now() + 864e5;
		const past = Date.now() - 36e5;

		// 1) 进行中：延迟 返回「已参与」与「楼主」后，卡片与评论区零缩水
		for (const [label, data] of [["已参与", floors({ me: 37 })], ["楼主", floors({ op: 1 })]]) {
			const html = withLink(P.postPage(), `<p><a href="${link(future)}">开奖</a></p>`);
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html, viewport: { width: 1440, height: 900 }, init: measureInit,
				api: { "/api/content/floor-data": [{ delay: 250, status: 200, body: { success: true, data } }] }
			});
			try {
				await page.waitForFunction(() => (window.__frames || []).length >= 2);
				const before = await page.evaluate(() => window.__frames[0]);
				await settle(page);
				await page.waitForTimeout(60);
				const after = await snap(page);
				assert.ok(before.cardH > 0, `${label} 首帧已有抽奖卡片：${JSON.stringify(before)}`);
				assert.ok(Math.abs(after.cardH - before.cardH) <= 1, `${label} 卡片高度不变：before=${before.cardH} after=${after.cardH}`);
				assert.ok(Math.abs(after.ccTop - before.ccTop) <= 1, `${label} 评论区位置不变：before=${before.ccTop} after=${after.ccTop}`);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}

		// 2) 未缓存已开奖（3 人 / 12 人 / 名单接口失败）：首帧到底栏落定与名单返回零伸缩，同时 3 人卡保持紧凑指标
		const post12Comments = (() => {
			let html = P.postPage();
			const base = html.match(/<li class="content-item" id="1">[\s\S]*?<\/li>/)[0];
			const items = Array.from({ length: 12 }, (_, k) => {
				const f = k + 1;
				return base.replace(/id="1"/, `id="${f}"`).replace(/href="#1"/, `href="#${f}"`).replace(/>#1</, `>#${f}<`);
			}).join("");
			return withLink(html.replace(/<ul class="comments">[\s\S]*?<\/ul>/, `<ul class="comments">${items}</ul>`), `<p><a href="${link(past, { count: 12 })}">开奖</a></p>`);
		})();
		const endedCases = [
			["已开奖 3 人", withLink(P.postPage(), `<p><a href="${link(past, { count: 3 })}">开奖</a></p>`), { "/api/content/floor-data": [{ delay: 250, status: 200, body: { success: true, data: floors() } }] }, { "api.drand.sh": () => ({ round: 1, randomness: RAND }) }, true],
			["已开奖 12 人两行", post12Comments, { "/api/content/floor-data": [{ delay: 250, status: 200, body: { success: true, data: floors() } }] }, { "api.drand.sh": () => ({ round: 1, randomness: RAND }) }, false],
			["drand 核验失败", withLink(P.postPage(), `<p><a href="${link(past, { count: 3 })}">开奖</a></p>`), { "/api/content/floor-data": [{ delay: 250, status: 200, body: { success: true, data: floors() } }] }, {}, false]
		];
		for (const [label, html, api, external, checkCompact] of endedCases) {
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html, viewport: { width: 1440, height: 900 }, init: measureInit, api, external
			});
			try {
				await page.waitForFunction(() => (window.__frames || []).length >= 2);
				const before = await page.evaluate(() => window.__frames[0]);
				await page.waitForFunction(() => {
					const r = document.querySelector(".nsk-post .nsmax-lottery")?.dataset?.nsmaxResult;
					return r === "ok" || r === "failed";
				}, null, { timeout: 8e3 });
				await page.waitForTimeout(60);
				const after = await snap(page);
				assert.ok(Math.abs(after.cardH - before.cardH) <= 1, `${label} 卡片高度不变：before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
				assert.ok(Math.abs(after.ccTop - before.ccTop) <= 1, `${label} 评论区位置不变：before=${before.ccTop} after=${after.ccTop}`);
				if (checkCompact) {
					assert.ok(after.topH <= 28 && after.footH <= 40 && after.cardH <= 235, `${label} 仍保持紧凑高度：${JSON.stringify(after)}`);
				}
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}

		// 3) 主帖纯文本 /lucky? 与楼主评论区纯文本 /lucky?：首帧第 1 次 rAF 卡片已在场
		for (const [label, html, sel] of [
			["主帖纯文本", P.postPage().replace("<h2>配置说明</h2>", `<p>开奖：https://www.nodeseek.com/lucky?post=1000&amp;time=${future}&amp;count=2</p><h2>配置说明</h2>`), ".nsk-post .nsmax-lottery"],
			["楼主评论纯文本", P.postPage().replace('<a href="/space/11" class="author-name">buyer</a>', '<a href="/space/10" class="author-name">seller</a><span class="is-poster role-tag nsk-badge">楼主</span>').replace("收了，私信你", `开奖：https://nodeseek.com/lucky?post=1000&amp;time=${future}&amp;count=2`), "ul.comments > li[id='1'] .nsmax-lottery"]
		]) {
			const plainInit = `(() => {
				window.__f1 = null;
				requestAnimationFrame(() => {
					const c = document.querySelector(${JSON.stringify(sel)});
					const cc = document.querySelector(".comment-container");
					window.__f1 = { hasCard: !!c, cardH: c ? Math.round(c.getBoundingClientRect().height) : 0, ccTop: cc ? Math.round(cc.getBoundingClientRect().top) : 0 };
				});
			})();`;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/post-1000-1", {
				html, viewport: { width: 1440, height: 900 }, init: plainInit, api: floorApi(floors())
			});
			try {
				await page.waitForFunction(() => !!window.__f1);
				await page.waitForFunction((s) => { const p = document.querySelector(s + " .nsmax-lottery-people"); return p && (p.parentElement.hidden || !/统计中/.test(p.textContent)); }, sel, { timeout: 8e3 });
				await page.waitForTimeout(60);
				const check = await page.evaluate((s) => {
					const c = document.querySelector(s);
					const cc = document.querySelector(".comment-container");
					return { f1: window.__f1, cardH: c ? Math.round(c.getBoundingClientRect().height) : 0, ccTop: cc ? Math.round(cc.getBoundingClientRect().top) : 0 };
				}, sel);
				assert.equal(check.f1.hasCard, true, `${label} 首帧已有卡片`);
				assert.ok(Math.abs(check.cardH - check.f1.cardH) <= 1 && Math.abs(check.ccTop - check.f1.ccTop) <= 1, `${label} 后续零跳动：${JSON.stringify(check)}`);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});

	test(`${engine} v1.9.83 「抽奖」分类页首屏同步就位，不先塌缩再撑开；无缓存识别中预留主栏高度防页脚上浮`, async () => {
		const future = Date.now() + 864e5;
		const past = Date.now() - 864e5;
		const trackInit = (seedBody) => `(() => {
			if (window.top === window) { ${seedBody} }
			window.__catFrames = [];
			const snap = () => {
				const left = document.getElementById("nsk-body-left");
				const ft = document.querySelector("body > footer");
				const row0 = document.querySelector("#nsk-body-left ul.post-list > li.post-list-item[data-nsmax-lottery='yes'] .post-info");
				window.__catFrames.push({
					cvHold: document.documentElement.hasAttribute("data-nsmax-cv-hold"),
					pending: document.documentElement.hasAttribute("data-nsmax-lottery-pending"),
					active: document.documentElement.hasAttribute("data-nsmax-lottery-active"),
					merged: document.querySelectorAll("li[data-nsmax-lottery-merged][data-nsmax-lottery='yes']").length,
					shown: document.querySelectorAll("li.post-list-item[data-nsmax-lottery='yes']").length,
					leftH: left ? Math.round(left.getBoundingClientRect().height) : 0,
					ftTop: ft ? Math.round(ft.getBoundingClientRect().top) : 0,
					rowLeft: row0 ? Math.round(row0.getBoundingClientRect().left) : 0
				});
			};
			requestAnimationFrame(() => { snap(); setTimeout(() => requestAnimationFrame(snap), 180); });
		})();`;

		// 1) 50 条含缓存 + 并入非「抽奖」标题行 + 只看进行中：首帧无 data-nsmax-cv-hold，首帧即显示并入行与「只看进行中」且零横向/纵向跳动
		const sp = {}, ch = {}, times = {};
		for (let i = 0; i < 50; i++) {
			const id = String(1000 + i);
			ch[id] = Date.now();
			if (i % 3 === 0) {
				sp[id] = "lottery";
				times[id] = i % 2 === 0 ? future : past;
			}
		}
		sp["1099"] = "lottery";
		times["1099"] = future;
		const rows = { "1099": { t: "无抽奖二字福利贴", u: "10", n: "alice", v: "123", r: "12", td: "2026-11-24T10:00:00Z", tt: "2026-11-24 18:00", c: "/categories/trade", cn: "交易" } };
		const seedCached = `localStorage.setItem("nsmax:special-posts",${JSON.stringify(JSON.stringify(sp))});localStorage.setItem("nsmax:special-checked",${JSON.stringify(JSON.stringify(ch))});localStorage.setItem("nsmax:lottery-times",${JSON.stringify(JSON.stringify(times))});localStorage.setItem("nsmax:lottery-rows",${JSON.stringify(JSON.stringify(rows))});localStorage.setItem("nsmax:lottery-index-at",String(Date.now()));sessionStorage.setItem("nsmax:lottery-active-only","1");`;
		{
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
				html: P.searchPage({ count: 50 }), viewport: { width: 1440, height: 900 }, init: trackInit(seedCached)
			});
			try {
				await page.waitForFunction(() => (window.__catFrames || []).length >= 2);
				const [f1, f2] = await page.evaluate(() => window.__catFrames);
				assert.equal(f1.cvHold, false, "抽奖分类页首帧不启用列表分档遮挡");
				assert.equal(f1.pending, false);
				assert.equal(f1.active, true, "首帧即启用「只看进行中」");
				assert.equal(f1.merged, 1, "首帧即并入本机记住的无「抽奖」标题贴");
				assert.ok(f1.shown >= 8, JSON.stringify(f1));
				assert.equal(f2.rowLeft, f1.rowLeft, "行信息首帧与后续零横向位移");
				assert.ok(Math.abs(f2.leftH - f1.leftH) <= 2 && Math.abs(f2.ftTop - f1.ftTop) <= 2, `首帧与后续高度零伸缩：${JSON.stringify({ f1, f2 })}`);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}

		// 2) 第一行待识别（shown === 0）：首帧已带 data-nsmax-lottery-pending 且主栏保留至少 560px 高度，防止页脚缩上来
		{
			const seedEmpty = `localStorage.setItem("nsmax:special-posts","{}");localStorage.setItem("nsmax:special-checked","{}");`;
			const { context, page, errors } = await open(browser, "https://www.nodeseek.com/search?q=%E6%8A%BD%E5%A5%96", {
				html: P.searchPage({ count: 10 }), viewport: { width: 1440, height: 900 }, init: trackInit(seedEmpty),
				beforeNavigate: async (p) => { await p.route("**/post-1000-1", async (r) => { await new Promise((done) => setTimeout(done, 600)); try { await r.fulfill({ status: 404, body: "" }); } catch {} }); }
			});
			try {
				await page.waitForFunction(() => (window.__catFrames || []).length >= 1);
				const f1 = await page.evaluate(() => window.__catFrames[0]);
				assert.equal(f1.pending, true, "首帧已标 data-nsmax-lottery-pending");
				assert.ok(f1.leftH >= 560, `待识别期间主栏保留最小高度防页脚上浮：${JSON.stringify(f1)}`);
				assert.ok(f1.ftTop >= 600, `页脚不被拉到视口中间：${JSON.stringify(f1)}`);
				assert.deepEqual(errors, []);
			} finally { await context.close(); }
		}
	});
}
