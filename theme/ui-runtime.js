	// 这些整理函数在每次扫描（页面有增删节点后）都会再跑一遍：只在值真的不同时才写 DOM。
	// 无条件写（哪怕写的是同一个值）也会产生 DOM 变动 → 观察器 → 再扫描 → 再写，形成循环：元素被反复替换，
	// 悬停闪烁、点击落空（个人空间「主题 / 回帖 / 收藏」切不动就是这样来的）。
	function nsmaxSetText(el, text) {
		if (el && el.textContent !== text) el.textContent = text;
	}
	// 页面类型：主题 CSS 按 html[data-nsmax-page] 分页面排版；搜索、账簿这类结构和列表页相同的页面都算 list
	function nsmaxPageKind(path = location.pathname) {
		return /^\/post-\d+/.test(path) ? "post" : /^\/notifications?(?:\/|$)/.test(path) ? "notification" : /^\/space\//.test(path) ? "space" : /^\/setting(?:\/|$)/.test(path) ? "setting" : /^\/(?:new|edit)-discussion(?:\/|$)/.test(path) ? "new" : /^\/board(?:\/|$)/.test(path) ? "board" : /^\/fans(?:\/|$)/.test(path) ? "fans" : /^\/(?:signIn|emailSignIn|smsSignIn|register)\.html$/.test(path) ? "auth" : /^\/lucky(?:\/|$)/.test(path) ? "lucky" : "list";
	}
	// 主题 CSS 按页面分块注入（2026-10-22）：构建时把编译后的样式拆成有序段（base + 各页面专属段，段序 = 原规则序），
	// 这里按当前页面只拼需要的段：别的页面的规则完全不参与解析，列表页 / 帖子页 / 通知页少解析 25%–50% 的 CSS，
	// 层叠结果和整份注入完全一样（段顺序不变，规则一条不少）。页面判定之外的兜底：认不出的页面只注入 base。
	// 自测 / 排查时在页面里设 window.__NSMAX_ALL_CSS = true（或 localStorage nsmax:all-css=1）注入全部段。
	function nsmaxThemeChunkKeys(kind = nsmaxPageKind()) {
		const keys = new Set(["base", "error", kind]);
		if (kind === "post" || kind === "new") keys.add("editor");
		// 首页、版块、搜索这几种纯列表页没有帖子正文、提醒卡片这些结构（body 段）
		if (kind !== "list" || !/^\/(?:page-\d+\/?|categories\/.*|search\/?)?$/.test(location.pathname)) keys.add("body");
		// 手机布局的规则只有粗指针设备用得上；手机版网页没有右栏。判断错了也没事，真用到时 nsmaxThemeRequire 补上
		if (matchMedia("(pointer: coarse)").matches) keys.add("touch");
		if (!nsmaxTouchLayout()) keys.add("side");
		// 抽奖页里嵌了一块排行榜预览（.board .rank-row），这两块要一起给
		if (kind === "lucky") keys.add("board");
		if (kind === "list") {
			if (location.pathname === "/search") keys.add("search");
			if (/^\/credit(?:\/|$)/.test(location.pathname)) keys.add("credit");
			if (/^\/ruling(?:\/|$)/.test(location.pathname)) keys.add("ruling");
		}
		try {
			// 自测 / 排查：地址上带 ?nsmax-all-css（或在页面里设 window.__NSMAX_ALL_CSS）时注入全部段
			if (unsafeWindow$1.__NSMAX_ALL_CSS || new URLSearchParams(location.search).has("nsmax-all-css") || localStorage.getItem("nsmax:all-css") === "1") for (const [name] of nsmax_theme_segments) keys.add(name);
		} catch {}
		return keys;
	}
	// 缓存挂在函数上：主题 CSS 在脚本一开始（applyModernThemeEarly）就要注入，那时运行时块里的 let / var 还没执行到，
	// 用模块级变量会撞上 TDZ。函数声明整体提升，属性挂在函数上最稳。
	function nsmaxThemeCss(kind) {
		if (nsmaxThemeCss.cache) return nsmaxThemeCss.cache;
		const keys = nsmaxThemeChunkKeys(kind);
		nsmaxThemeCss.cache = nsmaxThemeUnpack(keys);
		nsmaxThemeCss.keys = keys;
		return nsmaxThemeCss.cache;
	}
	// 把需要的段拼起来，还原构建时换成单字符的高频长串（见 build-sb.mjs 的 themeTokens）
	function nsmaxThemeUnpack(keys) {
		let css = "";
		for (const [name, text] of nsmax_theme_segments) if (keys.has(name)) css += text;
		return css.replace(/[`$|&§¶¤]/g, (token) => nsmax_theme_tokens[token]);
	}
	// 运行中才发现要用到的段（手机上遇到带右栏的网页、平板切到手机布局）：按原来的段序重新拼好写回去，层叠结果和一开始就注入一样
	function nsmaxThemeRequire(name) {
		const keys = nsmaxThemeCss.keys;
		if (!keys || keys.has(name)) return;
		keys.add(name);
		const css = nsmaxThemeCss.cache = nsmaxThemeUnpack(keys);
		if (nsmaxThemeCss.element?.isConnected) nsmaxThemeCss.element.textContent = css;
		else _css(css, true);
	}
	// 浮层样式（弹窗、用户卡、搜索面板、toast、图片预览……）按需注入：首帧只注入页面本体需要的段，
	// 主内容就绪后的空闲时段再补这段；用户提前交互（移动 / 按键 / 打开弹窗）时也会先补上，不会出现没样式的浮层。
	function nsmaxEnsureOverlayCss() {
		if (nsmaxEnsureOverlayCss.done) return;
		// 排查 / 测试用：?nsmax-no-overlay-css 完全不注入浮层段（连 toast / 预览打开前的显式补注入也不做）
		try { if (new URLSearchParams(location.search).has("nsmax-no-overlay-css")) return; } catch {}
		nsmaxEnsureOverlayCss.done = true;
		const css = nsmaxThemeUnpack(new Set(["overlay"]));
		// 构建时已经短名化 / 压缩过，按「编译后样式」注入，跳过运行时再优化一遍
		if (css) _css(css, true);
	}
	function nsmaxSetAttr(el, name, value = "") {
		if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
	}
	function nsmaxDropAttr(el, name) {
		if (el && el.hasAttribute(name)) el.removeAttribute(name);
	}
	function nsmaxHideEl(el) {
		if (el && !(el.style.getPropertyValue("display") === "none" && el.style.getPropertyPriority("display") === "important")) el.style.setProperty("display", "none", "important");
	}
	function nsmaxShowEl(el) {
		if (el && el.style.getPropertyValue("display")) el.style.removeProperty("display");
	}
	// 个人空间：这个人有没有写个人介绍（uid → true / false；接口没回来时没有这一项）
	const nsmaxSpaceIntro = new Map();
	// 个人空间资料卡的九格统计（uid → 接口读到的数字，见 nsmaxPrepareSpace）；已经在等接口的 uid
	const nsmaxSpaceStats = new Map();
	const nsmaxSpaceStatsWaiting = new Set();
	// 是不是自己的个人空间（没登录、或者站点配置还没出来时按「别人的」处理）
	function nsmaxIsOwnSpace() {
		const id = location.pathname.match(/^\/space\/(\d+)/)?.[1];
		const me = unsafeWindow$1.__config__?.user?.member_id;
		return !!id && me !== undefined && String(me) === id;
	}
	// 个人主页的资料：带上 readme=1（站点自己也这样请求），顺便知道这个人有没有写介绍，决定「介绍」标签显示与否；同一个人只请求一次。
	// 页面一开始解析就先发出去（见 nsmaxWatchSpace）：站点画出资料卡时多半已经回来了，「介绍」标签第一帧就是对的
	// （2026-10-23：以前等资料卡画出来才请求，回来后「介绍」标签藏起来，标签栏左移一截、下面换成「主题」，整块跳一下）
	function nsmaxSpaceInfo(uid) {
		if (!window.__nsmax_space_api_cache) window.__nsmax_space_api_cache = new Map();
		let reqPromise = window.__nsmax_space_api_cache.get(uid);
		if (reqPromise) return reqPromise;
		reqPromise = fetch("/api/account/getInfo/" + uid + "?readme=1", { headers: { "Accept": "application/json" } })
			.then(res => res.json())
			.then(data => data?.detail || data?.data || {})
			.catch(() => ({}));
		window.__nsmax_space_api_cache.set(uid, reqPromise);
		reqPromise.then(info => {
			nsmaxSpaceIntro.set(uid, typeof info?.readme === "string" ? info.readme.trim().length > 0 : false);
			nsmaxPrepareSpace();
			// 资料卡里的 Telegram 联系方式：接口返回的签名 / 简介里有就补一个和「私信」一样的按钮（放在它后面）
			try {
				const addTelegram = (contacts) => {
					const topRow = document.querySelector(".head-container > .nsmax-space-top");
					if (!topRow || !contacts?.length || topRow.querySelector(".nsmax-space-tg-btn")) return;
					const link = document.createElement("a");
					link.className = "btn nsmax-space-tg-btn";
					link.href = contacts[0].href;
					link.target = "_blank";
					link.rel = "noopener noreferrer";
					// 按钮上只写「TG」（2026-10-24：写全「Telegram」，和「私信」「关注」排在一排太挤），全名在悬停提示和读屏标签里
					link.textContent = "TG";
					link.setAttribute("aria-label", "Telegram");
					link.title = contacts[0].handle ? "Telegram：@" + contacts[0].handle : "在 Telegram 里打开";
					const pm = topRow.querySelector(":scope > a.btn");
					if (pm) pm.after(link); else topRow.append(link);
				};
				const contacts = nsmaxTelegramContacts(info?.signature || info?.sign || info?.signature_html || info?.bio || info?.readme || info?.intro || "");
				if (contacts.length) {
					nsmaxTelegramCache.set(uid, contacts);
					addTelegram(contacts);
				} else nsmaxLookupTelegram(uid).then(addTelegram);
			} catch {}
		});
		return reqPromise;
	}
	// 整页里找某种标签中符合选择器的元素：先拿浏览器缓存着的同名标签集合，处理过的（skip 返回 true）直接跳过，剩下的才用 matches 判断。
	// 2026-10-23：页面一有变动，各模块就用一长串带层级的选择器在整页四千来个元素里查一遍（列表页一轮整理六成时间花在查找上）；
	// 结果一样，绝大多数元素只做一次「处理过没有」的判断
	// 整页查询一段一段查（2026-10-23）：好几段用逗号拼成一条的选择器，浏览器要拿页面上每个元素把每一段都试一遍（列表页四千个元素，
	// 十段的一条要 3.5ms，CPU 4 倍降速下）；拆开以后单个类名走浏览器的快路径。同一个元素命中好几段会被访问几次——用到的地方都可以重复执行
	function nsmaxQueryEach(selectors, visit) {
		for (const selector of selectors) for (const el of document.querySelectorAll(selector)) visit(el);
	}
	// 不影响页面显示的活放到浏览器空闲时做（最多等 2 秒）；同一件事已经排着的不重复排，几次扫描合成一次
	var nsmaxIdleJobs = new Set();
	function nsmaxWhenIdle(key, job) {
		if (nsmaxIdleJobs.has(key)) return;
		nsmaxIdleJobs.add(key);
		const run = () => {
			nsmaxIdleJobs.delete(key);
			try { job(); } catch (error) { nsmaxRecordError(key, error); }
		};
		if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2000 });
		else setTimeout(run, 200);
	}
	function nsmaxEachTag(tag, selector, skip, visit) {
		for (const el of Array.from(document.getElementsByTagName(tag))) {
			if (skip && skip(el)) continue;
			if (selector && !el.matches(selector)) continue;
			visit(el);
		}
	}
	function nsmaxPrepareSpace() {
		if (!/^\/space\/\d+/.test(location.pathname)) return;
		// 资料卡里那一组统计由下面的 renderStatsAndProgress 管，这里只标记原站其余位置的过时统计
		for (const item of document.querySelectorAll(".card-block > .card-item")) {
			if (item.closest(".head-container")) continue;
			item.toggleAttribute("data-nsmax-obsolete-stat", !item.textContent.trim() || /加入天数|注册天数|信用分|信任分/.test(item.textContent));
		}
		const spaceId = location.pathname.match(/\/space\/(\d+)/)?.[1];
		const hasIntro = nsmaxSpaceIntro.get(spaceId);
		for (const readme of document.querySelectorAll(".readme")) {
			const text = readme.textContent.trim();
			const hasWatermark = !!readme.querySelector("img[src*='logo'], img[src*='nodeseek'], svg");
			// 接口说写了介绍就照常显示（介绍可能只有一张图）；站点写着「没有找到readme」或还没渲染出来时不显示
			const placeholder = /^(没有找到readme|暂无简介|暂无介绍|NodeSeek)/i.test(text);
			const isEmpty = !text && !readme.querySelector("img") || placeholder || hasIntro !== true && hasWatermark && text.length < 20;
			readme.toggleAttribute("data-nsmax-empty-readme", isEmpty);
			if (isEmpty) nsmaxHideEl(readme);
			else nsmaxShowEl(readme);
			// 站点画出来的介绍就能说明写没写（写着「没有找到readme」= 没写；有正文 = 写了），不用等接口：「介绍」标签第一帧就对
			// （2026-10-23：以前等接口回来才知道，站点先画好的话「介绍」标签过一会儿才藏起来，标签栏和下面的内容跳一下）
			if (spaceId && hasIntro === undefined && (placeholder || !isEmpty && text.length >= 20)) nsmaxSpaceIntro.set(spaceId, !placeholder);
		}
		const head = document.querySelector(".head-container"), stats = document.querySelector(".card-block");
		if (!head) return;

		// 彻底清除任何在线或最后在线状态元素
		for (const bad of head.querySelectorAll(".nsmax-space-online, .nsmax-space-last, .nsmax-online-dot")) bad.remove();

		const uid = location.pathname.match(/\/space\/(\d+)/)?.[1] || "";
		let topRow = head.querySelector(":scope > .nsmax-space-top");
		if (!topRow) {
			topRow = document.createElement("div");
			topRow.className = "nsmax-space-top";
			const avatar = head.querySelector("img");
			const nameEl = head.querySelector("h1, .username");
			const descEl = head.querySelector("p");
			const pmBtn = head.querySelector("a.btn, button.btn");

			const identity = document.createElement("div");
			identity.className = "nsmax-space-identity";

			const titleRow = document.createElement("div");
			titleRow.className = "nsmax-space-title-row";
			if (nameEl) titleRow.append(nameEl);

			const meta = document.createElement("div");
			meta.className = "nsmax-space-meta";
			const uidSpan = document.createElement("span");
			uidSpan.className = "nsmax-space-uid";
			uidSpan.textContent = `UID ${uid}`;
			const joinSpan = document.createElement("span");
			joinSpan.className = "nsmax-space-join";

			let daysMatch;
			if (stats) {
				for (const item of stats.querySelectorAll(".card-item")) {
					if (/加入|注册/.test(item.textContent)) {
						const num = item.textContent.match(/\d+/)?.[0];
						if (num) daysMatch = Number(num);
					}
				}
			}
			if (daysMatch) {
				const date = new Date(Date.now() - daysMatch * 864e5);
				joinSpan.textContent = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} 加入`;
			} else {
				// 站点这一页没写加入天数：先不写，下面接口的注册时间到了再补上（以前写「近期加入」，
				// 而补日期时又只认「不含『加入』」的空格子，论坛最早的那批账号也一直显示「近期加入」）
				joinSpan.hidden = true;
			}

			// 严格仅展示 UID 与加入时间，绝不显示在线或最后在线状态
			meta.append(uidSpan, joinSpan);
			identity.append(titleRow, meta);

			const rawDesc = descEl?.textContent.trim() || "";
			if (rawDesc && rawDesc !== "一句话介绍自己" && !/最后在线/.test(rawDesc)) {
				const bio = document.createElement("div");
				bio.className = "nsmax-space-bio";
				bio.textContent = rawDesc;
				identity.append(bio);
			}

			if (avatar) topRow.append(avatar);
			topRow.append(identity);
			if (pmBtn) topRow.append(pmBtn);
			if (descEl) descEl.remove();
			head.prepend(topRow);
		}

		// 确保顶栏中拥有固定的 card-block 统计容器
		let headStats = head.querySelector(":scope > .card-block");
		const origStats = document.querySelector(".selector .card-block, .selector-right-side .card-block");
		if (origStats && !headStats) {
			headStats = origStats.cloneNode(true);
			head.append(headStats);
		}
		if (!headStats) {
			headStats = document.createElement("div");
			headStats.className = "card-block";
			head.append(headStats);
		}
		for (const extraCard of document.querySelectorAll(".selector .card-block, .selector-right-side .card-block")) nsmaxHideEl(extraCard);

		// 统计照 sb.sb 个人页 .user-stats（三列、标签在上数字在下，上面一条细线，2026-10-24）：
		// 关注 粉丝 鸡腿 / 星辰 主题 回帖 / 收藏 等级 注册天数。站点页面上有的四个（等级、鸡腿、主题、回帖）第一帧就写上，
		// 别的先「—」、接口回来补齐（九格一开始就排好，不跳）。主题、回帖点了进下面的标签；自己的主页里关注 / 粉丝进站点的关注页，
		// 鸡腿进账簿，星辰进星辰明细，等级进等级进度（这几页站点只给看自己的）。以前只有等级、鸡腿、主题、回帖四格居中排
		const self = nsmaxIsOwnSpace();
		const renderStatsAndProgress = (info) => {
			if (!headStats) return;
			nsmaxDropAttr(headStats, "style");
			const levelVal = info.rank !== undefined && Number.isFinite(Number(info.rank)) ? Number(info.rank) : 1;
			const value = (v) => v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? "—" : String(Number(v));
			const created = Date.parse(info.created_at || "");
			const days = info.days ?? (Number.isFinite(created) ? Math.max(0, Math.floor((Date.now() - created) / 864e5)) : undefined);
			const cells = [
				["关注", value(info.follows), self ? "/fans?type=follow" : ""],
				["粉丝", value(info.fans), self ? "/fans?type=fans" : ""],
				["鸡腿", value(info.coin), self ? "/credit" : ""],
				["星辰", value(info.stardust), self ? "/stardust/list" : ""],
				["主题", value(info.nPost), "#/discussions"],
				["回帖", value(info.nComment), "#/comments"],
				["收藏", value(info.collectionCount), self ? "#/collections" : ""],
				["等级", info.rank !== undefined ? `Lv.${value(info.rank)}` : "—", self ? "/progress" : ""],
				["注册天数", value(days), ""]
			];
			const signature = cells.map((cell) => cell.join("|")).join("\n");
			nsmaxSetAttr(headStats, "data-nsmax-user-stats");
			if (headStats.getAttribute("data-nsmax-sig") !== signature) {
				headStats.setAttribute("data-nsmax-sig", signature);
				headStats.replaceChildren(...cells.map(([label, text, href]) => {
					const cell = document.createElement(href ? "a" : "div");
					cell.className = "nsmax-user-stat";
					if (href) cell.href = href;
					const name = document.createElement("span");
					name.className = "nsmax-user-stat-label";
					name.textContent = label;
					const number = document.createElement("span");
					number.className = "nsmax-user-stat-value";
					number.textContent = text;
					cell.append(name, number);
					return cell;
				}));
			}

			// 渲染等级进度条
			let progress = head.querySelector(":scope > .nsmax-space-progress");
			if (!progress) {
				progress = document.createElement("div");
				progress.className = "nsmax-space-progress";
				progress.innerHTML = '<span class="nsmax-space-progress-level"></span><strong class="nsmax-space-progress-percent"></strong><span class="nsmax-space-progress-next"></span><i><b></b></i>';
				head.append(progress);
			}
			const titles = {
				0: ["初来乍到", "初露锋芒"],
				1: ["初露锋芒", "小有收获"],
				2: ["小有收获", "渐入佳境"],
				3: ["渐入佳境", "小有成就"],
				4: ["小有成就", "经常露面"],
				5: ["经常露面", "登峰造极"],
				6: ["登峰造极", "已达最高等级"]
			};
			// sb.sb .points-progress-end：等宽的「Lv.N」+ 加粗称号
			const setLevelLabel = (n, title) => {
				const levelEl = progress.querySelector(".nsmax-space-progress-level");
				if (levelEl.querySelector(".nsmax-level-n") && levelEl.textContent === `Lv.${n} ${title}`) return;
				const num = document.createElement("span");
				num.className = "nsmax-level-n";
				num.textContent = `Lv.${n}`;
				const name = document.createElement("b");
				name.textContent = title;
				levelEl.replaceChildren(num, " ", name);
			};
			// 名字后面的等级徽章（sb.sb 个人页名字后面的身份标签位置）
			const titleRow = head.querySelector(".nsmax-space-title-row");
			if (titleRow) {
				let badge = titleRow.querySelector(".nsmax-space-vip");
				if (!badge) {
					badge = document.createElement("span");
					badge.className = "nsmax-space-vip";
					titleRow.append(badge);
				}
				nsmaxApplyLevel(badge, levelVal);
			}
			const setBar = (width) => {
				const bar = progress.querySelector(":scope > i > b");
				if (bar && bar.style.width !== width) bar.style.width = width;
			};
			if (levelVal >= 6) {
				nsmaxSetAttr(progress, "data-nsmax-level-max");
				if (!progress.classList.contains("nsmax-space-progress-max")) progress.classList.add("nsmax-space-progress-max");
				setLevelLabel(6, "登峰造极");
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-percent"), "MAX");
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-next"), "已达最高等级");
				setBar("100%");

			} else {
				nsmaxDropAttr(progress, "data-nsmax-level-max");
				if (progress.classList.contains("nsmax-space-progress-max")) progress.classList.remove("nsmax-space-progress-max");
				const cur = titles[levelVal]?.[0] || "当前等级";
				const nxt = titles[levelVal]?.[1] || "下一等级";
				// 真实进度（2026-10-24，以前按等级凑的 等级 × 10%）：站点的等级按鸡腿算，Lv.n 要 n² × 100 个（站点 /progress 同一个算法）；
				// 右边照 sb.sb 写「Lv.N+1 称号 还差 X」
				const coin = Number(info.coin);
				const min = levelVal * levelVal * 100, max = (levelVal + 1) * (levelVal + 1) * 100;
				const known = info.coin !== undefined && Number.isFinite(coin);
				const percent = known ? Math.max(0, Math.min(100, Math.floor((coin - min) / (max - min) * 100))) : 0;
				setLevelLabel(levelVal, cur);
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-percent"), known ? `${percent}%` : "—");
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-next"), `Lv.${levelVal + 1} ${nxt}${known ? ` 还差 ${Math.max(0, max - coin)}` : ""}`);
				setBar(`${percent}%`);
			}
		};

		// 1. 从已有 DOM 中读取统计数字（站点的概况页有加入天数、等级、鸡腿、主题帖、评论数；资料卡里的已经换成九格，从站点原来那组读）
		let parsedLevel, parsedCoin, parsedPost, parsedComment, parsedDays;
		const parseSource = origStats || headStats || stats;
		if (parseSource) {
			for (const item of parseSource.querySelectorAll(".card-item")) {
				const t = item.textContent.trim();
				if (/加入|注册/.test(t)) {
					const m = t.match(/\d+/);
					if (m) parsedDays = Number(m[0]);
				} else if (/等级/.test(t)) {
					const m = t.match(/\d+/);
					if (m) parsedLevel = Number(m[0]);
				} else if (/鸡腿/.test(t)) {
					const m = t.match(/\d+/);
					if (m) parsedCoin = Number(m[0]);
				} else if (/主题/.test(t)) {
					const m = t.match(/\d+/);
					if (m) parsedPost = Number(m[0]);
				} else if (/评论|回帖/.test(t)) {
					const m = t.match(/\d+/);
					if (m) parsedComment = Number(m[0]);
				}
			}
		}
		// 页面上的数字和接口的数字记在一处（这个人的九格）：页面上有的（等级、鸡腿、主题、回帖、注册天数）用页面上的，
		// 接口补页面上没有的（关注、粉丝、星辰、收藏）。站点换标签时会把概况那组统计拿掉，记下来的照样能画
		const known = nsmaxSpaceStats.get(uid) || {};
		for (const [key, value] of [["rank", parsedLevel], ["coin", parsedCoin], ["nPost", parsedPost], ["nComment", parsedComment], ["days", parsedDays]]) {
			if (value !== undefined) known[key] = value;
		}
		if (uid && Object.keys(known).length) nsmaxSpaceStats.set(uid, known);
		if (Object.keys(known).length) renderStatsAndProgress(known);

		// 2. 通过 API 保证异步获取完整数据（支持直达非概况页面），见 nsmaxSpaceInfo
		const reqPromise = uid ? nsmaxSpaceInfo(uid) : null;
		if (uid && !nsmaxSpaceStatsWaiting.has(uid)) {
			nsmaxSpaceStatsWaiting.add(uid);
			reqPromise.then(info => {
				if (!info || typeof info !== "object" || Array.isArray(info)) return;
				const entry = nsmaxSpaceStats.get(uid) || {};
				for (const key of ["rank", "coin", "stardust", "nPost", "nComment", "follows", "fans", "collectionCount", "created_at"]) {
					if (entry[key] === undefined && info[key] !== undefined && info[key] !== null && info[key] !== "") entry[key] = info[key];
				}
				nsmaxSpaceStats.set(uid, entry);
				nsmaxPrepareSpace();
			});
		}
		// 加入日期：站点页面上没有时（上面先藏着），用接口的注册时间补上
		const joinEl = head.querySelector(".nsmax-space-join");
		if (uid && reqPromise && joinEl?.hidden && !joinEl.hasAttribute("data-nsmax-waiting")) {
			joinEl.setAttribute("data-nsmax-waiting", "");
			reqPromise.then(info => {
				const created = Date.parse(info?.created_at || "");
				if (!joinEl.isConnected || !Number.isFinite(created)) return;
				const d = new Date(created);
				joinEl.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 加入`;
				joinEl.hidden = false;
			});
		}

		// 空间页标签（sb.sb .profile-toolbar）：【介绍】【主题】【回帖】【收藏】，置于列表卡片顶部。
		// 「介绍」就是原站的「概况」（站点只在这一页渲染 .readme，也就是用户写的个人介绍）：写了介绍才显示这个标签，
		// 并且和原站一样进来先看介绍；没写（接口返回的 readme 为空）就不显示，落到「主题」
		const selectorNav = document.querySelector(".selector");
		if (selectorNav) {
			const settingBtn = selectorNav.querySelector(".nsmax-space-setting-btn");
			if (settingBtn) settingBtn.remove();

			const hash = location.hash;
			const onGeneral = !hash || hash === "#" || /^#\/(?:general|info|profile)/.test(hash);
			const intro = nsmaxSpaceIntro.get(uid);
			// 写了介绍：显示；不知道（接口还没回来）时只在停在概况页时先显示；确定没写：不显示
			const showIntro = intro === true || intro === undefined && onGeneral;
			const tabDefs = [
				{ key: "general", text: "介绍", href: "#/general", match: /概况|资料|介绍|general|info|profile/i, hidden: !showIntro },
				{ key: "discussions", text: "主题", href: "#/discussions", match: /主题|讨论|帖子|discussions/i },
				{ key: "comments", text: "回帖", href: "#/comments", match: /评论|回帖|回复|comments/i },
				// 收藏只有自己看得到：看别人的主页不放这个标签（点进去也是空的）
				{ key: "collections", text: "收藏", href: "#/collections", match: /收藏|collections|fav/i, hidden: !nsmaxIsOwnSpace() }
			];

			const orderedTabs = [];
			for (const def of tabDefs) {
				let tab = Array.from(selectorNav.querySelectorAll("a.select-item")).find(t =>
					t.getAttribute("data-nsmax-tab") === def.key ||
					def.match.test(t.textContent.trim()) ||
					(t.getAttribute("href") || "").includes(def.key)
				);
				if (!tab) {
					if (def.hidden) continue;
					tab = document.createElement("a");
					tab.className = "select-item";
					selectorNav.append(tab);
				}
				nsmaxSetText(tab, def.text);
				// 概况标签保留站点原来的地址（真站是 #/general，个别页面是 #/info）
				if (def.key !== "general" || !/^#\/(?:general|info|profile)/.test(tab.getAttribute("href") || "")) nsmaxSetAttr(tab, "href", def.href);
				nsmaxSetAttr(tab, "data-nsmax-tab", def.key);
				if (def.hidden) {
					nsmaxHideEl(tab);
					nsmaxSetAttr(tab, "hidden");
					for (const name of ["active", "router-link-active", "router-link-exact-active"]) if (tab.classList.contains(name)) tab.classList.remove(name);
					continue;
				}
				nsmaxDropAttr(tab, "hidden");
				nsmaxShowEl(tab);
				orderedTabs.push(tab);
			}

			// 将 3 个 Tab 固定排在 selector 最前部，绝不混入列表项之中（顺序已经对了就不动，移动节点也算 DOM 变动）
			const firstNonTab = Array.from(selectorNav.children).find(c => !c.matches("a.select-item"));
			const inOrder = orderedTabs.every((tab, i) => tab.parentElement === selectorNav && (i === 0 || orderedTabs[i - 1].nextElementSibling === tab))
				&& (!firstNonTab || orderedTabs[orderedTabs.length - 1].nextElementSibling === firstNonTab || !!(orderedTabs[orderedTabs.length - 1].compareDocumentPosition(firstNonTab) & Node.DOCUMENT_POSITION_FOLLOWING));
			if (!inOrder) for (const tab of orderedTabs) {
				if (firstNonTab) selectorNav.insertBefore(tab, firstNonTab);
				else selectorNav.append(tab);
			}

			const syncActiveTabs = () => {
				const hash = location.hash;
				const general = !hash || hash === "#" || /^#\/(?:general|info|profile)/.test(hash);
				const introShown = orderedTabs.some((tab) => tab.getAttribute("data-nsmax-tab") === "general");
				for (const tab of orderedTabs) {
					const key = tab.getAttribute("data-nsmax-tab");
					let isActive = false;
					if (key === "general" && general) {
						isActive = true;
					} else if (key === "discussions" && (/discussions|posts/.test(hash) || general && !introShown)) {
						isActive = true;
					} else if (key === "comments" && /comments/.test(hash)) {
						isActive = true;
					} else if (key === "collections" && /collections|fav/.test(hash)) {
						isActive = true;
					}
					tab.classList.toggle("active", isActive);
					tab.classList.toggle("router-link-active", isActive);
				}
			};

			for (const tab of orderedTabs) {
				if (!tab.hasAttribute("data-nsmax-bound")) {
					tab.setAttribute("data-nsmax-bound", "true");
					tab.addEventListener("click", () => {
						const h = tab.getAttribute("href");
						if (h && h.startsWith("#")) {
							if (location.hash !== h) location.hash = h;
							setTimeout(() => {
								syncActiveTabs();
								nsmaxPrepareSpace();
							}, 30);
						}
					});
				}
			}

			// 停在概况页、但确定这个人没写介绍：换到「主题」（替换当前历史记录，返回键不会又回到空的概况页）
			if (onGeneral && intro === false) location.replace("#/discussions");
			syncActiveTabs();
		}

		if (!window.__nsmax_space_hash_bound) {
			window.__nsmax_space_hash_bound = true;
			window.addEventListener("hashchange", () => {
				nsmaxPrepareSpace();
			});
		}
	}
	// 整理过、内容（按钮和上面的数字）没变的菜单不再动（2026-10-25）：以前解析阶段每一步、之后每轮整理都把每一层的每个按钮
	// 重写一遍属性和行内样式，写的值一样也算一次改动，浏览器每次都要重算这些按钮的样式。点赞数变了文字跟着变，照样会重新整理
	var nsmaxCleanedMenus = new WeakMap();
	var nsmaxPinMenus = new WeakMap();
	var nsmaxPinKeys = new WeakSet();
	function nsmaxCleanPostActions(onlyMenu) {
		const names = { "good-one": ["点赞","thumbup"], "chicken-leg": ["加鸡腿","drumstick"], "bad-one": ["反对","thumbdown"], "quote": ["引用","quote"], "back": ["回复","reply"], "edit": ["编辑","edit"], "pin": ["置顶","pin"], "unpin": ["取消置顶","unpin"] };
		const signatureOf = menu => menu.childElementCount + "|" + menu.textContent + "|" + Array.from(menu.querySelectorAll("svg[title]"), svg => svg.getAttribute("title")).join("|");
		const menus = onlyMenu?.nodeType === 1 && onlyMenu.matches(".comment-menu") ? [onlyMenu] : document.querySelectorAll(".comment-menu");
		for (const menu of menus) {
			if (nsmaxCleanedMenus.get(menu) === signatureOf(menu)) continue;
			const seen = new Set();
			for (const action of Array.from(menu.querySelectorAll(":scope > .menu-item"))) {
				const href = action.querySelector("svg use")?.getAttribute("href")?.slice(1);
				const texts = Array.from(action.querySelectorAll("span"), span => span.textContent.trim());
				// 原站把置顶标题放在 SVG 上，外层没有 title；状态更新优先读原生 SVG 标题，避免补出的旧文字卡住取消状态。
				const pinText = [...Array.from(action.querySelectorAll("svg[title]"), svg => svg.getAttribute("title").trim()), ...texts].find(text => /^(?:取消)?置顶(?:评论)?$/.test(text));
				const rawLabel = pinText || action.title || texts.find(text => /^(点赞|加鸡腿|反对|收藏|引用|回复|编辑)$/.test(text)) || names[href]?.[0];
				const label = /^(?:取消)?置顶评论$/.test(rawLabel || "") ? rawLabel.replace(/评论$/, "") : rawLabel;
				const icon = ({ "点赞":"thumbup","加鸡腿":"drumstick","反对":"thumbdown","收藏":"star","引用":"quote","回复":"reply","编辑":"edit","置顶":"pin","取消置顶":"unpin" })[label];
				if (!icon) continue;
				if (seen.has(icon)) { action.remove(); continue; }
				seen.add(icon);
				nsmaxSetAttr(action, "data-nsmax-action", icon);
				if (icon === "pin" || icon === "unpin") {
					nsmaxSetAttr(action, "title", label);
					nsmaxSetAttr(action, "aria-label", label + "评论");
					if (!action.matches("button,a[href],input")) {
						if (!action.hasAttribute("role")) action.setAttribute("role", "button");
						if (!action.hasAttribute("tabindex")) action.tabIndex = 0;
						if (!nsmaxPinKeys.has(action)) {
							nsmaxPinKeys.add(action);
							action.addEventListener("keydown", event => { if (!event.defaultPrevented && !event.repeat && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); action.click(); } });
						}
					}
					if (!nsmaxPinMenus.has(menu)) {
						const observer = new MutationObserver(() => { if (!menu.isConnected) { observer.disconnect(); return; } nsmaxCleanPostActions(menu); nsmaxMarkPinnedReplies(); });
						observer.observe(menu, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title"] });
						nsmaxPinMenus.set(menu, observer);
					}
				} else {
					if (!action.title) action.title = label;
					if (!action.hasAttribute("aria-label")) action.setAttribute("aria-label", label);
				}
				for (const svg of action.querySelectorAll(":scope > svg")) { nsmaxSetAttr(svg, "data-nsmax-action-original"); nsmaxHideEl(svg); }
				for (const span of action.querySelectorAll(":scope > span")) {
					const text = span.textContent.trim();
					if (/^[\d.,]+(?:[kKwW万千])?$/.test(text)) { nsmaxSetAttr(span, "data-nsmax-action-count"); span.toggleAttribute("hidden", /^0+(?:\.0+)?$/.test(text.replace(/[kKwW万千]/gi, ""))); }
					else nsmaxSetAttr(span, "data-nsmax-action-label");
				}
			}
			nsmaxCleanedMenus.set(menu, signatureOf(menu));
		}
	}
	// 投票 / 抽奖帖（2026-10-17，照 sb.sb .topic-badge.poll-badge / .lottery-badge、.poll-widget、.lottery-widget）。
	// 站点列表里不标哪些帖子有投票、抽奖：按标题里的字认；打开过的帖子里确认有投票（.vote-panel）或开奖链接（/lucky?post=…）的
	// 记在本机（最多 400 篇），列表里也带上小标
	var NSMAX_SPECIAL_KEY = "nsmax:special-posts";
	var nsmaxSpecialPosts;
	function nsmaxSpecialPostMap() {
		if (nsmaxSpecialPosts) return nsmaxSpecialPosts;
		nsmaxSpecialPosts = new Map();
		try {
			for (const [id, kinds] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_SPECIAL_KEY) || "{}"))) if (typeof kinds === "string") nsmaxSpecialPosts.set(id, kinds);
		} catch {}
		return nsmaxSpecialPosts;
	}
	function nsmaxRememberSpecialPost(id, kinds) {
		if (!kinds.length) return;
		const map = nsmaxSpecialPostMap();
		const value = [...new Set([...(map.get(id) || "").split(",").filter(Boolean), ...kinds])].sort().join(",");
		if (map.get(id) === value) return;
		map.delete(id);
		map.set(id, value);
		while (map.size > 400) map.delete(map.keys().next().value);
		try { localStorage.setItem(NSMAX_SPECIAL_KEY, JSON.stringify(Object.fromEntries(map))); } catch {}
	}
	function nsmaxTopicBadge(title, link, className, text, on) {
		// 标题下面只有几个子元素，直接翻一遍（列表一页 95 个标题、每次扫描都要找，以前每个都走一遍选择器）
		let badge = null;
		for (const child of title.children) if (child.classList.contains(className)) { badge = child; break; }
		if (on && !badge) {
			badge = document.createElement("span");
			badge.className = className;
			badge.textContent = text;
			link.before(badge);
		} else if (!on && badge) badge.remove();
	}
	// 抽奖帖怎么认（2026-10-18 起只认抽奖、只看正文；投票帖不再挂小标）：
	// 1. 打开过的帖子：主帖正文里有开奖链接（/lucky?…）才算是；
	// 2. 列表里标题像的（抽奖 / 开奖 / 抽 N 个 / giveaway……）：在后台打开它的第一页看一眼主帖正文，页面在后台时不查；
	//    查过的记在本机（是、不是都记）。没查过的不挂小标（以前先按标题里的「抽奖」猜，只是标题里有这个词的也挂上了）。
	//    2026-10-19 加速：以前一篇一篇来、间隔 0.8 秒、每次打开页面最多查 6 篇，还把整页（几十层回复）下完才看；
	//    现在三篇一起查、间隔 0.15 秒、一次最多 30 篇，读到主帖正文结束（第一个 </article>）就停。
	// 3. 已结束：到了开奖时间，或者楼主自己标了结束——标题里写了「已结束 / 已开奖 / 【结束】」这类，或者主帖正文里写了
	//    「已结束 / 已开奖 / 恭喜……中奖」这类（查帖、打开帖子时看；还没结束的抽奖帖过 30 分钟以上再查一次，楼主后来改的也能跟上）
	var NSMAX_SPECIAL_CHECKED_KEY = "nsmax:special-checked";
	var NSMAX_LOTTERY_ENDED_TITLE = /已结束|已开奖|已抽奖|已抽完|已截止|已完结|开奖结束|抽奖结束|活动结束|[【\[（(]\s*(?:结束|完结|已结|结)\s*[】\]）)]/;
	// 「恭喜……中奖」中间要有人（恭喜 @a @b 中奖）；开奖前写在规则里的「恭喜中奖的朋友请私信」「恭喜你中奖」不算
	var NSMAX_LOTTERY_ENDED_TEXT = /已结束|已开奖|已抽奖|已抽完|已截止|恭喜(?![你您]?中奖)[^。！？!?；;]{1,30}?中奖(?![的者])/;
	var NSMAX_LOTTERY_ENDED_KEY = "nsmax:lottery-ended";
	var nsmaxLotteryEndedMap;
	function nsmaxLotteryEnded() {
		if (nsmaxLotteryEndedMap) return nsmaxLotteryEndedMap;
		nsmaxLotteryEndedMap = new Set();
		try {
			for (const id of JSON.parse(localStorage.getItem(NSMAX_LOTTERY_ENDED_KEY) || "[]")) if (typeof id === "string") nsmaxLotteryEndedMap.add(id);
		} catch {}
		return nsmaxLotteryEndedMap;
	}
	function nsmaxRememberLotteryEnded(id, ended) {
		const set = nsmaxLotteryEnded();
		if (!id || set.has(id) === ended) return;
		if (ended) set.add(id);
		else set.delete(id);
		while (set.size > 400) set.delete(set.values().next().value);
		try { localStorage.setItem(NSMAX_LOTTERY_ENDED_KEY, JSON.stringify([...set])); } catch {}
	}
	// 主帖正文里楼主写的结束（不算脚本自己画的抽奖卡片里的「进行中 / 已结束」）
	function nsmaxLotteryEndedIn(op) {
		let text = "";
		const walker = document.createTreeWalker(op, NodeFilter.SHOW_TEXT, { acceptNode: (node) => node.parentElement?.closest(".nsmax-lottery") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
		while (walker.nextNode()) text += walker.currentNode.data;
		return NSMAX_LOTTERY_ENDED_TEXT.test(text.replace(/\s+/g, ""));
	}
	var NSMAX_LOTTERY_HINT = /抽奖|开奖|抽\s*[一二两三四五六七八九十\d]+\s*(?:个|份|位|名|台|只|张|人)|lucky\s*draw|giveaway/i;
	// 主帖写得像在送东西、抽东西（标题里不写「抽奖」的也算）：主帖里没有开奖链接时，再看第一页评论里有没有（见 nsmaxCheckSpecialPost）。
	// 只认抽奖才会说的话（「楼层」「评论区」「福利」这类平常帖子里也常见，不算）
	var NSMAX_GIVEAWAY_HINT = /抽奖|开奖|中奖|(?:抽|送|送出)\s*[一二两三四五六七八九十\d]+\s*(?:个|份|位|名|台|只|张|人|枚|块|月|年)|随机(?:抽|送)|幸运(?:儿|观众|楼|用户)|按楼层|楼层抽|抽楼|白送|免费送|giveaway|lucky\s*draw/i;
	var nsmaxSpecialCheckedMap;
	function nsmaxSpecialChecked() {
		if (nsmaxSpecialCheckedMap) return nsmaxSpecialCheckedMap;
		nsmaxSpecialCheckedMap = new Map();
		try {
			for (const [id, at] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_SPECIAL_CHECKED_KEY) || "{}"))) if (Number.isFinite(at)) nsmaxSpecialCheckedMap.set(id, at);
		} catch {}
		return nsmaxSpecialCheckedMap;
	}
	function nsmaxMarkSpecialChecked(id) {
		const map = nsmaxSpecialChecked();
		if (map.has(id) && Date.now() - map.get(id) < 60e3) return;
		map.delete(id);
		map.set(id, Date.now());
		// 2026-10-23：列表里每篇都按内容查（不只查标题像抽奖的），多记一些
		while (map.size > 5000) map.delete(map.keys().next().value);
		try { localStorage.setItem(NSMAX_SPECIAL_CHECKED_KEY, JSON.stringify(Object.fromEntries(map))); } catch {}
	}
	// 主帖正文里有什么：投票、开奖链接
	function nsmaxSpecialKindsOf(op) {
		const kinds = [];
		if (op.querySelector('.vote-panel, a[data-href^="nsapp://vote"], a[href^="nsapp://vote"]') || /nsapp:\/\/vote\?id=\d+/.test(op.textContent || "")) kinds.push("poll");
		if (op.querySelector('a[href*="/lucky?"]')) kinds.push("lottery");
		return kinds;
	}
	// 评论里指向这一篇的开奖链接（/lucky?post=这一篇&…）：有的楼主把开奖链接贴在评论里，标题里也不写「抽奖」（2026-10-23）。
	// 只认 post 参数是这一篇的（别人贴的别的帖子的开奖链接不算）；没被渲染成链接的纯文字网址也认
	function nsmaxCommentLuckyParams(root, id) {
		const hrefs = Array.from(root.querySelectorAll('ul.comments a[href*="/lucky?"]'), (link) => link.getAttribute("href") || "");
		for (const body of root.querySelectorAll("ul.comments article.post-content")) {
			const text = body.textContent || "";
			if (text.includes("/lucky?")) for (const match of text.matchAll(/(?:https?:\/\/[^\s/]+)?\/lucky\?[^\s<>"'）)]+/g)) hrefs.push(match[0]);
		}
		for (const href of hrefs) {
			const params = nsmaxLuckyParams(href);
			if (params && params.url.searchParams.get("post") === String(id)) return params;
		}
		return null;
	}
	// 当前页面列表里这一篇的那一行（认出来是抽奖帖时记下它在列表上的样子，见 nsmaxRememberLotteryRow）
	function nsmaxListRowOf(id) {
		for (const link of document.querySelectorAll(`ul.post-list > li.post-list-item .post-title a[href^="/post-${id}-"]`)) return link.closest("li.post-list-item");
		return null;
	}
	var nsmaxSpecialQueue = [];
	var nsmaxSpecialBusy = false;
	// 2026-10-24：一页最多查 12 篇（以前 30 篇，v1.8.37 还给标题不像抽奖的另加 60 篇，十秒里取二十多篇，站点开始限流，
	// 页面、图片跟着变慢）。标题不像抽奖的不在列表页后台查：点开它时按内容认（见 nsmaxPrizeBadges），
	// 「抽奖」分类页里再在后台慢慢找（见 nsmaxCrawlNewPosts）
	var nsmaxSpecialBudget = 12;
	var nsmaxSpecialRecheckBudget = 4;
	var nsmaxSpecialQueued = new Set();
	function nsmaxVerifySpecialPosts(ctx) {
		// 「抽奖」分类页有自己的识别（见 nsmaxLotteryView），这里不再重复查；站点限流过、后台暂停中也不查
		if (nsmaxIsLotteryView() || nsmaxBackgroundPaused()) return;
		// 触屏普通列表先服务阅读和图片；点进帖子或主动打开「抽奖」分类时再按内容识别。
		if (matchMedia("(hover: none) and (pointer: coarse)").matches) return;
		const links = document.querySelectorAll(".post-list-item .post-title > a[href*='/post-']");
		if (!links.length) return;
		const known = nsmaxSpecialPostMap(), checked = nsmaxSpecialChecked(), times = nsmaxLotteryTimes(), ended = nsmaxLotteryEnded(), rows = nsmaxLotteryRows();
		for (const link of links) {
			const id = (link.getAttribute("href") || "").match(/\/post-(\d+)/)?.[1];
			if (!id || nsmaxSpecialQueued.has(id)) continue;
			const lottery = (known.get(id) || "").split(",").includes("lottery");
			if (lottery) {
				// 早就认出来、但还没记下列表上样子的抽奖帖：顺手记下（「抽奖」分类里没有它时并进去）
				if (!rows.has(id)) nsmaxRememberLotteryRow(link.closest("li.post-list-item"));
				// 认出来、还没结束、标题里也没写结束的抽奖帖：30 分钟以上没查过就再查一次（楼主可能在正文里改成了已结束）
				const time = times.get(id) || 0;
				const over = ended.has(id) || (time && time <= Date.now()) || NSMAX_LOTTERY_ENDED_TITLE.test(link.textContent || "");
				if (over || nsmaxSpecialRecheckBudget <= 0 || Date.now() - (checked.get(id) || 0) < 30 * 60e3) continue;
				nsmaxSpecialRecheckBudget--;
			} else {
				// 这次打开页面已经查过没查成的（删帖、要登录、站点限流……）不再反复查，下次打开页面再说
				if (known.has(id) || checked.has(id) || nsmaxSpecialFailed.has(id)) continue;
				if (!NSMAX_LOTTERY_HINT.test(link.textContent || "") || nsmaxSpecialBudget <= 0) continue;
				nsmaxSpecialBudget--;
			}
			nsmaxSpecialQueued.add(id);
			nsmaxSpecialQueue.push(id);
		}
		nsmaxRunSpecialQueue(ctx);
	}
	// 查一篇：打开它的第一页。打不开（删帖、要登录、站点验证、网络出错）：这次当作不是，不记下来，下次再查。
	// 1. 主帖正文里有开奖链接 → 抽奖帖（只读到主帖正文结束，和帖子预览共用同一份：识别过的帖子悬停预览时不用再取，反过来也一样）；
	// 2. 主帖里没有，但写得像在送东西、抽东西（NSMAX_GIVEAWAY_HINT，标题、正文都看）→ 再把第一页读完，评论里有指向这一篇的开奖链接
	//    也算（2026-10-23：有的楼主把开奖链接贴在评论里，标题里也不写「抽奖」）。
	// row：这一篇在列表里的那一行（后台读来的列表页里的），认出来是抽奖帖时记下它的样子；不给就在当前页面里找
	var nsmaxSpecialFailed = new Set();
	async function nsmaxCheckSpecialPost(ctx, id, row) {
		const url = `${location.origin}/post-${id}-1`;
		let op = null, title = "";
		try {
			const html = await nsmaxPostHtml(ctx.request, url, "low", { until: "</article>", signal: ctx.signal });
			const doc = new DOMParser().parseFromString(html, "text/html");
			op = doc.querySelector(".nsk-post article.post-content, .nsk-post .post-content");
			title = doc.querySelector(".nsk-post .post-title")?.textContent || "";
		} catch {}
		if (!op) {
			nsmaxSpecialFailed.add(id);
			return;
		}
		const kinds = nsmaxSpecialKindsOf(op);
		let time = nsmaxLotteryTimeOf(op);
		if (!kinds.includes("lottery") && NSMAX_GIVEAWAY_HINT.test(title + "\n" + (op.textContent || ""))) {
			try {
				const page = new DOMParser().parseFromString(await ctx.request(url, { responseType: "text", signal: ctx.signal, priority: "low" }), "text/html");
				const params = nsmaxCommentLuckyParams(page, id);
				if (params) {
					kinds.push("lottery");
					time = params.time;
				}
			} catch {
				nsmaxSpecialFailed.add(id);
				return;
			}
		}
		nsmaxRememberSpecialPost(id, kinds);
		nsmaxRememberLotteryTime(id, time);
		if (kinds.includes("lottery")) {
			nsmaxRememberLotteryEnded(id, NSMAX_LOTTERY_ENDED_TITLE.test(title) || nsmaxLotteryEndedIn(op));
			nsmaxRememberLotteryRow(row || nsmaxListRowOf(id));
		}
		nsmaxMarkSpecialChecked(id);
	}
	// 页面在滚动（最近 1.5 秒内滚过）时先不发后台请求：滚动时新露出来的头像、图片正在下，等停下来再说
	var nsmaxLastScrollAt = 0;
	function nsmaxScrollQuiet(ms = 1500) {
		if (!nsmaxScrollQuiet.bound) {
			nsmaxScrollQuiet.bound = true;
			addEventListener("scroll", () => { nsmaxLastScrollAt = performance.now(); }, { passive: true, capture: true });
		}
		return new Promise((resolve) => {
			const check = () => {
				const wait = nsmaxLastScrollAt + ms - performance.now();
				if (wait <= 0) resolve();
				else setTimeout(check, wait);
			};
			check();
		});
	}
	async function nsmaxRunSpecialQueue(ctx) {
		if (nsmaxSpecialBusy || !nsmaxSpecialQueue.length) return;
		nsmaxSpecialBusy = true;
		// 等页面自己加载完（图片、站点脚本）、主线程空下来再开始查；一篇查完再查下一篇（请求队列里后台请求同时只走一个、
		// 前后隔开，见 NSMAX_BG_SPACING）。2026-10-24：以前三篇一起、间隔 0.15 秒，和页面自己的图片抢网速
		await nsmaxPageLoaded();
		// 普通列表页再多等 3 秒、滚动时停一停（2026-10-24 反馈「加载慢、图片慢」）：站点慢的时候一张头像要一秒多，
		// 刚打开页面那几秒、往下翻的时候，网让给头像和图片。「抽奖」分类页不等（那里的行要查完才显示）
		const quiet = !nsmaxIsLotteryView();
		if (quiet) await new Promise((resolve) => setTimeout(resolve, 3000));
		await new Promise((resolve) => typeof requestIdleCallback === "function" ? requestIdleCallback(resolve, { timeout: 2000 }) : setTimeout(resolve, 200));
		try {
			while (nsmaxSpecialQueue.length && !ctx.signal.aborted && !nsmaxBackgroundPaused()) {
				if (document.hidden) {
					await new Promise((resolve) => document.addEventListener("visibilitychange", resolve, { once: true }));
					continue;
				}
				if (quiet) await nsmaxScrollQuiet();
				await nsmaxCheckSpecialPost(ctx, nsmaxSpecialQueue.shift());
				nsmaxLotteryRefresh();
			}
		} finally {
			nsmaxSpecialBusy = false;
		}
	}
	// 列表工具条「精华」「抽奖」（照 sb.sb 首页工具条的 精华 / 抽奖 标签，2026-10-18：「投票」去掉，顶栏的「精华」挪到这里）。
	// 精华是站点的 /award；抽奖见 nsmaxLotteryView。在这两页时对应标签是选中样子，「新评论 / 新帖子」回到首页列表（sb.sb 同款）
	var NSMAX_LOTTERY_QUERY = "抽奖";
	var nsmaxKindSorterBound = false;
	function nsmaxKindTabs(parsed) {
		const controller = document.querySelector("#nsk-body-left > .post-list-controler");
		const sorter = controller?.querySelector(":scope > .sorter");
		if (!sorter || parsed && !parsed(sorter)) return;
		// 普通搜索结果里不放「精华」「抽奖」：它们是首页列表的筛选，点了就离开搜索结果（「抽奖」那一页本身是一个搜索，照放）
		if (location.pathname === "/search" && !nsmaxIsLotteryView()) {
			controller.querySelector(":scope > .nsmax-kind-tabs")?.remove();
			return;
		}
		let tabs = controller.querySelector(":scope > .nsmax-kind-tabs");
		if (!tabs) {
			tabs = document.createElement("div");
			tabs.className = "nsmax-kind-tabs";
			for (const [kind, label, href] of [["award", "精华", "/award"], ["lottery", "抽奖", "/search?q=" + encodeURIComponent(NSMAX_LOTTERY_QUERY)]]) {
				const link = document.createElement("a");
				link.className = "nsmax-kind-tab";
				link.dataset.kind = kind;
				link.href = href;
				link.textContent = label;
				tabs.append(link);
			}
		}
		if (sorter.nextElementSibling !== tabs) sorter.after(tabs);
		const active = location.pathname === "/award" ? "award" : nsmaxIsLotteryView() ? "lottery" : "";
		for (const link of tabs.children) nsmaxFlag(link, "data-nsmax-on", link.dataset.kind === active);
		nsmaxFlag(controller, "data-nsmax-kind-on", !!active);
		if (!nsmaxKindSorterBound) {
			nsmaxKindSorterBound = true;
			// 站点的排序链接在当前地址上加 sortBy（精华、抽奖里点「新帖子」还停在原页）：这两页里改成回首页列表
			document.addEventListener("click", (event) => {
				const link = event.target instanceof Element ? event.target.closest("#nsk-body-left > .post-list-controler[data-nsmax-kind-on] > .sorter > a[data-sort]") : null;
				if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				location.href = "/?sortBy=" + encodeURIComponent(link.dataset.sort);
			}, true);
		}
	}
	// 「抽奖」页（照 sb.sb /prize/）：NodeSeek 没有抽奖分类，拿站内搜索「抽奖」（标题里带这两个字的帖子，新的在前，每页 50 篇）当来源，
	// 只留主帖正文里真有开奖链接的。没查过的按列表顺序在后台查（三篇一起），从上往下依次显示——上面的都有结论了才显示下面的，
	// 已经显示的行不会被后来的挤动；查过的记在本机，下次直接显示。页面看起来就是普通列表，工具条「抽奖」是选中的样子
	function nsmaxIsLotteryView() {
		if (location.pathname !== "/search") return false;
		try { return (new URLSearchParams(location.search).get("q") || "").trim() === NSMAX_LOTTERY_QUERY; } catch { return false; }
	}
	var nsmaxLotteryFailedIds = [];
	var nsmaxLotteryCtx = null;
	function nsmaxFilterLotteryRows() {
		const known = nsmaxSpecialPostMap(), checked = nsmaxSpecialChecked();
		let blocked = false, shown = 0, pending = 0, total = 0;
		const failed = [];
		for (const item of document.querySelectorAll("#nsk-body-left ul.post-list:not(.topic-carousel-panel) > li.post-list-item")) {
			total++;
			const id = item.querySelector(".post-title a[href*='/post-']")?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1];
			const state = id && (known.get(id) || "").split(",").includes("lottery") ? "yes" : !id || checked.has(id) || nsmaxSpecialFailed.has(id) ? "no" : "pending";
			if (state === "pending") { pending++; blocked = true; }
			else if (state === "no" && id && !checked.has(id)) failed.push(id);
			// 上面还有没查完的：这一行先不显示（查完了再按顺序接上）
			const show = state === "yes" && !blocked;
			nsmaxSetAttr(item, "data-nsmax-lottery", show ? "yes" : state === "no" ? "no" : "wait");
			if (show) shown++;
		}
		nsmaxLotteryFailedIds = failed;
		// 识别中先不显示页码：不夹在一行行冒出来的帖子中间跟着往下跳（见 design.css）
		nsmaxFlag(document.documentElement, "data-nsmax-lottery-pending", pending > 0);
		const list = document.querySelector("#nsk-body-left ul.post-list:not(.topic-carousel-panel)");
		if (list) {
			let status = list.parentElement.querySelector(":scope > .nsmax-lottery-status");
			if (!status) {
				status = document.createElement("div");
				status.className = "nsmax-lottery-status";
				status.setAttribute("role", "status");
				list.after(status);
			}
			// 没查成的（网络出错、站点限流）：说一声，给一个「重试」，不再一声不响地当成「不是」。
			// 站点限流过（后台暂停 10 分钟，见 NSMAX_BG_PAUSE_KEY）：还没查的先停着，「重试」马上接着查
			const paused = (pending > 0 || failed.length > 0) && nsmaxBackgroundPaused();
			const text = paused ? "站点限流，识别先停一会儿" : pending ? `正在识别抽奖帖 ${total - pending} / ${total}` : failed.length ? `有 ${failed.length} 篇没能识别（网络或站点限流）` : shown ? "" : "这一页没有抽奖帖";
			if (status.dataset.nsmaxText !== text) {
				status.dataset.nsmaxText = text;
				const parts = [text];
				if (paused || !pending && failed.length) {
					const retry = document.createElement("button");
					retry.type = "button";
					retry.className = "nsmax-lottery-retry";
					retry.textContent = "重试";
					retry.addEventListener("click", () => {
						nsmaxResumeBackground();
						for (const id of nsmaxLotteryFailedIds) nsmaxSpecialFailed.delete(id);
						if (nsmaxLotteryCtx) nsmaxLotteryView(nsmaxLotteryCtx);
					});
					parts.push(retry);
				}
				status.replaceChildren(...parts);
			}
			nsmaxFlag(status, "data-nsmax-busy", pending > 0 && !paused);
			nsmaxFlag(status, "hidden", !pending && !failed.length && shown > 0);
		}
		return pending;
	}
	// 页码最后那个「… 100」是搜索结果的总页数，不是抽奖帖有几页：抽奖页里不显示（见 design.css）
	function nsmaxMarkLotteryPager() {
		for (const pager of document.querySelectorAll("#nsk-body-left .nsk-pager")) {
			const numbers = pager.querySelectorAll(".pager-pos");
			const last = numbers[numbers.length - 1];
			const gap = last?.previousElementSibling;
			const far = !!gap?.classList.contains("nsmax-pager-ellipsis");
			nsmaxFlag(last, "data-nsmax-lottery-far", far);
			nsmaxFlag(gap, "data-nsmax-lottery-far", far);
		}
	}
	// 查完一篇就刷新显示（列表标题前的「抽奖」标签；抽奖页里哪些行显示），但一帧最多刷一次（以前每查完一篇都把整页的行、标题各翻一遍）
	var nsmaxLotteryRefreshQueued = 0;
	function nsmaxLotteryRefresh() {
		if (nsmaxLotteryRefreshQueued) return;
		nsmaxLotteryRefreshQueued = requestAnimationFrame(() => {
			nsmaxLotteryRefreshQueued = 0;
			if (nsmaxIsLotteryView()) nsmaxFilterLotteryRows();
			nsmaxPrizeBadges();
		});
	}
	var nsmaxLotteryViewBusy = false;
	async function nsmaxLotteryView(ctx) {
		if (!nsmaxIsLotteryView()) return;
		nsmaxLotteryCtx = ctx;
		document.documentElement.setAttribute("data-nsmax-lottery-view", "");
		if (document.title !== "抽奖 - NodeSeek") document.title = "抽奖 - NodeSeek";
		// 顶栏搜索框不填「抽奖」：这一页是分类，不是搜索结果
		for (const input of document.querySelectorAll("header input[name=q], #search-site2")) if (input.value.trim() === NSMAX_LOTTERY_QUERY) input.value = "";
		// 本机按内容认出来、但搜索（只搜标题）没搜到的抽奖帖并进来
		// 并进来的行马上挂上「抽奖」（这一轮整理里挂标签在这之前，不等下一轮）
		if (nsmaxMergeLotteryRows()) nsmaxPrizeBadges();
		nsmaxMarkLotteryPager();
		const pending = nsmaxFilterLotteryRows();
		if (nsmaxLotteryViewBusy) return;
		if (!pending) {
			nsmaxLotteryCrawlLater(ctx);
			return;
		}
		nsmaxLotteryViewBusy = true;
		try {
			const checked = nsmaxSpecialChecked();
			const ids = Array.from(document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item[data-nsmax-lottery='wait'] .post-title a[href*='/post-']"), (link) => link.getAttribute("href").match(/\/post-(\d+)/)?.[1]).filter((id, index, all) => id && !checked.has(id) && !nsmaxSpecialFailed.has(id) && all.indexOf(id) === index);
			// 请求走统一的请求队列（后台请求同时只走一个、前后隔开，见 NSMAX_BG_SPACING）；两个人轮着排：一篇在下载时另一篇在解析。
			// 2026-10-24：以前六篇一起查，十秒里取几十篇，站点回 429，整个站点都跟着慢；站点限流时停下（状态行给「重试」）
			const worker = async () => {
				while (ids.length && !ctx.signal.aborted && !nsmaxBackgroundPaused()) {
					if (document.hidden) {
						await new Promise((resolve) => document.addEventListener("visibilitychange", resolve, { once: true }));
						continue;
					}
					await nsmaxCheckSpecialPost(ctx, ids.shift());
					nsmaxLotteryRefresh();
				}
			};
			await Promise.all([worker(), worker()]);
		} finally {
			nsmaxLotteryViewBusy = false;
			cancelAnimationFrame(nsmaxLotteryRefreshQueued);
			nsmaxLotteryRefreshQueued = 0;
			nsmaxFilterLotteryRows();
			nsmaxPrizeBadges();
		}
		// 这一页查完了：下一页在后台先查掉，点「下一页」时直接显示
		const next = document.querySelector("#nsk-body-left .nsk-pager a.pager-next[href]");
		if (next && !ctx.signal.aborted && !nsmaxBackgroundPaused()) nsmaxWhenIdle("lottery-next", () => nsmaxPrefetchLotteryPage(ctx, next.getAttribute("href")));
		nsmaxLotteryCrawlLater(ctx);
	}
	// 抽奖页上：「新帖子」列表也在后台按内容查一遍（30 分钟最多一次），标题里没写「抽奖」的抽奖帖认出来就并进这一页
	function nsmaxLotteryCrawlLater(ctx) {
		if (ctx.signal.aborted || nsmaxBackgroundPaused() || !nsmaxLotteryIndexDue()) return;
		nsmaxWhenIdle("lottery-crawl", () => nsmaxCrawlNewPosts(ctx));
	}
	// 后台提前识别到时间了没有（30 分钟最多一次，本机记时间）；到了就记下这一次
	function nsmaxLotteryIndexDue() {
		if (!unsafeWindow$1.__config__?.user) return false;
		try {
			if (Date.now() - (Number(localStorage.getItem(NSMAX_LOTTERY_INDEX_KEY)) || 0) < 30 * 60e3) return false;
			localStorage.setItem(NSMAX_LOTTERY_INDEX_KEY, String(Date.now()));
			return true;
		} catch {
			return false;
		}
	}
	// 抽奖页查完当前页后，把下一页里没查过的帖子在后台低优先级查掉，翻到下一页时大多已经有结论，直接显示。一次最多查 25 篇。
	// 站内搜索要登录，没登录不查；省流量模式、2G 网络下不查；页面切到后台、站点限流过（后台暂停中）就停。
	// 2026-10-24：别的页面上不再每 30 分钟在后台查一遍「抽奖」搜索第一页和「新帖子」列表（一次几十篇，站点开始限流）
	var NSMAX_LOTTERY_INDEX_KEY = "nsmax:lottery-index-at";
	async function nsmaxPrefetchLotteryPage(ctx, url) {
		if (!unsafeWindow$1.__config__?.user || navigator.connection?.saveData || /2g/.test(navigator.connection?.effectiveType || "") || ctx.signal.aborted || document.hidden || nsmaxBackgroundPaused()) return;
		let html = "";
		try {
			html = await ctx.request(url, { responseType: "text", signal: ctx.signal, priority: "low" });
		} catch {
			return;
		}
		const doc = new DOMParser().parseFromString(html, "text/html");
		const checked = nsmaxSpecialChecked(), known = nsmaxSpecialPostMap();
		const ids = [...new Set(Array.from(doc.querySelectorAll("ul.post-list > li.post-list-item .post-title a[href*='/post-']"), (link) => link.getAttribute("href").match(/\/post-(\d+)/)?.[1]))].filter((id) => id && !checked.has(id) && !known.has(id)).slice(0, 25);
		while (ids.length && !ctx.signal.aborted && !document.hidden && !nsmaxBackgroundPaused()) await nsmaxCheckSpecialPost(ctx, ids.shift());
	}
	// 按内容找抽奖帖（2026-10-23）：标题里不写「抽奖」的抽奖帖，站内搜索（只搜标题）找不到。只在「抽奖」分类页上（登录后、30 分钟最多一次）
	// 读「新帖子」列表第一页，把没查过的帖子在后台低优先级一篇一篇查掉（主帖、第一页评论里有没有指向这一篇的开奖链接），一次最多 20 篇；
	// 认出来的记下它在列表上的样子，并进「抽奖」分类（见 nsmaxMergeLotteryRows）。平时点开的帖子也会按内容认（见 nsmaxPrizeBadges）
	async function nsmaxCrawlNewPosts(ctx) {
		if (ctx.signal.aborted || document.hidden || navigator.connection?.saveData || nsmaxBackgroundPaused()) return;
		let html = "";
		try {
			html = await ctx.request("/?sortBy=postTime", { responseType: "text", signal: ctx.signal, priority: "low" });
		} catch {
			return;
		}
		const doc = new DOMParser().parseFromString(html, "text/html");
		const checked = nsmaxSpecialChecked(), known = nsmaxSpecialPostMap(), rows = nsmaxLotteryRows();
		const todo = [];
		for (const item of doc.querySelectorAll("ul.post-list > li.post-list-item")) {
			const id = item.querySelector(".post-title a[href*='/post-']")?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1];
			if (!id) continue;
			if ((known.get(id) || "").split(",").includes("lottery")) {
				if (!rows.has(id)) nsmaxRememberLotteryRow(item);
			} else if (!checked.has(id) && !known.has(id) && todo.length < 20) todo.push([id, item]);
		}
		while (todo.length && !ctx.signal.aborted && !document.hidden && !nsmaxBackgroundPaused()) {
			const [id, item] = todo.shift();
			await nsmaxCheckSpecialPost(ctx, id, item);
			// 正在看「抽奖」分类：认出来就并进列表
			if (nsmaxIsLotteryView() && nsmaxMergeLotteryRows()) nsmaxLotteryRefresh();
		}
	}
	// 认出来的抽奖帖在列表上的样子（标题、作者、版块、浏览 / 回复数、最后回复、时间），记在本机，最多 200 篇（编号最大的那些）
	var NSMAX_LOTTERY_ROWS_KEY = "nsmax:lottery-rows";
	var nsmaxLotteryRowsMap;
	function nsmaxLotteryRows() {
		if (nsmaxLotteryRowsMap) return nsmaxLotteryRowsMap;
		nsmaxLotteryRowsMap = new Map();
		try {
			for (const [id, row] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_LOTTERY_ROWS_KEY) || "{}"))) if (/^\d+$/.test(id) && row && typeof row.t === "string") nsmaxLotteryRowsMap.set(id, row);
		} catch {}
		return nsmaxLotteryRowsMap;
	}
	function nsmaxRememberLotteryRow(item) {
		const link = item?.querySelector(".post-title a[href*='/post-']");
		const id = link?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1];
		if (!id) return;
		const info = item.querySelector(".post-info");
		const uid = (el) => el?.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1] || "";
		const digits = (el) => (el?.textContent || "").replace(/\D/g, "");
		const author = info?.querySelector(".info-author a[href*='/space/']");
		const last = info?.querySelector(".info-last-commenter a[href*='/space/']");
		const time = info?.querySelector("a.info-last-comment-time");
		const stamp = time?.querySelector("time");
		const category = info?.querySelector("a.post-category") || info?.querySelector("a.info-item[href*='/categories/']");
		const row = {
			t: link.textContent.trim(), u: uid(author) || uid(item.querySelector(":scope > a[href*='/space/']")), n: author?.textContent.trim() || "",
			v: digits(info?.querySelector(".info-views")), r: digits(info?.querySelector(".info-comments-count")),
			lu: uid(last), ln: last?.textContent.trim() || "",
			th: time?.getAttribute("href") || "", td: stamp?.getAttribute("datetime") || "", tt: stamp?.getAttribute("title") || "",
			c: category?.getAttribute("href") || "", cn: category?.textContent.trim() || ""
		};
		const map = nsmaxLotteryRows();
		if (JSON.stringify(map.get(id)) === JSON.stringify(row)) return;
		map.set(id, row);
		if (map.size > 200) map.delete([...map.keys()].reduce((a, b) => Number(a) < Number(b) ? a : b));
		try { localStorage.setItem(NSMAX_LOTTERY_ROWS_KEY, JSON.stringify(Object.fromEntries(map))); } catch {}
	}
	// 按记下的样子拼一行站点原样的列表行（和站点输出的结构一样，之后换图标、排顺序、中文时间都照常）
	function nsmaxLotteryRowElement(id, row) {
		const make = (tag, attrs = {}, ...children) => {
			const el = document.createElement(tag);
			for (const [key, value] of Object.entries(attrs)) if (value !== "") el.setAttribute(key, value);
			el.append(...children);
			return el;
		};
		const item = make("li", { class: "post-list-item" });
		item.setAttribute("data-nsmax-lottery-merged", "");
		if (row.u) item.append(make("a", { href: `/space/${row.u}` }, make("img", { src: `/avatar/${row.u}.png`, alt: row.n, "data-uid": row.u, class: "avatar-normal" })));
		const info = make("div", { class: "post-info" });
		if (row.u) info.append(make("span", { class: "info-item info-author" }, make("a", { href: `/space/${row.u}` }, row.n)));
		if (row.v) info.append(make("span", { class: "info-item info-views" }, make("span", { title: `${row.v} views` }, row.v)));
		if (row.r) info.append(make("span", { class: "info-item info-comments-count", title: `${row.r} comments` }, make("span", { title: `${row.r} comments` }, row.r)));
		if (row.lu) info.append(make("span", { class: "info-item info-last-commenter" }, make("a", { href: `/space/${row.lu}` }, row.ln)));
		if (row.td) info.append(make("a", { href: row.th || `/post-${id}-1`, class: "info-item info-last-comment-time" }, make("time", { title: row.tt, datetime: row.td }, row.tt || row.td)));
		if (row.c) info.append(make("a", { href: row.c, class: "info-item post-category" }, row.cn));
		item.append(make("div", { class: "post-list-content" }, make("div", { role: "heading", "aria-level": "3", class: "post-title" }, make("a", { href: `/post-${id}-1` }, row.t)), info));
		return item;
	}
	// 「抽奖」分类第一页：本机认出来、但站内搜索「抽奖」没搜到的抽奖帖（标题里没写「抽奖」的）按编号插进列表（不比这一页最旧的
	// 那篇还旧的才插，更旧的属于后面几页）。插进来的行和别的行一样按顺序显示
	function nsmaxMergeLotteryRows() {
		const list = document.querySelector("#nsk-body-left ul.post-list:not(.topic-carousel-panel)");
		if (!list || document.readyState === "loading") return 0;
		const current = document.querySelector("#nsk-body-left .nsk-pager :is(.pager-cur, [data-nsmax-pg-cur])");
		if (current && current.textContent.trim() !== "1") return 0;
		const idOf = (item) => Number(item.querySelector(".post-title a[href*='/post-']")?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1] || 0);
		// 置顶帖（编号小，不按时间排在最前面）不参与比较
		const pinned = (item) => !!item.querySelector(".post-title :is(svg.pined, use[href='#pin'])");
		const items = Array.from(list.querySelectorAll(":scope > li.post-list-item"));
		const present = new Set(items.map(idOf));
		const oldest = items.reduce((min, item) => pinned(item) ? min : Math.min(min, idOf(item) || Infinity), Infinity);
		const known = nsmaxSpecialPostMap();
		const adding = [...nsmaxLotteryRows()].filter(([id]) => !present.has(Number(id)) && (known.get(id) || "").split(",").includes("lottery") && !(oldest !== Infinity && Number(id) < oldest)).sort((a, b) => Number(b[0]) - Number(a[0]));
		if (!adding.length) return 0;
		// 插在屏幕上方会把正在看的内容往下推：记下屏幕里第一行的位置，插完把页面滚回去（Safari 没有浏览器自带的滚动锚定）
		const anchor = items.find((item) => item.getBoundingClientRect().bottom > 0);
		const top = anchor?.getBoundingClientRect().top;
		for (const [id, row] of adding) {
			let before = null;
			for (const item of list.children) {
				if (!item.matches("li.post-list-item") || pinned(item)) continue;
				if (idOf(item) < Number(id)) { before = item; break; }
			}
			list.insertBefore(nsmaxLotteryRowElement(id, row), before);
		}
		if (anchor && top !== undefined && scrollY > 0) {
			const moved = anchor.getBoundingClientRect().top - top;
			if (moved) window.scrollBy(0, moved);
		}
		return adding.length;
	}
	// NQ（NodeQuality 测机）入口：顶栏「精华」后面（以前在列表工具条右边）
	function nsmaxNqLink(className) {
		const link = document.createElement("a");
		link.className = className;
		link.href = "https://nodequality.com";
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.title = "NodeQuality 测机";
		// 2026-10-18 第八批：照 sb.sb 顶栏「论坛应用」按钮做成黄底深色字，图标换成单色的阶梯「N」（NodeQuality 标志的形状，跟字一个颜色）；
		// 原来那张彩色小图是白底的，放在黄底上会露出一块白方块，深色模式下又看不清
		const ns = "http://www.w3.org/2000/svg";
		const icon = document.createElementNS(ns, "svg");
		icon.setAttribute("class", "nsmax-nq-icon");
		icon.setAttribute("viewBox", "0 0 16 16");
		icon.setAttribute("fill", "currentColor");
		icon.setAttribute("aria-hidden", "true");
		for (const [x, y, w, h] of [[1.5, 1, 3, 14], [11.5, 1, 3, 14], [4.5, 1, 2, 3.8], [6.2, 4.8, 2, 3.2], [7.8, 8, 2, 3.4], [9.5, 11.2, 2, 3.8]]) {
			const rect = document.createElementNS(ns, "rect");
			rect.setAttribute("x", String(x));
			rect.setAttribute("y", String(y));
			rect.setAttribute("width", String(w));
			rect.setAttribute("height", String(h));
			icon.append(rect);
		}
		const text = document.createElement("span");
		text.textContent = "NQ";
		link.append(icon, text);
		return link;
	}
	var nsmaxCommentLuckyPage = "";
	var nsmaxCommentLucky = "";
	function nsmaxPrizeBadges() {
		const postId = location.pathname.match(/^\/post-(\d+)/)?.[1];
		const op = postId && document.querySelector(".nsk-post article.post-content");
		if (op) {
			const kinds = nsmaxSpecialKindsOf(op);
			let time = nsmaxLotteryTimeOf(op);
			// 主帖里没有、这一页评论里有指向这一篇的开奖链接：也是抽奖帖（2026-10-23）。整页解析完只看一次
			if (!kinds.includes("lottery") && document.readyState !== "loading" && nsmaxCommentLuckyPage !== location.pathname) {
				nsmaxCommentLuckyPage = location.pathname;
				const params = nsmaxCommentLuckyParams(document, postId);
				if (params) {
					nsmaxCommentLucky = postId;
					time = params.time;
				}
			}
			if (nsmaxCommentLucky === postId && !kinds.includes("lottery")) kinds.push("lottery");
			nsmaxRememberSpecialPost(postId, kinds);
			nsmaxRememberLotteryTime(postId, time);
			// 整页解析完才算「查过」：解析到一半时正文还不全，记成「不是」以后就不会再认
			if (document.readyState !== "loading") {
				nsmaxMarkSpecialChecked(postId);
				if (kinds.includes("lottery")) nsmaxRememberLotteryEnded(postId, NSMAX_LOTTERY_ENDED_TITLE.test(document.querySelector(".nsk-post .post-title")?.textContent || "") || nsmaxLotteryEndedIn(op));
			}
		}
		const known = nsmaxSpecialPostMap();
		nsmaxQueryEach([".post-list-item .post-title", ".nsk-post>.post-title h1"], (title) => {
			const link = title.querySelector("a");
			if (!link || nsmaxLateRows && title.closest(nsmaxLateRows)) return;
			const id = (link.getAttribute("href") || "").match(/\/post-(\d+)/)?.[1] || postId;
			// 只有确认正文里有开奖链接的才挂「抽奖」；投票帖不再挂小标（2026-10-18）
			const lottery = (id && known.get(id) || "").split(",").includes("lottery");
			// 到了开奖时间（sb.sb .lottery-badge-done + .special-ended）：「抽奖」变成细线框灰字，后面多一个「已结束」
			const time = lottery ? nsmaxLotteryTimes().get(id) : 0;
			const ended = lottery && ((!!time && time <= Date.now()) || nsmaxLotteryEnded().has(id) || NSMAX_LOTTERY_ENDED_TITLE.test(link.textContent || ""));
			nsmaxTopicBadge(title, link, "nsmax-prize-badge", "抽奖", lottery);
			if (lottery) for (const child of title.children) if (child.classList.contains("nsmax-prize-badge")) nsmaxFlag(child, "data-ended", ended);
			nsmaxTopicBadge(title, link, "nsmax-ended-badge", "已结束", lottery && ended);
		});
	}
	// 帖子里的投票（NodeSeek .vote-panel）：样子全由主题 CSS 照 sb.sb .poll-widget 排；这里把每项的百分比、总票数写成属性给 CSS 显示
	function nsmaxPreparePolls() {
		for (const panel of document.querySelectorAll("article.post-content .vote-panel")) {
			let total = 0;
			for (const stat of panel.querySelectorAll(".vote-stat")) {
				const bar = stat.querySelector(".vote-stat-count-bar");
				const value = stat.querySelector(".vote-stat-count-value");
				const count = Number((value?.textContent || "").trim());
				if (Number.isFinite(count)) total += count;
				if (value) nsmaxSetAttr(value, "data-nsmax-pct", (bar?.getAttribute("title") || bar?.textContent || "").trim());
			}
			// 站点在投票下面用一行灰字写 App 深链接和「（公开投票）」：深链接网页上用不上，整行由 CSS 收起，公开 / 匿名挪到总票数前面
			const kind = Array.from(panel.querySelectorAll("form > div")).map(div => div.textContent.match(/[(（]\s*((?:公开|匿名)投票)\s*[)）]/)?.[1]).find(Boolean);
			const head = panel.querySelector("form > h2");
			if (head) nsmaxSetAttr(head, "data-nsmax-total", (kind ? kind + " · " : "") + `${total} 票`);
		}
	}
	// 开奖时间记在本机（帖子 ID → 时间，最多 400 篇）：列表里已经到了开奖时间的抽奖帖，标签照 sb.sb 换成细线框的「抽奖」「已结束」
	var NSMAX_LOTTERY_TIMES_KEY = "nsmax:lottery-times";
	var nsmaxLotteryTimesMap;
	function nsmaxLotteryTimes() {
		if (nsmaxLotteryTimesMap) return nsmaxLotteryTimesMap;
		nsmaxLotteryTimesMap = new Map();
		try {
			for (const [id, time] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_LOTTERY_TIMES_KEY) || "{}"))) if (Number.isFinite(time)) nsmaxLotteryTimesMap.set(id, time);
		} catch {}
		return nsmaxLotteryTimesMap;
	}
	function nsmaxRememberLotteryTime(id, time) {
		if (!id || !Number.isFinite(time) || time <= 0) return;
		const map = nsmaxLotteryTimes();
		if (map.get(id) === time) return;
		map.delete(id);
		map.set(id, time);
		while (map.size > 400) map.delete(map.keys().next().value);
		try { localStorage.setItem(NSMAX_LOTTERY_TIMES_KEY, JSON.stringify(Object.fromEntries(map))); } catch {}
	}
	// 开奖链接（/lucky?post=…&time=开奖时间&count=中奖人数&start=起始楼层&duplicate=可否重复中奖）的参数；只认本站的 /lucky
	function nsmaxLuckyParams(href) {
		let url;
		try { url = new URL(href, location.href); } catch { return null; }
		const time = Number(url.searchParams.get("time"));
		if (url.origin !== location.origin || url.pathname !== "/lucky" || !Number.isFinite(time) || time <= 0) return null;
		return {
			url,
			time,
			count: Math.max(1, Number(url.searchParams.get("count")) || 1),
			start: Math.max(1, Number(url.searchParams.get("start")) || 1),
			duplicate: url.searchParams.get("duplicate") === "true"
		};
	}
	function nsmaxLuckyViewHref(href) {
		const params = nsmaxLuckyParams(href);
		if (!params) return href;
		params.url.searchParams.delete("mode");
		params.url.searchParams.append("mode", "view");
		return params.url.href;
	}
	function nsmaxLotteryTimeOf(op) {
		for (const link of op.querySelectorAll('a[href*="/lucky?"]')) {
			const params = nsmaxLuckyParams(link.getAttribute("href") || "");
			if (params) return params.time;
		}
		return 0;
	}
	// 帖子里的开奖链接：照 sb.sb 的 .lottery-widget（2026-10-18 第七批重排）——标题栏（图标、「抽奖」、右边「进行中 / 已结束」）、
	// 倒计时条（中文单位 天 时 分 秒，不足一天不显示「天」）、奖品 / 名额 / 中奖者小表、一行说明、「N 条回复 · 从 1 楼起 · 共 N 个名额」、
	// 前 12 位参与人小胶囊（#楼号 名字）、「回复参与」「查看开奖」。原来那条只有一个链接的段落收起
	var nsmaxLotteryCards = new Set();
	var nsmaxLotteryTimer = 0;
	function nsmaxLotteryTick() {
		const now = Date.now();
		for (const card of nsmaxLotteryCards) {
			if (!card.isConnected) {
				nsmaxLotteryCards.delete(card);
				continue;
			}
			const left = Number(card.dataset.nsmaxTime) - now;
			const state = left <= 0 ? "done" : left <= 3e5 ? "imminent" : left <= 36e5 ? "soon" : "open";
			nsmaxSetAttr(card, "data-state", state);
			nsmaxSetText(card.querySelector(".nsmax-lottery-state"), state === "done" ? "已结束" : "进行中");
			nsmaxSetText(card.querySelector(".nsmax-lottery-label"), state === "done" ? `已于 ${card.dataset.nsmaxWhen} 开奖` : "距开奖");
			nsmaxSetText(card.querySelector(".nsmax-lottery-winners"), state === "done" ? "已开奖，点「查看开奖」" : "未开奖");
			const parts = left <= 0 ? [0, 0, 0, 0] : [Math.floor(left / 864e5), Math.floor(left / 36e5) % 24, Math.floor(left / 6e4) % 60, Math.floor(left / 1e3) % 60];
			card.querySelectorAll(".nsmax-lottery-clock > .nsmax-lottery-seg").forEach((seg, i) => {
				const hidden = i === 0 && parts[0] === 0;
				if (seg.hidden !== hidden) seg.hidden = hidden;
				const b = seg.firstElementChild;
				const text = i === 0 ? String(parts[i]) : String(parts[i]).padStart(2, "0");
				// 只改文字节点（characterData），不替换子节点：页面观察器只看增删节点，倒计时不会触发整页整理
				if (b?.firstChild && b.firstChild.data !== text) b.firstChild.data = text;
			});
		}
		if (!nsmaxLotteryCards.size) {
			clearInterval(nsmaxLotteryTimer);
			nsmaxLotteryTimer = 0;
		}
	}
	// 一键抽奖发出去以后（见编辑器里的 nsmaxOpenLuckyModal）：站点跳到新帖子，这里按新帖子的编号生成开奖链接，
	// 用站点自己的编辑接口（/api/content/edit-discussion，和站点编辑器发的一样）把正文里「开奖链接：发布后自动生成」换成链接，再刷新。
	// 只认 15 分钟内、标题对得上、楼主是自己、正文里还没有开奖链接的帖子；失败时把链接给出来，可以复制后手动编辑
	var NSMAX_LUCKY_PENDING = "nsmax:lucky:pending";
	var nsmaxLuckyFinishing = false;
	function nsmaxFinishLuckyPost() {
		if (nsmaxLuckyFinishing) return;
		let pending;
		try { pending = JSON.parse(localStorage.getItem(NSMAX_LUCKY_PENDING) || "null"); } catch { return; }
		if (!pending) return;
		if (!(Date.now() - pending.at < 9e5)) {
			try { localStorage.removeItem(NSMAX_LUCKY_PENDING); } catch {}
			return;
		}
		const config = unsafeWindow$1.__config__;
		const post = config?.postData;
		const postId = Number(post?.postId || location.pathname.match(/^\/post-(\d+)/)?.[1]);
		const op = post?.comments?.find?.((comment) => Number(comment?.floorIndex) === 0) || post?.comments?.[0];
		const me = config?.user?.member_id;
		const mine = op?.poster?.isMe === true || me !== undefined && String(op?.poster?.uid ?? op?.poster?.member_id) === String(me);
		if (!postId || !op || !mine || String(post.title || "").trim() !== String(pending.title || "").trim()) return;
		const markdown = String(op.markdown ?? "");
		if (!markdown || /\/lucky\?/.test(markdown)) {
			try { localStorage.removeItem(NSMAX_LUCKY_PENDING); } catch {}
			return;
		}
		nsmaxLuckyFinishing = true;
		try { localStorage.removeItem(NSMAX_LUCKY_PENDING); } catch {}
		const url = nsmaxLuckyViewHref(`${location.origin}/lucky?post=${postId}&time=${pending.time}&count=${pending.count}&start=${pending.start}&duplicate=${pending.duplicate ? "true" : "false"}`);
		const line = `- **开奖链接**：[查看开奖](${url})`;
		const content = /- \*\*开奖链接\*\*：发布后自动生成/.test(markdown) ? markdown.replace(/- \*\*开奖链接\*\*：发布后自动生成/, line) : `${markdown.replace(/\s+$/, "")}${String.fromCharCode(10, 10)}${line}`;
		const token = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("");
		nsmaxToast("正在生成开奖链接…");
		fetch("/api/content/edit-discussion", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json", "csrf-token": token },
			body: JSON.stringify({ content, mode: "edit-discussion", title: post.title, postId, rank: Number(post.rank) || 0 })
		}).then((res) => res.json()).then((json) => {
			if (!json?.success) throw new Error(json?.message || "编辑失败");
			nsmaxToast("开奖链接已补进帖子");
			setTimeout(() => location.reload(), 600);
		}).catch((error) => {
			nsmaxToast(`开奖链接没补上（${error?.message || "请稍后再试"}），已复制链接，编辑帖子贴进去就行`, { error: true });
			try { navigator.clipboard?.writeText(url); } catch {}
		});
	}
	// 奖品：正文里写着「奖品：…」的那一行；没有就用标题（去掉「【抽奖】」「抽奖：」）
	function nsmaxLotteryPrize(article) {
		for (const node of article.querySelectorAll("li, p, td, h2, h3, h4")) {
			if (node.closest(".nsmax-lottery")) continue;
			const match = node.textContent.match(/奖品\s*[:：]\s*(.+)/);
			if (match) return match[1].replace(/\s+/g, " ").trim().slice(0, 80);
		}
		const title = document.querySelector(".nsk-post > .post-title h1, .post-title h1")?.textContent || "";
		return title.replace(/^\s*(?:【\s*抽奖\s*】|\[\s*抽奖\s*\]|抽奖\s*[:：])\s*/, "").trim().slice(0, 80) || "见正文";
	}
	// 参与人：已经加载出来的楼层里，从起始楼层起回复的人（按楼层先后、同一个人只算一次）
	function nsmaxLotteryEntrants(start) {
		const people = [];
		const seen = new Set();
		for (const item of document.querySelectorAll("ul.comments li.content-item")) {
			const floor = Number(item.id);
			const name = item.querySelector(".author-info > a.author-name")?.textContent.trim();
			if (!Number.isFinite(floor) || floor < start || !name || seen.has(name)) continue;
			seen.add(name);
			people.push([floor, name]);
		}
		return people.sort((a, b) => a[0] - b[0]);
	}
	function nsmaxPrepareLottery() {
		for (const link of document.querySelectorAll('article.post-content a[href*="/lucky?"]:not([data-nsmax-lottery])')) {
			// 卡片自己的「查看开奖」也是开奖链接：不跳过的话下一轮扫描又按它生成一张卡片，一层套一层
			if (link.closest(".nsmax-lottery")) continue;
			const params = nsmaxLuckyParams(link.href);
			if (!params) continue;
			const { url, time, count, start, duplicate } = params;
			link.setAttribute("data-nsmax-lottery", "");
			const postId = location.pathname.match(/^\/post-(\d+)/)?.[1];
			if (postId && link.closest(".nsk-post")) nsmaxRememberLotteryTime(postId, time);
			const article = link.closest("article.post-content") || document;
			// 回复总数见 nsmaxPostReplyCount；一时拿不到先写这一页的参与人数，拿到后 nsmaxShowPostReplyCount 更新
			const replies = nsmaxPostReplyCount();
			const entrants = nsmaxLotteryEntrants(start);
			const { card, join } = nsmaxBuildLotteryCard({ time, count, start, duplicate, prize: nsmaxLotteryPrize(article), href: url.href, replies: replies ?? entrants.length, entrants });
			join.addEventListener("click", () => {
				const editor = document.querySelector("#nsk-body-left .md-editor");
				if (!editor) return;
				editor.scrollIntoView({ behavior: "smooth", block: "center" });
				const cm = editor.querySelector(".CodeMirror")?.CodeMirror;
				setTimeout(() => {
					if (cm) cm.focus();
					else editor.querySelector("textarea:not(.CodeMirror textarea)")?.focus({ preventScroll: true });
				}, 320);
			});
			const block = link.closest("p, li, blockquote") || link;
			if (block !== link && block.textContent.trim() === link.textContent.trim()) block.setAttribute("data-nsmax-lottery-source", "");
			else link.setAttribute("data-nsmax-lottery-source", "");
			block.after(card);
			nsmaxTrackLottery(card);
		}
	}
	// 让卡片的倒计时每秒走（卡片不在页面上了，下一次走的时候自己去掉）
	function nsmaxTrackLottery(card) {
		nsmaxLotteryCards.add(card);
		nsmaxLotteryTick();
		nsmaxLotteryTimer ||= setInterval(nsmaxLotteryTick, 1e3);
	}
	// 一张抽奖卡片（sb.sb .lottery-widget）：帖子里开奖链接换成的卡片，一键抽奖弹窗的预览也用这一张（preview：按钮不能点、没有参与人）
	function nsmaxBuildLotteryCard({ time, count, start, duplicate, prize, href = "", replies = 0, entrants = [], preview = false }) {
		const make = (tag, className, text) => {
			const el = document.createElement(tag);
			if (className) el.className = className;
			if (text !== undefined) el.textContent = text;
			return el;
		};
		const date = new Date(time);
		const pad = (n) => String(n).padStart(2, "0");
		const card = make("div", "nsmax-lottery");
		card.dataset.nsmaxTime = String(time);
		card.dataset.nsmaxWhen = Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "—";
		if (preview) card.setAttribute("data-nsmax-preview", "");
		const head = make("div", "nsmax-lottery-head");
		head.append(make("span", "nsmax-lottery-icon"), make("strong", "", "抽奖"), make("span", "nsmax-lottery-state"));
		const countdown = make("div", "nsmax-lottery-countdown");
		const clock = make("span", "nsmax-lottery-clock");
		for (const unit of ["天", "时", "分", "秒"]) {
			const seg = make("span", "nsmax-lottery-seg");
			seg.append(make("b", "", "0"), make("i", "nsmax-lottery-unit", unit));
			clock.append(seg);
		}
		countdown.append(make("span", "nsmax-lottery-label", "距开奖"), clock);
		// 奖品 / 名额 / 中奖者（sb.sb .lottery-prizes 小表）
		const table = make("table", "nsmax-lottery-table");
		const thead = make("thead");
		const headRow = make("tr");
		headRow.append(make("th", "", "奖品"), make("th", "", "名额"), make("th", "", "中奖者"));
		thead.append(headRow);
		const tbody = make("tbody");
		const row = make("tr");
		row.append(make("td", "nsmax-lottery-prize", prize || "（奖品）"), make("td", "nsmax-lottery-count", String(count)), make("td", "nsmax-lottery-winners", "未开奖"));
		tbody.append(row);
		table.append(thead, tbody);
		const note = make("p", "nsmax-lottery-note", `到开奖时间后，站点按回复的楼层抽出中奖者（从 ${start} 楼起，${duplicate ? "可以重复中奖" : "每人最多中一次"}），点「查看开奖」看结果。`);
		// 「开奖时间 · N 条回复 · 从 1 楼起 · 共 N 个名额」+ 前 12 位参与人
		const stat = make("div", "nsmax-lottery-stat");
		stat.append(make("span", "", `开奖 ${card.dataset.nsmaxWhen}`));
		if (!preview) {
			const total = make("span", "", `${replies} 条回复`);
			total.setAttribute("data-nsmax-replies", "");
			stat.append(total);
		}
		stat.append(make("span", "", `从 ${start} 楼起`), make("span", "", `共 ${count} 个名额`));
		const people = make("div", "nsmax-lottery-people");
		for (const [floor, name] of entrants.slice(0, 12)) {
			const chip = make("a", "nsmax-lottery-person", `#${floor} ${name}`);
			chip.href = `#${floor}`;
			people.append(chip);
		}
		const actions = make("div", "nsmax-lottery-actions");
		const view = make("a", "nsmax-lottery-view", "查看开奖");
		view.setAttribute("data-nsmax-lottery", "");
		const join = make("button", "nsmax-lottery-join", "回复参与");
		join.type = "button";
		if (preview) {
			join.disabled = true;
			view.setAttribute("aria-disabled", "true");
		} else {
			view.href = nsmaxLuckyViewHref(href);
			view.target = "_blank";
			view.rel = "noopener";
		}
		actions.append(join, view);
		card.append(head, countdown, table, note, stat);
		if (people.childElementCount) card.append(people);
		card.append(actions);
		return { card, join, view };
	}
	function nsmaxCleanBadgesAndNotifications() {
		nsmaxQueryEach([".notify-count", ".unread-count", ".nspp-messages-count", ".nspp-messages-unread"], (el) => {
			// 消息中心自己的未读数由它自己用 hidden 管理（拿到数字后才显示）。这里要是在数字到之前把它写死成隐藏，
			// 之后数字到了也不会再整理（消息中心内部的变化不触发重新整理），未读数就一直不显示
			if (el.closest(".nspp-messages")) {
				if (el.getAttribute("data-empty") === "true") {
					el.removeAttribute("data-empty");
					el.style.removeProperty("display");
				}
				return;
			}
			const text = (el.textContent || "").trim();
			if (!text || text === "0") {
				nsmaxSetAttr(el, "data-empty", "true");
				nsmaxHideEl(el);
			} else {
				nsmaxDropAttr(el, "data-empty");
				nsmaxShowEl(el);
			}
		});
	}
	function nsmaxCleanSearchOverlay() {
		// 先找搜索浮层（多数页面没有），再在浮层里找谷歌那一项（以前三段带祖先的选择器整页查，每次 1.2ms）
		for (const overlay of document.querySelectorAll(".search-overlay")) {
			for (const link of overlay.querySelectorAll(".googleSearch, [data-tab=google], [data-type=google]")) link.remove();
			for (const element of overlay.querySelectorAll(".tab-btn")) if (/谷歌|google/i.test(element.textContent.trim())) element.remove();
		}
	}
	// 解析器已经越过这个元素了没有（它或者它的某层祖先后面已经有兄弟节点，或者页面已经解析完）
	function nsmaxParsedPast(el) {
		if (nsmaxLateRows && el.matches(nsmaxLateRows)) return false;
		if (document.readyState !== "loading") return true;
		for (let node = el; node && node !== document.body; node = node.parentElement) if (node.nextSibling) return true;
		return false;
	}
	// 列表每一行的元信息：排成 sb.sb .post-meta 的顺序，多一个行内版块。图标（作者、版块、浏览、回复、最后回复人）2026-10-23 起
	// 由主题 CSS 画（::before 遮罩，见 design.css「列表元信息图标」）：以前给每一项插一个 svg，一页 95 行要新建、插入近 500 个，
	// 手机上首帧前要多花几十毫秒；站点原来的 iconpark 图标留在原处，由 CSS 藏起来
	const nsmaxProcessedRows = new WeakSet();
	// 回复多的帖子，标题后面一排小页码（sb.sb .topic-pages：「2 3 … 5 6 7」，直接点进第几页，不用先进第 1 页再翻）。
	// 回复数用列表上的（站点列表的回复数就是最后一楼的楼号），一页 10 楼；两页以上才有，超过 6 页写 2、3、…、最后三页
	// （正好 6 页时中间没有跳过的页，不写省略号）。
	// 新标签页打开跟着标题走（站点偏好）。2026-10-24
	var NSMAX_FLOORS_PER_PAGE = 10;
	function nsmaxTopicPages(row) {
		const title = row.querySelector(".post-title");
		const link = title?.querySelector(":scope > a[href*='/post-']");
		const id = link?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1];
		const box = row.querySelector(".info-comments-count");
		if (!id || !box || title.querySelector(":scope > .nsmax-topic-pages")) return;
		const count = Number((box.getAttribute("title") || "").match(/^(\d+)\s*comments?/i)?.[1] ?? box.textContent.replace(/\D/g, ""));
		const pages = Math.ceil(count / NSMAX_FLOORS_PER_PAGE);
		if (!Number.isFinite(pages) || pages < 2) return;
		const holder = document.createElement("span");
		holder.className = "nsmax-topic-pages";
		holder.title = `共 ${pages} 页`;
		for (const n of pages <= 6 ? Array.from({ length: pages - 1 }, (_, i) => i + 2) : [2, 3, 0, pages - 2, pages - 1, pages]) {
			if (!n) {
				const gap = document.createElement("span");
				gap.className = "nsmax-topic-pages-gap";
				gap.textContent = "…";
				holder.append(gap);
				continue;
			}
			const page = document.createElement("a");
			page.href = `/post-${id}-${n}`;
			page.textContent = String(n);
			page.setAttribute("aria-label", `第 ${n} 页`);
			if (link.target) page.target = link.target;
			if (link.rel) page.rel = link.rel;
			holder.append(page);
		}
		link.setAttribute("data-nsmax-paged", "");
		link.after(holder);
	}
	function nsmaxProcessPostListRows() {
		for (const row of document.querySelectorAll("ul.post-list:not(.topic-carousel-panel)>li.post-list-item")) {
			if (nsmaxProcessedRows.has(row)) continue;
			const info = row.querySelector(".post-info");
			// 还没解析完的那一行（.post-info 还没出来、或者还在往里写）先不动，下一遍再来（以前先记成处理过，解析到一半的那行就再也不整理了）
			if (!info || !nsmaxParsedPast(row)) continue;
			nsmaxProcessedRows.add(row);
			nsmaxTopicPages(row);
			if (row.hasAttribute("data-nsmax-meta-ordered")) continue;
			let author, time, views, count, last, category, siteCategory;
			for (const child of info.children) {
				const list = child.classList;
				if (list.contains("info-author")) author ||= child;
				else if (list.contains("info-last-comment-time")) time ||= child;
				else if (list.contains("info-views")) views ||= child;
				else if (list.contains("info-comments-count")) count ||= child;
				else if (list.contains("info-last-commenter")) last ||= child;
				else if (list.contains("post-category")) category ||= child;
				else if (child.localName === "a" && list.contains("info-item") && (child.getAttribute("href") || "").includes("/categories/")) siteCategory ||= child;
			}
			// 手机版（服务器按手机 UA 输出）没有 .post-category：版块是 .post-info 里链到 /categories/ 的那个 a.info-item，直接当行内版块用
			const inline = category?.cloneNode(true) || siteCategory;
			if (inline) {
				inline.className = "nsmax-inline-category";
				for (const icon of inline.querySelectorAll("svg, .iconpark-icon")) icon.remove();
			}
			// 2026-10-20 实时 sb.sb .post-meta：作者 · 时间 · 版块 · 浏览 · 回复 · 最后回复人。
			// NodeSeek 的时间仍取原生最后回复时间，仅调整显示顺序；宽屏另有右侧版块标签。一次挪完
			info.append(...[author, time, inline, views, count, last, category].filter(Boolean));
			row.setAttribute("data-nsmax-meta-ordered", "");
		}
	}
	// 搜索结果页（/search?q=…，登录后才有，结果还是首页那套 ul.post-list）：照 sb.sb 在列表上面加一行 .search-summary——
	// 「搜索 关键词 · 版块 · 第几页」，13.5px 次要色、关键词正文色；一条结果都没有时排序、分页、空列表（还有站点自己那句提示）都收起来，
	// 换成 sb.sb 的 .empty-state 面板：「没有找到相关帖子」+ 一行提示 +「换个关键词」（打开站点自己的搜索框）/「搜索全部版块」（带了版块筛选时）
	function nsmaxPrepareSearch() {
		if (location.pathname !== "/search") return;
		const left = document.querySelector("#nsk-body-left");
		if (!left) return;
		const params = new URLSearchParams(location.search);
		const keyword = (params.get("q") || "").trim();
		const category = (params.get("category") || "").trim();
		const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
		// 顶栏搜索框里显示这次搜的词（登录后点它打开的是站点的搜索弹层，这里只让人看到现在搜的是什么；只填一次，清空了不再补回去）
		const input = document.querySelector("#search-site2");
		if (input && keyword && !input.hasAttribute("data-nsmax-search-filled")) {
			input.setAttribute("data-nsmax-search-filled", "");
			if (!input.value) input.value = keyword;
		}
		// 页面还在解析时列表可能还没出来，等解析完再判断是不是真的没有结果
		if (document.readyState === "loading" && !nsmaxPrepareSearch.waiting) {
			nsmaxPrepareSearch.waiting = true;
			document.addEventListener("DOMContentLoaded", () => nsmaxPrepareSearch(), { once: true });
		}
		const empty = document.readyState !== "loading" && !left.querySelector("ul.post-list > li.post-list-item");
		const categoryName = category && ((document.querySelector(`a[href="/categories/${CSS.escape(category)}"]`)?.textContent || "").trim() || category);
		let summary = left.querySelector(":scope > .nsmax-search-summary");
		if (!summary) {
			summary = document.createElement("p");
			summary.className = "nsmax-search-summary";
		}
		if (left.firstElementChild !== summary) left.prepend(summary);
		const key = [keyword, categoryName, page, empty].join("\n");
		if (summary.dataset.nsmaxKey !== key) {
			summary.dataset.nsmaxKey = key;
			const strong = (text) => { const element = document.createElement("strong"); element.textContent = text; return element; };
			const parts = keyword ? ["搜索 ", strong(keyword)] : ["没有输入关键词"];
			if (categoryName) parts.push(" · 版块 ", strong(categoryName));
			if (empty) { if (keyword) parts.push(" · 没有找到结果"); }
			else if (page > 1) parts.push(` · 第 ${page} 页`);
			summary.replaceChildren(...parts);
			summary.title = summary.textContent;
		}
		nsmaxFlag(left, "data-nsmax-search-empty", empty);
		let panel = left.querySelector(":scope > .nsmax-search-empty");
		for (const child of left.children) {
			if (child === summary || child === panel) continue;
			const native = child.matches(".post-list-controler, ul.post-list") || !!child.querySelector(".nsk-pager")
				|| !child.matches("#nsk-body-left-block") && !child.querySelector("input, textarea, select") && child.textContent.trim().length <= 60 && /没有|暂无|无结果|找不到|未找到|nothing|no results?|not found/i.test(child.textContent);
			nsmaxFlag(child, "data-nsmax-search-hide", empty && native);
		}
		if (!empty) { panel?.remove(); return; }
		if (!panel) {
			panel = document.createElement("div");
			panel.className = "nsmax-search-empty";
		}
		if (summary.nextElementSibling !== panel) summary.after(panel);
		if (panel.dataset.nsmaxKey === key) return;
		panel.dataset.nsmaxKey = key;
		const state = document.createElement("div"); state.className = "empty-state";
		const title = document.createElement("p"); title.className = "nsmax-search-empty-title";
		title.textContent = keyword ? "没有找到相关帖子" : "输入关键词开始搜索";
		const hint = document.createElement("p"); hint.className = "nsmax-search-empty-hint";
		hint.textContent = keyword ? (category ? "换个关键词，或者去掉版块筛选再试试" : "换个关键词，或者少用几个词再试试") : "可以搜帖子标题、正文，也可以搜用户";
		const actions = document.createElement("div"); actions.className = "nsmax-search-empty-actions";
		const retry = document.createElement("button");
		retry.type = "button";
		retry.textContent = keyword ? "换个关键词" : "搜索";
		retry.addEventListener("click", () => {
			// 站点的搜索弹层挂在顶栏搜索框（宽屏）和放大镜（手机）的点击上
			(document.querySelector("#mobile-search") || document.querySelector("form.search-box"))?.click();
			setTimeout(() => document.querySelector(".search-overlay input:not([type=hidden])")?.focus(), 60);
		});
		actions.append(retry);
		if (keyword && category) {
			const all = document.createElement("a");
			all.href = "/search?q=" + encodeURIComponent(keyword);
			all.textContent = "搜索全部版块";
			actions.append(all);
		}
		state.append(title, hint, actions);
		panel.replaceChildren(state);
	}
	function nsmaxPrepareBoard() {
		if (!/^\/board(?:\/|$)/.test(location.pathname)) {
			document.querySelectorAll(".nsmax-board-banner").forEach(el => el.remove());
			return;
		}
		const container = document.querySelector(".board-container, #nsk-body-left");
		if (!container) return;

		// 1. Checkin top banner (Yellow bar matching Image 1)
		let banner = document.querySelector(".nsmax-board-banner");
		if (!banner) {
			banner = document.createElement("div");
			banner.className = "nsmax-board-banner";
			banner.innerHTML = `
				<div class="nsmax-board-banner-content">
					<span class="nsmax-board-banner-text">今日还未签到，</span>
					<div class="nsmax-board-banner-actions">
						<button type="button" class="nsmax-board-btn nsmax-board-btn-fixed" data-mode="fixed">鸡腿 x 5</button>
						<span class="nsmax-board-sep">/</span>
						<button type="button" class="nsmax-board-btn nsmax-board-btn-random" data-mode="random">试试手气</button>
					</div>
				</div>
			`;
			const firstChild = container.firstElementChild;
			if (firstChild) firstChild.before(banner);
			else container.prepend(banner);

			const doCheckin = async (random) => {
				const btns = banner.querySelectorAll("button");
				btns.forEach(b => { b.disabled = true; b.style.opacity = "0.6"; });
				try {
					const res = await fetch(`/api/attendance?random=${random}`, { method: "POST" });
					const data = await res.json();
					if (data && data.success) {
						banner.querySelector(".nsmax-board-banner-text").textContent = "今日已签到，";
						banner.querySelector(".nsmax-board-banner-actions").innerHTML = `<span class="nsmax-board-badge-done">获得 ${data.gain ?? 5} 鸡腿</span>`;
					} else {
						banner.querySelector(".nsmax-board-banner-text").textContent = (data && data.message) || "今日已签到";
						banner.querySelector(".nsmax-board-banner-actions").innerHTML = `<span class="nsmax-board-badge-done">今日已完成签到</span>`;
					}
				} catch {
					banner.querySelector(".nsmax-board-banner-text").textContent = "已尝试签到";
					banner.querySelector(".nsmax-board-banner-actions").innerHTML = `<span class="nsmax-board-badge-done">请刷新页面查看</span>`;
				}
			};

			banner.querySelector(".nsmax-board-btn-fixed")?.addEventListener("click", () => doCheckin(false));
			banner.querySelector(".nsmax-board-btn-random")?.addEventListener("click", () => doCheckin(true));
		} else if (banner.parentElement !== container) {
			const firstChild = container.firstElementChild;
			if (firstChild && firstChild !== banner) firstChild.before(banner);
			else container.prepend(banner);
		}

		// Check if user already signed in according to page content
		const alreadySigned = Array.from(document.querySelectorAll("body *")).some(el => !el.closest(".nsmax-board-banner") && /^(?:[✓✔]\s*)?(?:今日已完成签到|今日已签到|已签到)/.test(el.textContent?.trim() || ""));
		if (alreadySigned && banner) {
			banner.querySelector(".nsmax-board-banner-text").textContent = "今日已签到，祝您好运！";
			const actions = banner.querySelector(".nsmax-board-banner-actions");
			if (actions && !actions.querySelector(".nsmax-board-badge-done")) {
				actions.innerHTML = `<span class="nsmax-board-badge-done">今日已完成签到</span>`;
			}
		}

		// 2. Leaderboard Title
		const titleEl = Array.from(document.querySelectorAll("h1, h2, h3, .title, strong")).find(el => !el.closest(".nsmax-board-banner") && /今日签到|签到排行榜|鸡腿排行榜/.test(el.textContent));
		if (titleEl) {
			titleEl.classList.add("nsmax-board-title");
			if (!titleEl.querySelector(".nsmax-board-title-text")) {
				titleEl.innerHTML = `<span class="nsmax-board-title-bar">|</span> <span class="nsmax-board-title-text">今日签到鸡腿排行榜</span>`;
			}
		}

		// 3. Leaderboard list / table rows styling & ranks
		const rows = document.querySelectorAll(".board-list > li, table tbody tr, .board-item, .table-row");
		rows.forEach((row, index) => {
			row.classList.add("nsmax-board-row");
			const rank = index + 1;
			row.setAttribute("data-rank", String(rank));
			const rankCol = row.querySelector("td:first-child, .rank, .index, span:first-child");
			if (rankCol && !rankCol.classList.contains("nsmax-board-rank")) {
				rankCol.classList.add("nsmax-board-rank");
			}
			const img = row.querySelector("img");
			if (img) img.classList.add("nsmax-board-avatar");
			const userLink = row.querySelector("a[href^='/space/'], .username a, td a");
			if (userLink) userLink.classList.add("nsmax-board-username");
		});
	}
	// 中文时间：time / .date-created / .date-updated 的文字换成「3 小时前」这类中文相对时间（超过 30 天显示完整日期）。
	// 不需要改时返回 null。页面解析阶段（nsmaxApplyChineseTimes）和「内容增强」模块共用。
	function nsmaxChineseTimeText(el) {
		const old = el.textContent;
		// 能按时间算出来的（几乎所有）直接用；算不出来才去翻译原文里的英文
		const computed = forumTime(el.getAttribute("datetime") || old || "")?.text;
		if (computed) return old !== computed ? computed : null;
		const units = {
			y: "年",
			mo: "月",
			d: "天",
			h: "小时",
			min: "分钟",
			s: "秒"
		};
		const translated = (old || "").replace(/just now/gi, "刚刚").replace(/^edited\s*/i, "编辑于 ").replace(/(\d+)\s*(mo(?:nths?)?|min(?:utes?)?|y(?:ears?)?|d(?:ays?)?|h(?:ours?)?|s(?:econds?)?)\b/gi, (_, n, unit) => `${n}${units[unit.toLowerCase().startsWith("mo") ? "mo" : unit.toLowerCase().startsWith("min") ? "min" : unit[0].toLowerCase()]}`).replace(/\s*ago/gi, "前");
		return old !== translated ? translated : null;
	}
	// 页面解析阶段就把时间改成中文（设置里关掉「中文时间」或「内容增强」时不改）；原文字记在 data-nsmax-time-orig，
	// 模块启动后据此登记还原。parsed 判断元素是否已经完整解析（文字没解析完时先不动）。
	function nsmaxApplyChineseTimes(parsed) {
		if (nsmaxChineseTimeEnabled == null) {
			const all = GM_getValue$1(SETTINGS_KEY, {});
			const reading = all?.["reading-content"];
			nsmaxChineseTimeEnabled = reading?.enabled !== false && reading?.chineseTime !== false;
		}
		if (!nsmaxChineseTimeEnabled) return;
		for (const el of document.querySelectorAll("time:not([data-nsmax-time-orig]), .date-created:not([data-nsmax-time-orig]), .date-updated:not([data-nsmax-time-orig])")) {
			if (el.children.length || el.hasAttribute("data-nsmax-time-done") || parsed && !parsed(el) || nsmaxLateRows && el.closest(nsmaxLateRows)) continue;
			el.setAttribute("data-nsmax-time-done", "");
			const value = nsmaxChineseTimeText(el);
			if (value === null) continue;
			el.setAttribute("data-nsmax-time-orig", el.textContent);
			el.textContent = value;
		}
	}
	var nsmaxChineseTimeEnabled = null;
	// NQ（NodeQuality 测机）的图标
	// 列表工具条：NQ 入口挪到顶栏「精华」后面（见 nsmaxUpdateNavEssence），这里只清掉以前放在工具条上的那个；工具条加「投票」「抽奖」
	function nsmaxEnsureNqEntry(parsed) {
		for (const old of document.querySelectorAll(".post-list-controler > .nsmax-nq-entry")) old.remove();
		nsmaxKindTabs(parsed);
	}
	// 分页：只留首页、末页和当前页前后，中间用省略号；「上一页 / 下一页」写成文字。
	function nsmaxTidyPagers() {
		for (const pager of document.querySelectorAll(".nsk-pager")) {
			const current = Number(pager.querySelector(".pager-cur,[aria-current=page]:not(a)")?.textContent) || 1;
			const pages = Array.from(pager.querySelectorAll(".pager-pos"));
			const number = element => Number(element.textContent.match(/(\d+)\s*$/)?.[1]);
			const confirmedLast = Number(pager.getAttribute("data-nsmax-last-page"));
			const last = confirmedLast > 0 ? confirmedLast : Math.max(...pages.map(number).filter(Number.isFinite));
			let previous;
			const seenPages = new Set();
			for (const page of pages) {
				const n = number(page);
				const keep = n >= 1 && n <= last && !seenPages.has(n) && (n === 1 || n === last || (current <= 2 ? n <= 3 : Math.abs(n - current) <= 1));
				seenPages.add(n);
				page.toggleAttribute("data-nsmax-page-skip", !keep);
				for (const ellipsis of page.querySelectorAll(".ellipsis")) if (!ellipsis.hidden) ellipsis.hidden = true;
				if (keep && previous && n - previous > 1 && !page.previousElementSibling?.matches(".nsmax-pager-ellipsis")) {
					const dots = document.createElement("span"); dots.className = "nsmax-pager-ellipsis"; dots.textContent = "…"; page.before(dots);
				}
				if (keep) previous = n;
			}
			if (confirmedLast > 0) {
				const visible = pages.filter(page => !page.hasAttribute("data-nsmax-page-skip"));
				for (const dots of pager.querySelectorAll(".nsmax-pager-ellipsis")) {
					const after = visible.find(page => dots.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING);
					const before = after && visible[visible.indexOf(after) - 1];
					if (!before || number(after) - number(before) <= 1) dots.remove();
				}
				if (current >= last) for (const link of pager.querySelectorAll("a.pager-next")) {
					link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); link.setAttribute("data-nsmax-pg-off", "");
				}
			}
			// 站点在 .pager-more 里写死的「..」也收掉：脚本插的是「…」，两个并排会连成「..…」
			for (const dots of pager.querySelectorAll(".pager-more > span:not([class])")) if (/^\.{2,}$/.test(dots.textContent.trim())) dots.hidden = true;
			for (const [selector, label] of [["a.pager-next", "下一页"], ["a.pager-prev", "上一页"]]) {
				const link = pager.querySelector(selector);
				if (link && link.textContent !== label) link.textContent = label;
				// 手机像 sb.sb 一样只画箭头，保留读屏和键盘可辨认的翻页名称。
				nsmaxSetAttr(link, "aria-label", label);
			}
		}
	}
	// 帖子页每层的操作（点赞、回复……）和楼号放进同一行
	function nsmaxGroupFloorActions(parsed) {
		for (const item of document.querySelectorAll("ul.comments li.content-item")) {
			if (parsed && !parsed(item)) continue;
			const menu = item.querySelector(":scope > .comment-menu");
			const floor = item.querySelector(":scope > .nsk-content-meta-info > .floor-link-wrapper");
			let actions = item.querySelector(":scope > .nsmax-floor-actions");
			if (!actions && menu && floor) {
				actions = document.createElement("div"); actions.className = "nsmax-floor-actions";
				item.append(actions); actions.append(menu, floor);
			}
			if (!actions) continue;
			// 热评标记放到名字后面（和楼主、等级标签一排）：留在右侧操作区里，有 / 没有热评的楼层操作图标就对不齐
			const hot = actions.querySelector(".hot-badge");
			const author = item.querySelector(":scope > .nsk-content-meta-info .author-info");
			if (hot && author) author.append(hot);
			// 自己楼层的「编辑」就留在操作胶囊里（sb.sb 的编辑也在这一排）。2026-10-23：以前另在时间后面补一个小字「编辑」、
			// 再把胶囊里的藏起来；后来胶囊样式加了权重，藏不住，同一层出现两个「编辑」
			for (const action of actions.querySelectorAll(".menu-item:not([data-nsmax-compact-action])")) {
				const label = action.title || Array.from(action.querySelectorAll("span")).map(span => span.textContent.trim()).find(text => /^(点赞|加鸡腿|反对|收藏|引用|回复|举报|编辑)$/.test(text));
				if (label) { if (!action.title) action.title = label; if (!action.hasAttribute("aria-label")) action.setAttribute("aria-label", label); }
				for (const span of action.querySelectorAll(":scope > span")) {
					const text = span.textContent.trim();
					if (/^[\d.,]+(?:[kKwW万千])?$/.test(text)) span.setAttribute("data-nsmax-action-count", "");
					else span.setAttribute("data-nsmax-action-label", "");
				}
				action.setAttribute("data-nsmax-compact-action", "");
			}
		}
	}
	// 正文图片：一出现就排成最终样子（sb.sb .post-image-link：左对齐、单独一块、小圆角），不等图片下载完。以前要下载完、量过尺寸才换，
	// 图片先按站点自带的「上下 1rem、左右缩进 2.5%」放着，下好后突然往左上跳一截。表情、和文字在同一行的图片不动；
	// 下载完发现其实很小（宽高都不超过 96px，多半是小图标）再退回行内。页面解析阶段就会跑一遍（nsmaxEarlyVisuals）
	var nsmaxClassifiedImages = new WeakSet();
	function nsmaxClassifyPostImages(parsed) {
		for (const image of document.querySelectorAll(".nsk-post article.post-content img, ul.comments article.post-content img")) {
			if (nsmaxClassifiedImages.has(image) || parsed && !parsed(image)) continue;
			nsmaxClassifiedImages.add(image);
			// 图片在后台线程解码（2026-10-20）：几 MB 的截图滚进屏幕时不再占着主线程解码、把滚动卡一下
			if (!image.hasAttribute("decoding")) image.decoding = "async";
			const parent = image.parentElement;
			const emoji = /emoji|smoji|expression|emoticon|yct\d|xhj\d|表情/i.test(image.className + " " + image.alt + " " + image.src);
			// 投票里的投票人头像、指向个人主页的小头像不是正文配图（以前被当成大图，每个头像单独占一行，一个投票拉得两三千像素高）
			if (emoji || image.closest(".vote-panel") || parent?.matches('a[href*="/space/"]')) continue;
			if (!parent?.matches("p, a") || parent.textContent.trim()) continue;
			const paragraph = image.closest("p");
			const mark = (on) => {
				image.classList.toggle("nsmax-post-image", on);
				if (parent.tagName === "A") {
					parent.classList.toggle("post-image-link", on);
					parent.classList.toggle("post-image-break", on);
				}
				paragraph?.classList.toggle("nsmax-image-paragraph", on);
			};
			mark(true);
			const check = () => {
				if (image.naturalWidth && image.naturalWidth <= 96 && image.naturalHeight <= 96) mark(false);
			};
			if (image.complete) check();
			else image.addEventListener("load", check, { once: true });
		}
	}
	// 帖子页经典布局（sb.sb 帖子页默认的 .post-dz，用户 2026-10-17 图七）：每层左边一栏作者——88px 头像、名字、UID、等级和
	// 帖子 / 鸡腿 / 星辰。不放 sb.sb 的勋章、头衔、宠物（NodeSeek 没有）。头像、名字、UID 用楼层里现成的；等级和三个数字要读
	// /api/account/getInfo。「简洁模式」（html[data-nsmax-post-layout=simple]）是以前的紧凑排法：作者栏由 CSS 收起，切换时不改 DOM。
	// 2026-10-19 进帖子不再「卡一下」：以前作者栏先只有头像和名字，出现在屏幕上才去读资料，读到后再插进等级和三格数字，作者栏一下
	// 变高，下面的楼层整个往下跳（真站上晚半秒到一秒）。现在等级和三格一建作者栏就放好（先用本机记下的资料，没有就是「—」），
	// 页面一解析出楼层就开始读，读到后只换字；读过的人记在本机（localStorage，最多 600 人），再进帖子直接是完整的
	var NSMAX_MEMBER_TTL = 6e5;
	var NSMAX_MEMBERS_KEY = "nsmax:members";
	var nsmaxMemberStore;
	function nsmaxMembers() {
		if (nsmaxMemberStore) return nsmaxMemberStore;
		nsmaxMemberStore = new Map();
		try {
			for (const [id, value] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_MEMBERS_KEY) || "{}"))) if (value && typeof value === "object" && Number.isFinite(value.at)) nsmaxMemberStore.set(id, value);
		} catch {}
		return nsmaxMemberStore;
	}
	var nsmaxMembersSaving = 0;
	function nsmaxRememberMember(id, detail) {
		const map = nsmaxMembers();
		map.delete(id);
		map.set(id, { at: Date.now(), ...detail });
		while (map.size > 600) map.delete(map.keys().next().value);
		// 一页十几个人：合在一起写一次
		if (!nsmaxMembersSaving) nsmaxMembersSaving = setTimeout(() => {
			nsmaxMembersSaving = 0;
			try { localStorage.setItem(NSMAX_MEMBERS_KEY, JSON.stringify(Object.fromEntries(nsmaxMembers()))); } catch {}
		}, 500);
	}
	var nsmaxMemberCache = new Map();
	function nsmaxMemberInfo(id, request) {
		const key = String(id);
		const hit = nsmaxMemberCache.get(key);
		if (hit && Date.now() - hit.at < NSMAX_MEMBER_TTL) return hit.promise;
		const stored = nsmaxMembers().get(key);
		if (stored && Date.now() - stored.at < NSMAX_MEMBER_TTL) {
			const promise = Promise.resolve(stored);
			nsmaxMemberCache.set(key, { at: stored.at, promise });
			return promise;
		}
		const at = Date.now();
		const promise = request("/api/account/getInfo/" + key).then((data) => {
			const detail = data?.detail || data?.data;
			if (!detail || typeof detail !== "object") throw new Error("资料读取失败");
			const kept = { rank: detail.rank, coin: detail.coin, stardust: detail.stardust, nPost: detail.nPost, nComment: detail.nComment };
			nsmaxRememberMember(key, kept);
			return kept;
		});
		promise.catch(() => nsmaxMemberCache.delete(key));
		nsmaxMemberCache.set(key, { at, promise });
		return promise;
	}
	// 页面还在解析、功能模块还没启动时就读作者资料用的请求：同时最多 4 个；站点正在限流（脚本记下的冷却时间没过）时不读，
	// 留给模块启动后的 nsmaxLoadAuthorStats 走带冷却、重试的请求队列。priority：后台提前准备的（悬停、首屏以外）用 "low"，
	// 不和页面自己的请求、点开链接抢网速
	var nsmaxEarlyFetchQueue = [];
	var nsmaxEarlyFetchActive = 0;
	function nsmaxEarlyJson(url, priority = "auto") {
		try {
			if (nsmaxLocalGet(COOLDOWN_KEY(), 0) > Date.now()) return Promise.reject(new Error("站点限流中"));
		} catch {}
		if (priority === "low" && nsmaxBackgroundPaused()) return Promise.reject(nsmaxRateLimitedError());
		return new Promise((resolve, reject) => {
			const run = () => {
				nsmaxEarlyFetchActive++;
				fetch(url, { credentials: "same-origin", headers: { accept: "application/json" }, priority }).then((response) => {
					if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
					return response.json();
				}).then(resolve, reject).finally(() => {
					nsmaxEarlyFetchActive--;
					nsmaxEarlyFetchQueue.shift()?.();
				});
			};
			if (nsmaxEarlyFetchActive < 4) run();
			else nsmaxEarlyFetchQueue.push(run);
		});
	}
	// 点开帖子之前先把东西备好（2026-10-20）：鼠标停在帖子标题上时「帖子卡片预览」本来就要取这篇帖子，取到后顺手——
	// 1. 正文前几张图（主帖 3 张、前两层回复各 1 张）：先连上图床（第一次连一个图床要多花 0.2～0.4 秒），在后台下好，点开时直接出来；
	// 2. 主帖和前几层回复的作者资料（等级、帖子 / 鸡腿 / 星辰）：读好记在本机，点开时作者栏第一帧就是完整的，不再「闪一下才出现」。
	// 都是低优先级请求，同一篇只准备一次；省流量模式下不做。帖子网页本身同一篇只取一次（以前预览一篇要取两遍）。
	// priority：预览卡要马上显示的那篇用 "auto"（2026-10-20：以前也是 "low"，页面上图片多时卡片要排在图片后面）
	var nsmaxPostHtmlCache = new Map();
	function nsmaxPostHtml(request, href, priority = "low", options = {}) {
		const key = String(href).replace(/#.*$/, "");
		const hit = nsmaxPostHtmlCache.get(key);
		if (hit && Date.now() - hit.at < 3e5) return hit.promise;
		// options 透传给 request：悬停预览用 { until: "</article>" }，读到主帖就停，后面的回复不用下
		const entry = { at: Date.now(), promise: request(key, { responseType: "text", priority, ...options }) };
		nsmaxPostHtmlCache.set(key, entry);
		entry.promise.catch(() => {
			if (nsmaxPostHtmlCache.get(key) === entry) nsmaxPostHtmlCache.delete(key);
		});
		// 抽奖帖识别也用这份（见 nsmaxCheckSpecialPost），留 40 篇：查一页抽奖帖时不把悬停预览刚取的挤掉太多
		while (nsmaxPostHtmlCache.size > 40) nsmaxPostHtmlCache.delete(nsmaxPostHtmlCache.keys().next().value);
		return entry.promise;
	}
	var nsmaxWarmedPosts = new Set();
	var nsmaxWarmImages = [];
	var nsmaxPreconnected = new Set();
	function nsmaxPreconnect(origin) {
		if (!origin || origin === location.origin || nsmaxPreconnected.has(origin) || nsmaxPreconnected.size >= 30) return;
		nsmaxPreconnected.add(origin);
		const link = document.createElement("link");
		link.rel = "preconnect";
		link.href = origin;
		(document.head || document.documentElement).append(link);
	}
	function nsmaxWarmImage(src, base, priority = "low") {
		let url;
		try { url = new URL(src, base); } catch { return; }
		if (!/^https?:$/.test(url.protocol)) return;
		nsmaxPreconnect(url.origin);
		if (nsmaxWarmImages.some((image) => image.src === url.href)) return;
		const image = new Image();
		image.decoding = "async";
		image.fetchPriority = priority;
		image.src = url.href;
		nsmaxWarmImages.push(image);
		if (nsmaxWarmImages.length > 40) nsmaxWarmImages.shift();
	}
	// doc：DOMParser 解析好的帖子页。priority：悬停预览用 "high"（图片早点出来），点开前预热用默认的 "low"
	function nsmaxWarmPost(href, doc, priority = "low") {
		const key = String(href).replace(/#.*$/, "");
		if (!doc || nsmaxWarmedPosts.has(key) || navigator.connection?.saveData) return;
		nsmaxWarmedPosts.add(key);
		const op = doc.querySelector(".nsk-post article.post-content");
		for (const image of Array.from(op?.querySelectorAll("img:not(.sticker)") || []).slice(0, 3)) nsmaxWarmImage(image.getAttribute("src"), key, priority);
		for (const article of Array.from(doc.querySelectorAll("ul.comments > li.content-item > article.post-content")).slice(0, 2)) {
			const image = article.querySelector("img:not(.sticker)");
			if (image) nsmaxWarmImage(image.getAttribute("src"), key);
		}
		nsmaxWarmAuthors(doc, 6);
	}
	// 一页楼层（当前页面，或者取来的另一页）前 limit 位作者里，本机没记下或者超过 10 分钟的，低优先级读好
	function nsmaxWarmAuthors(doc, limit) {
		if (navigator.connection?.saveData) return;
		const ids = [];
		for (const link of doc.querySelectorAll(".nsk-post > .content-item > .nsk-content-meta-info .author-info > a[href*='/space/'], ul.comments > li.content-item > .nsk-content-meta-info .author-info > a[href*='/space/']")) {
			const id = link.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1];
			if (id && !ids.includes(id)) ids.push(id);
			if (ids.length >= limit) break;
		}
		for (const id of ids) {
			// 头像也先下好（作者栏的 88px 头像点开时直接出来）
			nsmaxWarmImage(`/avatar/${id}.png`, location.href);
			const stored = nsmaxMembers().get(id);
			if (stored && Date.now() - stored.at < NSMAX_MEMBER_TTL) continue;
			nsmaxMemberInfo(id, (url) => nsmaxEarlyJson(url, "low")).catch(() => {});
		}
	}
	function nsmaxPostLayout() {
		try { return localStorage.getItem("nsmax:post-layout") === "simple" ? "simple" : "classic"; } catch { return "classic"; }
	}
	// 每层（主帖和回复，楼中楼不算）前面放一栏作者；名字或作者变了（站点重新渲染）就重做，否则不动 DOM
	function nsmaxBuildAuthorColumns(parsed) {
		if (!/^\/post-\d+/.test(location.pathname)) return;
		for (const floor of document.querySelectorAll("#nsk-body-left .nsk-post > .content-item, #nsk-body-left ul.comments > li.content-item")) {
			if (parsed && !parsed(floor)) continue;
			const name = floor.querySelector(":scope > .nsk-content-meta-info .author-info > a[href*='/space/']");
			const id = name?.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1];
			if (!id) continue;
			const label = name.textContent.trim();
			let column = floor.querySelector(":scope > .nsmax-author-col");
			if (column && column.dataset.nsmaxUid === id && column.dataset.nsmaxName === label) continue;
			column?.remove();
			column = document.createElement("aside");
			column.className = "nsmax-author-col";
			column.dataset.nsmaxUid = id;
			column.dataset.nsmaxName = label;
			const avatar = document.createElement("a");
			avatar.className = "nsmax-author-avatar";
			avatar.href = "/space/" + id;
			avatar.tabIndex = -1;
			avatar.setAttribute("aria-hidden", "true");
			const image = document.createElement("img");
			image.src = floor.querySelector(":scope > .nsk-content-meta-info .avatar-wrapper img")?.getAttribute("src") || "/avatar/" + id + ".png";
			image.alt = "";
			image.decoding = "async";
			avatar.append(image);
			const who = document.createElement("div");
			who.className = "nsmax-author-who";
			const link = document.createElement("a");
			link.className = "nsmax-author-name";
			link.href = "/space/" + id;
			link.textContent = label;
			const uid = document.createElement("span");
			uid.className = "nsmax-author-uid";
			uid.textContent = "UID " + id;
			// 等级徽章和三格数字先放好、占好位置（等级没读到时看不见，数字是「—」），读到资料只换字
			const level = document.createElement("span");
			level.className = "nsmax-author-level";
			level.setAttribute("data-nsmax-pending", "");
			// 先按 Lv.1 的样子排（徽章的字号、内边距跟着 data-nsmax-level 走），读到真实等级只换字和颜色，大小不变
			nsmaxApplyLevel(level, 1);
			const stats = document.createElement("div");
			stats.className = "nsmax-author-stats";
			stats.setAttribute("data-nsmax-pending", "");
			for (const [text, href, title] of [["帖子", `/space/${id}#/discussions`, "主题和评论加起来，点开看 TA 的主题"], ["鸡腿", `/space/${id}`, "鸡腿"], ["星辰", `/space/${id}`, "星辰"]]) {
				const cell = document.createElement("a");
				cell.href = href;
				cell.title = title;
				const b = document.createElement("b");
				b.textContent = "—";
				const span = document.createElement("span");
				span.textContent = text;
				cell.append(b, span);
				stats.append(cell);
			}
			who.append(link, uid, level, stats);
			column.append(avatar, who);
			floor.prepend(column);
			nsmaxPrefetchAuthor(column);
		}
	}
	// 作者栏一建好：本机记下过这个人就先填上（10 分钟内读过的算准的，不再读）；没记下或者旧了，首屏那几层（主帖和前 4 层回复）
	// 马上去读，读到后换字；再往下的等页面解析完、空下来以后低优先级读（2026-10-20：以前等滚到附近才读，滚得快时徽章晚一步才出来）
	var nsmaxAuthorPrefetched = 0;
	var nsmaxAuthorLater = null;
	function nsmaxPrefetchAuthor(column) {
		const id = column.dataset.nsmaxUid;
		const stored = nsmaxMembers().get(id);
		if (stored) nsmaxFillAuthor(column, stored, Date.now() - stored.at >= NSMAX_MEMBER_TTL);
		if (column.hasAttribute("data-nsmax-filled") || document.documentElement.dataset.nsmaxPostLayout === "simple") return;
		if (!nsmaxMemberCache.has(id)) {
			if (nsmaxAuthorPrefetched >= 5) {
				(nsmaxAuthorLater ||= nsmaxScheduleLaterAuthors()).add(column);
				return;
			}
			nsmaxAuthorPrefetched++;
		}
		nsmaxMemberInfo(id, nsmaxEarlyJson).then((detail) => nsmaxFillAuthor(column, detail)).catch(() => {});
	}
	function nsmaxScheduleLaterAuthors() {
		const columns = new Set();
		const run = () => {
			nsmaxAuthorLater = null;
			for (const column of columns) {
				if (!column.isConnected || column.hasAttribute("data-nsmax-filled")) continue;
				nsmaxMemberInfo(column.dataset.nsmaxUid, (url) => nsmaxEarlyJson(url, "low")).then((detail) => nsmaxFillAuthor(column, detail)).catch(() => {});
			}
		};
		// 页面解析完、站点脚本跑完以后，停 0.6 秒、主线程空下来就读。不等 load（2026-10-20）：load 要等所有图片下完，
		// 图床慢的帖子要多等好几秒；这些请求是低优先级，不和图片抢
		const idle = () => setTimeout(() => typeof requestIdleCallback === "function" ? requestIdleCallback(run, { timeout: 1500 }) : run(), 600);
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", idle, { once: true });
		else idle();
		return columns;
	}
	// 作者栏出现在屏幕上时再读资料：等级徽章 + 帖子（主题 + 评论）/ 鸡腿 / 星辰
	var nsmaxAuthorWatched = new WeakSet();
	var nsmaxAuthorObserver;
	function nsmaxLoadAuthorStats(ctx) {
		if (!/^\/post-\d+/.test(location.pathname) || typeof IntersectionObserver !== "function") return;
		nsmaxAuthorObserver ||= new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const column = entry.target;
				nsmaxAuthorObserver.unobserve(column);
				if (document.documentElement.dataset.nsmaxPostLayout === "simple") {
					nsmaxAuthorWatched.delete(column);
					continue;
				}
				nsmaxMemberInfo(column.dataset.nsmaxUid, ctx.request).then((detail) => nsmaxFillAuthor(column, detail)).catch(() => {});
			}
			// 提前一屏多就读：滚到那一层时数字已经在了
		}, { rootMargin: "900px 0px" });
		for (const column of document.querySelectorAll("#nsk-body-left .nsmax-author-col:not([data-nsmax-filled])")) {
			if (nsmaxAuthorWatched.has(column)) continue;
			nsmaxAuthorWatched.add(column);
			nsmaxAuthorObserver.observe(column);
		}
	}
	// 把资料填进作者栏里已经放好的等级徽章和三格（nsmaxBuildAuthorColumns）：只改字和等级属性，不加删元素，作者栏高度不变。
	// stale：本机记下的旧资料，先填上，之后读到新的再换（不标「已填好」）
	function nsmaxFillAuthor(column, detail, stale = false) {
		if (!column.isConnected || column.hasAttribute("data-nsmax-filled") || !detail) return;
		const who = column.querySelector(".nsmax-author-who");
		if (!who) return;
		const number = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
		const level = number(detail.rank);
		const badge = who.querySelector(":scope > .nsmax-author-level");
		if (badge && level !== null && level >= 0) {
			nsmaxApplyLevel(badge, level);
			nsmaxDropAttr(badge, "data-nsmax-pending");
		}
		const posts = number(detail.nPost), comments = number(detail.nComment);
		const values = [posts === null && comments === null ? null : (posts || 0) + (comments || 0), number(detail.coin), number(detail.stardust)];
		const stats = who.querySelector(":scope > .nsmax-author-stats");
		if (stats && values.some((value) => value !== null)) nsmaxDropAttr(stats, "data-nsmax-pending");
		who.querySelectorAll(":scope > .nsmax-author-stats > a > b").forEach((b, index) => {
			const value = values[index];
			nsmaxSetText(b, value === null || value === undefined ? "—" : value >= 1e5 ? (value / 1e4).toFixed(value >= 1e6 ? 0 : 1) + "万" : String(value));
		});
		if (!stale) column.setAttribute("data-nsmax-filled", "");
	}
	// 楼中楼（sb.sb .floor-box，图五）：回复某一层的楼层（第一段以「@某某 #楼号」开头、楼号是本页更早的一层）挪进那一层（多轮对话都挂在
	// 最外层，只有一级）末尾的一个次底色圆角框里；框底「共 N 条回复」+「我也说一句」。挪的是站点原来的楼层节点，操作、锚点、草稿都还在。
	// 页面解析阶段就整理（解析到哪层整理到哪层），首屏不会先平铺再收进框里
	var nsmaxNestedMoved = new WeakSet();
	function nsmaxCreateFloorBox(rootFloor) {
		const box = document.createElement("div");
		box.className = "nsmax-floor-box";
		const replies = document.createElement("ul");
		replies.className = "nsmax-nested-replies";
		replies.setAttribute("aria-label", "楼中楼回复");
		const foot = document.createElement("div");
		foot.className = "nsmax-fb-foot";
		const count = document.createElement("span");
		count.className = "nsmax-fb-count";
		const say = document.createElement("button");
		say.type = "button";
		say.className = "nsmax-fb-say";
		say.textContent = "我也说一句";
		// 「我也说一句」就是回复这一层：点外层楼层自己的「回复」（站点填「@层主 #楼号」，回复框挪到这里）
		say.addEventListener("click", () => rootFloor.querySelector(":scope > .nsmax-floor-actions .menu-item[title='回复'], :scope > .comment-menu .menu-item[title='回复']")?.click());
		foot.append(count, say);
		box.append(replies, foot);
		return box;
	}
	// 每一层第一次出现时在页面上的先后（站点把热评排在最前面）：简洁模式下把楼中楼摊平回去时按这个顺序排（见 nsmaxFlattenNestedReplies）
	var nsmaxFloorOrder = new WeakMap();
	var nsmaxFloorSeq = 0;
	function nsmaxGroupNestedReplies(parsed) {
		if (!/^\/post-\d+/.test(location.pathname)) return;
		const list = document.querySelector("#nsk-body-left ul.comments");
		if (!list) return;
		for (const item of list.children) if (!nsmaxFloorOrder.has(item) && item.matches("li.content-item[id]")) nsmaxFloorOrder.set(item, nsmaxFloorSeq++);
		// 简洁模式照 sb.sb：没有楼中楼，一层一层按顺序排（2026-10-24；以前简洁模式里楼中楼照样收在框里）
		if (document.documentElement.dataset.nsmaxPostLayout === "simple") {
			nsmaxFlattenNestedReplies(list);
			return;
		}
		const floors = new Map(Array.from(list.querySelectorAll("li.content-item[id]"), (item) => [item.id, item]));
		const post = location.pathname.match(/^\/post-(\d+)-/)?.[1];
		// 按楼号从小到大处理：站点把热评排在评论最前面，热评又常常是楼中楼回复。按页面顺序处理时，回复会比它回复的那一层先被收起来，
		// 那一层后来再被收进别的框，就一层套一层（2026-10-19 真站 post-893437：#1 > #40 > #42 > #43，里面几层被挤成 0～130px 宽）
		const order = Array.from(floors).sort((a, b) => Number(a[0]) - Number(b[0]));
		for (const [id, item] of order) {
			if (nsmaxNestedMoved.has(item) || parsed && !parsed(item)) continue;
			const paragraph = item.querySelector(":scope > article.post-content > p:first-child");
			// 简洁模式下摊平过的回复：开头还留着楼中楼那一行的「名字：」（见 nsmaxDecorateFloorBoxes），判断、找楼号时跳过它
			const who = paragraph?.querySelector(":scope > .nsmax-fb-who");
			if (!paragraph || !/^\s*@/.test(who ? paragraph.textContent.slice(paragraph.textContent.indexOf(who.textContent) + who.textContent.length) : paragraph.textContent)) continue;
			const link = Array.from(paragraph.querySelectorAll("a[href]")).find((anchor) => {
				if (who?.contains(anchor)) return false;
				try { const url = new URL(anchor.href, location.href); return url.origin === location.origin && /^\/post-\d+-\d+$/.test(url.pathname) && /^#\d+$/.test(url.hash); } catch { return false; }
			});
			if (!link) continue;
			const url = new URL(link.href, location.href);
			const parentId = url.hash.slice(1);
			if (!url.pathname.startsWith("/post-" + post + "-") || Number(parentId) >= Number(id)) continue;
			const parent = floors.get(parentId);
			if (!parent || parent === item || item.contains(parent)) continue;
			// 多轮回复都平铺在最外层楼层下（只有一级），不会一层层缩进成很窄的一条
			let rootFloor = parent;
			while (rootFloor.parentElement && rootFloor.parentElement !== list) {
				const ancestor = rootFloor.parentElement.closest("li.content-item");
				if (!ancestor) break;
				rootFloor = ancestor;
			}
			if (rootFloor === item || item.contains(rootFloor)) continue;
			let box = rootFloor.querySelector(":scope > .nsmax-floor-box");
			if (!box) {
				box = nsmaxCreateFloorBox(rootFloor);
				// 回复框正挂在这一层下面时，框放在回复框前面
				const inline = rootFloor.querySelector(":scope > [data-nsmax-inline]");
				if (inline) inline.before(box);
				else rootFloor.append(box);
			}
			const nested = box.querySelector(":scope > .nsmax-nested-replies");
			nsmaxNestInto(nested, item);
			// 这一层以前当过外层（它回复的那层当时还没加载出来）：自己的楼中楼框里的回复摊平到外层框里，外层才有的作者栏去掉
			const own = item.querySelector(":scope > .nsmax-floor-box");
			if (own) {
				for (const reply of own.querySelectorAll(":scope > .nsmax-nested-replies > li.content-item")) nsmaxNestInto(nested, reply);
				own.remove();
			}
			item.querySelector(":scope > .nsmax-author-col")?.remove();
			nsmaxNestedMoved.add(item);
		}
	}
	// 简洁模式：楼中楼框里的回复摊平回一层一层（按第一次出现时的先后，热评还在最前面），框去掉；只在有框时动 DOM。
	// 摊平的回复正文里留着楼中楼那一行的「名字：」（样式里不在框里时不显示），换回默认排法时 nsmaxGroupNestedReplies 再收进去
	function nsmaxFlattenNestedReplies(list) {
		const boxes = list.querySelectorAll(":scope > li.content-item > .nsmax-floor-box");
		if (!boxes.length) return;
		const nested = Array.from(list.querySelectorAll(":scope > li.content-item > .nsmax-floor-box > .nsmax-nested-replies > li.content-item"));
		for (const item of nested) nsmaxNestedMoved.delete(item);
		const rank = (item) => nsmaxFloorOrder.has(item) ? nsmaxFloorOrder.get(item) : Infinity;
		const floors = Array.from(list.children).filter((item) => item.matches("li.content-item[id]")).concat(nested).sort((a, b) => rank(a) - rank(b) || Number(a.id) - Number(b.id));
		let prev = null;
		for (const item of floors) {
			if (prev) {
				if (prev.nextElementSibling !== item) prev.after(item);
			} else if (item.parentElement !== list) list.prepend(item);
			prev = item;
		}
		for (const box of boxes) box.remove();
	}
	// 楼中楼按楼号排（sb.sb 楼中楼按时间先后）：插在第一条楼号比它大的前面
	function nsmaxNestInto(nested, item) {
		const after = Array.from(nested.children).find((other) => other !== item && Number(other.id) > Number(item.id));
		if (after) {
			if (after.previousElementSibling !== item) after.before(item);
		} else if (nested.lastElementChild !== item) nested.append(item);
	}
	// 楼中楼每一条：sb.sb .floor-box-item——「名字 回复 某某：内容」一行（回复的就是层主时只写「名字：内容」），开头站点自带的
	// 「@某某 #楼号」两个链接藏起来；框底的条数跟着更新。只在没整理过时写 DOM
	function nsmaxDecorateFloorBoxes() {
		for (const box of document.querySelectorAll("#nsk-body-left .nsmax-floor-box")) {
			const items = box.querySelectorAll(":scope > .nsmax-nested-replies > li.content-item");
			nsmaxSetText(box.querySelector(":scope > .nsmax-fb-foot > .nsmax-fb-count"), `共 ${items.length} 条回复`);
			const rootFloor = box.closest("li.content-item");
			for (const item of items) {
				const article = item.querySelector(":scope > article.post-content");
				if (!article) continue;
				const done = article.querySelector(":scope > .nsmax-fb-who, :scope > p > .nsmax-fb-who");
				if (done) {
					// 整理过、后来又被摊平到另一个外层的框里：「回复 某某」跟着新的外层重新判断（回复的就是层主时不写）
					const leads = article.querySelectorAll("a[data-nsmax-fb-lead]");
					const parentId = leads[1]?.getAttribute("href")?.match(/#(\d+)$/)?.[1];
					const to = done.querySelector(":scope > .nsmax-fb-to");
					if (parentId && parentId !== rootFloor?.id && !to) {
						const word = document.createElement("span");
						word.className = "nsmax-fb-to";
						word.textContent = "回复";
						const target = document.createElement("a");
						target.className = "nsmax-fb-target";
						target.href = "#" + parentId;
						target.textContent = leads[0].textContent.trim().replace(/^@/, "");
						done.querySelector(":scope > .nsmax-fb-colon")?.before(word, target);
					} else if (to && (!parentId || parentId === rootFloor?.id)) {
						if (to.nextElementSibling?.matches(".nsmax-fb-target")) to.nextElementSibling.remove();
						to.remove();
					}
					continue;
				}
				const name = item.querySelector(":scope > .nsk-content-meta-info .author-info > a.author-name, :scope > .nsk-content-meta-info .author-info > a[href*='/space/']");
				if (!name) continue;
				const first = article.firstElementChild;
				let host = first?.matches("p") ? first : article;
				const lead = host.firstElementChild?.matches("a") && /^@/.test(host.firstElementChild.textContent.trim()) && !host.firstElementChild.previousSibling?.textContent.trim() ? host.firstElementChild : null;
				const floorLink = lead?.nextElementSibling?.matches("a") && /^#\d+$/.test(lead.nextElementSibling.textContent.trim()) ? lead.nextElementSibling : null;
				const parentId = floorLink?.getAttribute("href")?.match(/#(\d+)$/)?.[1];
				const who = document.createElement("span");
				who.className = "nsmax-fb-who";
				const self = document.createElement("a");
				self.className = "nsmax-fb-name";
				self.href = name.getAttribute("href") || "#";
				self.textContent = name.textContent.trim();
				who.append(self);
				// 楼主自己的回复：名字后面一个「楼主」小标签（sb.sb .post-user-group--op）。2026-10-23：以前楼中楼里名字那一行整个收起，楼主标签跟着没了
				if (item.querySelector(":scope > .nsk-content-meta-info .author-info > .is-poster")) {
					const op = document.createElement("span");
					op.className = "nsmax-fb-op";
					op.textContent = "楼主";
					who.append(op);
				}
				if (lead && floorLink && parentId && parentId !== rootFloor?.id) {
					const to = document.createElement("span");
					to.className = "nsmax-fb-to";
					to.textContent = "回复";
					const target = document.createElement("a");
					target.className = "nsmax-fb-target";
					target.href = "#" + parentId;
					target.textContent = lead.textContent.trim().replace(/^@/, "");
					who.append(to, target);
				}
				const colon = document.createElement("span");
				colon.className = "nsmax-fb-colon";
				colon.textContent = "：";
				who.append(colon);
				if (lead && floorLink) {
					lead.setAttribute("data-nsmax-fb-lead", "");
					floorLink.setAttribute("data-nsmax-fb-lead", "");
					// 两个链接之间、后面紧跟的空白去掉：冒号后面直接接内容
					for (const node of [lead.nextSibling, floorLink.nextSibling]) if (node?.nodeType === 3 && /^\s/.test(node.data)) node.data = node.data.replace(/^\s+/, "");
					// 「@某某 #楼号」后面换了行（站点把回车写成 <br>，以前内容因此掉到名字下面一行）：这个换行也藏起来
					let next = floorLink.nextSibling;
					while (next?.nodeType === 3 && !next.data.trim()) next = next.nextSibling;
					if (next?.nodeName === "BR") {
						next.setAttribute("data-nsmax-fb-lead", "");
						if (next.nextSibling?.nodeType === 3) next.nextSibling.data = next.nextSibling.data.replace(/^\s+/, "");
					}
					// 「@某某 #楼号」单独一段、内容在下一段：名字接到下一段前面，这一段收起
					if (host !== article && !Array.from(host.childNodes).some((node) => node !== lead && node !== floorLink && node.nodeName !== "BR" && !(node.nodeType === 3 && !node.data.trim())) && host.nextElementSibling?.matches("p")) {
						host.setAttribute("data-nsmax-fb-lead", "");
						host = host.nextElementSibling;
					}
				}
				host.prepend(who);
			}
		}
	}
	// 置顶的回复（楼主置顶的那一层，站点排在评论最前面）：站点在楼号前放一个绿色圆底、带阴影的图钉（.pined-comment-badge），
	// 和主题哪里都不搭。换成和列表「置顶」一样的小标，放在头部「楼主」标签那一排；图钉由主题 CSS 藏起来（2026-10-18）
	function nsmaxMarkPinnedReplies() {
		for (const tag of document.querySelectorAll("#nsk-body-left li.content-item .nsmax-pin-tag")) {
			const row = tag.closest("li.content-item");
			if (!Array.from(row.querySelectorAll(".pined-comment-badge")).some(badge => badge.closest("li.content-item") === row)) tag.remove();
		}
		for (const badge of document.querySelectorAll("#nsk-body-left li.content-item .pined-comment-badge")) {
			const info = badge.closest("li.content-item")?.querySelector(":scope > .nsk-content-meta-info .author-info");
			if (!info || info.querySelector(":scope > .nsmax-pin-tag")) continue;
			const tag = document.createElement("span");
			tag.className = "nsmax-pin-tag";
			tag.textContent = "置顶";
			info.append(tag);
		}
	}
	// 右栏里站点留下的空 div（发帖按钮挪进资料卡后剩下的那个，还有最后的空占位）：右栏按 20px 间距排，空 div 也占一份，
	// 资料卡和今日热门之间就成了 40px（别的卡片之间 20px）。收起来，卡片之间一样宽（2026-10-18）
	function nsmaxTidySidebar() {
		const sidebar = document.getElementById("nsk-right-panel-container");
		if (!sidebar) return;
		for (const child of sidebar.children) {
			if (child.tagName !== "DIV" || child.id || child.className) continue;
			nsmaxFlag(child, "data-nsmax-empty", !child.children.length && !child.textContent.trim());
		}
	}
	// 回复某一层时回复框挪到那一层下面（sb.sb floorComposer，图六）：点楼层或楼中楼的「回复」「引用」、楼中楼的「我也说一句」时，
	// 先把整个编辑器（站点的 #editor）挪到那一层（楼中楼就是它所在的外层）的末尾，站点自己的 reply() 接着填「@某某 #楼号」并滚到编辑器；
	// 提交按钮写「回复层主」，旁边「取消回复」把编辑器放回页面底部（只有「@某某 #楼号」没写别的时一起清掉）。
	// 编辑自己的楼层、主帖的回复 / 直达底部之前也先放回去。手机上有悬浮回复框（floating-reply），这里不挪
	var NSMAX_MENTION_ONLY = /^\s*(?:@\S+(?:\s+(?:#\d+|\[#\d+\]\([^)\s]*\)))?\s*)+$/;
	var NSMAX_FLOOR_MENTION = /(?:^|\s)@\S+\s+(?:#\d+(?!\d)|\[#\d+\]\()/;
	var nsmaxComposer = null;
	// 提交按钮上的字（2026-10-18 第七批）：没 @ 人是「回复楼主」；回复框挂在某一层下面时，@ 的是层主写「回复层主」，
	// @ 的是楼中楼里别的人写「回复 某某」（以前一律写「回复层主」，回复楼中楼里的人也这么写）
	function nsmaxReplyLabel(editor) {
		const match = nsmaxEditorValue(editor).match(/(?:^|\s)@(\S+)\s+(?:#\d+(?!\d)|\[#\d+\]\()/);
		if (!match) return "回复楼主";
		const floor = editor.closest("li.content-item");
		const host = floor?.querySelector(".author-name")?.textContent.trim();
		const name = match[1];
		if (!floor || !host || host === name) return "回复层主";
		return `回复 ${name.length > 10 ? name.slice(0, 10) + "…" : name}`;
	}
	function nsmaxEditorValue(root) {
		const cm = root?.querySelector(".CodeMirror")?.CodeMirror;
		if (cm) return cm.getValue();
		return root?.querySelector("textarea:not(.CodeMirror textarea)")?.value || "";
	}
	function nsmaxSetEditorValue(root, value) {
		const cm = root?.querySelector(".CodeMirror")?.CodeMirror;
		if (cm) {
			cm.setValue(value);
			cm.refresh();
			return;
		}
		const input = root?.querySelector("textarea:not(.CodeMirror textarea)");
		if (!input) return;
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}
	function nsmaxSetupComposer(ctx) {
		if (nsmaxComposer?.host.isConnected || !/^\/post-\d+/.test(location.pathname)) return nsmaxComposer;
		const md = document.querySelector("#nsk-body-left .md-editor");
		if (!md) return null;
		const host = md.closest("#editor") || md;
		const home = document.createComment("nsmax-editor-home");
		host.before(home);
		// 站点的 reply() / quote() 填好「@某某 #楼号」后调用不带参数的 rootEl.scrollIntoView()：默认把编辑器顶端对齐到窗口顶端，
		// 编辑器明明就在眼前，整页也会突然往下滑一截（2026-10-18 图四）。不带参数的这一下改成：整个看得见就不滚，
		// 看不全再平滑滚到刚好看全。带参数的调用（脚本自己的「直达底部」等）照常
		md.scrollIntoView = function (...args) {
			if (args.length) return Element.prototype.scrollIntoView.apply(this, args);
			const rect = this.getBoundingClientRect();
			const viewport = nsmaxTouchLayout() ? window.visualViewport : null;
			const offset = viewport?.offsetTop || 0, bottom = offset + (viewport?.height || innerHeight);
			const top = offset + (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
			if (rect.top >= top && rect.bottom <= bottom) return;
			Element.prototype.scrollIntoView.call(this, { block: rect.height > bottom - top ? "start" : "nearest", behavior: nsmaxTouchLayout() ? "auto" : "smooth" });
		};
		const floating = window.matchMedia("(max-width: 700px), (hover: none)");
		let cancel = null;
		const ensureCancel = () => {
			if (cancel?.isConnected) return cancel;
			const submit = md.querySelector(":is(.topic-select, .submit-row) > :is(button.submit, button[type='submit'])");
			if (!submit) return null;
			cancel = document.createElement("button");
			cancel.type = "button";
			cancel.className = "nsmax-reply-cancel";
			cancel.textContent = "取消回复";
			cancel.hidden = true;
			cancel.addEventListener("click", () => {
				const floor = host.closest("li.content-item");
				restore(true);
				floor?.scrollIntoView({ block: "nearest" });
			}, { signal: ctx.signal });
			submit.after(cancel);
			return cancel;
		};
		const clearMentions = () => {
			if (NSMAX_MENTION_ONLY.test(nsmaxEditorValue(md))) nsmaxSetEditorValue(md, "");
		};
		const refresh = () => {
			md.querySelector(".CodeMirror")?.CodeMirror?.refresh();
			nsmaxSyncEditorMode();
		};
		const restore = (clear) => {
			if (clear) clearMentions();
			for (const floor of document.querySelectorAll("li.content-item[data-nsmax-replying]")) floor.removeAttribute("data-nsmax-replying");
			if (!host.hasAttribute("data-nsmax-inline")) return;
			if (home.isConnected) home.after(host);
			host.removeAttribute("data-nsmax-inline");
			const button = ensureCancel();
			if (button) button.hidden = true;
			refresh();
		};
		const moveTo = (floor) => {
			if (floating.matches || !floor) return;
			clearMentions();
			if (floor.lastElementChild !== host) floor.append(host);
			host.setAttribute("data-nsmax-inline", "");
			for (const other of document.querySelectorAll("li.content-item[data-nsmax-replying]")) if (other !== floor) other.removeAttribute("data-nsmax-replying");
			floor.setAttribute("data-nsmax-replying", "");
			const button = ensureCancel();
			if (button) button.hidden = false;
			refresh();
		};
		document.addEventListener("click", (event) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!target) return;
			const action = target.closest(".comment-menu .menu-item[title='回复'], .comment-menu .menu-item[title='引用']");
			if (action) {
				const floor = action.closest("#nsk-body-left ul.comments > li.content-item");
				if (floor) moveTo(floor);
				return;
			}
			if (target.closest(".menu-item[data-nsmax-action='edit'], .nsmax-floor-edit, .nsmax-op-edit")) restore(false);
		}, { capture: true, signal: ctx.signal });
		// 回复框挂在某一层下面时按 Esc：和「取消回复」一样放回页面底部（只有「@某某 #楼号」时一起清掉，写了别的内容照样留着）
		md.addEventListener("keydown", (event) => {
			if (event.key !== "Escape" || !host.hasAttribute("data-nsmax-inline") || document.querySelector("dialog[open]")) return;
			const floor = host.closest("li.content-item");
			restore(true);
			floor?.scrollIntoView({ block: "nearest" });
		}, { signal: ctx.signal });
		nsmaxComposer = { host, md, moveTo, restore };
		ctx.signal.addEventListener("abort", () => {
			restore(false);
			home.remove();
			nsmaxComposer = null;
		}, { once: true });
		return nsmaxComposer;
	}
	// 「直达底部」和主帖的「回复」「引用」：回复框在最后一页最下面（sb.sb 的 #reply）。评论自动翻页时，在前面的页上直接滚到底，
	// 下一页接上来又把回复框往下顶，怎么也到不了底。还没到最后一页时直接打开最后一页、定位到回复框（编辑器里已写的内容带过去）；
	// 已经在最后一页（或自动翻页已经接到最后一页）就直接滚过去
	var NSMAX_REPLY_HASH = "#nsmax-reply";
	function nsmaxLastPage() {
		const total = Number(unsafeWindow$1.__config__?.postData?.postPageCount);
		const pager = Math.max(0, ...Array.from(document.querySelectorAll("#nsk-body-left .nsk-pager :is(a, span)"), (el) => /^\d+$/.test(el.textContent.trim()) ? Number(el.textContent.trim()) : 0));
		return Math.max(1, Number.isFinite(total) ? total : 0, pager);
	}
	function nsmaxLoadedPage() {
		const current = Number(document.querySelector("#nsk-body-left .post-bottom-pager :is(.pager-cur, [aria-current='page'], [data-nsmax-pg-cur])")?.textContent.trim());
		return current || Number(location.pathname.match(/^\/post-\d+-(\d+)/)?.[1]) || 1;
	}
	function nsmaxFocusReplyBox(smooth = true) {
		const md = document.querySelector("#nsk-body-left .md-editor");
		if (!md) {
			window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
			return;
		}
		md.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
		const cm = md.querySelector(".CodeMirror")?.CodeMirror;
		const input = md.querySelector("textarea:not(.CodeMirror textarea)");
		setTimeout(() => {
			if (cm) {
				cm.focus();
				cm.setCursor(cm.lineCount(), 0);
			} else input?.focus({ preventScroll: true });
		}, smooth ? 320 : 0);
	}
	function nsmaxGoReplyEnd() {
		nsmaxComposer?.restore(false);
		const id = location.pathname.match(/^\/post-(\d+)/)?.[1];
		const last = nsmaxLastPage();
		if (id && last > nsmaxLoadedPage()) {
			const text = nsmaxEditorValue(document.querySelector("#nsk-body-left .md-editor"));
			try {
				if (text.trim()) sessionStorage.setItem("nsmax:carry:" + id, JSON.stringify({ text, at: Date.now() }));
			} catch {}
			location.assign(`/post-${id}-${last}${NSMAX_REPLY_HASH}`);
			return;
		}
		nsmaxFocusReplyBox();
	}
	// 打开时地址带着 #nsmax-reply（上面跳过来的）：编辑器就绪后滚到回复框、把带过来的内容放回去，再把地址里的 #nsmax-reply 去掉
	var nsmaxReplyArrival = location.hash === NSMAX_REPLY_HASH;
	function nsmaxHandleReplyArrival() {
		if (!nsmaxReplyArrival) return;
		const md = document.querySelector("#nsk-body-left .md-editor");
		if (!md?.querySelector(".CodeMirror, textarea")) return;
		nsmaxReplyArrival = false;
		const id = location.pathname.match(/^\/post-(\d+)/)?.[1];
		let carry = null;
		try {
			carry = JSON.parse(sessionStorage.getItem("nsmax:carry:" + id) || "null");
			sessionStorage.removeItem("nsmax:carry:" + id);
		} catch {}
		const apply = () => {
			if (!carry?.text || Date.now() - carry.at > 6e5) return;
			const current = nsmaxEditorValue(md);
			// 站点自己也会恢复这个帖子的草稿（异步，可能比这里晚、内容旧一点）：编辑器是空的、或内容被带过来的这段包含时才放回去
			if (current !== carry.text && (!current.trim() || carry.text.includes(current.trim()))) nsmaxSetEditorValue(md, carry.text);
		};
		apply();
		setTimeout(apply, 800);
		try { history.replaceState(history.state, "", location.pathname + location.search); } catch {}
		const go = () => requestAnimationFrame(() => nsmaxFocusReplyBox(false));
		go();
		if (document.readyState !== "complete") window.addEventListener("load", go, { once: true });
	}
	// 结构标记：代替主题 CSS 里的 :has()。:has() 会让页面任何一处增删节点都去重新匹配祖先元素——帖子里有 NodeSeek
	// 渲染的 xterm 终端（测评帖的 ANSI 输出）时，终端每画一批字符就触发一次整页样式重算，页面直接卡死。
	// 这里在页面解析阶段和之后每次扫描时给元素打上属性（只在需要变化时才写），CSS 只认这些属性。
	function nsmaxIsEmptyEl(el) {
		for (const node of el.childNodes) if (node.nodeType === 1 || node.nodeType === 3) return false;
		return true;
	}
	function nsmaxFlag(el, name, on, value = "") {
		if (!el) return;
		if (on) nsmaxSetAttr(el, name, value);
		else nsmaxDropAttr(el, name);
	}
	// 正文 / 预览里包着图片的链接：文字链接样式（下划线、悬停浅底）不套到图片上
	function nsmaxTagImageLinks(root) {
		const tag = (a) => {
			const has = !!a.querySelector("img");
			if (has !== a.hasAttribute("data-nsmax-imglink")) a.toggleAttribute("data-nsmax-imglink", has);
		};
		if (root) {
			for (const a of root.querySelectorAll("a")) tag(a);
			return;
		}
		// 先找正文、预览这几种外框，再在框里找链接（以前整页每个链接都往上找一遍祖先，列表页一个正文都没有也要 2.6ms）
		nsmaxQueryEach([".post-content", ".nspp-preview-content", ".nsmax-editor-preview"], (box) => {
			if (box.classList.contains("post-content") && box.localName !== "article") return;
			for (const a of box.getElementsByTagName("a")) tag(a);
		});
		for (const a of document.querySelectorAll("a.post-image-link")) tag(a);
	}
var NSMAX_TELEGRAM_ICON = "M21.5 4.3 2.9 11.5c-.9.3-.9 1.5 0 1.8l4.6 1.5 1.8 5.4c.3.8 1.3 1 1.9.4l2.5-2.4 4.5 3.3c.7.5 1.7.1 1.9-.7l3.1-14.3c.2-.9-.7-1.6-1.7-1.2ZM9.6 14.2l7.6-5.6-5.5 6.3-.2 3.1-1.9-3.8Z";
// 页面上见到的 Telegram 联系方式按用户记在本机（uid → {at, c: [{href, handle}]}，最多 1500 人）：悬停在作者身上时资料卡直接拿来用。
// 2026-10-23：以前只记在当前页面里，资料接口又不返回签名，所以只有在帖子里（签名渲染出来了）才看得到 Telegram，
// 列表页、个人主页的资料卡都没有。现在记在本机（有的记 30 天，没有的也记 3 天、不重复去查），没见过的人由 nsmaxLookupTelegram 去查
var NSMAX_TELEGRAM_KEY = "nsmax:telegram";
var nsmaxTelegramStore;
var nsmaxTelegramSaving = 0;
function nsmaxTelegramMap() {
	if (nsmaxTelegramStore) return nsmaxTelegramStore;
	nsmaxTelegramStore = new Map();
	try {
		for (const [uid, entry] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_TELEGRAM_KEY) || "{}"))) if (entry && Array.isArray(entry.c) && Number.isFinite(entry.at)) nsmaxTelegramStore.set(uid, entry);
	} catch {}
	return nsmaxTelegramStore;
}
var nsmaxTelegramCache = {
	// 记下过、还没过期：返回联系方式（可能是空数组，表示查过、没有）；没记下或过期：undefined
	get(uid) {
		const entry = nsmaxTelegramMap().get(String(uid));
		if (!entry) return undefined;
		return Date.now() - entry.at > (entry.c.length ? 30 : 3) * 864e5 ? undefined : entry.c;
	},
	set(uid, contacts) {
		const key = String(uid || "");
		if (!/^\d+$/.test(key)) return;
		const map = nsmaxTelegramMap();
		const list = (contacts || []).slice(0, 3).map(({ href, handle }) => ({ href, handle }));
		const old = map.get(key);
		if (old && JSON.stringify(old.c) === JSON.stringify(list) && Date.now() - old.at < 864e5) return;
		map.delete(key);
		map.set(key, { at: Date.now(), c: list });
		while (map.size > 1500) map.delete(map.keys().next().value);
		if (!nsmaxTelegramSaving) nsmaxTelegramSaving = setTimeout(() => {
			nsmaxTelegramSaving = 0;
			try { localStorage.setItem(NSMAX_TELEGRAM_KEY, JSON.stringify(Object.fromEntries(nsmaxTelegramMap()))); } catch {}
		}, 600);
	}
};
// 没见过的人：读他最近一篇主帖（只读到主帖的签名为止），签名里有 Telegram 就记下；一篇主帖都没发过的，读他最近一条回复所在的那一页。
// 只在登录后查（没登录时站点不给签名）；同一个人同时只查一次，查到的、没有的都记下
var nsmaxTelegramLookups = new Map();
function nsmaxLookupTelegram(uid) {
	uid = String(uid || "");
	const known = nsmaxTelegramCache.get(uid);
	if (known) return Promise.resolve(known);
	if (!/^\d+$/.test(uid) || !unsafeWindow$1.__config__?.user) return Promise.resolve([]);
	const pending = nsmaxTelegramLookups.get(uid);
	if (pending) return pending;
	const json = (url) => fetch(url, { credentials: "same-origin", priority: "low" }).then((response) => response.ok ? response.json() : null);
	const ownerOf = (root) => root?.querySelector(".nsk-content-meta-info .author-info a[href*='/space/']")?.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1];
	const promise = (async () => {
		let contacts = [];
		const discussions = await json(`/api/content/list-discussions?uid=${uid}&page=1`);
		const postId = discussions?.discussions?.[0]?.post_id;
		if (postId) {
			const response = await fetch(`/post-${postId}-1`, { credentials: "same-origin", priority: "low" });
			const html = response.ok && response.body ? await readUntil(response, "comment-menu-mount") : "";
			const op = new DOMParser().parseFromString(html, "text/html").querySelector(".nsk-post > .content-item");
			if (op && ownerOf(op) === uid) contacts = nsmaxTelegramContacts(op.querySelector(".signature") || "");
		} else {
			const comment = (await json(`/api/content/list-comments?uid=${uid}&page=1`))?.comments?.[0];
			const floor = Number(comment?.floor_id);
			if (comment?.post_id && floor > 0) {
				const perPage = Number(unsafeWindow$1.__config__?.commmentPerPage) || 10;
				const response = await fetch(`/post-${comment.post_id}-${Math.floor((floor - 1) / perPage) + 1}`, { credentials: "same-origin", priority: "low" });
				const item = new DOMParser().parseFromString(response.ok ? await response.text() : "", "text/html").querySelector(`ul.comments > li.content-item[id="${floor}"]`);
				if (item && ownerOf(item) === uid) contacts = nsmaxTelegramContacts(item.querySelector(".signature") || "");
			}
		}
		nsmaxTelegramCache.set(uid, contacts);
		return contacts;
	})().catch(() => []).finally(() => nsmaxTelegramLookups.delete(uid));
	nsmaxTelegramLookups.set(uid, promise);
	return promise;
}
function nsmaxTelegramContacts(source) {
	const list = [];
	const pushHref = (href) => {
		if (!href || !/^(?:https?:)?\/\/[^/]*(?:t|telegram)\.me\//i.test(href)) return;
		const normalized = href.startsWith("//") ? "https:" + href : href;
		if (list.some((item) => item.href === normalized)) return;
		const handle = (normalized.match(/t(?:elegram)?\.me\/([A-Za-z0-9_]+)/i)?.[1] || "").replace(/^@/, "");
		list.push({ href: normalized, handle });
	};
	const pushHandle = (handle) => {
		const clean = String(handle || "").replace(/^@/, "");
		if (!/^[A-Za-z0-9_]{4,32}$/.test(clean)) return;
		pushHref("https://t.me/" + clean);
	};
	// 纯文字（签名 / 简介可能是「电报：@xxx」「TG: @xxx」「t.me/xxx」这种，不是链接）：只认 telegram / tg / 电报 / 纸飞机 后面的 @名字
	const scanText = (value) => {
		if (!value) return;
		const plain = String(value).replace(/<[^>]+>/g, " ");
		for (const match of plain.matchAll(/(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([A-Za-z0-9_]{4,32})/gi)) pushHandle(match[1]);
		for (const match of plain.matchAll(/(?:telegram|电报|纸飞机|\btg\b)\s*[:：\-]?\s*@([A-Za-z0-9_]{4,32})/gi)) pushHandle(match[1]);
	};
	if (typeof source === "string") {
		for (const match of source.matchAll(/(?:https?:)?\/\/[^"'\s<>]*(?:t|telegram)\.me\/[A-Za-z0-9_]+/gi)) pushHref(match[0]);
		scanText(source);
	} else if (source && typeof source.querySelectorAll === "function") {
		for (const link of source.querySelectorAll("a[href]")) pushHref(link.href || link.getAttribute("href"));
		scanText(source.textContent || "");
	}
	return list;
}
var nsmaxSignaturesSeen = new WeakSet();
function nsmaxDecorateSignatures() {
	// 签名只用来「收集」这个人的 Telegram 联系方式（资料卡上显示成和「私信」一样的按钮）；
	// 签名下面不再额外插标签：帖子里签名本来就会写出来，再插一行是重复的（2026-10-22）。
	// 每个签名、这一页的帖子数据都只看一次（2026-10-23：以前每次扫描都把每个签名的文字、链接重新匹配一遍）
	for (const signature of document.querySelectorAll(".signature")) {
		if (nsmaxSignaturesSeen.has(signature)) continue;
		// 页面解析到一半时签名可能还没写完：解析完了才算看过
		if (document.readyState !== "loading") nsmaxSignaturesSeen.add(signature);
		const contacts = nsmaxTelegramContacts(signature);
		if (!contacts.length) continue;
		const ownerLink = signature.closest(".content-item, .post-list-item, .user-head, .user-card")?.querySelector('a[href*="/space/"]');
		const uid = ownerLink?.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1];
		if (uid) nsmaxTelegramCache.set(uid, contacts);
	}
	// 帖子数据里这一页每位作者的签名（登录后才有）：有 Telegram 的、没有的都记下，以后在列表页悬停时不用再去查
	const config = unsafeWindow$1.__config__;
	if (config?.user && Array.isArray(config.postData?.comments) && !nsmaxSignaturesSeen.has(config.postData.comments)) {
		nsmaxSignaturesSeen.add(config.postData.comments);
		for (const comment of config.postData.comments) {
			const uid = comment?.poster?.uid;
			if (!uid || typeof comment.signature !== "string") continue;
			const contacts = nsmaxTelegramContacts(comment.signature);
			// 签名（页面上渲染出来的）里认出来过的，不被这里的「没有」盖掉
			if (contacts.length || !nsmaxTelegramCache.get(uid)?.length) nsmaxTelegramCache.set(uid, contacts);
		}
	}
}
function nsmaxTagStructure() {
		// 页码外层：列表页底部、帖子评论区上下（底部那个会被移到评论区外面）、个人空间列表下方
		for (const pager of document.querySelectorAll(".nsk-pager")) {
			const box = pager.parentElement;
			// 账簿的页码和表格在同一个 div 里，不算页码外层（否则会被排成左右两栏）
			if (!box || box.matches("body, #nsk-body, #nsk-body-left, .post-list-controler, .comment-container, .selector, .nsk-post-wrapper, .credit-table > div")) continue;
			nsmaxFlag(box, "data-nsmax-pagerbox", true, pager.matches(".pager-top, .post-top-pager") ? "top" : "bottom");
		}
		for (const box of document.querySelectorAll("[data-nsmax-pagerbox]")) if (!box.querySelector(":scope > .nsk-pager")) nsmaxDropAttr(box, "data-nsmax-pagerbox");
		for (const container of document.querySelectorAll(".comment-container")) {
			nsmaxFlag(container, "data-nsmax-empty", !container.querySelector(":scope > ul.comments > li.content-item"));
			nsmaxFlag(container, "data-nsmax-bottom-pager", !!container.querySelector(":scope > div > .post-bottom-pager, :scope > .post-bottom-pager"));
		}
		// 列表标题后面的小标：置顶（svg.pined）、等级锁（#lock）
		for (const span of document.querySelectorAll(".post-list-item .post-title > span")) {
			nsmaxFlag(span, "data-nsmax-pinned", !!span.querySelector(":scope > svg.pined"));
			nsmaxFlag(span, "data-nsmax-lock", !!span.querySelector(':scope > svg > use[href="#lock"]'));
			// 置顶标签挪到标题前面（sb.sb .topic-badge 和标题在同一段文字里）：长标题从标签下面接着折行，不再把标签单独挤到上面一行
			if (span.hasAttribute("data-nsmax-pinned") && span.parentElement.firstElementChild !== span) span.parentElement.prepend(span);
		}
		nsmaxTagImageLinks();
	nsmaxDecorateSignatures();
		// 页面骨架：左栏是否为空、是否帖子页；右栏是否为空
		const body = document.querySelector("#nsk-body");
		if (body) {
			const side = body.querySelector(":scope > #nsk-right-panel-container");
			nsmaxFlag(body, "data-nsmax-noside", !side || nsmaxIsEmptyEl(side));
			const left = body.querySelector(":scope > #nsk-body-left");
			if (left) {
				const content = [...left.children].some((child) => !child.matches("#nsk-body-left-block, script, style") && !nsmaxIsEmptyEl(child));
				nsmaxFlag(left, "data-nsmax-empty", !content && !left.querySelector(":scope > #nsk-body-left-block > *"));
				nsmaxFlag(left, "data-nsmax-postbody", !!left.querySelector(":scope > .nsk-post-wrapper"));
			}
		}
		// 右栏：原站发帖按钮外层、带按钮的面板、原生资料卡、资料卡后紧跟发帖入口
		const side = document.querySelector("#nsk-right-panel-container");
		if (side) {
			for (const box of side.querySelectorAll(":scope > div")) nsmaxFlag(box, "data-nsmax-newpost-box", !!box.querySelector(":scope > a.new-discussion"));
			for (const row of side.querySelectorAll(":scope > .nsk-panel > .small-margin")) {
				const has = !!row.querySelector(".btn");
				nsmaxFlag(row, "data-nsmax-btnrow", has);
				nsmaxFlag(row.parentElement, "data-nsmax-btnpanel", has);
			}
			for (const card of side.querySelectorAll(".user-card")) nsmaxFlag(card, "data-nsmax-native-card", !!card.querySelector(":scope > .user-head") && !!card.querySelector(":scope > .user-stat"));
			for (const card of side.querySelectorAll(":scope > [data-nsmax-usercard]")) nsmaxFlag(card, "data-nsmax-before-cta", !!card.nextElementSibling?.matches("[data-nsmax-cta]"));
		}
		// 顶栏：脚本自己加的按钮、整组链接都被隐藏的分类
		const head = document.querySelector("#nsk-head");
		nsmaxFlag(document.documentElement, "data-nsmax-mhead", !!head?.querySelector(":scope > ul.nav-menu > #toggle-left-panel"));
		// 手机版侧滑菜单（Vue 在页面加载后渲染）的版块列表：和顶栏一样隐藏设置里隐藏的版块和推广
		const drawer = document.getElementById("left-slide-panel");
		if (drawer) {
			try {
				const hidden = sidebarNavSettings()?.hidden || new Set(filterLines(NSMAX_HIDDEN_DEFAULT).map((name) => name.toLocaleLowerCase()));
				for (const link of drawer.querySelectorAll(".category-mobile a[href*='/categories/']")) nsmaxFlag(link, "data-nsmax-own-hide", hidden.has(navLabel(link)) || (link.getAttribute("href") || "").includes("/categories/promotion"));
			} catch {}
		}
		if (head) {
			nsmaxFlag(head, "data-nsmax-has-settings", !!head.querySelector(".nsmax-settings-button"));
			nsmaxFlag(head, "data-nsmax-has-mobile-menu", !!head.querySelector(".nsmax-mobile-menu"));
			nsmaxFlag(head, "data-nsmax-own-colors", !!head.querySelector(".nsmax-header-action[data-nsmax-own-header=colors]"));
			for (const li of head.querySelectorAll("ul.nav-menu > li")) {
				const visible = [...li.children].some((child) => child.matches("a:not([data-nsmax-header-hide], [data-nsmax-own-hide], [hidden])"));
				nsmaxFlag(li, "data-nsmax-li-hidden", !visible);
			}
		}
		// 帖子页：主帖面包屑、回复框外层、编辑器工具条所在的那一格
		for (const post of document.querySelectorAll(".nsk-post")) nsmaxFlag(post, "data-nsmax-crumb", !!post.querySelector(":scope > .nsmax-crumb"));
		for (const box of document.querySelectorAll(".nsk-post-wrapper > div")) nsmaxFlag(box, "data-nsmax-editor-box", !!box.querySelector(":scope > .md-editor"));
		for (const row of document.querySelectorAll(".md-editor [data-nsmax-ed-head]")) {
			for (const child of row.children) nsmaxFlag(child, "data-nsmax-ed-toolwrap", !child.matches(".mde-toolbar") && !!child.querySelector(".mde-toolbar"));
		}
		for (const field of document.querySelectorAll(".md-editor .topic-select > div")) nsmaxFlag(field, "data-nsmax-topic-field", !!field.querySelector("select, .category-select") || !field.querySelector("button"));
		if (/^\/new-discussion(?:\/|$)/.test(location.pathname)) nsmaxNewPostHint();
		// 通知 / 私信：消息中心已接管时原生标签栏隐藏；原生「全部已读」按钮外层
		for (const box of document.querySelectorAll(".nsk-notification")) {
			nsmaxFlag(box, "data-nsmax-msgcenter", !!box.querySelector(".nspp-messages"));
			for (const row of box.querySelectorAll(":scope > div > div")) nsmaxFlag(row, "data-nsmax-readall-box", !!row.querySelector(":scope > button"));
		}
		// 个人空间：根容器、回帖列表的摘要行
		for (const box of document.querySelectorAll("#nsk-frame > .nsk-container")) nsmaxFlag(box, "data-nsmax-space-root", !!box.querySelector(":scope > .head-container"));
		for (const a of document.querySelectorAll(".discussion-wrapper > a")) nsmaxFlag(a, "data-nsmax-excerpt", !!a.querySelector(":scope > p"));
		for (const item of document.querySelectorAll(".discussion-wrapper .discussion-item")) {
			const next = item.nextElementSibling;
			nsmaxFlag(item, "data-nsmax-has-excerpt", !!next && next.matches("a") && !!next.querySelector(":scope > p"));
		}
		// 登录 / 注册：按钮组
		for (const box of document.querySelectorAll(":is(#login-panel, #register-panel) fieldset > div")) nsmaxFlag(box, "data-nsmax-btn-group", !!box.querySelector(":scope > button"));
	}
	// 页脚品牌块（sb.sb 2026-10-12 新版页脚左侧：标志 + 简介 + 社交图标）。NodeSeek 页脚没有这一块，这里补上：
	// 简介用站点自己 <meta name=description> 的意思（NodeSeek 给出中文），社交图标取原站「联系我们」里的链接和页脚里的 RSS
	var NSMAX_FOOTER_ICONS = {
		telegram: "M21.5 3.6 2.8 10.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.9 1.4 1.1 2 .4l2.6-2.7 4.7 3.5c.8.6 1.9.1 2.1-.9l3-14.9c.2-1.1-.9-2-1.9-1.7Z M8.4 14.2l9.8-7.4",
		mail: "M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Z M3 7l9 6.5L21 7",
		rss: "M5 11a8 8 0 0 1 8 8 M5 4.5A14.5 14.5 0 0 1 19.5 19 M6 19h.01"
	};
	function nsmaxBuildFooter() {
		const inner = document.querySelector("body > footer .contain");
		if (!inner || inner.querySelector(":scope > .nsmax-footer-brand")) return;
		const brand = document.createElement("div");
		brand.className = "nsmax-footer-brand";
		const deep = /deepflood/i.test(location.hostname);
		const logo = document.createElement("a");
		logo.className = "nsmax-footer-logo";
		logo.href = "/";
		const mark = document.createElement("span");
		mark.className = "nsmax-logo-mark";
		mark.setAttribute("aria-hidden", "true");
		const word = document.createElement("span");
		word.className = "nsmax-logo-word";
		word.textContent = deep ? "DeepFlood" : "NodeSeek";
		logo.append(mark, word);
		const about = document.createElement("p");
		about.className = "nsmax-footer-about";
		about.textContent = deep ? (document.querySelector('meta[name="description"]')?.content || "") : "NodeSeek 是热爱网站开发、主机、VPS / 服务器等极客事物的人们的聚集地。";
		const social = document.createElement("p");
		social.className = "nsmax-footer-social";
		const links = [];
		for (const a of inner.querySelectorAll(".col.social a[href]")) {
			const href = a.getAttribute("href") || "";
			if (/t\.me\//.test(href)) links.push(["telegram", href, "Telegram"]);
			else if (/^mailto:/.test(href)) links.push(["mail", href, "邮件"]);
		}
		const rss = Array.from(inner.querySelectorAll("a[href]")).find((a) => /rss/i.test(a.getAttribute("href") || "") || /RSS/.test(a.textContent));
		if (rss) links.push(["rss", rss.getAttribute("href"), "RSS 订阅"]);
		for (const [icon, href, label] of links) {
			const a = document.createElement("a");
			a.href = href;
			a.setAttribute("aria-label", label);
			a.title = label;
			if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("stroke-width", "1.7");
			svg.setAttribute("stroke-linecap", "round");
			svg.setAttribute("stroke-linejoin", "round");
			svg.setAttribute("aria-hidden", "true");
			for (const d of NSMAX_FOOTER_ICONS[icon].split(" M")) {
				const path = document.createElementNS(svg.namespaceURI, "path");
				path.setAttribute("d", d.startsWith("M") ? d : "M" + d);
				svg.append(path);
			}
			a.append(svg);
			social.append(a);
		}
		brand.append(logo, about);
		if (social.childElementCount) brand.append(social);
		inner.prepend(brand);
	}
	// 首帧前就要完成的界面整理：页面解析阶段每解析出一段执行一次（parsed 判断元素是否已解析完），
	// 之后 mountLeanUi 的 scan 也调用同一套（都可重复执行），所以首屏就是最终的样子，不会先显示原样再变。
	// 签到页（/board，照 sb.sb /checkin/，2026-10-18 第七批）：最上面一张「每日签到」卡——左边大字连续签到天数，右边签到按钮
	// （还没签时是站点的「鸡腿 x 5」「试试手气」，点的就是站点自己的按钮；签过了是灰的「今日已签到」），下面四格：今日获得、今日排名、
	// 本月签到、今日签到人数，再下面本月日历（签过的日子黄底，今天细框）。哪天签过：账簿里「签到收益N个鸡腿」那几条（按北京时间算日子），
	// 记在本机，下次只读新增的几页；排名、签到人数取站点签到排行接口
	function nsmaxBeijingDay(time) {
		return new Date(time + 8 * 36e5).toISOString().slice(0, 10);
	}
	function nsmaxShiftDay(day, delta) {
		return new Date(Date.parse(day + "T00:00:00Z") + delta * 864e5).toISOString().slice(0, 10);
	}
	var NSMAX_CHECKIN_KEY = "nsmax:checkin:";
	function nsmaxCheckinRecord(uid) {
		try {
			const value = JSON.parse(localStorage.getItem(NSMAX_CHECKIN_KEY + uid) || "null");
			if (value && typeof value.days === "object") return value;
		} catch {}
		return { days: {}, newest: "", oldest: "" };
	}
	function nsmaxCheckinSave(uid, record) {
		const days = Object.keys(record.days).sort().reverse().slice(0, 400);
		record.days = Object.fromEntries(days.map((day) => [day, record.days[day]]));
		try { localStorage.setItem(NSMAX_CHECKIN_KEY + uid, JSON.stringify(record)); } catch {}
	}
	// 连续签到：今天签了从今天往前数，还没签从昨天往前数；数到读过的最早一天还没断时，前面没读过的不算
	function nsmaxCheckinStreak(record, today) {
		let day = record.days[today] !== undefined ? today : nsmaxShiftDay(today, -1);
		let streak = 0;
		while (record.days[day] !== undefined) {
			streak++;
			day = nsmaxShiftDay(day, -1);
		}
		return { streak, complete: !record.oldest || day >= record.oldest };
	}
	// 等级进度（站点 /progress「NodeSeek进度系统」）照 sb.sb「我的烧饼」（/points/）排：一张卡片，上面鸡腿、等级两个大数字和升级进度条
	// （Lv.5 —— 百分比 —— Lv.6，下面一行还差多少鸡腿），细线下面「今日鸡腿」四项小进度条（发帖、评论、签到、免费投喂）。
	// 数据是站点前端（progress.js）读完 /api/progress/today 和签到接口后画进 #progress-mount 的：卡片第一帧就放好（数字先是「—」），
	// 站点画好以后从它画的那块读数（「4531 / 3600」「Lv5」……），站点那块不显示。等级的上下限照站点的算法：Lv.n 是 n² × 100 个鸡腿。
	// 2026-10-24：用户转来的反馈——找不到看每天鸡腿进度的地方（资料卡的等级小标签现在也链到这里）
	function nsmaxProgressPage() {
		if (location.pathname !== "/progress") return;
		const left = document.querySelector("#nsk-body-left");
		if (!left) return;
		const make = (tag, className, text) => {
			const el = document.createElement(tag);
			if (className) el.className = className;
			if (text !== undefined) el.textContent = text;
			return el;
		};
		const bar = (small) => {
			const track = make("div", small ? "nsmax-progress-bar is-sm" : "nsmax-progress-bar");
			track.setAttribute("role", "progressbar");
			track.setAttribute("aria-valuemin", "0");
			track.setAttribute("aria-valuemax", "100");
			track.append(make("div", "nsmax-progress-fill"));
			return track;
		};
		let panel = left.querySelector(":scope > .nsmax-progress");
		if (!panel) {
			panel = make("section", "nsmax-progress");
			const counters = make("div", "nsmax-progress-counters");
			for (const [key, label] of [["coin", "鸡腿"], ["level", "等级"]]) {
				const counter = make("div", "nsmax-progress-counter");
				counter.dataset.key = key;
				counter.append(make("span", "nsmax-progress-counter-label", label), make("span", "nsmax-progress-counter-value", "—"));
				counters.append(counter);
			}
			const level = make("div", "nsmax-progress-level");
			const head = make("div", "nsmax-progress-head");
			head.append(make("span", "nsmax-progress-from", "—"), make("span", "nsmax-progress-pct", "—"), make("span", "nsmax-progress-to", "—"));
			const levelBar = bar(false);
			levelBar.setAttribute("aria-label", "升级进度");
			level.append(head, levelBar, make("p", "nsmax-progress-note", "正在读取……"));
			const daily = make("div", "nsmax-progress-daily");
			const dailyHead = make("div", "nsmax-progress-daily-head");
			dailyHead.append(make("h3", "nsmax-progress-daily-title", "今日鸡腿"), make("span", "nsmax-progress-daily-total", "—"));
			const list = make("ul", "nsmax-progress-daily-list");
			for (const [key, label] of [["post", "发帖"], ["comment", "评论"], ["checkin", "签到"], ["feed", "免费投喂额度"]]) {
				const item = make("li", "nsmax-progress-item");
				item.dataset.key = key;
				const row = make("div", "nsmax-progress-item-row");
				row.append(make("span", "nsmax-progress-item-label", label), make("span", "nsmax-progress-item-num", "—"));
				const itemBar = bar(true);
				itemBar.setAttribute("aria-label", label);
				item.append(row, itemBar);
				list.append(item);
			}
			daily.append(dailyHead, list);
			panel.append(make("h2", "nsmax-progress-title", "等级进度"), counters, level, daily, make("p", "nsmax-progress-foot", "每天发帖、评论能得的鸡腿有上限；签到的鸡腿每天随机。"));
			const mount = left.querySelector(":scope > #progress-mount");
			if (mount) mount.before(panel);
			else left.append(panel);
		}
		// 站点画好的那块：h1「NodeSeek进度系统」+ 一组 h2 / 进度条
		const native = Array.from(left.children).find((el) => el !== panel && el.querySelector(":scope > h1")?.textContent.includes("进度系统"));
		if (!native) return;
		nsmaxSetAttr(native, "data-nsmax-progress-native");
		const sections = new Map();
		for (const h2 of native.querySelectorAll("h2")) {
			const wrapper = h2.nextElementSibling?.matches(".progress-wrapper") ? h2.nextElementSibling : null;
			const pair = wrapper?.querySelector(".progress-text")?.textContent.match(/(-?\d+)\s*\/\s*(-?\d+)/);
			if (!pair) continue;
			const ends = Array.from(wrapper.querySelectorAll(":scope > div:last-child > div"), (el) => el.textContent.trim());
			sections.set(h2.textContent.trim(), { current: Number(pair[1]), max: Number(pair[2]), left: ends[0] || "", right: ends[1] || "" });
		}
		if (!sections.size) return;
		const setBar = (track, ratio) => {
			const pct = Math.max(0, Math.min(100, Math.round(ratio * 1000) / 10));
			nsmaxSetAttr(track, "aria-valuenow", String(Math.round(pct)));
			const fill = track.querySelector(".nsmax-progress-fill");
			const width = pct + "%";
			if (fill.style.width !== width) fill.style.width = width;
			nsmaxFlag(track, "data-full", pct >= 100);
			return pct;
		};
		// 等级：站点按 min(等级, 5) 算上下限（Lv.6 是最高级，进度条会超过 100%），这里封顶，满级时说「已是最高等级」
		const rank = sections.get("等级进度");
		if (rank) {
			const from = Number(rank.left.match(/\d+/)?.[0] ?? NaN), to = Number(rank.right.match(/\d+/)?.[0] ?? NaN);
			const userRank = Number(unsafeWindow$1.__config__?.user?.rank);
			const levelNow = Number.isFinite(userRank) ? userRank : rank.current >= rank.max ? to : from;
			const top = levelNow >= 6;
			const min = Number.isFinite(from) ? from * from * 100 : 0;
			nsmaxSetText(panel.querySelector('[data-key="coin"] > .nsmax-progress-counter-value'), String(rank.current));
			const badge = panel.querySelector('[data-key="level"] > .nsmax-progress-counter-value');
			if (badge.getAttribute("data-nsmax-level") !== String(levelNow)) nsmaxApplyLevel(badge, levelNow);
			const pct = setBar(panel.querySelector(".nsmax-progress-level > .nsmax-progress-bar"), top ? 1 : (rank.current - min) / Math.max(1, rank.max - min));
			nsmaxSetText(panel.querySelector(".nsmax-progress-from"), top ? "Lv.6" : `Lv.${from}`);
			nsmaxSetText(panel.querySelector(".nsmax-progress-to"), top ? "最高等级" : `Lv.${to}`);
			nsmaxSetText(panel.querySelector(".nsmax-progress-pct"), `${Math.floor(pct)}%`);
			nsmaxSetText(panel.querySelector(".nsmax-progress-note"), top ? `已是最高等级 Lv.6（${rank.current} 个鸡腿）` : `距离 Lv.${to} 还差 ${Math.max(0, rank.max - rank.current)} 个鸡腿（${rank.current} / ${rank.max}）`);
		}
		let gained = 0;
		const item = (key, data, num) => {
			const el = panel.querySelector(`.nsmax-progress-item[data-key="${key}"]`);
			if (!el || !data) return;
			nsmaxSetText(el.querySelector(".nsmax-progress-item-num"), num);
			setBar(el.querySelector(".nsmax-progress-bar"), data.max > 0 ? data.current / data.max : 0);
		};
		const post = sections.get("今日发帖可得鸡腿");
		if (post) {
			gained += post.current;
			item("post", post, `${post.current / 5} / ${post.max / 5} 帖 · +${post.current} / ${post.max}`);
		}
		const comment = sections.get("今日评论可得鸡腿");
		if (comment) {
			gained += comment.current;
			item("comment", comment, `${comment.current} / ${comment.max} 条 · +${comment.current} / ${comment.max}`);
		}
		const checkin = sections.get("今日签到获得鸡腿");
		if (checkin) {
			gained += checkin.current;
			item("checkin", checkin, checkin.current > 0 ? `已签到 · +${checkin.current}` : "未签到");
		}
		const feed = sections.get("今日免费投喂鸡腿额度");
		if (feed) item("feed", feed, `${feed.current} / ${feed.max} 次`);
		nsmaxSetText(panel.querySelector(".nsmax-progress-daily-total"), `+${gained}`);
		nsmaxFlag(panel, "data-ready", true);
	}
	var nsmaxCheckinState = { loading: false, board: null };
	function nsmaxCheckinPage() {
		const board = document.querySelector("section#nsk-frame > .board");
		const head = board?.querySelector(":scope > .head-info");
		if (!board || !head) return;
		const make = (tag, className, text) => {
			const el = document.createElement(tag);
			if (className) el.className = className;
			if (text !== undefined) el.textContent = text;
			return el;
		};
		let card = board.querySelector(":scope > .nsmax-checkin");
		if (!card) {
			card = make("section", "nsmax-checkin");
			const top = make("div", "nsmax-checkin-top");
			const streak = make("div", "nsmax-checkin-streak");
			streak.append(make("b", "", "—"), make("span", "", "连续签到（天）"));
			const side = make("div", "nsmax-checkin-side");
			side.append(make("div", "nsmax-checkin-actions"), make("p", "nsmax-checkin-note"));
			top.append(streak, side);
			const stats = make("dl", "nsmax-checkin-stats");
			for (const [key, label] of [["gain", "今日获得"], ["order", "今日排名"], ["month", "本月签到"], ["total", "今日签到人数"]]) {
				const cell = make("div");
				cell.dataset.key = key;
				cell.append(make("dd", "", "—"), make("dt", "", label));
				stats.append(cell);
			}
			const month = make("div", "nsmax-checkin-month");
			const calendar = make("div", "nsmax-checkin-calendar");
			card.append(make("h2", "nsmax-checkin-title", "每日签到"), top, stats, month, calendar);
			board.prepend(card);
		}
		// 站点自己那一行（「今日签到获得鸡腿9个，当前排名第288」或「今日还未签到」+ 两个按钮）：文字放进卡片，按钮换成卡片里的同名按钮
		const text = head.textContent.replace(/\s+/g, " ").trim();
		// 没登录：站点那一行是「登录后签到」。卡片里只写一句说明和「登录后签到」，连续签到、统计、日历都是个人的，不显示（design.css 第 58 节）
		const guest = !unsafeWindow$1.__config__?.user && !!head.querySelector('a[href*="signIn"]');
		card.toggleAttribute("data-guest", guest);
		const done = !guest && /获得鸡腿\s*\d+\s*个|已签到/.test(text);
		const gain = Number(text.match(/获得鸡腿\s*(\d+)\s*个/)?.[1]);
		const order = Number(text.match(/排名第\s*(\d+)/)?.[1]);
		nsmaxSetText(card.querySelector(".nsmax-checkin-note"), guest ? "登录后才能签到。每天签到领鸡腿；「试试手气」随机 1–10 个。" : done ? text : "今天还没签到，签到领鸡腿；「试试手气」随机 1–10 个。");
		const actions = card.querySelector(".nsmax-checkin-actions");
		const nativeButtons = Array.from(head.querySelectorAll("button, a.btn, .pure-button")).filter((button) => button.textContent.trim());
		const signature = guest ? "guest" : done ? "done" : nativeButtons.map((button) => button.textContent.trim()).join("|");
		if (actions.dataset.signature !== signature) {
			actions.dataset.signature = signature;
			actions.replaceChildren();
			if (guest) {
				const login = make("a", "nsmax-checkin-button primary", "登录后签到");
				login.href = "/signIn.html";
				actions.append(login);
			} else if (done || !nativeButtons.length) {
				const button = make("button", "nsmax-checkin-button", done ? "今日已签到" : "签到");
				button.type = "button";
				button.disabled = done;
				if (!done) button.addEventListener("click", () => { location.href = "/board"; });
				actions.append(button);
			} else {
				nativeButtons.forEach((native, index) => {
					const button = make("button", "nsmax-checkin-button" + (index === 0 ? " primary" : ""), native.textContent.replace(/\s+/g, " ").trim());
					button.type = "button";
					button.addEventListener("click", () => native.click());
					actions.append(button);
				});
			}
		}
		card.toggleAttribute("data-done", done);
		// 站点那一行说今天签过了（账簿里那一条可能还没读到）：今天先记上，连续签到、本月签到、日历都算上今天
		const uidNow = unsafeWindow$1.__config__?.user?.member_id;
		if (done && uidNow && Number.isFinite(gain)) {
			const record = nsmaxCheckinRecord(uidNow);
			const today = nsmaxBeijingDay(Date.now());
			if (record.days[today] !== gain) {
				record.days[today] = gain;
				nsmaxCheckinSave(uidNow, record);
			}
		}
		const cell = (key) => card.querySelector(`.nsmax-checkin-stats > [data-key="${key}"] > dd`);
		const live = nsmaxCheckinState.board;
		nsmaxSetText(cell("gain"), Number.isFinite(gain) ? `${gain} 鸡腿` : live?.record?.gain ? `${live.record.gain} 鸡腿` : "—");
		nsmaxSetText(cell("order"), Number.isFinite(order) ? `第 ${order}` : live?.order ? `第 ${live.order}` : "—");
		if (live?.total) nsmaxSetText(cell("total"), String(live.total));
		nsmaxCheckinCalendar(card);
		const uid = unsafeWindow$1.__config__?.user?.member_id;
		if (uid && !nsmaxCheckinState.loading && document.readyState !== "loading") {
			nsmaxCheckinState.loading = true;
			nsmaxLoadCheckin(uid, card).catch(() => {});
		}
	}
	function nsmaxCheckinCalendar(card) {
		const uid = unsafeWindow$1.__config__?.user?.member_id;
		const record = uid ? nsmaxCheckinRecord(uid) : { days: {}, oldest: "" };
		const today = nsmaxBeijingDay(Date.now());
		const [year, month] = today.split("-").map(Number);
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
		const prefix = today.slice(0, 8);
		const signed = Object.keys(record.days).filter((day) => day.startsWith(prefix));
		const { streak, complete } = nsmaxCheckinStreak(record, today);
		nsmaxSetText(card.querySelector(".nsmax-checkin-streak > b"), uid && (record.newest || signed.length) ? `${streak}${complete || !streak ? "" : "+"}` : "—");
		nsmaxSetText(card.querySelector('.nsmax-checkin-stats > [data-key="month"] > dd'), uid && record.newest ? `${signed.length} 天` : "—");
		nsmaxSetText(card.querySelector(".nsmax-checkin-month"), `${year} 年 ${month} 月`);
		const calendar = card.querySelector(".nsmax-checkin-calendar");
		const signature = `${prefix}|${signed.sort().join(",")}|${today}`;
		if (calendar.dataset.signature === signature) return;
		calendar.dataset.signature = signature;
		const tiles = [];
		for (const label of ["一", "二", "三", "四", "五", "六", "日"]) {
			const head = document.createElement("span");
			head.className = "nsmax-checkin-weekday";
			head.textContent = label;
			tiles.push(head);
		}
		for (let i = 0; i < first; i++) tiles.push(Object.assign(document.createElement("span"), { className: "nsmax-checkin-blank" }));
		for (let d = 1; d <= days; d++) {
			const day = prefix + String(d).padStart(2, "0");
			const tile = document.createElement("span");
			tile.className = "nsmax-checkin-day";
			const number = document.createElement("b");
			number.textContent = String(d);
			tile.append(number);
			const gain = record.days[day];
			if (gain !== undefined) {
				tile.setAttribute("data-signed", "");
				const small = document.createElement("i");
				small.textContent = `+${gain}`;
				tile.append(small);
				tile.title = `${day} 签到获得 ${gain} 个鸡腿`;
			}
			if (day === today) tile.setAttribute("data-today", "");
			else if (day > today) tile.setAttribute("data-future", "");
			tiles.push(tile);
		}
		calendar.replaceChildren(...tiles);
	}
	async function nsmaxLoadCheckin(uid, card) {
		const json = (url) => fetch(url, { credentials: "same-origin" }).then((res) => res.json());
		// 今日排名、今日签到人数
		json("/api/attendance/board?page=1").then((data) => {
			if (!data?.success && !Array.isArray(data?.list)) return;
			nsmaxCheckinState.board = { total: data.total, order: data.order, record: data.record };
			nsmaxCheckinPage();
		}).catch(() => {});
		// 哪天签过：从账簿第一页往后读，读到上次读过的那一天、并且本月和连续签到都数清楚了就停（最多 40 页）
		const record = nsmaxCheckinRecord(uid);
		const today = nsmaxBeijingDay(Date.now());
		const monthStart = today.slice(0, 8) + "01";
		const previous = record.newest;
		let oldestSeen = today;
		for (let page = 1; page <= 40; page++) {
			const data = await json(`/api/account/credit/page-${page}`);
			const rows = Array.isArray(data?.data) ? data.data : [];
			for (const row of rows) {
				const [, , reason, time] = Array.isArray(row) ? row : [];
				const at = Date.parse(time);
				if (!Number.isFinite(at)) continue;
				const day = nsmaxBeijingDay(at);
				if (day < oldestSeen) oldestSeen = day;
				const match = /签到收益\s*(\d+)\s*个鸡腿/.exec(reason || "");
				if (match) record.days[day] = Number(match[1]);
			}
			record.newest = today;
			if (!record.oldest || oldestSeen < record.oldest) record.oldest = oldestSeen;
			// 账簿读到头了（这一页不满 20 条）：以前的都读过了，连续签到是数清楚的
			if (rows.length < 20) record.oldest = "0000-00-00";
			nsmaxCheckinSave(uid, record);
			nsmaxCheckinCalendar(card);
			if (rows.length < 20) break;
			const overlap = previous && oldestSeen < previous;
			const monthDone = record.oldest < monthStart;
			const streakDone = nsmaxCheckinStreak(record, today).complete;
			if (monthDone && streakDone && (overlap || !previous)) break;
		}
	}
	// 发帖页（照 sb.sb /t/new/，2026-10-18 第七批）：「版块」下面一行弱化字说明，内容取站点「重要提醒」卡片里的几条规则
	// （那张卡片由主题收起，sb.sb 也是把规则写在版块下面）。卡片还没解析出来时先不加，免得只有半句
	function nsmaxNewPostHint() {
		const editor = document.querySelector("#editor > .md-editor");
		if (!editor || editor.querySelector(":scope > .nsmax-new-hint")) return;
		const card = document.querySelector("#nsk-body-left > .post-content");
		if (!card && document.readyState === "loading") return;
		const rules = Array.from(card?.querySelectorAll("li") || [], (li) => li.textContent.replace(/\s+/g, " ").trim().replace(/[。；;，,]$/, "")).filter(Boolean);
		const tail = card?.querySelector(":scope > p")?.textContent.replace(/\s+/g, " ").trim();
		const hint = document.createElement("p");
		hint.className = "nsmax-new-hint";
		hint.textContent = `请选择正确的版块${rules.length ? "：" + rules.join("；") + "。" : "。"}${tail ? tail.replace(/[。.]?$/, "。") : ""}`;
		editor.append(hint);
	}
	function nsmaxEarlyVisuals(parsed) {
		const nav = document.querySelector("ul.nav-menu");
		if (nav && (!parsed || parsed(nav))) nsmaxUpdateNavEssence();
		nsmaxEnsureNqEntry(parsed);
		nsmaxTidyPagers();
		nsmaxTagStructure();
		nsmaxBuildFooter();
		nsmaxCleanPostActions();
		nsmaxMarkLevels();
		nsmaxApplyChineseTimes(parsed);
		nsmaxTidySidebar();
		if (/^\/board(?:\/|$)/.test(location.pathname)) nsmaxCheckinPage();
		if (location.pathname === "/progress") nsmaxProgressPage();
		// 「抽奖」页：查过的抽奖帖首屏就显示、别的先不显示（没查过的等模块启动后在后台查）
		if (nsmaxIsLotteryView()) nsmaxFilterLotteryRows();
		nsmaxEarlyMyReplies(parsed);
		if (!/^\/post-\d+/.test(location.pathname)) return;
		nsmaxGroupFloorActions(parsed);
		nsmaxGroupNestedReplies(parsed);
		nsmaxDecorateFloorBoxes();
		nsmaxMarkPinnedReplies();
		nsmaxBuildAuthorColumns(parsed);
		nsmaxClassifyPostImages(parsed);
		nsmaxWrapCodeBlocks(parsed);
		nsmaxDecorateQuotes(parsed);
		nsmaxReserveMoreRow(parsed);
		// 统计（浏览数、回复数）要等评论区解析完才准，不然先显示一个偏小的回复数再变
		const comments = document.querySelector(".comment-container");
		if (!parsed || document.readyState !== "loading" || comments && parsed(comments)) {
			nsmaxDecoratePostDetail();
			// 抽奖帖：开奖链接换成的抽奖卡片在第一帧就放好（参与人要等评论区解析完才全，和统计同一时机）。
			// 2026-10-23：以前等模块启动才插进正文，第一帧画出来之后整篇正文被往下推三百多像素
			nsmaxPrepareLottery();
		}
	}
	// 列表行在空闲时排好（2026-10-25，样式见主题第 72 节）：首屏照旧用 content-visibility:auto 先不排屏幕外的行
	// （CPU 4 倍降速下首帧早 0.6 秒多）；页面整理完 1.5 秒后，每次浏览器空闲排 8 行（打上 data-nsmax-cv-done，改成 visible），
	// 往下滚的时候这些行已经排好，不用在滚动的那一帧里现排——4 倍降速下一打开就往下滚，以前中位每帧 180ms 以上。
	// 自动接上来的下一页也照这样排（每轮整理时调用 nsmaxPrerenderKick）
	var nsmaxPrerenderKick = null;
	var NSMAX_PRERENDER_ROWS = "#nsk-body-left ul.post-list:not(.topic-carousel-panel) > li.post-list-item:not([data-nsmax-cv-done])";
	function nsmaxPrerenderRows(ctx) {
		const root = document.documentElement;
		if (!root.hasAttribute("data-nsmax-cv") || nsmaxPrerenderKick) return;
		const idle = (fn) => typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(() => fn({ timeRemaining: () => 8 }), 200);
		let running = false;
		const step = (deadline) => {
			if (ctx.signal.aborted || !root.hasAttribute("data-nsmax-cv")) {
				running = false;
				return;
			}
			let done = 0;
			for (const row of document.querySelectorAll(NSMAX_PRERENDER_ROWS)) {
				row.setAttribute("data-nsmax-cv-done", "");
				if (++done >= 8 || deadline.timeRemaining() < 4) break;
			}
			if (done) idle(step);
			else running = false;
		};
		const timer = setTimeout(() => {
			nsmaxPrerenderKick = () => {
				if (running || ctx.signal.aborted) return;
				running = true;
				idle(step);
			};
			nsmaxPrerenderKick();
		}, 1500);
		ctx.signal.addEventListener("abort", () => {
			clearTimeout(timer);
			nsmaxPrerenderKick = null;
		}, { once: true });
	}
	// 楼号悬停预览（照 sb.sb .quote-hover）：帖子正文里指向这一帖某一层的链接——「#12」、引用卡片头上的「#0」、楼中楼里的「回复 某某」——
	// 鼠标停 0.14 秒弹出一张小卡片：头上「#楼号 作者」，下面那一层的正文（纯文字，最高 260px，长了可以滚）。这一页上有那一层就直接用；
	// 不在这一页的按楼号算出在第几页（一页 10 楼），取那一页（同一页只取一次）；找不到写「这一层不存在或已被删除」。
	// 移开 0.18 秒收起（移进卡片里不收），Esc、滚动页面收起；键盘移到链接上也会弹出。2026-10-24
	var nsmaxFloorHoverBound = false;
	function nsmaxFloorHover(ctx) {
		if (nsmaxFloorHoverBound || !/^\/post-\d+/.test(location.pathname)) return;
		nsmaxFloorHoverBound = true;
		const postId = location.pathname.match(/^\/post-(\d+)/)[1];
		const pages = new Map();
		let card = null, timer = 0, current = null;
		const target = (node) => {
			const a = node instanceof Element ? node.closest("#nsk-body-left article.post-content a[href], #nsk-body-left .nsmax-fb-who > a.nsmax-fb-target") : null;
			if (!a || !(/^#\d+$/.test(a.textContent.trim()) || a.matches(".nsmax-fb-target, .nsmax-quote-floor"))) return null;
			let url;
			try { url = new URL(a.getAttribute("href"), location.href); } catch { return null; }
			if (url.origin !== location.origin || !/^#\d+$/.test(url.hash)) return null;
			const path = url.pathname.match(/^\/post-(\d+)(?:-(\d+))?/);
			if (path ? path[1] !== postId : url.pathname !== location.pathname) return null;
			return { a, no: Number(url.hash.slice(1)), page: path?.[2] ? Number(path[2]) : 0 };
		};
		const pick = (doc, no) => {
			const item = no === 0 ? doc.querySelector(".nsk-post > .content-item, .nsk-post .content-item") : doc.querySelector(`ul.comments li.content-item[id="${no}"]`);
			const body = item?.querySelector(":scope > article.post-content");
			if (!body) return null;
			const copy = body.cloneNode(true);
			for (const extra of copy.querySelectorAll(".nsmax-fb-who, [data-nsmax-fb-lead], .nsmax-quote-head, .nsmax-lottery, script, style")) extra.remove();
			for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
			for (const block of copy.querySelectorAll("p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, tr")) block.append("\n");
			for (const image of copy.querySelectorAll("img:not(.sticker, [class*=emoji])")) image.replaceWith("[图片]");
			const text = copy.textContent.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
			const author = item.querySelector(":scope > .nsk-content-meta-info .author-info > a.author-name, :scope > .nsk-content-meta-info .author-info > a[href*='/space/']")?.textContent.trim() || "";
			return { no, author, text: text.length > 1200 ? text.slice(0, 1200) + "……" : text };
		};
		const hide = () => {
			clearTimeout(timer);
			timer = 0;
			if (card) card.hidden = true;
			current = null;
		};
		const show = (a, data) => {
			if (!card) {
				card = document.createElement("div");
				card.className = "nsmax-floor-hover";
				card.setAttribute("role", "tooltip");
				card.addEventListener("mouseenter", () => { clearTimeout(timer); timer = 0; });
				card.addEventListener("mouseleave", hide);
				document.body.append(card);
			}
			const head = document.createElement("div");
			head.className = "nsmax-floor-hover-head";
			head.textContent = `#${data.no}${data.author ? " " + data.author : ""}`;
			const body = document.createElement("div");
			body.className = "nsmax-floor-hover-body";
			body.textContent = data.text || "（这一层没有文字）";
			card.replaceChildren(head, body);
			card.hidden = false;
			const link = a.getBoundingClientRect(), box = card.getBoundingClientRect();
			const width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
			const left = Math.min(Math.max(8, link.left + scrollX), scrollX + width - box.width - 8);
			const below = link.bottom + scrollY + 6, above = link.top + scrollY - box.height - 6;
			card.style.left = left + "px";
			card.style.top = (height - link.bottom < box.height + 16 && above > scrollY ? above : below) + "px";
		};
		const open = async (hit) => {
			current = hit.a;
			let data = pick(document, hit.no);
			if (!data) {
				const page = hit.page || (hit.no === 0 ? 1 : Math.ceil(hit.no / NSMAX_FLOORS_PER_PAGE));
				const href = `/post-${postId}-${page}`;
				if (!pages.has(href)) pages.set(href, ctx.request(href, { responseType: "text", signal: ctx.signal }).then((html) => new DOMParser().parseFromString(html, "text/html")).catch(() => null));
				const doc = await pages.get(href);
				if (current !== hit.a) return;
				data = doc ? pick(doc, hit.no) : null;
			}
			show(hit.a, data || { no: hit.no, author: "", text: "这一层不存在或已被删除" });
		};
		const options = { signal: ctx.signal };
		document.addEventListener("mouseover", (event) => {
			if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
			const hit = target(event.target);
			if (!hit || hit.a === current) return;
			clearTimeout(timer);
			timer = setTimeout(() => open(hit), 140);
		}, options);
		document.addEventListener("mouseout", (event) => {
			if (!target(event.target)) return;
			clearTimeout(timer);
			timer = setTimeout(hide, 180);
		}, options);
		document.addEventListener("focusin", (event) => {
			if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
			const hit = target(event.target);
			if (hit) open(hit);
		}, options);
		document.addEventListener("focusout", (event) => { if (target(event.target)) hide(); }, options);
		document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); }, options);
		window.addEventListener("scroll", () => { if (current || card && !card.hidden) hide(); }, { passive: true, signal: ctx.signal });
		ctx.signal.addEventListener("abort", () => card?.remove(), { once: true });
	}
	// 引用（站点「引用」按钮插进回复里的格式：> @某某 [#楼号](地址) 发布于 时间，编辑于 时间，下面是被引用的内容）排成引用卡片。
	// sb.sb 没有对应的东西：照它通知里的引用卡片（.notify-quote-card：次底色、左边 3px 细线、右边小圆角）和楼号悬停卡片的头
	// （.quote-hover-head：小字），头上一行「名字 · #楼号 · 时间 · 编辑过」，下面是被引用的内容（弱化字）；内容超过 8 行先收起，
	// 头上右边给「展开」（放在头里，量出来是长的才显示，不会把下面的内容往下推）。2026-10-24，用户：NS 的引用要好好设计
	var nsmaxQuoteSeen = new WeakSet();
	var nsmaxQuoteObserver = null;
	function nsmaxDecorateQuotes(parsed) {
		const pad = (n) => String(n).padStart(2, "0");
		for (const quote of document.querySelectorAll("#nsk-body-left article.post-content blockquote")) {
			if (nsmaxQuoteSeen.has(quote) || parsed && !parsed(quote)) continue;
			nsmaxQuoteSeen.add(quote);
			const first = quote.firstElementChild;
			const mention = first?.matches("p") ? first.firstElementChild : null;
			const floor = mention?.nextElementSibling;
			if (!mention?.matches("a") || !/^@/.test(mention.textContent.trim()) || mention.previousSibling?.textContent.trim()) continue;
			if (!floor?.matches("a") || !/^#\d+$/.test(floor.textContent.trim()) || mention.nextSibling !== floor && mention.nextSibling?.textContent.trim()) continue;
			// 楼号后面到第一个换行为止是「发布于 …，编辑于 …」
			const meta = [];
			let node = floor.nextSibling;
			while (node && node.nodeName !== "BR") {
				meta.push(node);
				node = node.nextSibling;
			}
			const text = meta.map((item) => item.textContent).join("").trim();
			if (!/^发布于/.test(text)) continue;
			const [posted, edited] = text.split(/[，,]\s*(?=编辑于)/).map((part) => part.replace(/^(发布于|编辑于)\s*/, "").trim());
			const when = Date.parse(posted);
			const head = document.createElement("div");
			head.className = "nsmax-quote-head";
			const name = document.createElement("a");
			name.className = "nsmax-quote-name";
			name.href = mention.getAttribute("href") || "#";
			name.textContent = mention.textContent.trim().replace(/^@/, "");
			const number = document.createElement("a");
			number.className = "nsmax-quote-floor";
			number.href = floor.getAttribute("href") || "#";
			number.textContent = floor.textContent.trim();
			const time = document.createElement("time");
			time.className = "nsmax-quote-time";
			if (Number.isFinite(when)) {
				const date = new Date(when);
				time.dateTime = date.toISOString();
				time.textContent = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
			} else time.textContent = posted;
			time.title = text;
			head.append(name, number, time);
			if (edited) {
				const mark = document.createElement("span");
				mark.className = "nsmax-quote-edited";
				mark.textContent = "编辑过";
				mark.title = "编辑于 " + edited;
				head.append(mark);
			}
			const toggle = document.createElement("button");
			toggle.type = "button";
			toggle.className = "nsmax-quote-toggle";
			toggle.textContent = "展开";
			toggle.setAttribute("aria-expanded", "false");
			toggle.addEventListener("click", () => {
				const open = !quote.hasAttribute("data-nsmax-quote-open");
				quote.toggleAttribute("data-nsmax-quote-open", open);
				toggle.textContent = open ? "收起" : "展开";
				toggle.setAttribute("aria-expanded", String(open));
			});
			head.append(toggle);
			// 原来那一行（@某某 #楼号 发布于…）拿掉，剩下的内容包进 .nsmax-quote-body（收起时限高）
			for (const item of [mention, floor, ...meta, node]) item?.remove();
			if (!first.textContent.trim() && !first.querySelector("img")) first.remove();
			else if (first.firstChild?.nodeType === 3) first.firstChild.data = first.firstChild.data.replace(/^\s+/, "");
			const body = document.createElement("div");
			body.className = "nsmax-quote-body";
			body.append(...quote.childNodes);
			quote.append(head, body);
			quote.setAttribute("data-nsmax-quote", "");
			// 长不长等它排好版、离屏幕不远时再量（不在打开页面时逼浏览器当场排版）
			if (typeof IntersectionObserver === "function") {
				nsmaxQuoteObserver ||= new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						nsmaxQuoteObserver.unobserve(entry.target);
						const box = entry.target.querySelector(":scope > .nsmax-quote-body");
						if (box && box.scrollHeight > box.clientHeight + 4) entry.target.setAttribute("data-nsmax-quote-long", "");
					}
				}, { rootMargin: "600px 0px" });
				nsmaxQuoteObserver.observe(quote);
			}
		}
	}
	// 评论自动翻页「加载下一页」那一行（模块启动后 infinite 才放到评论列表下面）：有下一页、开着评论自动翻页时，第一帧就把同样的按钮放好，
	// infinite 接着用它（2026-10-24，用户：进页面底下伸缩一下——以前第一帧之后才插进来，页脚往下一撑 45px）
	function nsmaxReserveMoreRow(parsed) {
		const list = document.querySelector("#nsk-body-left ul.comments");
		const pager = document.querySelector(".post-bottom-pager");
		if (!list || !pager || parsed && !parsed(pager) || !pager.querySelector("a.pager-next")) return;
		if (list.nextElementSibling?.matches("button.nspp-action")) return;
		let on = true;
		try {
			const options = GM_getValue$1(`nspp:settings:${location.hostname}`, {})?.["infinite-scroll"];
			on = options?.enabled !== false && options?.comments !== false;
		} catch {}
		if (!on) return;
		const button = document.createElement("button");
		button.type = "button";
		button.className = "nspp-action";
		button.setAttribute("data-nsmax-early", "");
		button.textContent = "加载下一页";
		list.after(button);
	}
	// 正文代码块包进 .nsmax-code（对应 sb.sb 的 .code-block）：「内容增强」的复制按钮放在外层右上角，
	// 代码横向滚动时按钮不跟着跑。页面解析阶段就包好，之后放进按钮不会让内容跳动。
	function nsmaxWrapCodeBlocks(parsed) {
		let copy;
		for (const pre of document.querySelectorAll("article.post-content pre:not(.nsmax-code > pre)")) {
			if (parsed && !parsed(pre)) continue;
			// NodeSeek 会把 ANSI 输出（code.language-ansi）整块换成 xterm 终端，这种不包
			if (pre.querySelector(":scope > code.language-ansi")) continue;
			const wrap = document.createElement("div");
			wrap.className = "nsmax-code";
			const button = pre.querySelector(":scope > [data-nspp-copy]");
			pre.before(wrap);
			wrap.append(pre);
			if (button) wrap.append(button);
			// 「内容增强」的「复制」等会儿才加上（模块启动时），代码块顶上放按钮的那一条现在就留好（2026-10-23：以前加按钮时
			// 才留出来，后面的正文在第一帧之后被往下推一截）。站点偏好「一直显示复制按钮」要等站点读完偏好才知道，先按上次看到的
			copy ??= nsmaxEarlyCopyState();
			if (!copy.enabled) continue;
			if (!pre.hasAttribute("data-nsmax-copy")) pre.setAttribute("data-nsmax-copy", "");
			if (copy.always && !pre.hasAttribute("data-nsmax-copy-always")) pre.setAttribute("data-nsmax-copy-always", "");
		}
	}
	// 「复制」按钮会不会加、站点的复制按钮上次是不是「一直显示」（内容增强看到站点的按钮时记在本机：nsmax:copy-always；
	// 还没见过时按站点的默认「一直显示」）
	function nsmaxEarlyCopyState() {
		let enabled = false;
		let always = true;
		try {
			const options = GM_getValue$1(SETTINGS_KEY, {})?.["reading-content"] || {};
			enabled = options.enabled !== false && options.copyCode !== false;
			always = localStorage.getItem("nsmax:copy-always") !== "0";
		} catch {}
		return { enabled, always };
	}
	function nsmaxUpdateNavEssence() {
		// 手机版顶栏的 ul.nav-menu 是 ≡ / 标志 / 搜索 / 深浅色那一排，版块在 header > ul.mobile-nav：「精华」加进版块那一排
		const navMenus = [];
		nsmaxQueryEach(["ul.nav-menu", "header > ul.mobile-nav"], (menu) => { if (!navMenus.includes(menu) && !menu.querySelector(":scope > #toggle-left-panel")) navMenus.push(menu); });
		for (const navMenu of navMenus) {
			for (const item of navMenu.querySelectorAll(":scope > li")) {
				const a = item.querySelector("a");
				if (!a) continue;
				if (a.textContent.includes("推广") || (a.getAttribute("href") || "").includes("/categories/promotion")) {
					nsmaxHideEl(item);
					nsmaxSetAttr(item, "data-nsmax-own-hide");
				}
			}
			// 「精华」挪到列表工具条（「抽奖」旁边，见 nsmaxKindTabs，2026-10-18）：以前加在顶栏的拿掉
			navMenu.querySelector(":scope > li.nsmax-essence-tab-item")?.remove();
			// NQ（NodeQuality 测机）入口排在最后
			let nqLi = navMenu.querySelector(":scope > li.nsmax-nq-tab-item");
			if (!nqLi) {
				nqLi = document.createElement("li");
				nqLi.className = "nsmax-nq-tab-item";
				nqLi.append(nsmaxNqLink("nsmax-nq-tab"));
			}
			if (nqLi.parentElement !== navMenu || nqLi.nextElementSibling) navMenu.append(nqLi);
		}
	}
	// 等级徽章：NodeSeek 只有 Lv1–Lv6。凡是只写着等级的小标签都打上 data-nsmax-level=N（主题按等级配色、配徽记），
	// 文字统一成 sb.sb 的「Lv.N」；Lv6 另外保留 data-nsmax-lv6（旧规则与外部样式在用）
	function nsmaxApplyLevel(el, level) {
		const n = Math.max(1, Math.min(6, Number(level) || 1));
		nsmaxSetAttr(el, "data-nsmax-level", String(n));
		if (n === 6) nsmaxSetAttr(el, "data-nsmax-lv6", "true");
		else nsmaxDropAttr(el, "data-nsmax-lv6");
		nsmaxSetText(el, `Lv.${n}`);
	}
	var NSMAX_LEVEL_SELECTORS = [".role-tag", ".nspp-level", ".user-badge", ".badge", ".author-info > span", ".nsk-content-meta-info > span", ".nsmax-account-rank", ".nsmax-person-level", ".nsmax-space-vip"];
	function nsmaxMarkLevels() {
		const mark = (el) => {
			if (el.children.length) return;
			const text = (el.textContent || "").replace(/\s+/g, "");
			const match = text.match(/^(?:Lv\.?|Level|等级)(\d)$/i);
			if (match) nsmaxApplyLevel(el, match[1]);
		};
		nsmaxQueryEach(NSMAX_LEVEL_SELECTORS, mark);
		for (const card of document.querySelectorAll(".hover-user-card")) for (const el of card.querySelectorAll("[class*='level']")) mark(el);
	}
	// 帖子的回复总数（标题栏右边、评论区标题、抽奖卡片里的「N 条回复」）。帖子页自己没有这个数（__config__.postData 只有总页数），
	// 以前在评论区文字里找第一个「N 条回复」：多页的帖子评论区标题写的是「全部回复 · 共 N 页」，找到的是楼中楼框底的「共 1 条回复」，
	// 标题栏就成了 1，抽奖卡片退回去数这一页的参与人（2026-10-19）。现在：
	// 1. 列表里看到过的，用列表上的回复数（记在本机，最多 1000 篇）；站点列表上的回复数就是最后一楼的楼号；
	// 2. 只有一页、或者就在最后一页（页面解析完）时，用这一页最大的楼号；
	// 3. 都没有、或者记下的数超过 10 分钟：后台打开最后一页看最大的楼号，拿到后把页面上这几处一起更新
	var NSMAX_REPLY_COUNTS_KEY = "nsmax:reply-counts";
	var nsmaxReplyCountsMap;
	function nsmaxReplyCounts() {
		if (nsmaxReplyCountsMap) return nsmaxReplyCountsMap;
		nsmaxReplyCountsMap = new Map();
		try {
			for (const [id, value] of Object.entries(JSON.parse(localStorage.getItem(NSMAX_REPLY_COUNTS_KEY) || "{}"))) if (Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])) nsmaxReplyCountsMap.set(id, value);
		} catch {}
		return nsmaxReplyCountsMap;
	}
	var nsmaxReplyCountsSaving = 0;
	function nsmaxRememberReplyCount(id, count) {
		if (!id || !Number.isFinite(count) || count < 0) return;
		const map = nsmaxReplyCounts();
		const old = map.get(id);
		if (old && old[0] === count && Date.now() - old[1] < 60e3) return;
		map.delete(id);
		map.set(id, [count, Date.now()]);
		while (map.size > 1000) map.delete(map.keys().next().value);
		// 列表一页要记 50 篇：合在一起写一次
		if (!nsmaxReplyCountsSaving) nsmaxReplyCountsSaving = setTimeout(() => {
			nsmaxReplyCountsSaving = 0;
			try { localStorage.setItem(NSMAX_REPLY_COUNTS_KEY, JSON.stringify(Object.fromEntries(nsmaxReplyCounts()))); } catch {}
		}, 300);
	}
	// 列表上的回复数：<span title="699 comments" class="info-comments-count"><span title="700 comments">699</span></span>。
	// 每一行记下过就不再看（2026-10-23：以前每次扫描都把一页 95 行重新找一遍、解析一遍）
	var nsmaxReplyCountRows = new WeakSet();
	function nsmaxRememberListReplyCounts() {
		for (const item of document.querySelectorAll("ul.post-list > li.post-list-item")) {
			if (nsmaxReplyCountRows.has(item)) continue;
			const id = item.querySelector(".post-title a[href*='/post-']")?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1];
			const box = item.querySelector(".info-comments-count");
			if (!id || !box) continue;
			const count = Number((box.getAttribute("title") || "").match(/^(\d+)\s*comments?/i)?.[1] ?? box.textContent.replace(/\D/g, ""));
			if (box.textContent.replace(/\D/g, "") === "" || !Number.isFinite(count)) continue;
			nsmaxRememberReplyCount(id, count);
			nsmaxReplyCountRows.add(item);
		}
	}
	var nsmaxReplyFetching = new Set();
	function nsmaxPostReplyCount() {
		const data = unsafeWindow$1.__config__?.postData || {};
		const id = String(data.postId || location.pathname.match(/^\/post-(\d+)/)?.[1] || "");
		if (!id) return null;
		const pages = Math.max(1, Number(data.postPageCount) || 1);
		const page = Number(data.postPage) || Number(location.pathname.match(/^\/post-\d+-(\d+)/)?.[1]) || 1;
		const floors = Array.from(document.querySelectorAll("#nsk-body-left ul.comments li.content-item[id]"), (li) => Number(li.id)).filter(Number.isFinite);
		const here = floors.length ? Math.max(...floors) : 0;
		if (page >= pages && document.readyState !== "loading") {
			nsmaxRememberReplyCount(id, here);
			return here;
		}
		const cached = nsmaxReplyCounts().get(id);
		if ((!cached || Date.now() - cached[1] > 10 * 60e3) && !nsmaxReplyFetching.has(id) && pages > 1 && !nsmaxBackgroundPaused()) {
			nsmaxReplyFetching.add(id);
			// 等页面自己加载完再取（2026-10-24：不和正文图片抢网速）
			nsmaxPageLoaded().then(() => fetch(`/post-${id}-${pages}`, { credentials: "same-origin", priority: "low" })).then((response) => response.ok ? response.text() : "").then((html) => {
				if (!html) return;
				const doc = new DOMParser().parseFromString(html, "text/html");
				const last = Array.from(doc.querySelectorAll("ul.comments li.content-item[id]"), (li) => Number(li.id)).filter(Number.isFinite);
				if (!last.length) return;
				nsmaxRememberReplyCount(id, Math.max(...last));
				nsmaxShowPostReplyCount();
			}).catch(() => {});
		}
		return cached ? Math.max(cached[0], here) : null;
	}
	// 把回复总数写到标题栏、评论区标题、抽奖卡片上（拿到最后一页的数以后也调一次）
	function nsmaxShowPostReplyCount() {
		const count = nsmaxPostReplyCount();
		if (count === null) return;
		const stat = document.querySelector("#nsk-body-left .nsk-post .nsmax-post-stats .nsmax-post-stat-item:last-child > span");
		if (stat && stat.textContent !== String(count)) stat.textContent = String(count);
		const heading = document.querySelector("#nsk-body-left .comment-container .nsmax-reply-title");
		if (heading && heading.textContent !== `${count} 条回复`) heading.textContent = `${count} 条回复`;
		for (const span of document.querySelectorAll("#nsk-body-left .nsk-post .nsmax-lottery [data-nsmax-replies]")) {
			if (span.textContent !== `${count} 条回复`) span.textContent = `${count} 条回复`;
		}
	}
	function nsmaxDecoratePostDetail() {
		if (!/^\/post-\d+/.test(location.pathname)) return;

		// 0. 底部分页器移出评论卡片容器，直接落在页面底色上（所有页数均生效，即使没有 OP 主帖）
		const commentContainer = document.querySelector("#nsk-body-left .comment-container, .comment-container");
		if (commentContainer) {
			const bottomPager = commentContainer.querySelector(".post-bottom-pager, .nsk-pager:not(.post-top-pager):not(.pager-top)");
			if (bottomPager) {
				const pagerWrapper = bottomPager.closest(".comment-container > div") || bottomPager;
				// 外观（透明底、无框）由主题 CSS 的 .nsmax-detached-pager 负责，这里只打标记、只移动一次
				if (!pagerWrapper.classList.contains("nsmax-detached-pager")) pagerWrapper.classList.add("nsmax-detached-pager");
				if (pagerWrapper.parentElement === commentContainer) {
					commentContainer.after(pagerWrapper);
				}
			}
		}

		// 主帖：.nsk-post，没有时找楼号 0 的那层。id 以数字开头不能写成 #0（选择器不合法会直接抛错：站点出错页、帖子不存在时
		// 页面上没有 .nsk-post，走到这里整轮整理就断了，2026-10-20），用属性选择器
		const opPost = document.querySelector(".nsk-post") || document.querySelector('#nsk-body-left .content-item[id="0"]') || document.querySelector('.content-item[id="0"]');
		if (!opPost) return;

		// 1. 彻底隐藏 OP 主帖 #0 楼号
		for (const floor of opPost.querySelectorAll(".floor-link-wrapper, a.floor-link, [href='#0'], [href*='#0']")) {
			if (!floor.hasAttribute("hidden")) {
				floor.style.setProperty("display", "none", "important");
				floor.setAttribute("hidden", "");
			}
		}

		// 2. 标题栏右侧浏览量与回复数统计 (👁️ 浏览量  💬 回复数)，对齐 sb.sb
		const postTitle = opPost.querySelector(".post-title") || document.querySelector(".nsk-post .post-title");
		if (postTitle) {
			let stats = postTitle.querySelector(".nsmax-post-stats");
			if (!stats || !stats.querySelector(".nsmax-post-stat-item")) {
				if (!stats) {
					stats = document.createElement("div");
					stats.className = "nsmax-post-stats";
					postTitle.append(stats);
				}
				// 浏览数用站点给的 __config__.postData.views（以前还会拿页面上第一个 .info-views、在全文里找「N 浏览」，都可能是别的数）
				let views = "";
				const configViews = unsafeWindow$1.__config__?.postData?.views;
				if (configViews !== undefined && configViews !== null && Number.isFinite(Number(configViews))) views = String(Number(configViews));
				const viewsEl = views ? null : postTitle.querySelector(".views, [title*='views'], [title*='浏览']");
				if (viewsEl) views = viewsEl.textContent.replace(/[^\d.,kKwW万千]/g, "").trim();
				if (!views) views = "—";

				// 回复总数见 nsmaxPostReplyCount
				const replyCount = nsmaxPostReplyCount();
				const replies = replyCount === null ? "—" : String(replyCount);

				stats.innerHTML = `
				<span class="nsmax-post-stat-item" title="浏览量">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
					<span>${views}</span>
				</span>
				<span class="nsmax-post-stat-item" title="回复数">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					<span>${replies}</span>
				</span>
			`;
				for (const oldViews of postTitle.querySelectorAll(".views, [title*='views'], [title*='浏览'], span:has(>svg:not(.meta-icon)):not(.nsmax-post-stats *)")) {
					oldViews.style.setProperty("display", "none", "important");
				}
				if (stats.parentElement !== postTitle) postTitle.append(stats);
			} else {
				nsmaxShowPostReplyCount();
			}
		}

		// 3. 在 OP 楼主信息右侧添加小字操作栏（引用、回复、举报）
		const metaInfo = opPost.querySelector(".nsk-content-meta-info") || opPost.querySelector(".author-info")?.parentElement;
		if (metaInfo && !metaInfo.querySelector(".nsmax-op-actions")) {
			const actions = document.createElement("div");
			actions.className = "nsmax-op-actions";
			actions.innerHTML = `
				<a class="nsmax-op-action nsmax-op-quote" role="button" title="引用正文">引用</a>
				<a class="nsmax-op-action nsmax-op-reply" role="button" title="回复本帖">回复</a>
				<a class="nsmax-op-action nsmax-op-report" role="button" title="举报本帖">举报</a>
			`;

			const getEditor = () => {
				const editor = document.querySelector(".md-editor");
				const cm = editor?.querySelector(".CodeMirror")?.CodeMirror;
				const input = editor?.querySelector("textarea:not(.CodeMirror textarea)");
				const submit = editor?.querySelector("button.submit, button[type=submit], .submit-row button, .topic-select button");
				return { editor, cm, input, submit };
			};

			actions.querySelector(".nsmax-op-quote").addEventListener("click", () => {
				const nativeQuote = opPost.querySelector(".comment-menu [title='引用'], .comment-menu [data-nsmax-compact-action][title='引用']");
				if (nativeQuote) {
					nativeQuote.click();
				} else {
					const postBody = opPost.querySelector("article.post-content, .post-content")?.textContent?.trim() || "";
					const quoteText = postBody ? `> ${postBody.slice(0, 300).split("\n").join("\n> ")}\n\n` : "";
					const { editor, cm, input } = getEditor();
					if (cm) {
						const cur = cm.getValue();
						cm.setValue(cur ? `${cur}\n\n${quoteText}` : quoteText);
						cm.refresh();
					} else if (input) {
						const cur = input.value || "";
						input.value = cur ? `${cur}\n\n${quoteText}` : quoteText;
						input.dispatchEvent(new Event("input", { bubbles: true }));
					}
				}
				// 引用的内容已经在编辑器里：去最后一页最下面的回复框（还不在最后一页时打开最后一页，内容带过去）
				nsmaxGoReplyEnd();
			});

			actions.querySelector(".nsmax-op-reply").addEventListener("click", () => nsmaxGoReplyEnd());

			// 「举报」：在这一页的回复框里写上「@admin 」、光标放在后面，别的都不做（不自动发出去、不跳到别的页，2026-10-18）。
			// 已经写了别的内容时加在最前面
			actions.querySelector(".nsmax-op-report").addEventListener("click", () => {
				const md = getEditor().editor;
				if (!md) return;
				nsmaxComposer?.restore(false);
				const value = nsmaxEditorValue(md);
				if (!/(^|\s)@admin\b/.test(value)) nsmaxSetEditorValue(md, value.trim() ? `@admin ${value}` : "@admin ");
				nsmaxFocusReplyBox();
			});

			metaInfo.append(actions);
		}

		// 自己的主帖：NodeSeek 的「编辑」在主帖下方的按钮里（没有标题也没有图标，只剩一个色块）。sb.sb 把编辑放在楼主信息右侧的
		// 小字操作里（回复 编辑 …），这里照做：小字操作栏里补一个「编辑」，点它就是点原站的编辑按钮；补上以后原站那个按钮隐藏
		const opBar = metaInfo?.querySelector(".nsmax-op-actions");
		if (opBar) {
			const nativeEdit = opPost.querySelector(".content-item > .comment-menu > .menu-item[data-nsmax-action='edit']");
			let editLink = opBar.querySelector(".nsmax-op-edit");
			if (nativeEdit && !editLink) {
				editLink = document.createElement("a");
				editLink.className = "nsmax-op-action nsmax-op-edit";
				editLink.setAttribute("role", "button");
				editLink.title = "编辑本帖";
				editLink.textContent = "编辑";
				editLink.addEventListener("click", () => opPost.querySelector(".content-item > .comment-menu > .menu-item[data-nsmax-action='edit']")?.click());
				const reply = opBar.querySelector(".nsmax-op-reply");
				if (reply) reply.after(editLink);
				else opBar.append(editLink);
			} else if (!nativeEdit && editLink) editLink.remove();
			if (nativeEdit) nsmaxSetAttr(nativeEdit, "data-nsmax-op-moved");
			// 站点在楼主信息行里还留了一个纯文字「编辑」链接（和上面补的胶囊重复）：收起来，只保留胶囊里的那个
			if (editLink) for (const link of opPost.querySelectorAll(".content-info a, .nsk-content-meta-info a")) {
				if (link === editLink || link.classList.contains("nsmax-op-edit") || link.classList.contains("nsmax-floor-edit")) continue;
				if (/^编辑$/.test(link.textContent.trim())) nsmaxSetAttr(link, "data-nsmax-op-moved");
			}
		}

		// 4. 清理主帖底部 comment-menu 内的“引用”和“回复”
		const opMenu = opPost.querySelector(".comment-menu");
		if (opMenu) {
			for (const item of opMenu.querySelectorAll(".menu-item")) {
				const text = item.title || item.getAttribute("aria-label") || item.textContent || "";
				if (/引用|回复/.test(text)) item.remove();
			}
		}
	}
	function nsmaxSetupMarkdownTabs() {
		// 分开查再去重（article.post-content 两段都命中，以前同一块正文要翻两遍）
		const postContainers = new Set();
		nsmaxQueryEach([".post-content", ".markdown-body", ".comment-content", "article"], (el) => postContainers.add(el));
		if (!postContainers.size) return;

		for (const container of postContainers) {
			// 不用 div:has(...)：每次扫描都要对正文里每个 div（终端一行就是一个 div）做一遍子元素匹配，太重。
			// 先找标签头元素，再取它的父元素作为分组。NodeSeek 自己的 .nsk-magic-tabs 由站点脚本处理，不碰。
			const tabGroups = new Set(container.querySelectorAll(".tabs, .tabset, .markdown-tabs, .tab-container, .tabs-container, [class*='tab-set'], [class*='tabs-component']"));
			for (const head of container.querySelectorAll(".tab-item, [class*='tab-nav'], ul.nav-tabs")) if (head.parentElement?.matches("div")) tabGroups.add(head.parentElement);
			for (const group of tabGroups) {
				if (group.hasAttribute("data-nsmax-tabs-ready") || group.closest(".xterm, .nsk-magic-tabs")) continue;
				group.setAttribute("data-nsmax-tabs-ready", "true");
				group.classList.add("nsmax-tabs-container");

				let tabHeaders = Array.from(group.querySelectorAll(":scope > .tabs-nav > *, :scope > .tab-nav > *, :scope > .tab-list > *, :scope > .tabs-header > *, :scope > ul > li, :scope > .nav-tabs > li, :scope > div:first-child > .tab-item, :scope > div:first-child > button, :scope > div:first-child > [role='tab']"));
				if (!tabHeaders.length) {
					const firstChild = group.firstElementChild;
					if (firstChild && firstChild.childElementCount > 1) {
						tabHeaders = Array.from(firstChild.children).filter(el => /tab/i.test(el.className) || el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "LI" || el.getAttribute("role") === "tab");
					}
				}
				if (!tabHeaders.length) {
					tabHeaders = Array.from(group.querySelectorAll("[role='tab'], .tab-item, .tab-btn, .tab-button, [data-tab]")).filter(el => el.closest(".tabs, .tabset, .nsmax-tabs-container") === group);
				}
				if (!tabHeaders.length) continue;

				const headerContainer = tabHeaders[0].parentElement;
				if (headerContainer && headerContainer !== group) {
					headerContainer.classList.add("nsmax-tabs-nav");
				}

				let panels = Array.from(group.querySelectorAll(":scope > .tab-content > *, :scope > .tabs-content > *, :scope > .tab-panels > *, :scope > .tab-pane, :scope > .tab-panel, :scope > [role='tabpanel']"));
				if (!panels.length) {
					panels = Array.from(group.children).filter(el => el !== headerContainer && !el.contains(tabHeaders[0]));
				}
				if (!panels.length) continue;

				let activeIndex = tabHeaders.findIndex(t => t.classList.contains("active") || t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true");
				if (activeIndex < 0) activeIndex = 0;

				const activateTab = (index) => {
					tabHeaders.forEach((tab, i) => {
						const isActive = i === index;
						tab.classList.toggle("active", isActive);
						tab.classList.toggle("is-active", isActive);
						tab.setAttribute("aria-selected", String(isActive));
						if (tab.tagName === "BUTTON" || tab.tagName === "A") {
							tab.setAttribute("tabindex", isActive ? "0" : "-1");
						}
					});

					panels.forEach((panel, i) => {
						const isActive = i === index;
						panel.classList.toggle("active", isActive);
						panel.classList.toggle("is-active", isActive);
						if (isActive) {
							panel.removeAttribute("hidden");
							panel.style.removeProperty("display");
						} else {
							panel.setAttribute("hidden", "");
							panel.style.setProperty("display", "none", "important");
						}
					});
				};

				activateTab(activeIndex);

				(headerContainer || group).addEventListener("click", (e) => {
					if (!(e.target instanceof Element)) return;
					let clickedIndex = tabHeaders.findIndex(tab => tab === e.target || tab.contains(e.target));
					if (clickedIndex < 0) {
						const anchor = e.target.closest("a, button, [data-tab]");
						const panelId = anchor?.getAttribute("data-tab") || anchor?.getAttribute("href")?.replace(/^#/, "");
						if (panelId) clickedIndex = panels.findIndex(p => p.id === panelId);
					}
					if (clickedIndex >= 0) {
						e.preventDefault();
						e.stopPropagation();
						activateTab(clickedIndex);
					}
				});
			}
		}
	}
	// 我的关注 / 我的粉丝（/fans）：按 sb.sb /u/<id>/following/ 的成员列表重排。
	// 原站结构：.member-list > .fans-switcher（两个切换链接）+ .user-card-wrapper-container > .user-card-wrapper > .user-card
	// （.user-head 头像与名字 / 加入天数或签名，.user-stat 等级、鸡腿、星辰、主题帖、评论数、粉丝，.usercard-button-group 转账 / 取关 / 私信）。
	// 每张卡片里追加一块 sb.sb .member-row 版式（原有子元素用 CSS 收起），三个按钮挪进来，保留原站的点击逻辑；只在值变化时写 DOM。
	// 账簿（/credit）：鸡腿变动按正负上色（sb.sb .points-ledger .num.plus / .minus）；翻页时原站复用同一批单元格，只在值变化时写
	function nsmaxPrepareCredit() {
		if (!/^\/credit(?:\/|$)/.test(location.pathname)) return;
		for (const td of document.querySelectorAll(".credit-table table > tbody > tr > td:first-child")) {
			const n = Number(td.textContent.trim().replace(/^\+/, ""));
			nsmaxFlag(td, "data-nsmax-num", Number.isFinite(n) && n !== 0, n > 0 ? "plus" : "minus");
		}
	}
	// 设置页（/setting）按 sb.sb「个人资料」页：卡片标题用当前分页名；英文字段名改成中文并补一行说明；
	// 存储位置 Local / Remote 改成「仅本机 / 同步到账号」；和卡片标题重复的分页小标题隐藏；只放了按钮的一行标成操作行。只在值不同时才写 DOM
	var NSMAX_SETTING_FIELDS = {
		Bio: ["简介", "一句话介绍自己"],
		签名: ["签名", "显示在你的帖子和回复正文下方，支持 Markdown"],
		Readme: ["主页介绍", "显示在你的个人主页，支持 Markdown"]
	};
	// 登录、邮箱 / 短信验证登录、注册页按 sb.sb 登录页（.auth-split）排：左边黄底品牌区（站名、站标、说明），右边「登录 / 注册」标签 + 表单。
	// 表单是站点的 Vue 应用渲染的，不动它里面的节点；品牌区和标签插在 Vue 挂载容器外面那一层（登录页 #nsk-body-left-block、注册页 #nsk-frame-block、
	// 短信登录页 #nsk-body-left），只在缺少时插入。说明文字只写页面上本来就有的信息。
	var NSMAX_AUTH_PAGES = {
		"/signIn.html": ["signIn", "登录说明", ["用户名或注册邮箱都可以登录。", "也可以用邮箱或短信动态验证码登录。", "使用公共设备后请退出登录。"]],
		"/emailSignIn.html": ["signIn", "邮箱验证码登录", ["填写注册邮箱，点「发送验证码」，再填收到的验证码。", "想用用户名和密码登录，点上面的「登录」。", "使用公共设备后请退出登录。"]],
		"/smsSignIn.html": ["signIn", "短信验证登录", ["按页面上的提示，用绑定的手机号发送短信完成验证。", "想用用户名和密码登录，点上面的「登录」。", "使用公共设备后请退出登录。"]],
		"/register.html": ["register", "注册说明", ["用户名 2–15 个字符，密码 6–18 个字符。", "用邮箱或手机号接收验证码。", "提交前请先阅读服务条款。"]]
	};
	function nsmaxAuthShell() {
		const own = (child) => !child.matches(".nsmax-auth-hero, .nsmax-auth-tabs, script, style");
		const block = document.querySelector("#nsk-body-left > #nsk-body-left-block");
		const blockApp = block && Array.from(block.children).find(own);
		if (blockApp) return [block, blockApp];
		const frame = document.querySelector("#nsk-frame > #nsk-frame-block");
		const frameApp = frame && Array.from(frame.children).find(own);
		if (frameApp?.querySelector("form")) return [frame, frameApp];
		const left = document.querySelector("#nsk-body-left");
		const form = left?.querySelector(":scope > form");
		return form ? [left, form] : [];
	}
	function nsmaxPrepareAuth() {
		const page = NSMAX_AUTH_PAGES[location.pathname];
		if (!page) return;
		const [shell, app] = nsmaxAuthShell();
		if (!shell) return;
		const [kind, title, notes] = page;
		nsmaxSetAttr(shell, "data-nsmax-auth-card", kind);
		nsmaxSetAttr(app, "data-nsmax-auth-app", "");
		let hero = shell.querySelector(":scope > .nsmax-auth-hero");
		if (!hero) {
			hero = document.createElement("aside");
			hero.className = "nsmax-auth-hero";
			const name = document.createElement("div");
			name.className = "nsmax-auth-hero-name";
			name.textContent = "NodeSeek";
			const art = document.createElement("div");
			art.className = "nsmax-auth-hero-art";
			const logo = document.createElement("span");
			logo.className = "nsmax-auth-hero-logo";
			logo.setAttribute("aria-hidden", "true");
			art.append(logo);
			const box = document.createElement("div");
			box.className = "nsmax-auth-hero-notes";
			const head = document.createElement("span");
			head.className = "nsmax-auth-hero-notes-title";
			head.textContent = title;
			const list = document.createElement("ul");
			for (const text of notes) {
				const item = document.createElement("li");
				item.textContent = text;
				list.append(item);
			}
			box.append(head, list);
			hero.append(name, art, box);
			shell.prepend(hero);
		}
		if (!shell.querySelector(":scope > .nsmax-auth-tabs")) {
			const tabs = document.createElement("nav");
			tabs.className = "nsmax-auth-tabs";
			tabs.setAttribute("aria-label", "登录或注册");
			for (const [label, href, key] of [["登录", "/signIn.html", "signIn"], ["注册", "/register.html", "register"]]) {
				const link = document.createElement("a");
				link.href = href;
				link.textContent = label;
				if (key === kind) link.setAttribute("aria-current", "page");
				tabs.append(link);
			}
			hero.after(tabs);
		}
		// 输入框后面紧跟「发送验证码」的一组排成一行；后面是提交按钮的不算，它本来就另起一行，排成两列只会让输入框短 8px
		for (const set of app.querySelectorAll("fieldset")) nsmaxFlag(set, "data-nsmax-auth-row", !!set.querySelector(":scope > input + button[type=button], :scope > input + span + button[type=button]"));
		nsmaxPasswordToggles(app);
	}
	// 登录 / 注册页密码框右侧的「显示 / 隐藏」：sb.sb 登录页在密码框里放了同款文字按钮（2026-10-21）。
	// 不动表单结构（站点样式里有 fieldset > input 这类直接子元素选择器），按钮挂在最近的 fieldset 上绝对定位，
	// 竖向位置按密码框自己的 offsetTop 算，窗口缩放 / 字体加载完再量一次。
	const nsmaxPasswordFields = new Map();
	// 以「top:0 时按钮落在哪儿」为原点自己量：fieldset 的 <legend> 会把绝对定位的包含块往下推，
	// 用 input.offsetTop 算会和实际差一个 legend 的高度（注册页两个密码框的量出来差 28px）
	const nsmaxPlacePasswordToggle = (input, toggle) => {
		const field = input.closest("fieldset") || input.parentElement;
		if (!field || !toggle.isConnected || !input.isConnected) return;
		toggle.style.top = "0px";
		const origin = toggle.getBoundingClientRect().top;
		const inputRect = input.getBoundingClientRect();
		toggle.style.top = `${Math.max(0, Math.round(inputRect.top + (inputRect.height - toggle.offsetHeight) / 2 - origin))}px`;
	};
	function nsmaxPasswordToggles(app) {
		for (const input of app.querySelectorAll('input[type="password"]')) {
			if (nsmaxPasswordFields.has(input)) continue;
			const field = input.closest("fieldset") || input.parentElement;
			if (!field) continue;
			const toggle = document.createElement("button");
			toggle.type = "button";
			toggle.className = "nsmax-password-toggle";
			toggle.textContent = "显示";
			toggle.setAttribute("aria-label", "显示密码");
			toggle.setAttribute("aria-pressed", "false");
			toggle.addEventListener("click", () => {
				const show = input.type === "password";
				input.type = show ? "text" : "password";
				toggle.textContent = show ? "隐藏" : "显示";
				toggle.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
				toggle.setAttribute("aria-pressed", String(show));
				input.focus({ preventScroll: true });
			});
			field.append(toggle);
			input.setAttribute("data-nsmax-password", "");
			nsmaxPasswordFields.set(input, toggle);
			nsmaxPlacePasswordToggle(input, toggle);
			requestAnimationFrame(() => nsmaxPlacePasswordToggle(input, toggle));
		}
		document.fonts?.ready?.then(() => {
			for (const [input, toggle] of nsmaxPasswordFields) nsmaxPlacePasswordToggle(input, toggle);
		}).catch(() => {});
	}
	window.addEventListener("resize", () => {
		for (const [input, toggle] of nsmaxPasswordFields) nsmaxPlacePasswordToggle(input, toggle);
	}, { passive: true });
	// 签到排行（/board）、管理记录（/ruling）是没有右栏的独立页面：照列表页补一个右栏（资料卡、今日热门、最近浏览），
	// 主栏和右栏一起放进 1600px 版心，左右和顶栏的站标、齿轮对齐。资料卡用页面配置里的当前用户信息拼出原生资料卡的结构，交给 nsmaxBuildAccountCard 排版
	// 个人主页也补（2026-10-24，照 sb.sb /u/…/：资料卡下面是主栏，右边资料卡、今日热门、最近浏览）
	function nsmaxSidePage(path = location.pathname) {
		return /^\/(?:board|ruling)(?:\/|$)|^\/space\/\d+/.test(path);
	}
	// 发帖页也有右栏（照 sb.sb /t/new/：表单 + 右边资料卡、今日热门、最近浏览，2026-10-18 第七批）
	function nsmaxNewPostPage(path = location.pathname) {
		return /^\/new-discussion(?:\/|$)/.test(path);
	}
	// 自己的资料（名字、头像、等级、鸡腿、星辰、主题帖、评论数）：站点只在有右栏的页面给资料卡，在那些页面上记一份；
	// 签到、管理记录、发帖这些脚本自己补右栏的页面先按记下的画（页面解析阶段站点配置还没出来），站点配置里有的数字再盖上去
	var NSMAX_ACCOUNT_KEY = "nsmax:account";
	function nsmaxStoredAccount() {
		try {
			const value = JSON.parse(localStorage.getItem(NSMAX_ACCOUNT_KEY) || "null");
			return value && typeof value === "object" ? value : {};
		} catch {
			return {};
		}
	}
	function nsmaxRememberAccount(data) {
		const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== "" && !Number.isNaN(value)));
		if (!Number.isSafeInteger(Number(clean.id))) return;
		const stored = nsmaxStoredAccount();
		const next = { ...(String(stored.id) === String(clean.id) ? stored : {}), ...clean };
		if (Object.keys(next).every((key) => next[key] === stored[key])) return;
		try { localStorage.setItem(NSMAX_ACCOUNT_KEY, JSON.stringify(next)); } catch {}
	}
	function nsmaxPrepareSidePage(early = false) {
		const newPost = nsmaxNewPostPage();
		if (!nsmaxSidePage() && !newPost) return;
		if (document.getElementById("nsk-right-panel-container")) return;
		const frame = document.querySelector("section#nsk-frame");
		if (!frame) return;
		let host;
		if (newPost) {
			host = document.getElementById("nsk-body");
			if (!host || document.getElementById("nsk-body-left")?.parentElement !== host) return;
		} else {
			if (frame.querySelector(":scope > #nsk-body")) return;
			nsmaxSetAttr(frame, "data-nsmax-side-page", "");
			host = frame;
		}
		const config = unsafeWindow$1.__config__?.user;
		const live = { id: config?.member_id, name: config?.member_name, rank: config?.rank, coin: config?.coin, stardust: config?.stardust, nPost: config?.nPost, nComment: config?.nComment };
		const stored = nsmaxStoredAccount();
		const user = { ...(live.id === undefined || String(stored.id) === String(live.id) ? stored : {}), ...Object.fromEntries(Object.entries(live).filter(([, value]) => value !== undefined && value !== null)) };
		const id = Number(user.id);
		const known = Number.isSafeInteger(id) && id > 0 && typeof user.name === "string" && !!user.name;
		// 页面解析阶段只在记过资料时先画（站点配置在页面最后才有）；没记过的等页面解析完再补
		if (early && !known) return;
		const side = document.createElement("div");
		side.id = "nsk-right-panel-container";
		nsmaxThemeRequire("side");
		side.className = "nsmax-side-panel";
		if (known) {
			const card = document.createElement("div");
			card.className = "user-card";
			const head = document.createElement("div");
			head.className = "user-head";
			const picture = document.createElement("a");
			picture.href = `/space/${id}`;
			const avatar = document.createElement("img");
			avatar.className = "avatar-normal";
			avatar.src = user.avatar || `/avatar/${id}.png`;
			avatar.alt = user.name;
			picture.append(avatar);
			const menu = document.createElement("div");
			menu.className = "menu";
			const name = document.createElement("a");
			name.className = "Username";
			name.href = `/space/${id}`;
			name.textContent = user.name;
			menu.append(name);
			head.append(picture, menu);
			const stats = document.createElement("div");
			stats.className = "user-stat";
			const number = (value) => Number.isFinite(Number(value)) && value !== null && value !== "" ? String(Number(value)) : "—";
			for (const [label, value] of [["等级", `Lv ${number(user.rank)}`], ["鸡腿", number(user.coin)], ["星辰", number(user.stardust)], ["主题帖", number(user.nPost)], ["评论数", number(user.nComment)]]) {
				const cell = document.createElement("div");
				const text = document.createElement("span");
				text.dataset.nsmaxStat = label;
				text.textContent = `${label} ${value}`;
				cell.append(text);
				stats.append(cell);
			}
			card.append(head, stats);
			const box = document.createElement("div");
			const post = document.createElement("a");
			post.className = "btn new-discussion";
			post.href = "/new-discussion";
			post.textContent = "发帖";
			box.append(post);
			side.append(card, box);
		}
		host.append(side);
		// 站点配置里没有主题帖、评论数（签到、管理记录、发帖页都没有）：页面解析完读一次自己的资料补上
		if (known && !early) nsmaxRefreshSideAccount(id);
	}
	function nsmaxRefreshSideAccount(id) {
		// 自己的个人主页上，主页资料卡已经在读同一个人的资料（nsmaxSpaceInfo）：共用那一次，不再多发一个请求
		const own = location.pathname.match(/^\/space\/(\d+)/)?.[1] === String(id);
		(own ? nsmaxSpaceInfo(String(id)).then((detail) => ({ detail })) : fetch(`/api/account/getInfo/${id}`, { credentials: "same-origin" }).then((res) => res.json())).then((json) => {
			const data = json?.detail || json?.data;
			if (!data || json?.success === false) return;
			const values = { "等级": data.rank !== undefined ? `Lv ${data.rank}` : undefined, "鸡腿": data.coin, "星辰": data.stardust, "主题帖": data.nPost, "评论数": data.nComment };
			let changed = false;
			for (const span of document.querySelectorAll("#nsk-right-panel-container .user-card .user-stat [data-nsmax-stat]")) {
				const value = values[span.dataset.nsmaxStat];
				if (value === undefined || value === null) continue;
				const text = `${span.dataset.nsmaxStat} ${value}`;
				if (span.textContent !== text) { span.textContent = text; changed = true; }
			}
			nsmaxRememberAccount({ id, name: data.member_name, rank: data.rank, coin: data.coin, stardust: data.stardust, nPost: data.nPost, nComment: data.nComment });
			if (changed) nsmaxBuildAccountCard();
		}).catch(() => {});
	}
	// 右栏固定在顶栏下面、可以单独滚动（样式见主题第 33 节）：只认用户自己在右栏上的滚动（滚轮、触摸、键盘）；
	// 页面别处的操作（切换 Markdown 编辑器、聚焦输入框……）让浏览器顺带滚了右栏的，滚回原位，资料卡不会被卷走半截
	function nsmaxGuardSidebarScroll() {
		const side = document.getElementById("nsk-right-panel-container");
		if (!side || side._nsmaxScrollGuard) return;
		side._nsmaxScrollGuard = true;
		let userUntil = 0;
		let last = side.scrollTop;
		const intent = () => {
			userUntil = performance.now() + 900;
		};
		for (const type of ["wheel", "touchstart", "touchmove", "pointerdown", "keydown"]) side.addEventListener(type, intent, { passive: true });
		side.addEventListener("scroll", () => {
			if (performance.now() <= userUntil) {
				last = side.scrollTop;
				return;
			}
			if (Math.abs(side.scrollTop - last) > 1) side.scrollTop = last;
		}, { passive: true });
	}
	function nsmaxPrepareSetting() {
		if (!/^\/setting(?:\/|$)/.test(location.pathname)) return;
		const right = document.querySelector("#user-setting-panel .selector-right-side");
		if (!right) return;
		const current = document.querySelector("#user-setting-panel .selector-left-side a.select-item.selected")?.textContent.trim() || "";
		nsmaxFlag(right, "data-nsmax-setting-title", !!current, current);
		for (const h2 of right.querySelectorAll("fieldset > h2")) {
			const key = h2.getAttribute("data-nsmax-field") || h2.textContent.trim();
			const entry = NSMAX_SETTING_FIELDS[key];
			if (!entry) continue;
			nsmaxSetAttr(h2, "data-nsmax-field", key);
			nsmaxSetText(h2, entry[0]);
			let hint = h2.nextElementSibling;
			if (!hint?.classList.contains("nsmax-setting-hint")) {
				hint = document.createElement("p");
				hint.className = "nsmax-setting-hint";
				h2.after(hint);
			}
			nsmaxSetText(hint, entry[1]);
		}
		for (const tip of right.querySelectorAll(".storage-tip")) {
			const raw = tip.getAttribute("data-nsmax-storage") || tip.textContent.trim();
			nsmaxSetAttr(tip, "data-nsmax-storage", raw);
			nsmaxSetText(tip, raw === "Local" ? "仅本机" : raw === "Remote" ? "同步到账号" : raw);
			nsmaxSetAttr(tip, "title", raw === "Local" ? "只保存在这个浏览器里" : raw === "Remote" ? "保存在账号上，换设备也生效" : raw);
		}
		for (const h2 of right.querySelectorAll(":scope > div > h2, :scope > form > h2")) nsmaxFlag(h2, "data-nsmax-dup-title", !!current && h2.textContent.trim() === current);
		for (const row of right.querySelectorAll("form > div")) nsmaxFlag(row, "data-nsmax-setting-actions", row.children.length > 0 && Array.from(row.children).every((child) => child.matches("button, .btn")));
	}
	// 关注 / 粉丝页第一帧：数据是站点前端画的（先是一张转圈 gif + 英文 Loading，整块换掉）。
	// 照列表骨架放 4 行占位（头像圆 + 两行灰条），比一张大空卡片中间一个小转圈好看，数据到了自然消失
	function nsmaxFansSkeleton() {
		const mount = document.querySelector("#nsk-frame #fans-mount");
		if (!mount || mount.querySelector(":scope > .nsmax-fans-skeleton")) return;
		if (!mount.querySelector(":scope > .loading-img, :scope > span")) return;
		const list = document.createElement("div");
		list.className = "nsmax-fans-skeleton";
		for (let i = 0; i < 6; i++) {
			const row = document.createElement("div");
			row.className = "nsmax-fans-skeleton-row";
			const avatar = document.createElement("span");
			avatar.className = "nsmax-skeleton-line nsmax-fans-skeleton-avatar";
			const body = document.createElement("span");
			body.className = "nsmax-fans-skeleton-body";
			const line = document.createElement("span");
			line.className = "nsmax-skeleton-line";
			const short = document.createElement("span");
			short.className = "nsmax-skeleton-line nsmax-fans-skeleton-short";
			body.append(line, short);
			row.append(avatar, body);
			list.append(row);
		}
		mount.replaceChildren(list);
	}
	function nsmaxPrepareFans() {
		if (!/^\/fans(?:\/|$)/.test(location.pathname)) return;
		nsmaxFansSkeleton();
		// 「取关」：站点给这个按钮写了行内的 background-color: gray !important（压过所有样式表），灰底灰字很怪；
		// 去掉这条行内样式，按 sb.sb 的细线按钮排（悬停时浅红，提示是取消关注）
		for (const btn of document.querySelectorAll(":is(.nsmax-member-actions, .usercard-button-group) > .btn")) {
			if (btn.textContent.trim() !== "取关") continue;
			nsmaxSetAttr(btn, "data-nsmax-unfollow");
			if (btn.style.getPropertyValue("background-color")) btn.style.removeProperty("background-color");
		}
		for (const tab of document.querySelectorAll(".fans-switcher > a.switcher-item")) {
			const label = (tab.textContent || "").replace(/[^\u4e00-\u9fa5A-Za-z0-9 ]/g, "").trim();
			if (label && tab.getAttribute("data-nsmax-label") !== label) {
				tab.setAttribute("data-nsmax-label", label);
				nsmaxSetText(tab, label);
			}
		}
		for (const card of document.querySelectorAll(".user-card-wrapper > .user-card")) {
			const text = card.querySelector(":scope > .user-stat")?.textContent || "";
			const num = (re) => text.match(re)?.[1];
			const stats = { level: num(/等级\s*(?:Lv\.?\s*)?(\d+)/i), coin: num(/鸡腿\s*(\d+)/), star: num(/星辰\s*(\d+)/), post: num(/主题帖?\s*(\d+)/), comment: num(/评论数?\s*(\d+)/), fans: num(/粉丝\s*(\d+)/) };
			const signature = JSON.stringify(stats) + "|" + (card.querySelector(".user-head .menu")?.textContent || "");
			let row = card.querySelector(":scope > .nsmax-member");
			if (row && row.getAttribute("data-nsmax-sig") === signature) {
				// 按钮可能被原站重新渲染：不在我们这块里的就挪进来
				const buttons = card.querySelector(":scope > .usercard-button-group");
				const slot = row.querySelector(".nsmax-member-actions");
				if (buttons && slot) for (const btn of buttons.querySelectorAll(":scope > .btn")) slot.append(btn);
				continue;
			}
			row?.remove();
			row = document.createElement("div");
			row.className = "nsmax-member";
			row.setAttribute("data-nsmax-sig", signature);
			const head = card.querySelector(":scope > .user-head");
			const nameLink = head?.querySelector(".Username, a[href*='/space/']:not(:has(img))") || head?.querySelector("a[href*='/space/']");
			const href = nameLink?.getAttribute("href") || head?.querySelector("a[href]")?.getAttribute("href") || "#";
			const avatarLink = document.createElement("a");
			avatarLink.className = "nsmax-member-avatar";
			avatarLink.href = href;
			const img = head?.querySelector("img");
			if (img) { const copy = document.createElement("img"); copy.src = img.src; copy.alt = ""; copy.loading = "lazy"; avatarLink.append(copy); }
			const body = document.createElement("div");
			body.className = "nsmax-member-body";
			const title = document.createElement("div");
			title.className = "nsmax-member-title";
			const name = document.createElement("a");
			name.className = "nsmax-member-name";
			name.href = href;
			name.textContent = (nameLink?.textContent || "").trim();
			title.append(name);
			if (stats.level) { const badge = document.createElement("span"); nsmaxApplyLevel(badge, stats.level); title.append(badge); }
			// 签名或加入天数：原站写的是英文「Joined 1316days ago」
			const metaText = Array.from(head?.querySelector(".menu")?.children || []).filter((el) => el !== nameLink).map((el) => el.textContent.trim()).find(Boolean) || "";
			const joined = metaText.match(/Joined\s*(\d+)\s*days?\s*ago/i);
			const bio = document.createElement("span");
			bio.className = "nsmax-member-bio";
			bio.textContent = joined ? `加入 ${joined[1]} 天` : metaText;
			if (metaText) bio.title = metaText;
			// 统计一行等宽小字（sb.sb .member-row-value），一行放不下就省略：鸡腿 · 粉丝 · 主题（2026-10-24：以前五项各占一格，
			// 窄的卡片折成两行，一排卡片高矮不齐）。五项全的写在悬停提示里
			const line = document.createElement("span");
			line.className = "nsmax-member-stats";
			const pairs = [["鸡腿", stats.coin], ["粉丝", stats.fans], ["主题", stats.post], ["评论", stats.comment], ["星辰", stats.star]].filter(([, value]) => value !== undefined);
			line.textContent = pairs.slice(0, 3).map(([label, value]) => `${label} ${value}`).join(" · ");
			line.title = pairs.map(([label, value]) => `${label} ${value}`).join("　");
			body.append(title);
			if (bio.textContent) body.append(bio);
			body.append(line);
			const actions = document.createElement("div");
			actions.className = "nsmax-member-actions";
			const buttons = card.querySelector(":scope > .usercard-button-group");
			// 顺序：关注 / 取关、私信、转账（关注状态最常用放最前）
			const btns = buttons ? Array.from(buttons.querySelectorAll(":scope > .btn")) : [];
			const rank = (btn) => /关注|取关/.test(btn.textContent) ? 0 : /私信/.test(btn.textContent) ? 1 : 2;
			for (const btn of btns.sort((a, b) => rank(a) - rank(b))) actions.append(btn);
			row.append(avatarLink, body, actions);
			card.append(row);
			card.setAttribute("data-nsmax-fan-rebuilt", "true");
		}
	}
	function nsmaxCleanNotifications() {
		if (!/^\/notifications?(?:\/|$)/.test(location.pathname)) return;
		const hasMessages = !!document.querySelector(".nspp-messages, #nspp-messages");
		if (hasMessages) {
			for (const sw of document.querySelectorAll(".nsk-notification > .app-switch, #nsk-body-left > .nsk-notification > .app-switch, .app-switch:has(a[href*='#/atMe'])")) {
				sw.style.setProperty("display", "none", "important");
			}
		}
	}
	// 帖子页的编辑器在「回复 / 编辑主帖 / 编辑回复」之间切换：NodeSeek 只改提交按钮上的字（发布评论 / 编辑帖子 / 编辑评论），
	// 编辑主帖时最上面多一个标题框（.title-input）、提交行多一组「阅读限制」。卡片标题跟着改成「编辑帖子 / 编辑回复」；
	// 编辑主帖时把脚本自己的标题栏挪到标题框上面（标题栏是脚本建的，挪它不碰站点 Vue 管的节点），标题框就排在卡片里、标题栏下面
	function nsmaxSyncEditorMode() {
		if (!/^\/post-\d+/.test(location.pathname)) return;
		for (const editor of document.querySelectorAll(".md-editor")) {
			const head = editor.querySelector(".nsmax-editor-head");
			const heading = head?.querySelector(".nsmax-editor-heading");
			// 提交行一般直接在编辑器下面（真站），有的结构在 #editor-body 里面：不限层级
			const button = editor.querySelector(":is(.topic-select, .submit-row) > button.submit");
			const text = (button?.textContent || "").trim();
			// 提交中按钮换成灰色的另一个按钮、字也不同：认不出的字沿用上一次的模式，标题栏不跟着闪
			const replyText = /^(?:发布评论|回复|回复楼主|回复层主)$/.test(text) || /^回复 \S/.test(text);
			const mode = { "编辑帖子": "edit-discussion", "编辑评论": "edit-comment" }[text] || (replyText ? "reply" : "") || editor.getAttribute("data-nsmax-editor-mode") || "reply";
			nsmaxSetAttr(editor, "data-nsmax-editor-mode", mode);
			if (heading) nsmaxSetText(heading, mode === "edit-discussion" ? "编辑帖子" : mode === "edit-comment" ? "编辑回复" : "发表回复");
			if (button && replyText) nsmaxSetText(button, nsmaxReplyLabel(editor));
			const title = editor.querySelector(":scope > .title-input");
			const body = editor.querySelector(":scope > #editor-body");
			if (head && title) {
				if (head.nextElementSibling !== title) editor.insertBefore(head, title);
			} else if (head && body && head.parentElement !== body) body.prepend(head);
		}
	}
	// 一句话提示：照 sb.sb showToast——屏幕下方居中的深色小条（出错时红底），停留 4 秒，字多时每多一个字多 0.16 秒
	// （最多 10 秒，出错至少 6 秒）；连续触发时换文字、重新计时。2026-10-18 起脚本所有提示（各模块的通知、站点的提示框）都走这里。
	// 用 popover 放进顶层：设置面板、确认框这些模态框开着时也在它们上面。出现时先画一帧透明的再淡入（不当场量版面）
	var nsmaxToastTimer = 0;
	var nsmaxToastFrame = 0;
	function nsmaxToast(text, options = {}) {
		if (!document.body) return;
		// toast 的样式在按需注入的 overlay 段里：弹提示前先确保注入（自动签到之类的提示可能早于第一次交互）
		try { nsmaxEnsureOverlayCss(); } catch {}
		let toast = document.querySelector("body > .nsmax-toast");
		if (!toast) {
			toast = document.createElement("div");
			toast.className = "nsmax-toast";
			toast.setAttribute("role", "status");
			toast.setAttribute("aria-live", "polite");
			if (typeof toast.showPopover === "function") toast.setAttribute("popover", "manual");
			document.body.append(toast);
		}
		const error = !!options.error;
		toast.textContent = text;
		if (nsmaxTouchLayout()) nsmaxSyncOverlayViewport(true);
		toast.classList.toggle("is-error", error);
		toast.removeAttribute("data-nsmax-shown");
		if (toast.hasAttribute("popover")) {
			try {
				if (toast.matches(":popover-open")) toast.hidePopover();
				toast.showPopover();
			} catch {}
		}
		cancelAnimationFrame(nsmaxToastFrame);
		nsmaxToastFrame = requestAnimationFrame(() => {
			nsmaxToastFrame = requestAnimationFrame(() => {
				// 排队的这两帧里键盘可能弹出，这期间的视口变化被跳过了，显示前再对一次
				if (nsmaxTouchLayout()) nsmaxSyncOverlayViewport(true);
				toast.setAttribute("data-nsmax-shown", "");
			});
		});
		clearTimeout(nsmaxToastTimer);
		const millis = Math.min(1e4, 4e3 + Math.max(0, [...String(text || "")].length - 12) * 160);
		nsmaxToastTimer = setTimeout(() => toast.removeAttribute("data-nsmax-shown"), error ? Math.max(6e3, millis) : millis);
	}
	// 点赞 / 加鸡腿 / 反对 / 收藏：NodeSeek 成功后什么也不说，只给这一项加上 .clicked（原站变红）。
	// 点了以后盯住这一项，它变成「已点」（加鸡腿、反对要先在确认框里点确定，所以最多等 30 秒）就弹一条 toast
	const NSMAX_ACTION_DONE = { "点赞": ["已点赞"], "加鸡腿": ["已投喂鸡腿"], "反对": ["已反对"], "收藏": ["已收藏", "已取消收藏"] };
	function nsmaxActionFeedback(ctx) {
		document.addEventListener("click", (event) => {
			const item = event.target instanceof Element ? event.target.closest(".comment-menu > .menu-item[title]") : null;
			const texts = item && NSMAX_ACTION_DONE[item.title];
			if (!texts || item.__nsmaxWatch) return;
			const was = item.classList.contains("clicked");
			const observer = new MutationObserver(() => {
				const now = item.classList.contains("clicked");
				if (now === was) return;
				stop();
				const text = now ? texts[0] : texts[1];
				if (text) nsmaxToast(text);
			});
			const timer = setTimeout(() => stop(), 30e3);
			const stop = () => { observer.disconnect(); clearTimeout(timer); item.__nsmaxWatch = null; };
			item.__nsmaxWatch = stop;
			observer.observe(item, { attributes: true, attributeFilter: ["class"] });
		}, { capture: true, signal: ctx.signal });
	}
	// NodeSeek 的提示框（msc-confirm，mscAlert / mscConfirm 每次新建一个加到 body 末尾，点按钮后移除）：
	// 只有一个按钮、一句话的提示（「您已进行过点赞操作」「您未登录……」）改成 toast，原提示框在画出来之前就替用户点掉；
	// 要确认的（有「取消」，如「是否投喂鸡腿……」）留着，排成 sb.sb 的弹窗（见主题 37 节），按钮改成「确定 / 取消」
	function nsmaxWatchMsc(ctx) {
		const handle = (box) => {
			const ok = box.querySelector(".msc-ok");
			const cancel = box.querySelector(".msc-cancel");
			if (ok && ok.textContent.trim() === "OK") ok.textContent = "确定";
			if (cancel && /^cancel$/i.test(cancel.textContent.trim())) cancel.textContent = "取消";
			const title = (box.querySelector(".msc-title")?.textContent || "").trim();
			const sub = (box.querySelector(".msc-sub")?.textContent || "").trim();
			// 没登录打开通知、设置、关注页时站点弹「提示：用户未登录」：页面里已经有一张「登录后才能……」+「去登录」的卡片（nsmaxGuestPlaceholder），
			// 不再挡在页面中间，改成 toast
			if (!cancel && ok && !box.querySelector(".msc-input") && (sub || title) === "用户未登录") {
				nsmaxToast("用户未登录");
				ok.click();
				return;
			}
			if (cancel || box.querySelector(".msc-input") || sub || !title || title.length > 40 || !ok) return;
			nsmaxToast(title);
			ok.click();
		};
		const observer = new MutationObserver((records) => {
			for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && node.classList.contains("msc-confirm")) handle(node);
		});
		observer.observe(document.body, { childList: true });
		ctx.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
		// 脚本装好之前就弹出来的（页面一打开站点就弹的提示）也处理一遍
		for (const box of document.querySelectorAll("body > .msc-confirm")) handle(box);
	}
	// 我的关注 / 粉丝：列表是站点前端画的（先是一个 Loading，拿到数据后整块画出来）。页面整理要在页面变化后 100ms 以上才跑，
	// 站点画出来的原版卡片会先在屏幕上露一下，再变成 sb.sb 成员卡片、整块跳一下。这里单独盯着：站点一画出卡片，
	// 就在同一轮微任务里（浏览器画下一帧之前）改好，屏幕上不出现原版。nsmaxPrepareFans 只在需要时改 DOM，改完那次变化不会再引起改动
	// 站点 Vue 页面里的报错框（行内写死的红框、2rem 大红字，如管理记录页的「用户未登录」「Not allowed to search」）：
	// 主题排成 sb.sb 空状态（见 design.css 第 57 节）；未登录的加一个「去登录」按钮，英文的换成中文
	// 出错页（404 / 502 / 503 / 504）：照 sb.sb 的分栏卡片——左边黄底站名 + 站标 + 大号状态码，
	// 右边标题 / 说明 / 两个按钮 / 「搜一下」/「也可以去」。和登录页共用同一套分栏尺寸（980px、1:1、--r 圆角）
	function nsmaxErrorCard({ code, title, message }) {
		const card = document.createElement("div");
		card.className = "nsmax-error-split";
		const hero = document.createElement("aside");
		hero.className = "nsmax-error-hero";
		const name = document.createElement("div");
		name.className = "nsmax-error-name";
		name.textContent = "NodeSeek";
		const art = document.createElement("div");
		art.className = "nsmax-error-art";
		art.setAttribute("aria-hidden", "true");
		const codeEl = document.createElement("p");
		codeEl.className = "nsmax-error-code";
		codeEl.textContent = code;
		hero.append(name, art, codeEl);
		const main = document.createElement("div");
		main.className = "nsmax-error-main";
		const heading = document.createElement("h1");
		heading.className = "nsmax-error-title";
		heading.textContent = title;
		const text = document.createElement("p");
		text.className = "nsmax-error-message";
		text.textContent = message;
		const actions = document.createElement("div");
		actions.className = "nsmax-error-actions";
		const home = document.createElement("a");
		home.className = "nsmax-error-primary";
		home.href = "/";
		home.textContent = "回到首页";
		const back = document.createElement("button");
		back.type = "button";
		back.className = "nsmax-error-secondary";
		back.textContent = "返回上一页";
		back.addEventListener("click", () => history.back());
		actions.append(home, back);
		const search = document.createElement("div");
		search.className = "nsmax-error-search";
		const searchLabel = document.createElement("span");
		searchLabel.className = "nsmax-error-label";
		searchLabel.textContent = "搜一下";
		const form = document.createElement("form");
		form.className = "nsmax-error-form";
		form.action = "/search";
		form.method = "get";
		const input = document.createElement("input");
		input.className = "nsmax-error-input";
		input.type = "search";
		input.name = "q";
		input.placeholder = "搜索帖子标题";
		input.autocomplete = "off";
		input.required = true;
		const submit = document.createElement("button");
		submit.type = "submit";
		submit.className = "nsmax-error-submit";
		submit.textContent = "搜索";
		form.append(input, submit);
		search.append(searchLabel, form);
		const places = document.createElement("div");
		places.className = "nsmax-error-places";
		const placesLabel = document.createElement("span");
		placesLabel.className = "nsmax-error-label";
		placesLabel.textContent = "也可以去";
		const list = document.createElement("ul");
		for (const [label, href] of [["全部主题", "/"], ["精华", "/award"], ["排行榜", "/board"], ["合作商家", "/providers"]]) {
			const item = document.createElement("li");
			const link = document.createElement("a");
			link.href = href;
			link.textContent = label;
			item.append(link);
			list.append(item);
		}
		places.append(placesLabel, list);
		main.append(heading, text, actions, search, places);
		card.append(hero, main);
		return card;
	}
	// 站点整页出错（nginx 的 502 / 503 / 504 只回一个 h1，没有 #nsk-frame）：整页换成分栏卡片
	function nsmaxErrorPage() {
		if (document.querySelector(".nsmax-error-split") || document.getElementById("nsk-frame")) return;
		const heading = document.querySelector("h1");
		const code = (heading?.textContent.trim().match(/^([45]\d\d)\b/) || document.title.match(/\b([45]\d\d)\b/) || [])[1];
		if (!code) return;
		const wrap = document.createElement("div");
		wrap.className = "nsmax-error-page";
		wrap.append(nsmaxErrorCard({ code, title: "出错了", message: `页面暂时打不开（${code}）。可以稍后刷新重试，或者回首页看看别的帖子。` }));
		document.body.replaceChildren(wrap);
		nsmaxSetAttr(document.documentElement, "data-nsmax-page", "error");
	}
	// 站点对不存在的帖子直接回 text/plain 的「not found」（9 个字节），浏览器里只有一行灰字，也没有站点样式。
	// 这种文档进不了主题那套流程（入口发现不是 HTML 就退出），所以自己铺：设好主题属性、注入编译好的主题样式，再放出错卡片
	function nsmaxPlainTextErrorPage() {
		if (!/^text\/plain/i.test(document.contentType || "")) return;
		const text = (document.body?.textContent || "").trim();
		if (text && !/^not found\.?$/i.test(text)) return;
		const render = () => {
			try {
				const root = document.documentElement;
				root.setAttribute("data-nsmax-theme", "");
				root.setAttribute("data-nsmax-page", "error");
				root.setAttribute("data-nsmax-palette", "claude");
				if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) root.setAttribute("data-nsmax-dark", "");
				document.title = "页面不存在 - NodeSeek";
				if (!document.querySelector("style[data-nsmax-error-style]")) {
					const style = document.createElement("style");
					style.setAttribute("data-nsmax-error-style", "");
					style.textContent = nsmaxThemeCss("error");
					(document.head || root).append(style);
				}
				const wrap = document.createElement("div");
				wrap.className = "nsmax-error-page";
				wrap.append(nsmaxErrorCard({ code: "404", title: "页面不存在", message: "这个地址没有对应的页面。它可能已被删除、改过地址，或者从来就不存在。" }));
				document.body.replaceChildren(wrap);
			} catch (error) {
				nsmaxRecordError("error-page", error);
			}
		};
		if (document.body) render();
		else document.addEventListener("DOMContentLoaded", render, { once: true });
	}
	function nsmaxTidySiteErrors() {
		// 邀请好友页没登录时是 .invite-panel 里单独一个 h2「用户未登录」
		const boxes = new Set();
		nsmaxQueryEach(['#nsk-frame div[style*="solid red"]', "#nsk-frame .invite-panel > h2:only-child"], (el) => boxes.add(el));
		// 别的页面没登录时只是一个写着「用户未登录」的空元素（账簿页是 .credit-table 里一个 div，2026-10-19）：没登录时按文字认。
		// 列表、帖子正常显示出来的页面不是这种出错页，不用把整页的字拼出来找（以前没登录时每次扫描都拼一遍）
		const frame = document.getElementById("nsk-frame");
		if (frame && !unsafeWindow$1.__config__?.user && !frame.querySelector("ul.post-list > li.post-list-item, .nsk-post > .content-item") && frame.textContent.includes("用户未登录")) {
			const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode;
				if (node.data.trim() !== "用户未登录") continue;
				const box = node.parentElement;
				if (!box || box.children.length && !box.hasAttribute("data-nsmax-site-error") || box.closest("#nsk-left-panel-container, #nsk-right-panel-container, [class*='nsmax-']")) continue;
				boxes.add(box);
			}
		}
		for (const box of boxes) {
			nsmaxSetAttr(box, "data-nsmax-site-error");
			const text = box.firstChild?.nodeType === 3 ? box.firstChild.data.trim() : box.textContent.trim();
			if (/^not allowed to search$/i.test(text)) nsmaxSetText(box, "站点只给管理员按用户名搜索管理记录");
			if (text === "用户未登录" && !box.querySelector(".nsmax-site-error-login")) {
				const link = document.createElement("a");
				link.className = "nsmax-site-error-login";
				link.href = "/signIn.html";
				link.textContent = "去登录";
				box.append(link);
			}
		}
	}
	// 没登录时打开通知、设置、关注 / 粉丝：站点只弹一个「用户未登录」提示，点掉之后整页空白（关注页只剩两个标签）。
	// 放一张和别处一样的空状态卡片：一句话 + 「去登录」（2026-10-19）
	function nsmaxGuestPlaceholder() {
		if (unsafeWindow$1.__config__?.user) return;
		const path = location.pathname;
		const fans = /^\/fans(?:\/|$)/.test(path);
		const text = /^\/notification(?:\/|$)/.test(path) ? "登录后才能查看通知和私信" : /^\/setting(?:\/|$)/.test(path) ? "登录后才能修改个人设置" : fans ? "登录后才能查看关注和粉丝" : "";
		if (!text) return;
		const host = fans ? document.querySelector("#nsk-frame .member-list") : document.getElementById("nsk-frame");
		if (!host || host.querySelector(":scope > .nsmax-guest-empty")) return;
		const box = document.createElement("div");
		box.className = "nsmax-guest-empty";
		box.setAttribute("data-nsmax-site-error", "");
		box.append(text);
		const link = document.createElement("a");
		link.className = "nsmax-site-error-login";
		link.href = "/signIn.html";
		link.textContent = "去登录";
		box.append(link);
		const mount = host.querySelector(":scope > #search-panel-mount");
		if (mount) mount.before(box);
		else host.append(box);
	}
	// 友站链接页（/friends）照 sb.sb .link-card：名字下面一行写网址的域名（主题排版见 design.css 第 58 节）；
	// 头像图挂了的（站点上有几个外链图已经失效，显示成破图加「头像」两个字）换成名字首字的占位块
	function nsmaxPrepareFriends() {
		const list = document.querySelector("#nsk-frame > .nsk-friends > .friends-container");
		if (!list) return;
		for (const link of list.querySelectorAll(":scope > div > a[href]")) {
			if (!link.querySelector(":scope > .nsmax-friend-host")) {
				let host = "";
				try { host = new URL(link.href, location.href).hostname.replace(/^www\./, ""); } catch {}
				if (host) {
					const meta = document.createElement("span");
					meta.className = "nsmax-friend-host";
					meta.textContent = host;
					link.append(meta);
				}
			}
			const image = link.querySelector(":scope > img");
			if (!image || image.hasAttribute("data-nsmax-watched")) continue;
			image.setAttribute("data-nsmax-watched", "");
			const broken = () => {
				if (image.hidden) return;
				image.hidden = true;
				const name = link.querySelector(":scope > p")?.textContent.trim() || link.title || "";
				const badge = document.createElement("span");
				badge.className = "nsmax-friend-avatar";
				badge.setAttribute("aria-hidden", "true");
				badge.textContent = Array.from(name)[0] || "?";
				image.before(badge);
			};
			if (image.complete && !image.naturalWidth) broken();
			else image.addEventListener("error", broken, { once: true });
		}
	}
	// 页面解析阶段（脚本注入得早时）就装上，模块挂载时再调一次不重复装
	var nsmaxFansWatching = false;
	function nsmaxWatchFans(ctx) {
		if (nsmaxFansWatching || !/^\/fans(?:\/|$)/.test(location.pathname) || !document.body) return;
		nsmaxFansWatching = true;
		const relevant = (node) => node instanceof Element && (node.matches(".member-list, .user-card-wrapper-container, .user-card-wrapper, .user-card, .usercard-button-group, .fans-switcher, .switcher-item, .btn") || !!node.querySelector(".user-card, .fans-switcher"));
		const observer = new MutationObserver((records) => {
			if (!records.some((record) => Array.from(record.addedNodes).some(relevant))) return;
			try { nsmaxPrepareFans(); } catch {}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.signal.addEventListener("abort", () => { observer.disconnect(); nsmaxFansWatching = false; }, { once: true });
		try { nsmaxPrepareFans(); } catch {}
	}
	// 个人主页：资料卡是站点前端画的（页面解析完以后才画，切「主题帖 / 评论」或水合时整块重画）。页面整理要在页面变化后 100ms 以上才跑，
	// 原版资料卡会先在屏幕上露一下，再变成 sb.sb 的资料卡，页脚跟着跳一截（2026-10-23，真站重放 4 倍降速下露 0.3 秒）。
	// 和关注页一样单独盯着：站点一画出来，就在同一轮微任务里（浏览器画下一帧之前）改好。自己改出来的那些变化不再处理
	// 资料卡画出来之前主栏是空的，页脚紧贴在顶栏下面，资料卡一出来页脚被推下去一大截：先给主栏留一屏高（data-nsmax-space-pending），
	// 画出来就撤掉；最多留 4 秒
	var nsmaxSpaceWatching = false;
	function nsmaxWatchSpace(ctx) {
		const uid = location.pathname.match(/^\/space\/(\d+)/)?.[1];
		if (nsmaxSpaceWatching || !uid || !document.body) return;
		nsmaxSpaceWatching = true;
		try { nsmaxSpaceInfo(uid); } catch {}
		const root = document.documentElement;
		const drawn = () => !!document.querySelector(".head-container");
		if (!drawn()) {
			root.setAttribute("data-nsmax-space-pending", "");
			setTimeout(() => root.removeAttribute("data-nsmax-space-pending"), 4e3);
		}
		const relevant = (node) => node instanceof Element && (node.matches(".nsk-container, .head-container, .card-block, .readme, .selector") || !!node.querySelector(".head-container, .card-block, .readme"));
		const observer = new MutationObserver((records) => {
			if (!records.some((record) => Array.from(record.addedNodes).some(relevant))) return;
			try { nsmaxPrepareSpace(); } catch {}
			if (drawn()) root.removeAttribute("data-nsmax-space-pending");
			observer.takeRecords();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.signal.addEventListener("abort", () => { observer.disconnect(); nsmaxSpaceWatching = false; }, { once: true });
		try { nsmaxPrepareSpace(); } catch {}
	}
	// Userscripts 的 content world 不能直接读页面 expando。桥只访问论坛配置和编辑器；不暴露任何 GM API 或存储。
	function nsmaxCreateUserscriptsBridge() {
		const token = "nsmax-us-" + Math.random().toString(36).slice(2), requestEvent = token + "-request", changeEvent = token + "-change";
		let node = null, config = null, configAt = 0, parsedText = "", parsedConfig = null, sequence = 0;
		const methods = new Set(["getValue","setValue","getSelection","getCursor","setCursor","setSelection","replaceSelection","replaceRange","lineCount","getLine","getRange","indexFromPos","posFromIndex","getOption","setOption","refresh","focus","somethingSelected","getScrollInfo"]);
		const call = payload => {
			if (!node?.isConnected || node.getAttribute("data-ready") !== "1") return undefined;
			node.setAttribute("data-request", JSON.stringify(payload)); node.removeAttribute("data-result"); node.dispatchEvent(new Event(requestEvent));
			const raw = node.getAttribute("data-result"); if (!raw) return undefined;
			const result = JSON.parse(raw); if (!result.ok) throw new Error(result.error || "无法读取论坛编辑器");
			return result.value;
		};
		const bindEditors = () => {
			for (const element of document.querySelectorAll(".CodeMirror")) {
				if (element.CodeMirror) continue;
				let id = element.getAttribute("data-nsmax-cm-id"); if (!id) { id = token + "-" + (++sequence); element.setAttribute("data-nsmax-cm-id",id); }
				try { if (!call({op:"probe",id})) continue; } catch { continue; }
				const handlers = new Map(), keyMaps = new Map(); let proxy;
				element.addEventListener(changeEvent,event=>{try{const data=JSON.parse(event.detail);for(const callback of [...(handlers.get(data.type)||[])])callback(proxy,data.change);}catch{}});
				proxy = new Proxy({}, {get(_,name) {
					if(name==="getWrapperElement")return()=>element;
					if(name==="getInputField")return()=>element.querySelector("textarea");
					if(name==="getScrollerElement")return()=>element.querySelector(".CodeMirror-scroll");
					if(name==="getDoc")return()=>proxy;
					if(name==="on")return(type,callback)=>{let list=handlers.get(type);if(!list)handlers.set(type,list=new Set());list.add(callback);};
					if(name==="off")return(type,callback)=>handlers.get(type)?.delete(callback);
					if(name==="addKeyMap")return keys=>{const listener=event=>{const key=(event.altKey?"Alt-":"")+(event.ctrlKey?"Ctrl-":"")+(event.metaKey?"Cmd-":"")+(event.shiftKey&&event.key.length>1?"Shift-":"")+(event.key.length===1?event.key.toUpperCase():event.key);if(typeof keys[key]==="function"){event.preventDefault();keys[key](proxy);}};keyMaps.set(keys,listener);element.addEventListener("keydown",listener,true);};
					if(name==="removeKeyMap")return keys=>{const listener=keyMaps.get(keys);if(listener)element.removeEventListener("keydown",listener,true);keyMaps.delete(keys);};
					if(methods.has(name))return(...args)=>call({op:"cm",id,method:name,args});
				}});
				try{Object.defineProperty(element,"CodeMirror",{configurable:true,value:proxy});}catch{}
			}
		};
		whenRoot(root=>{
			node=document.createElement("script");node.id=token;
			const nonce=document.querySelector("script[nonce]")?.nonce;if(nonce)node.nonce=nonce;
			try { node.textContent="("+function(node,requestEvent,changeEvent){
				const methods=new Set(["getValue","setValue","getSelection","getCursor","setCursor","setSelection","replaceSelection","replaceRange","lineCount","getLine","getRange","indexFromPos","posFromIndex","getOption","setOption","refresh","focus","somethingSelected","getScrollInfo"]);
				const bound=new WeakSet();
				const config=()=>typeof __config__!=="undefined"?__config__:window.__config__;
				node.addEventListener(requestEvent,()=>{try{
					const p=JSON.parse(node.getAttribute("data-request")||"{}"),element=[...document.querySelectorAll(".CodeMirror")].find(e=>e.getAttribute("data-nsmax-cm-id")===p.id),cm=element?.CodeMirror;
					let value;
					if(p.op==="config")value=config();
					else if(p.op==="probe"){
						value=!!cm;
						if(cm&&typeof cm.on==="function"&&!bound.has(cm)){bound.add(cm);for(const type of ["change","focus","blur","cursorActivity"])cm.on(type,(_,change)=>element.dispatchEvent(new CustomEvent(changeEvent,{detail:JSON.stringify({type,change:change?{from:change.from,to:change.to,text:change.text,removed:change.removed,origin:change.origin}:undefined})})));}
					}else if(p.op==="cm"&&cm&&methods.has(p.method)&&typeof cm[p.method]==="function"&&Array.isArray(p.args))value=cm[p.method](...p.args);
					node.setAttribute("data-result",JSON.stringify({ok:true,value}));
				}catch(error){node.setAttribute("data-result",JSON.stringify({ok:false,error:String(error?.message||error)}));}});
				node.setAttribute("data-ready","1");
			}.toString()+")(document.currentScript,"+JSON.stringify(requestEvent)+","+JSON.stringify(changeEvent)+");";
			(document.head||root).append(node); } catch {}
			bindEditors();
			new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(".CodeMirror")||n.querySelector?.(".CodeMirror")))||r.target.closest?.(".CodeMirror")&&!r.target.closest(".CodeMirror").CodeMirror))bindEditors();}).observe(root,{childList:true,subtree:true});
		});
		document.addEventListener("DOMContentLoaded",bindEditors,{once:true});window.addEventListener("load",bindEditors,{once:true});
		return {get available(){return node?.getAttribute("data-ready")==="1";},config(){
			if(config&&performance.now()-configAt<1000)return config;
			try{const value=call({op:"config"});if(value&&typeof value==="object"){config=value;configAt=performance.now();return config;}}catch{}
			const text=document.getElementById("temp-script")?.textContent?.trim();if(!text)return config;
			if(text===parsedText)return parsedConfig;
			try{parsedConfig=JSON.parse(text.startsWith("{")?text:new TextDecoder().decode(Uint8Array.from(atob(text),c=>c.charCodeAt(0))));parsedText=text;}catch{}
			return parsedConfig||config;
		}};
	}
	// 手机历史条目各自保存位置；原生回退偶尔会按重排前的锚点上移 80px，等主布局就绪后校正一次。
	function nsmaxKeepTouchScroll(ctx, media) {
		if (!media.matches) return () => {};
		const key = "__nsmaxTouchScroll", root = document.documentElement;
		const navigation = performance.getEntriesByType("navigation")[0]?.type;
		let storageKey, previous;
		try {
			const state = history.state;
			if (state !== null && (typeof state !== "object" || Array.isArray(state))) return () => {};
			let id = navigation !== "navigate" && typeof state?.[key] === "string" ? state[key] : null;
			if (!id) {
				id = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
				history.replaceState({ ...state, [key]: id }, "");
			}
			storageKey = "nsmax:touch-scroll:" + id;
			previous = JSON.parse(sessionStorage.getItem(storageKey) || "null");
			const indexKey = "nsmax:touch-scroll:index";
			const stored = JSON.parse(sessionStorage.getItem(indexKey) || "[]");
			const ids = [...(Array.isArray(stored) ? stored : []).filter(value => typeof value === "string" && value !== id), id];
			for (const old of ids.slice(0, -80)) sessionStorage.removeItem("nsmax:touch-scroll:" + old);
			sessionStorage.setItem(indexKey, JSON.stringify(ids.slice(-80)));
		} catch { return () => {}; }
		let restoring = media.matches && performance.getEntriesByType("navigation")[0]?.type === "back_forward" && previous?.href === location.href && previous.width === innerWidth && Number.isFinite(previous.y) && previous.y >= 0;
		let cancelled = false, frame = 0, timer = 0, lastSaved = 0;
		const save = (leaving = false) => {
			if ((!leaving && !media.matches) || restoring || root.hasAttribute("data-nsmax-mobile-lock")) return;
			try {
				// history.state 只保存条目标识；滚动位置更新单独写入会话缓存。
				sessionStorage.setItem(storageKey, JSON.stringify({ href: location.href, x: scrollX, y: scrollY, width: innerWidth }));
				lastSaved = Date.now();
			} catch {}
		};
		nsmaxKeepTouchScroll.save = save;
		const observer = new MutationObserver(() => schedule());
		const restore = () => {
			if (!restoring || cancelled || root.hasAttribute("data-nsmax-mounting")) return;
			const old = root.style.getPropertyValue("scroll-behavior"), priority = root.style.getPropertyPriority("scroll-behavior");
			root.style.setProperty("scroll-behavior", "auto", "important");
			window.scrollTo(Number(previous.x) || 0, previous.y);
			if (old) root.style.setProperty("scroll-behavior", old, priority); else root.style.removeProperty("scroll-behavior");
			if (document.readyState === "complete") { restoring = false; observer.disconnect(); save(); }
		};
		const schedule = () => {
			if (!restoring || cancelled || root.hasAttribute("data-nsmax-mounting")) return;
			cancelAnimationFrame(frame); clearTimeout(timer);
			frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore); });
			timer = setTimeout(restore, 160);
		};
		const cancel = event => { cancelled = true; restoring = false; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); if (event.type === "pointerdown" || event.type === "touchstart" || event.type === "keydown" && (event.key === "Enter" || event.key === " ")) save(); };
		for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) window.addEventListener(type, cancel, { capture: true, passive: true, signal: ctx.signal });
		window.addEventListener("scroll", () => { if (Date.now() - lastSaved >= 1000) save(); }, { passive: true, signal: ctx.signal });
		if (restoring) {
			observer.observe(root, { attributes: true, attributeFilter: ["data-nsmax-mounting"] });
			window.addEventListener("load", schedule, { once: true, signal: ctx.signal });
			schedule();
		}
		return () => { if (nsmaxKeepTouchScroll.save === save) delete nsmaxKeepTouchScroll.save; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); };
	}
	function nsmaxMountTouchUi(ctx) {
		const root = document.documentElement;
		const media = matchMedia("(pointer: coarse) and (max-width: 700px), (pointer: coarse) and (max-width: 960px) and (max-height: 600px)");
		const stopScroll = nsmaxKeepTouchScroll(ctx, media);
		const bound = new WeakSet();
		let panel = null, panelMask = null, nativeSearch = null;
		const drawerView = (view) => {
			if (!panel) return;
			nsmaxSetAttr(panel, "data-nsmax-drawer-view", view);
			for (const button of panel.querySelectorAll(".nsmax-drawer-tabs button")) nsmaxSetAttr(button, "aria-pressed", String(button.dataset.view === view));
			for (const host of panel.querySelectorAll(":scope > [data-drawer-pane]")) host.hidden = host.dataset.drawerPane !== view;
			panel.scrollTop = 0;
		};
		const openRow = event => {
			if (!media.matches || event.button !== 0 || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || getSelection()?.isCollapsed === false) return;
			const target = event.target instanceof Element ? event.target : null;
			if (!target || target.closest("a,button,input,textarea,select,[role=button],[contenteditable=true]")) return;
			event.currentTarget.querySelector(".post-title > a")?.click();
		};
		const closeSearch = (focusBack = false) => {
			root.removeAttribute("data-nsmax-search-open");
			if (focusBack) document.getElementById("search-site2")?.blur();
		};
		const closeMenu = () => {
			const mask = panelMask;
			mask?.click();
			if (panel && parseFloat(panel.style.left) === 0) panel.style.left = "-100%";
			if (mask) mask.style.display = "none";
			sync();
			document.querySelector("#toggle-left-panel > a")?.focus({ preventScroll: true });
		};
		const sync = () => {
			if (media.matches) nsmaxThemeRequire("touch");
			if (root.hasAttribute("data-nsmax-touch") !== media.matches) root.toggleAttribute("data-nsmax-touch", media.matches);
			if (!media.matches) {
				closeSearch();
				for (const owner of [...nsmaxMobileScrollOwners]) nsmaxMobileLock(owner, false);
				return;
			}
			nsmaxSyncOverlayViewport();
			for (const owner of [...nsmaxMobileScrollOwners]) if (!owner?.isConnected) nsmaxMobileLock(owner, false);
			const nextPanel = document.getElementById("left-slide-panel");
			if (panel && panel !== nextPanel) { nsmaxMobileLock(panel, false); if (panelMask?.isConnected) panelMask.style.display = "none"; }
			panel = nextPanel;
			panelMask = panel?.parentElement?.querySelector(".global-mask") || null;
			if (panel && !panel.querySelector(":scope > .nsmax-drawer-head")) {
				panel.tabIndex = -1;
				const head = document.createElement("div"); head.className = "nsmax-drawer-head";
				const label = document.createElement("strong"); label.textContent = "菜单";
				const close = document.createElement("button"); close.type = "button"; close.setAttribute("aria-label", "关闭菜单"); close.append(toolIcon("close"));
				close.addEventListener("click", closeMenu, { signal: ctx.signal });
				head.append(label, close); panel.prepend(head);
				panel.addEventListener("click", event => { if (event.target.closest("a[href]")) closeMenu(); }, { signal: ctx.signal });
				const tabs = document.createElement("div"); tabs.className = "nsmax-drawer-tabs"; tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "侧栏内容");
				const config = GM_getValue$1(SETTINGS_KEY, {});
				const views = [["navigation", "导航"]];
				if (location.hostname === "www.nodeseek.com" && config["hot-rankings"]?.enabled !== false && config["hot-rankings"]?.sidebar !== false) views.push(["hot", "热榜"]);
				if (config["sb-recent-visits"]?.enabled !== false) views.push(["recent", "最近浏览"]);
				for (const [view, title] of views) {
					const button = document.createElement("button"); button.type = "button"; button.textContent = title; button.dataset.view = view;
					button.addEventListener("click", () => drawerView(view), { signal: ctx.signal }); tabs.append(button);
					if (view === "navigation") continue;
					const host = document.createElement("div"); host.className = "nsmax-drawer-" + view; host.dataset.drawerPane = view; host.hidden = true;
					if (view === "recent") { const empty = document.createElement("p"); empty.className = "nsmax-drawer-empty"; empty.textContent = "还没有浏览记录，打开帖子后会保存在这里。"; host.append(empty); }
					panel.append(host);
				}
				head.after(tabs); drawerView("navigation");
				const boards = panel.querySelector(":scope > .category-mobile");
				if (boards) tabs.after(boards);
				const account = panel.querySelector(":scope > .user-card-container");
				if (account) { const title = document.createElement("h2"); title.className = "nsmax-drawer-section-title"; title.textContent = "我的菜单"; account.prepend(title); }
				const category = panel.querySelector(".category-mobile > div");
				if (category && !category.querySelector('a[href="/"]')) { const all = document.createElement("a"); all.href = "/"; const text = document.createElement("p"); text.textContent = "全部帖子"; all.append(text); category.prepend(all); }
				const tools = document.createElement("div"); tools.className = "nsmax-drawer-tools";
				const settings = document.createElement("button"); settings.type = "button"; settings.textContent = "脚本设置"; settings.append(toolIcon("gear"));
				settings.addEventListener("click", () => { closeMenu(); document.querySelector('[aria-label="NodeSeek Max 设置"]')?.click(); }, { signal: ctx.signal }); tools.append(settings); panel.append(tools);
				panel.addEventListener("keydown", event => {
					if (nsmaxLayers.some(layer => layer.open)) return;
					if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); }
					if (event.key !== "Tab") return;
					const focusable = [...panel.querySelectorAll('a[href],button:not(:disabled),input,select,textarea,[tabindex="0"]')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
					const first = focusable[0], last = focusable.at(-1);
					if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
					else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first?.focus(); }
				}, { signal: ctx.signal });
				let swipe = null;
				panel.addEventListener("touchstart", event => { const touch = event.touches[0]; swipe = event.touches.length === 1 && !event.target.closest("input,textarea,select,[contenteditable=true]") ? { x: touch.clientX, y: touch.clientY } : null; }, { passive: true, signal: ctx.signal });
				panel.addEventListener("touchend", event => { const touch = event.changedTouches[0], start = swipe; swipe = null; if (!start || !touch) return; const dx = touch.clientX - start.x, dy = touch.clientY - start.y; if (dx < -72 && Math.abs(dx) > Math.abs(dy) * 1.5) closeMenu(); }, { passive: true, signal: ctx.signal });
				panel.addEventListener("touchcancel", () => { swipe = null; }, { passive: true, signal: ctx.signal });
			}
			if (panel) {
				const open = parseFloat(panel.style.left) === 0, firstOpen = open && !nsmaxMobileScrollOwners.has(panel);
				panel.inert = !open;
				for (const [name,value] of [["role","dialog"],["aria-label","站点菜单"],["aria-modal",String(open)]]) if (panel.getAttribute(name) !== value) panel.setAttribute(name,value);
				const toggle = document.querySelector("#toggle-left-panel > a");
				if (toggle) for (const [name,value] of [["role","button"],["aria-label","打开菜单"],["aria-expanded",String(open)]]) if (toggle.getAttribute(name) !== value) toggle.setAttribute(name,value);
				nsmaxMobileLock(panel, open);
				for (const link of panel.querySelectorAll(".category-mobile a[href]")) { const current = new URL(link.href, location.href); const selected = current.pathname === location.pathname && current.search === location.search; if (link.classList.contains("selected") !== selected) link.classList.toggle("selected", selected); if (selected) nsmaxSetAttr(link, "aria-current", "page"); else nsmaxDropAttr(link, "aria-current"); }
				if (firstOpen) panel.focus({ preventScroll: true });
			}
			const search = document.querySelector(".search-overlay");
			if (nativeSearch && nativeSearch !== search) nsmaxMobileLock(nativeSearch, false);
			nativeSearch = search;
			if (search) nsmaxMobileLock(search, !!search.getClientRects().length && getComputedStyle(search).visibility !== "hidden");
			// iOS 对非交互节点不一定派发兼容 click；把监听器绑定到列表行本身，保留行内真实链接的原生行为。
			for (const row of document.querySelectorAll("ul.post-list > li.post-list-item:not(.topic-carousel-item)")) if (!bound.has(row)) { bound.add(row); row.addEventListener("click", openRow, { signal: ctx.signal }); }
			for (const image of document.querySelectorAll("#nsk-body-left article.post-content img")) if (!bound.has(image)) { bound.add(image); image.addEventListener("click", () => {}, { signal: ctx.signal }); }
			const input = document.getElementById("search-site2"), form = input?.closest("form");
			for (const link of document.querySelectorAll("body > header > ul.mobile-nav a[href]")) {
				const path = new URL(link.href, location.href).pathname;
				if (path === location.pathname || path !== "/" && location.pathname.startsWith(path + "/")) nsmaxSetAttr(link, "aria-current", "page");
				else nsmaxDropAttr(link, "aria-current");
			}
			if (!form || bound.has(form)) return;
			bound.add(form);
			input.enterKeyHint = "search"; input.autocapitalize = "none"; input.setAttribute("aria-label", "搜索帖子或用户"); input.placeholder = "搜索";
			const close = document.createElement("button"); close.type = "button"; close.className = "nsmax-search-close"; close.setAttribute("aria-label", "关闭搜索"); close.append(toolIcon("close"));
			close.addEventListener("click", () => closeSearch(true), { signal: ctx.signal }); form.append(close);
			input.addEventListener("focus", () => { if (media.matches) root.setAttribute("data-nsmax-search-open", ""); }, { signal: ctx.signal });
			input.addEventListener("blur", () => { setTimeout(() => { if (!form.contains(document.activeElement)) closeSearch(); }, 0); }, { signal: ctx.signal });
			form.addEventListener("submit", event => {
				if (!media.matches) return;
				event.preventDefault(); event.stopImmediatePropagation();
				const query = input.value.trim();
				if (query) location.assign("/search?q=" + encodeURIComponent(query));
			}, { capture: true, signal: ctx.signal });
		};
		const observer = new MutationObserver(records => {
			if (records.some(r => r.type === "attributes" ? r.target.matches?.("#left-slide-panel,.global-mask,.search-overlay") : [...r.addedNodes,...r.removedNodes].some(n => n.nodeType === 1 && (n.matches?.("#left-slide-panel,.search-overlay") || n.querySelector?.("#left-slide-panel,.search-overlay")))) || [...nsmaxMobileScrollOwners].some(owner => !owner?.isConnected)) sync();
		});
		const observe = () => { observer.disconnect(); if (media.matches) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] }); };
		observe();
		media.addEventListener("change", () => { observe(); sync(); nsmaxPlaceHeaderButtons(GM_getValue$1(SETTINGS_KEY,{})?.["content-filter"]?.enabled !== false); }, { signal: ctx.signal });
		document.addEventListener("keydown", event => { if (event.key === "Escape") closeSearch(true); }, { signal: ctx.signal });
		// iOS Safari 要文档上挂着 touchstart 才会触发 :active，否则手机按下反馈不生效
		document.addEventListener("touchstart", () => {}, { passive: true, signal: ctx.signal });
		document.addEventListener("pointerdown", event => { if (root.hasAttribute("data-nsmax-search-open") && !event.target.closest("form.search-box,form.search-form")) closeSearch(); }, { passive: true, signal: ctx.signal });
		const stop = ctx.watch(sync);
		return () => { stopScroll(); stop(); observer.disconnect(); nsmaxMobileLock(panel, false); nsmaxMobileLock(nativeSearch, false); root.removeAttribute("data-nsmax-touch"); root.removeAttribute("data-nsmax-search-open"); document.querySelectorAll(".nsmax-search-close,.nsmax-drawer-head,.nsmax-drawer-tabs,.nsmax-drawer-hot,.nsmax-drawer-recent,.nsmax-drawer-tools").forEach(e=>e.remove()); };
	}
	function mountLeanUi(ctx) {
		const editors = new Map();
		const stopTouchUi = nsmaxMountTouchUi(ctx);
		nsmaxActionFeedback(ctx);
		nsmaxWatchMsc(ctx);
		nsmaxWatchFans(ctx);
		nsmaxWatchSpace(ctx);
		nsmaxFloorHover(ctx);
		nsmaxPrerenderRows(ctx);
		const scan = () => {
			const currentPage = nsmaxPageKind();
			if (document.documentElement.dataset.nsmaxPage !== currentPage) {
				document.documentElement.dataset.nsmaxPage = currentPage;
			}
			if (typeof nsmaxBuildAccountCard === "function") {
				nsmaxBuildAccountCard();
			}
			nsmaxPrizeBadges();
			// 看不见的记账（记下列表上的回复数、排上要在后台查的抽奖帖）放到空闲时做：页面刚出来那一下少干点活（2026-10-23）
			nsmaxWhenIdle("reply-counts", nsmaxRememberListReplyCounts);
			nsmaxWhenIdle("special-posts", () => nsmaxVerifySpecialPosts(ctx));
			nsmaxLotteryView(ctx);
			nsmaxTidySidebar();
			nsmaxCleanSearchOverlay();
			nsmaxCleanPostActions();
			nsmaxUpdateNavEssence();
			nsmaxMarkLevels();
			nsmaxSetupMarkdownTabs();
			nsmaxEnsureNqEntry();
			nsmaxTidyPagers();
			nsmaxProcessPostListRows();
			// 新接上来的列表行（自动翻页）也在空闲时排好
			if (nsmaxPrerenderKick && document.querySelector(NSMAX_PRERENDER_ROWS)) nsmaxPrerenderKick();
			// 只属于某一页的整理，调用前先按地址判断（和各函数开头的判断一样）：别的页面上不调用，浏览器也就不用编译这些大函数
			// （2026-10-23：列表页第一次扫描时光编译这些用不上的函数就要 6ms，CPU 4 倍降速下）
			const path = location.pathname;
			if (path === "/search") nsmaxPrepareSearch();
			if (/^\/space\/\d+/.test(path)) nsmaxPrepareSpace();
			nsmaxPrepareBoard();
			if (/^\/board(?:\/|$)/.test(path)) nsmaxCheckinPage();
			if (path === "/progress") nsmaxProgressPage();
			if (/^\/fans(?:\/|$)/.test(path)) nsmaxPrepareFans();
			if (/^\/credit(?:\/|$)/.test(path)) nsmaxPrepareCredit();
			if (/^\/setting(?:\/|$)/.test(path)) nsmaxPrepareSetting();
			nsmaxPrepareSidePage();
			nsmaxTidySiteErrors();
			nsmaxErrorPage();
			if (!unsafeWindow$1.__config__?.user) nsmaxGuestPlaceholder();
			nsmaxPrepareFriends();
			nsmaxGuardSidebarScroll();
			if (NSMAX_AUTH_PAGES[path]) nsmaxPrepareAuth();
			if (/^\/notifications?(?:\/|$)/.test(path)) nsmaxCleanNotifications();
			nsmaxCleanBadgesAndNotifications();
			const isPost = /^\/post-\d+/.test(location.pathname);
			if (isPost) {
				nsmaxDecoratePostDetail();
				nsmaxFinishLuckyPost();
			}
			nsmaxTagStructure();
			nsmaxBuildFooter();
			if (!isPost && !/^\/(?:new|edit)-discussion/.test(location.pathname)) return;
			nsmaxClassifyPostImages();
			if (isPost) {
				nsmaxGroupFloorActions();
				nsmaxMarkPinnedReplies();
				nsmaxPreparePolls();
				nsmaxPrepareLottery();
				nsmaxWrapCodeBlocks();
			}
			for (const editor of document.querySelectorAll(".md-editor")) {
				if (editors.has(editor)) continue;
				if (nsmaxUserscriptsBridge && !nsmaxUserscriptsBridge.available) { editor.setAttribute("data-nsmax-native-editor", ""); continue; }
				const body = editor.querySelector("#editor-body") || editor;
				const cm = editor.querySelector(".CodeMirror")?.CodeMirror;
				const input = editor.querySelector("textarea:not(.CodeMirror textarea)");
				if (!cm && !input) continue;
				editor.classList.add("nsmax-compact-reply");
				const heading = document.createElement("h2");
				heading.className = "nsmax-editor-heading";
				heading.textContent = isPost ? "发表回复" : "内容";
				const controls = document.createElement("div");
				controls.className = "nsmax-editor-controls";
				const head = document.createElement("div"); head.className = "nsmax-editor-head"; head.append(heading);
				const preview = document.createElement("div");
				preview.className = "nsmax-editor-preview post-content";
				preview.hidden = true;
				preview.setAttribute("aria-label", "回复预览");
				let previewing = false;
				const render = () => {
					if (previewing) {
						preview.replaceChildren(renderMessageMarkdown(cm ? cm.getValue() : input.value));
						nsmaxTagImageLinks(preview);
					}
				};
				const action = (label, icon, callback) => {
					const button = document.createElement("button");
					button.type = "button";
					button.title = label;
					button.setAttribute("aria-label", label);
					button.setAttribute("aria-pressed", "false");
					const text = document.createElement("span"); text.className = "nsmax-action-label"; text.textContent = label === "Markdown" ? "使用 Markdown 编辑器" : label === "附件" ? "上传附件" : label;
					button.append(toolIcon(icon), text);
					button.addEventListener("click", () => callback(button), { signal: ctx.signal });
					controls.append(button);
				};
				const setEditorValue = value => {
					if (cm) { cm.setValue(value); cm.refresh(); return; }
					if (!input) return;
					const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
					setter?.call(input, value);
					input.dispatchEvent(new Event("input", { bubbles: true }));
				};
				const insertMarkdown = (prefix, suffix = "", defaultText = "") => {
					if (cm) {
						const selection = cm.getSelection();
						if (selection) {
							cm.replaceSelection(`${prefix}${selection}${suffix}`);
						} else {
							const cursor = cm.getCursor();
							cm.replaceRange(`${prefix}${defaultText}${suffix}`, cursor);
							if (defaultText) {
								cm.setSelection(
									{ line: cursor.line, ch: cursor.ch + prefix.length },
									{ line: cursor.line, ch: cursor.ch + prefix.length + defaultText.length }
								);
							}
						}
						cm.focus();
					} else if (input) {
						// 2026-10-23：都当成一次输入写进去（Ctrl+Z 能撤回）；引用、列表、标题按选中的每一行加前缀，
						// 加粗、斜体、行内代码再点一次取消，链接选中网址就直接包成链接（见 nsmaxPrefixLines / nsmaxToggleWrap / nsmaxInsertLink）
						if (!suffix && ["> ", "- ", "1. ", "### "].includes(prefix)) return nsmaxPrefixLines(input, prefix);
						if (prefix && prefix === suffix) return nsmaxToggleWrap(input, prefix, defaultText);
						if (prefix === "[" && suffix === "](https://)") return nsmaxInsertLink(input);
						const start = input.selectionStart || 0;
						const end = input.selectionEnd || 0;
						const selection = input.value.slice(start, end);
						nsmaxInsertText(input, selection ? `${prefix}${selection}${suffix}` : `${prefix}${defaultText}${suffix}`);
						if (selection) input.setSelectionRange(start + prefix.length, end + prefix.length);
						else if (defaultText) input.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
					}
				};

				const mdeToolbar = document.createElement("div");
				mdeToolbar.className = "nsmax-custom-mde-toolbar";
				mdeToolbar.hidden = true;

				const addMdeTool = (label, title, onClick) => {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.className = "nsmax-mde-btn";
					btn.title = title;
					btn.setAttribute("aria-label", title);
					btn.textContent = label;
					btn.addEventListener("click", e => {
						e.preventDefault();
						onClick();
					}, { signal: ctx.signal });
					mdeToolbar.append(btn);
				};
				const addMdeSep = () => {
					const sep = document.createElement("span");
					sep.className = "nsmax-mde-sep";
					mdeToolbar.append(sep);
				};

				addMdeTool("B", "粗体", () => insertMarkdown("**", "**", "粗体文本"));
				addMdeTool("I", "斜体", () => insertMarkdown("*", "*", "斜体文本"));
				addMdeTool("H", "标题", () => insertMarkdown("### ", "", "标题"));
				addMdeSep();
				addMdeTool("”", "引用", () => insertMarkdown("> ", "", "引用内容"));
				addMdeTool("<>", "代码", () => insertMarkdown("`", "`", "代码"));
				addMdeSep();
				addMdeTool("🔗", "链接", () => insertMarkdown("[", "](https://)", "链接文本"));
				addMdeTool("🖼️", "图片", () => insertMarkdown("![", "](https://)", "图片描述"));
				addMdeSep();
				addMdeTool("•", "无序列表", () => insertMarkdown("- ", "", "列表项"));
				addMdeTool("1.", "有序列表", () => insertMarkdown("1. ", "", "列表项"));
				addMdeTool("⊞", "表格", () => insertMarkdown("\n| 表头 1 | 表头 2 |\n| :--- | :--- |\n| 内容 1 | 内容 2 |\n", "", ""));
				addMdeTool("—", "分割线", () => insertMarkdown("\n\n---\n\n", "", ""));

				action("Markdown", "code", button => {
					const on = editor.classList.toggle("nsmax-editor-tools");
					button.setAttribute("aria-pressed", String(on));
					button.title = on ? "切换到纯文本" : "使用 Markdown 编辑器";
					button.setAttribute("aria-label", button.title);
					button.querySelector(".nsmax-action-label").textContent = button.title;
					mdeToolbar.hidden = !on;
					cm?.refresh();
				});
				// 一键抽奖（2026-10-18 第七批，真的一键）：弹窗里填奖品、中奖人数、开奖时间、从几楼起、能否重复中奖、版块，
				// 点「发布抽奖帖」——标题、正文、版块填进发帖表单，点站点自己的「发布帖子」发出去（内版收费确认等照常由站点弹）；
				// 站点跳到新帖子后，脚本按新帖子的编号生成开奖链接（/lucky?post=…&time=…&count=…&start=…&duplicate=…），
				// 用站点自己的编辑接口补进正文（见 nsmaxFinishLuckyPost）。不用再去开奖页生成链接、回来编辑
				function nsmaxOpenLuckyModal(titleEl, setValueFn, cmInst, inputEl) {
					document.querySelector("dialog.nsmax-lucky-dialog")?.close();
					const make = (tag, className, text) => {
						const el = document.createElement(tag);
						if (className) el.className = className;
						if (text !== undefined) el.textContent = text;
						return el;
					};
					const field = (label, control, hint) => {
						const box = make("label", "nsmax-lucky-field");
						box.append(make("span", "nsmax-lucky-label", label), control);
						if (hint) box.append(make("small", "nsmax-lucky-hint", hint));
						return box;
					};
					const input = (type, value, attrs = {}) => {
						const el = make("input", "nsmax-lucky-input");
						el.type = type;
						el.value = value;
						for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
						return el;
					};
					const pad = (n) => String(n).padStart(2, "0");
					const local = (time) => {
						const date = new Date(time);
						return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
					};
					const nextHour = (hours) => {
						const date = new Date(Date.now() + hours * 36e5);
						date.setMinutes(0, 0, 0);
						return date.getTime() + 36e5;
					};
					const evening = (days) => {
						const date = new Date();
						date.setDate(date.getDate() + days);
						date.setHours(20, 0, 0, 0);
						return date.getTime();
					};
					// 弹窗的头、脚用 div：站点给所有 header / footer 元素套了阴影、#333 灰底和 width:100%（脚栏会比弹窗宽，右边的按钮被切掉）
					const dialog = make("dialog", "nsmax-dialog nsmax-lucky-dialog");
					dialog.setAttribute("aria-label", "一键抽奖");
					const head = make("div", "nsmax-dialog-head");
					const closeButton = make("button", "nsmax-dialog-close");
					closeButton.type = "button";
					closeButton.setAttribute("aria-label", "关闭");
					closeButton.append(toolIcon("close"));
					head.append(make("h3", "", "一键抽奖"), closeButton);
					const body = make("div", "nsmax-dialog-body");
					const intro = make("p", "nsmax-lucky-intro", "点「发布抽奖帖」直接发出去。发出去以后脚本按新帖子的编号生成开奖链接补进正文，到开奖时间站点按回复楼层抽出中奖者。");
					const prize = input("text", "", { placeholder: "例如：50 鸡腿 / 香港小鸡一台 / 兑换码", maxlength: "60" });
					const count = input("number", "1", { min: "1", max: "100" });
					const when = input("datetime-local", local(nextHour(24)));
					const presets = make("div", "nsmax-lucky-presets");
					const tonight = new Date().getHours() < 19;
					for (const [label, time] of [["24 小时后", () => nextHour(24)], ["48 小时后", () => nextHour(48)], [tonight ? "今晚 20:00" : "明晚 20:00", () => evening(tonight ? 0 : 1)], ["三天后 20:00", () => evening(3)]]) {
						const chip = make("button", "nsmax-lucky-chip", label);
						chip.type = "button";
						chip.addEventListener("click", () => { when.value = local(time()); update(); });
						presets.append(chip);
					}
					const start = input("number", "1", { min: "1", max: "100000" });
					const once = input("checkbox", "");
					once.checked = true;
					const onceBox = make("label", "nsmax-lucky-check");
					onceBox.append(once, make("span", "", "每人最多中一次（同一个人回复多次只算一次）"));
					const rule = input("text", "回复本帖即可参与", { maxlength: "80" });
					const extra = make("textarea", "nsmax-lucky-input nsmax-lucky-extra");
					extra.rows = 3;
					extra.placeholder = "补充说明（可不填），比如奖品详情、发放方式";
					const current = (cmInst ? cmInst.getValue() : inputEl?.value || "").trim();
					if (current && !/开奖链接/.test(current)) extra.value = current;
					const nativeCategory = document.querySelector("#editor select#category");
					const category = make("select", "nsmax-lucky-input");
					for (const option of nativeCategory?.options || []) category.append(new Option(option.textContent.trim(), option.value, false, option.value === nativeCategory.value));
					const titleInput = input("text", "", { maxlength: "120" });
					let titleTouched = false;
					titleInput.addEventListener("input", () => { titleTouched = true; });
					const row = (...children) => {
						const box = make("div", "nsmax-lucky-row");
						box.append(...children);
						return box;
					};
					// 预览：发出去以后帖子里那张抽奖卡片的样子（sb.sb .lottery-widget）
					const preview = make("div", "nsmax-lucky-preview");
					const status = make("p", "nsmax-lucky-error");
					status.setAttribute("role", "alert");
					status.hidden = true;
					// 宽屏两栏：左边表单，右边预览（跟着滚动停在顶上）和说明；窄屏一栏，预览排在表单后面
					const form = make("div", "nsmax-lucky-form");
					const timeField = make("div", "nsmax-lucky-group");
					timeField.append(field("开奖时间", when), presets);
					form.append(
						field("奖品", prize),
						row(field("中奖人数", count), field("从第几楼开始算", start, "楼主是 0 楼，回复从 1 楼开始")),
						timeField,
						onceBox,
						field("参与方式", rule),
						field("补充说明", extra),
						row(field("版块", category), field("标题", titleInput)),
						status
					);
					const side = make("div", "nsmax-lucky-side");
					side.append(make("span", "nsmax-lucky-label", "预览"), preview, intro);
					body.append(form, side);
					const foot = make("div", "nsmax-dialog-foot");
					const cancel = make("button", "nsmax-dialog-button", "取消");
					cancel.type = "button";
					const go = make("button", "nsmax-dialog-button primary", "发布抽奖帖");
					go.type = "button";
					foot.append(cancel, go);
					dialog.append(head, body, foot);
					document.body.append(dialog);
					const close = () => dialog.close();
					dialog.addEventListener("close", () => dialog.remove());
					closeButton.addEventListener("click", close);
					cancel.addEventListener("click", close);
					const values = () => {
						const time = new Date(when.value).getTime();
						const date = new Date(time);
						return {
							prize: prize.value.trim(),
							count: Math.max(1, Math.min(100, Math.floor(Number(count.value) || 1))),
							time,
							when: Number.isFinite(time) ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "",
							start: Math.max(1, Math.floor(Number(start.value) || 1)),
							duplicate: !once.checked,
							rule: rule.value.trim() || "回复本帖即可参与",
							extra: extra.value.trim()
						};
					};
					const update = () => {
						const v = values();
						if (!titleTouched) titleInput.value = v.prize ? `【抽奖】${v.prize}` : "";
						// 和帖子里那张卡片同一个样子（同一个函数生成），倒计时也一样每秒走
						const { card } = nsmaxBuildLotteryCard({ time: Number.isFinite(v.time) ? v.time : Date.now(), count: v.count, start: v.start, duplicate: v.duplicate, prize: v.prize, preview: true });
						preview.replaceChildren(card);
						nsmaxTrackLottery(card);
					};
					for (const el of [prize, count, when, start, once, rule]) {
						el.addEventListener("input", update);
						el.addEventListener("change", update);
					}
					go.addEventListener("click", () => {
						const v = values();
						const error = !v.prize ? "请填写奖品" : !Number.isFinite(v.time) ? "请选择开奖时间" : v.time <= Date.now() + 6e4 ? "开奖时间要晚于现在" : !category.value ? "请选择版块" : !titleInput.value.trim() ? "请填写标题" : "";
						status.hidden = !error;
						status.textContent = error;
						if (error) return;
						const title = titleInput.value.trim();
						const md = [
							"## 🎁 抽奖",
							"",
							`- **奖品**：${v.prize}`,
							`- **中奖人数**：${v.count} 人`,
							`- **开奖时间**：${v.when}`,
							`- **参与方式**：${v.rule}`,
							`- **规则**：从 ${v.start} 楼起，${v.duplicate ? "可以重复中奖" : "每人最多中一次"}`,
							"- **开奖链接**：发布后自动生成",
							...(v.extra ? ["", v.extra] : [])
						].join(String.fromCharCode(10));
						const activeTitle = titleEl || document.querySelector("#mde-title, .post-title-input, [name=title], input[placeholder*='标题']");
						if (activeTitle) {
							const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
							setter?.call(activeTitle, title);
							activeTitle.dispatchEvent(new Event("input", { bubbles: true }));
						}
						setValueFn(md);
						if (nativeCategory && nativeCategory.value !== category.value) {
							nativeCategory.value = category.value;
							nativeCategory.dispatchEvent(new Event("change", { bubbles: true }));
						}
						try {
							localStorage.setItem(NSMAX_LUCKY_PENDING, JSON.stringify({ title, time: v.time, count: v.count, start: v.start, duplicate: v.duplicate, at: Date.now() }));
						} catch {}
						close();
						// 等编辑器和表单把新内容记进去（站点的标题、正文、版块都是数据绑定）再点站点自己的「发布帖子」
						setTimeout(() => document.querySelector("#editor .md-editor button.submit, #editor .md-editor .submit.btn")?.click(), 60);
					});
					update();
					if (typeof dialog.showModal === "function") nsmaxShowDialog(dialog);
					else dialog.setAttribute("open", "");
					prize.focus();
				}
				action("附件", "image", () => (editor.querySelector(".nspp-upload-choose") || editor.querySelector('.mde-toolbar [title="图片"],.mde-toolbar [title="上传图片"]'))?.click());
				action("表情", "smile", button => {
					const on = editor.classList.toggle("nsmax-editor-emoji");
					button.setAttribute("aria-pressed", String(on));
				});
				action("预览", "eye", button => {
					previewing = !previewing;
					preview.hidden = !previewing;
					editor.classList.toggle("nsmax-editor-previewing", previewing);
					button.setAttribute("aria-pressed", String(previewing));
					nsmaxSetText(button.querySelector(".nsmax-action-label"), previewing ? "继续编辑" : "预览");
					render();
					if (!previewing) { cm?.refresh(); (cm || input).focus(); }
				});
				const surface = document.createElement("div");
				surface.className = "nsmax-editor-surface";
				const nativeInput = editor.querySelector(".CodeMirror") || input;
				let pane = nativeInput;
				while (pane.parentElement && pane.parentElement !== body && pane.parentElement !== editor) pane = pane.parentElement;
				// 外框负责圆角和焦点；原生 textarea 单独保留直角绘制区，选中文字的色块不跟着外框裁成圆角。
				if (pane === input) { const frame = document.createElement("div"); frame.className = "nsmax-native-editor-frame"; input.before(frame); frame.append(input); pane = frame; }
				if (pane !== body && pane !== editor) { pane.setAttribute("data-nsmax-editor-pane", ""); pane.before(surface); surface.append(pane, preview); }
				else { body.append(surface); surface.append(preview); }
				// 挪进外框以后每行的左右内边距从 CodeMirror 自带的 4px 变成 0（主题第 34 节），可它早先量好、缓存着的光标位置还按 4px 算：
				// 空着点进去，光标压在提示字「写」上（2026-10-24 反馈，真站上量到光标比提示字靠右 4px）。挪完让它按现在的样式重新量一次，
				// 第一次聚焦时再量一次兜底（站点晚一步改了样式也不怕）
				if (cm) {
					requestAnimationFrame(() => cm.refresh());
					const remeasure = () => { cm.off("focus", remeasure); cm.refresh(); };
					cm.on("focus", remeasure);
				}
				const resize = document.createElement("div");
				resize.className = "nsmax-editor-resize"; resize.tabIndex = 0;
				resize.setAttribute("role","separator"); resize.setAttribute("aria-label","调整输入框高度"); resize.setAttribute("aria-orientation","horizontal");
				let drag;
				// 输入框高度只由 --nsmax-editor-height 决定（主题 CSS 让外框＝这个高度、里面的 CodeMirror / 文本框填满其余部分）。
				// 以前分别给外层、CodeMirror、文本框写同一个像素高度，外框还有内边距和边框，内容比外框高出一截，底边被挤掉。
				const heightBox = () => (pane !== body && pane !== editor ? pane : input) || surface;
				const setHeight = (height, manual = true) => {
					const value = Math.max(120, Math.min(1200, Math.round(height)));
					if (manual) editor.setAttribute("data-nsmax-resized", "");
					editor.style.setProperty("--nsmax-editor-height", value + "px");
					resize.setAttribute("aria-valuenow", String(value));
					cm?.refresh();
				};
				const beginDrag = event => {
					if (event.button !== undefined && event.button !== 0) return;
					event.preventDefault();
					event.stopPropagation();
					drag = { y: event.clientY ?? event.touches?.[0]?.clientY ?? 0, height: heightBox().getBoundingClientRect().height };
					if (event.pointerId !== undefined && typeof resize.setPointerCapture === "function") {
						try { resize.setPointerCapture(event.pointerId); } catch(e) {}
					}
				};
				const moveDrag = event => {
					if (drag) {
						event.preventDefault();
						const cy = event.clientY ?? event.touches?.[0]?.clientY;
						if (cy !== undefined) setHeight(drag.height + cy - drag.y);
					}
				};
				const endDrag = event => {
					if (drag) {
						if (event?.pointerId !== undefined && typeof resize.releasePointerCapture === "function") {
							try { resize.releasePointerCapture(event.pointerId); } catch(e) {}
						}
						drag = undefined;
					}
				};
				resize.addEventListener("pointerdown", beginDrag, { signal: ctx.signal });
				resize.addEventListener("mousedown", beginDrag, { signal: ctx.signal });
				resize.addEventListener("touchstart", beginDrag, { signal: ctx.signal, passive: false });
				for (const type of ["pointermove", "mousemove", "touchmove"]) {
					window.addEventListener(type, moveDrag, { signal: ctx.signal, passive: false });
				}
				for (const type of ["pointerup", "pointercancel", "mouseup", "touchend", "touchcancel"]) {
					window.addEventListener(type, endDrag, { signal: ctx.signal });
				}
				resize.addEventListener("lostpointercapture", endDrag, { signal: ctx.signal });
				resize.addEventListener("keydown",event=>{ if (["ArrowDown","ArrowUp"].includes(event.key)) { event.preventDefault(); setHeight(heightBox().getBoundingClientRect().height+(event.key==="ArrowDown"?30:-30)); } },{signal:ctx.signal});
				surface.append(resize);
				// 标题栏照 sb.sb .reply-panel-head：左边「发表回复」，右边一行弱化小字「说两句」（以前「内容 / 预览」两个胶囊放在这里，标题栏被撑到 53px）
				const status = document.createElement("span");
				status.className = "nsmax-editor-status";
				status.textContent = "说两句";
				head.append(status);
				surface.before(controls, mdeToolbar);
				body.prepend(head);
				const submit = editor.querySelector(".topic-select,.submit-row");
				if (isPost) { const button = editor.querySelector("button.submit,button[type=submit]"); if (button && button.textContent.trim() === "发布评论") button.textContent="回复楼主"; }
				if (!submit) { const footer = document.createElement("div"); footer.className = "submit-row"; editor.append(footer); }
				const submitBtn = editor.querySelector("button.submit,button[type=submit]");
				let draftClear = null;
				if (isPost && submitBtn && !editor.querySelector(".nsmax-draft-clear")) {
					draftClear = document.createElement("button");
					draftClear.type = "button";
					draftClear.className = "nsmax-draft-clear";
					draftClear.textContent = "清空草稿";
					draftClear.hidden = true;
					// 照 sb.sb：先问一句「确定清空草稿？」（站点的确认框，主题按 sb.sb 弹窗排），确定了再清空，下方提示「已清空草稿」
					draftClear.addEventListener("click", () => {
						const clear = () => {
							setEditorValue("");
							syncDraft();
							(cm || input)?.focus();
							nsmaxToast("已清空草稿");
						};
						const confirm = unsafeWindow$1.mscConfirm;
						if (typeof confirm === "function") confirm({ title: "确定清空草稿？", subtitle: "已输入的内容将被删除。", okText: "清空草稿", cancelText: "取消", onOk: clear, dismissOverlay: true, closeOnEscape: true });
						else if (window.confirm("确定清空草稿？已输入的内容将被删除。")) clear();
					}, { signal: ctx.signal });
					submitBtn.after(draftClear);
				}
				// 标题栏右边的状态字（sb.sb .reply-status）：平时「说两句」，点了发送「提交中」，发出去（站点清空了编辑器）「已回复」；
				// 站点弹出提示（多半是没发成功，比如字数不够）或 15 秒还没结果就回到「说两句」
				let sendTimer = 0;
				const setStatus = (text) => {
					clearTimeout(sendTimer);
					nsmaxSetText(status, text);
					if (text === "提交中") sendTimer = setTimeout(() => setStatus("说两句"), 15e3);
				};
				if (isPost && submitBtn) {
					submitBtn.addEventListener("click", () => {
						if ((cm ? cm.getValue() : input?.value || "").trim()) setStatus("提交中");
					}, { capture: true, signal: ctx.signal });
					const alerts = new MutationObserver((records) => {
						if (status.textContent !== "提交中") return;
						if (records.some((record) => Array.from(record.addedNodes).some((node) => node instanceof HTMLElement && node.classList.contains("msc-confirm")))) setStatus("说两句");
					});
					alerts.observe(document.body, { childList: true });
					ctx.signal.addEventListener("abort", () => alerts.disconnect(), { once: true });
				}
				// 写了字时状态字换成「已写 N 字」（2026-10-23），清空回到「说两句」；提交中、已回复照旧
				const syncDraft = () => {
					const value = (cm ? cm.getValue() : input?.value || "").trim();
					if (draftClear) draftClear.hidden = !value;
					if (status.textContent === "提交中" && !value) setStatus("已回复");
					else if (status.textContent !== "提交中" && !(status.textContent === "已回复" && !value)) setStatus(value ? `已写 ${[...value].length} 字` : "说两句");
					nsmaxSyncEditorMode();
				};
				// 站点会把这个帖子没发出去的草稿放回编辑器：照 sb.sb 提示一句「已恢复未发出的草稿」。
				// 只在打开页面后、还没动过页面时（不是自己点了引用 / 回复 / 举报填进去的，也不是「直达底部」带过来的）
				if (isPost) {
					let touched = false;
					const touch = () => { touched = true; };
					document.addEventListener("pointerdown", touch, { capture: true, once: true, signal: ctx.signal });
					document.addEventListener("keydown", touch, { capture: true, once: true, signal: ctx.signal });
					const carried = () => {
						try { return !!sessionStorage.getItem("nsmax:carry:" + location.pathname.match(/^\/post-(\d+)/)?.[1]); } catch { return false; }
					};
					let announced = false;
					const announce = () => {
						if (announced || touched || nsmaxReplyArrival || carried() || !(cm ? cm.getValue() : input?.value || "").trim()) return;
						announced = true;
						nsmaxToast("已恢复未发出的草稿");
					};
					setTimeout(announce, 0);
					setTimeout(announce, 1500);
				}
				// 输入框聚焦时暂停评论自动翻页：在底部写回复时，下一页接上来会把回复框往下顶
				const composing = (on) => {
					if (document.documentElement.hasAttribute("data-nsmax-composing") === on) return;
					document.documentElement.toggleAttribute("data-nsmax-composing", on);
					document.dispatchEvent(new Event("nspp:reply-state"));
				};
				// 提示字（sb.sb 同款）：帖子页「写下你的回复…」，发帖 / 编辑页「写下正文…」——所有编辑器都换掉站点自己的
				// 「鼓励友善发言，禁止人身攻击」（以前只换了帖子页，发帖页还是站点的提示）。聚焦输入时提示由主题 CSS 藏起来，不和光标叠在一起
				const hint = isPost ? "写下你的回复…" : "写下正文…";
				if (cm) {
					try { if (cm.getOption("placeholder") !== hint) cm.setOption("placeholder", hint); } catch {}
				} else if (input && (!input.placeholder || /鼓励友善/.test(input.placeholder))) input.placeholder = hint;
				if (isPost) {
					if (cm) {
						cm.on("change", syncDraft);
						cm.on("focus", () => composing(true));
						cm.on("blur", () => composing(false));
					} else if (input) {
						input.addEventListener("input", syncDraft, { signal: ctx.signal });
						input.addEventListener("focus", () => composing(true), { signal: ctx.signal });
						input.addEventListener("blur", () => composing(false), { signal: ctx.signal });
					}
					setTimeout(syncDraft, 0);
				}
				if (!isPost && /^\/new-discussion$/.test(location.pathname) && submitBtn && !editor.querySelector(".nsmax-lucky-trigger")) {
					const luckyBtn = document.createElement("button");
					luckyBtn.type = "button";
					luckyBtn.className = "nsmax-lucky-trigger";
					luckyBtn.innerHTML = `<span>🎁</span><b>一键抽奖</b>`;
					luckyBtn.addEventListener("click", () => {
						const titleInput = document.querySelector(".post-title-input,[name=title],input[placeholder*='标题']");
						nsmaxOpenLuckyModal(titleInput, setEditorValue, cm, input);
					});
					submitBtn.before(luckyBtn);
				}
				// 纯文本框（没有 CodeMirror）时：内容超过默认高度就跟着长高（最多 800px），删短了再缩回；用户手动拖过就不再自动改
				const adjustInputHeight = () => {
					if (!input || cm || editor.hasAttribute("data-nsmax-resized")) return;
					const box = heightBox();
					editor.style.setProperty("--nsmax-editor-height", "150px");
					const needed = input.scrollHeight + (box.offsetHeight - input.clientHeight);
					if (needed > 150) setHeight(Math.min(800, needed), false);
				};
				// 只在没有内容时回到顶部（有内容时点进去还跳回第一行会很烦）
				input?.addEventListener("focus", () => { if (input && !input.value) input.scrollTop = 0; }, { signal: ctx.signal });
				if (cm) cm.on("change", render);
				else {
					input.addEventListener("input", render, { signal: ctx.signal });
					input.addEventListener("input", adjustInputHeight, { signal: ctx.signal });
					setTimeout(adjustInputHeight, 0);
				}
				editors.set(editor, () => { cm?.off("change", render); head.remove(); controls.remove(); mdeToolbar.remove(); preview.remove(); });
			}
			nsmaxSyncEditorMode();
			if (!isPost) return;
			nsmaxGroupNestedReplies();
			nsmaxDecorateFloorBoxes();
			nsmaxDecorateQuotes();
			nsmaxBuildAuthorColumns();
			nsmaxLoadAuthorStats(ctx);
			nsmaxSetupComposer(ctx);
			nsmaxHandleReplyArrival();
		};
		const stop = ctx.watch(scan);
		window.addEventListener("popstate", scan, { signal: ctx.signal });
		window.addEventListener("hashchange", scan, { signal: ctx.signal });
		let origPush, origReplace;
		if (typeof history !== "undefined") {
			origPush = history.pushState;
			origReplace = history.replaceState;
			history.pushState = function() {
				const res = origPush.apply(this, arguments);
				try { scan(); } catch(e) {}
				return res;
			};
			history.replaceState = function() {
				const res = origReplace.apply(this, arguments);
				try { scan(); } catch(e) {}
				return res;
			};
		}
		return () => {
			stop();
			if (origPush) history.pushState = origPush;
			if (origReplace) history.replaceState = origReplace;
			stopTouchUi();
			for (const dispose of editors.values()) dispose();
			editors.clear();
		};
	}
	var leanUiFeature = { id: "sb-page-controls", defaults: { enabled: true }, mount: mountLeanUi };

	// 帖子列表、帖子、搜索、精华这些页面挂侧栏热榜和最近浏览（与 main 里的 isForum 一致）。
	function nsmaxForumPage(page = location.pathname) {
		return /^\/post-\d+/.test(page) || page === "/" || page === "/search" || /^\/(?:page-\d+|categories\/|award(?:\/|$))/.test(page);
	}
	// 最近浏览按账号分开记。页面解析阶段 __config__ 还没执行（它在页面最后），从站点画好的资料卡里取 UID；
	// 资料卡也还没出来时返回 null（还不知道是谁，先不画）。
	function nsmaxRecentAccount(sidebar) {
		const config = unsafeWindow$1.__config__;
		if (config) return config.user?.member_id ? String(config.user.member_id) : "guest";
		const link = sidebar?.querySelector(".user-card .user-head a[href*='/space/']");
		const id = /\/space\/(\d+)/.exec(link?.getAttribute("href") || "")?.[1];
		if (id) return id;
		return sidebar && !sidebar.querySelector("#usercard-me.skeleton, .user-card .user-stat") ? "guest" : null;
	}
	function nsmaxRecentRecords(account) {
		try {
			const value = JSON.parse(localStorage.getItem("nsmax:recent:" + account) || "[]");
			return Array.isArray(value) ? value.filter((item) => typeof item?.title === "string" && /^\/post-\d+-\d+$/.test(item.path)).slice(0, 10).map(({ path, title }) => ({ path, title })) : [];
		} catch {
			return [];
		}
	}
	// 帖子页：当前帖子排到最前（没变时原样返回同一个数组）
	function nsmaxRecentWithCurrent(records) {
		const match = location.pathname.match(/^\/post-(\d+)(?:-\d+)?$/);
		const title = document.querySelector(".nsk-post .post-title-link,.nsk-post h1")?.textContent.trim();
		if (!match || !title) return records;
		const path = "/post-" + match[1] + "-1";
		return [{ path, title: title.slice(0, 200) }, ...records.filter((item) => item.path !== path)].slice(0, 10);
	}
	function nsmaxRecentPanel() {
		const panel = document.createElement("section");
		panel.className = "nsmax-recent-panel";
		const head = document.createElement("h2");
		head.textContent = "最近浏览";
		panel.append(head, document.createElement("ul"));
		return panel;
	}
	// 列表内容和记录一样时不动 DOM（页面解析阶段画好的面板，模块接管时不重画）
	function nsmaxRenderRecent(panel, records) {
		const list = panel.querySelector(":scope > ul");
		if (!list) return;
		if (list.children.length === records.length && records.every((record, index) => {
			const link = list.children[index].firstElementChild;
			return link?.getAttribute("href") === record.path && link.textContent === record.title;
		})) return;
		list.replaceChildren(...records.map((record) => {
			const item = document.createElement("li");
			const link = document.createElement("a");
			link.href = record.path;
			link.textContent = record.title;
			link.title = record.title;
			item.append(link);
			return item;
		}));
	}
	// 页面解析阶段和资料卡、今日热门一起放进右栏（见 startEarlyPass 的 region("right")）：以前要等模块挂载
	// （真实站点上比其他卡片晚一两秒）才插进来，侧栏一块一块地出现
	function nsmaxEarlyRecentPanel(sidebar) {
		if (!nsmaxForumPage() || sidebar.querySelector(".nsmax-recent-panel")) return;
		if (GM_getValue$1(SETTINGS_KEY, {})?.["sb-recent-visits"]?.enabled === false) return;
		const account = nsmaxRecentAccount(sidebar);
		if (!account) return;
		const records = nsmaxRecentWithCurrent(nsmaxRecentRecords(account));
		if (!records.length) return;
		const panel = nsmaxRecentPanel();
		nsmaxRenderRecent(panel, records);
		const hot = sidebar.querySelector(":scope > .nsmax-hot-panel");
		if (hot) hot.after(panel);
		else sidebar.append(panel);
	}

	var recentVisitsFeature = {
		id: "sb-recent-visits", defaults: { enabled: true }, mount(ctx) {
			const account = nsmaxRecentAccount(null) || "guest";
			const key = "nsmax:recent:" + account;
			let records = nsmaxRecentRecords(account);
			const current = nsmaxRecentWithCurrent(records);
			if (current !== records) {
				records = current;
				try { localStorage.setItem(key, JSON.stringify(records)); } catch {}
			}
			let panel;
			const render = () => {
				const sidebar = document.getElementById("nsk-right-panel-container") || (nsmaxTouchLayout() ? document.querySelector("#left-slide-panel .nsmax-drawer-recent") : null);
				if (!sidebar) return;
				if (!records.length) { panel?.remove(); panel = null; nsmaxDropAttr(sidebar, "data-nsmax-recent-ready"); return; }
				// 页面解析阶段已经画好的面板原地接管
				panel ||= sidebar.querySelector(":scope > .nsmax-recent-panel") || nsmaxRecentPanel();
				const hot = sidebar.querySelector(".nsmax-hot-panel");
				if (hot && hot.nextElementSibling !== panel) hot.after(panel);
				else if (!panel.isConnected) sidebar.append(panel);
				nsmaxRenderRecent(panel, records);
				nsmaxSetAttr(sidebar, "data-nsmax-recent-ready", "");
			};
			const stop = ctx.watch(render);
			window.addEventListener("storage", event => { if (event.key === key) { records = nsmaxRecentRecords(account); render(); } }, { signal: ctx.signal });
			return () => { stop(); panel?.remove(); };
		}
	};

	// 我的回复（2026-10-18）：列表里回复过的帖子下面一行「我的回复 #4 #22 #32」，帖子评论区最上面也有一行，点了直接跳到那一楼
	// （已经加载出来的楼层就地滚过去）。哪几楼是自己的：看帖子时把这一页里作者是自己的楼层（含楼中楼）记下来，
	// 另外每 10 分钟最多查一次自己最新一页评论（/api/content/list-comments，15 条）合并进来，更早的回帖每分钟往后补一页。
	// 按账号存在本机，最多记 3000 篇帖子
	function nsmaxMyRepliesPost() {
		return Number(location.pathname.match(/^\/post-(\d+)/)?.[1]) || 0;
	}
	// 一行「我的回复 #4 #22 #32」：已经有了、内容也一样就不动
	function nsmaxMyRepliesRow(host, post, floors, before) {
		let el = host.querySelector(":scope > .nsmax-my-replies");
		if (!floors?.length) {
			el?.remove();
			return;
		}
		const here = post === nsmaxMyRepliesPost();
		const loaded = (floor) => here && !!document.getElementById(String(floor))?.matches("li.content-item");
		const sig = floors.join(",") + "|" + floors.filter(loaded).join(",");
		if (el?.dataset.sig === sig) return;
		if (!el) {
			el = document.createElement("div");
			el.className = "nsmax-my-replies";
			host.insertBefore(el, before?.parentNode === host ? before : null);
		}
		el.dataset.sig = sig;
		const label = document.createElement("span");
		label.className = "nsmax-my-replies-label";
		label.textContent = "我的回复";
		const links = floors.slice(0, 12).map((floor) => {
			const a = document.createElement("a");
			a.href = loaded(floor) ? "#" + floor : `/post-${post}-${Math.max(1, Math.ceil(floor / 10))}#${floor}`;
			a.textContent = "#" + floor;
			a.title = `我在第 ${floor} 楼的回复`;
			return a;
		});
		el.replaceChildren(label, ...links);
		if (floors.length > 12) {
			const more = document.createElement("span");
			more.className = "nsmax-my-replies-more";
			more.textContent = `等 ${floors.length} 处`;
			el.append(more);
		}
	}
	// 列表里每一篇下面、帖子回复区标题栏里各画一行。parsed：页面解析阶段只动已经解析完的列表行
	// （往还在解析的行里插，站点后面的内容会接在这一行后面）
	function nsmaxMyRepliesRender(posts, parsed) {
		for (const item of document.querySelectorAll("#nsk-body-left ul.post-list > li.post-list-item")) {
			if (parsed && !parsed(item)) continue;
			const post = Number(item.querySelector(".post-title a[href*='/post-']")?.getAttribute("href")?.match(/\/post-(\d+)/)?.[1]);
			nsmaxMyRepliesRow(item.querySelector(".post-list-content") || item, post, posts[post]);
		}
		const post = nsmaxMyRepliesPost();
		const container = document.querySelector("#nsk-body-left .comment-container");
		if (!post || !container) return;
		// 放进回复区标题栏，接在「N 条回复」后面（2026-10-24 反馈）：以前单独一行夹在标题栏和回复列表两张卡片中间，
		// 透明底加一条下边线，看着像断开的一截灰条。评论有好几页时标题在上面那排页码里，一样接在标题后面
		const heading = container.querySelector(".nsmax-reply-title");
		if (parsed && !heading) return;
		const host = heading?.parentElement || container;
		for (const stray of container.querySelectorAll(".nsmax-my-replies")) if (stray.parentElement !== host) stray.remove();
		const floors = (posts[post] || []).slice();
		// 解析阶段：这一页里作者是自己的楼层也先算上（模块启动后会记下来）
		if (parsed) {
			const uid = nsmaxMyRepliesUid();
			for (const li of document.querySelectorAll("#nsk-body-left ul.comments li.content-item[id]")) {
				const floor = Number(li.id);
				if (floor > 0 && !floors.includes(floor) && li.querySelector(":scope > .nsk-content-meta-info .author-info a[href*='/space/']")?.getAttribute("href")?.match(/\/space\/(\d+)/)?.[1] === uid) floors.push(floor);
			}
			floors.sort((a, b) => a - b);
		}
		nsmaxMyRepliesRow(host, post, floors, heading ? heading.nextSibling : container.firstChild);
		const el = heading && host.querySelector(":scope > .nsmax-my-replies");
		if (el && el.previousElementSibling !== heading) heading.after(el);
		// 标题栏里有这一行时换一种排法（主题 71b；主题里不能用 :has()，会让站点的终端渲染卡死整页）
		if (heading) nsmaxFlag(host, "data-nsmax-my-replies", !!el);
	}
	// 当前账号：站点配置在页面最后才有，解析阶段先用记下的自己的资料（nsmaxStoredAccount）
	function nsmaxMyRepliesUid() {
		return String(unsafeWindow$1.__config__?.user?.member_id || nsmaxStoredAccount().id || "");
	}
	// 页面解析阶段就画（2026-10-24 反馈「加载一卡一卡、卡一下动一下」）：以前等模块启动（第一帧之后）才插，
	// 列表里回复过的那几篇每篇高出 25px，下面整列往下跳一下；手机上帖子页标题栏放不下、这一行换到第二行，回复列表也跟着跳。
	// 记录只读一次（几千篇帖子的记录，每解析一段就读一遍太费）
	var nsmaxMyRepliesEarly;
	function nsmaxEarlyMyReplies(parsed) {
		if (nsmaxMyRepliesEarly === undefined) {
			nsmaxMyRepliesEarly = null;
			try {
				const uid = nsmaxMyRepliesUid();
				if (uid && typeof myRepliesFeature === "object" && featureEnabled(myRepliesFeature).enabled) {
					const posts = featureState("sb-my-replies")["posts:" + uid];
					if (posts && typeof posts === "object" && !Array.isArray(posts)) nsmaxMyRepliesEarly = posts;
				}
			} catch {}
		}
		if (nsmaxMyRepliesEarly) nsmaxMyRepliesRender(nsmaxMyRepliesEarly, parsed);
	}
	var myRepliesFeature = {
		id: "sb-my-replies", defaults: { enabled: true }, mount(ctx) {
			const uid = String(unsafeWindow$1.__config__?.user?.member_id || "");
			// 没登录：解析阶段按记下的账号先画了的话收掉
			if (!uid) {
				for (const el of document.querySelectorAll(".nsmax-my-replies")) el.remove();
				return;
			}
			const key = "posts:" + uid;
			let posts = ctx.get(key);
			if (!posts || typeof posts !== "object" || Array.isArray(posts)) posts = {};
			const save = () => {
				const ids = Object.keys(posts);
				if (ids.length > 3000) for (const id of ids.slice(0, ids.length - 3000)) delete posts[id];
				ctx.set(key, posts);
			};
			const add = (post, floor) => {
				if (!Number.isInteger(post) || !Number.isInteger(floor) || post <= 0 || floor <= 0) return false;
				const list = Array.isArray(posts[post]) ? posts[post] : (posts[post] = []);
				if (list.includes(floor)) return false;
				list.push(floor);
				list.sort((a, b) => a - b);
				return true;
			};
			// 这一页里作者是自己的楼层
			const collect = () => {
				const post = nsmaxMyRepliesPost();
				if (!post) return false;
				let added = false;
				for (const li of document.querySelectorAll("#nsk-body-left ul.comments li.content-item[id]")) {
					const href = li.querySelector(":scope > .nsk-content-meta-info .author-info a[href*='/space/']")?.getAttribute("href") || "";
					if (href.match(/\/space\/(\d+)/)?.[1] === uid && add(post, Number(li.id))) added = true;
				}
				return added;
			};
			const render = () => {
				if (collect()) save();
				nsmaxMyRepliesRender(posts);
			};
			const sync = async () => {
				if (document.hidden || ctx.signal.aborted) return;
				if (Date.now() - (Number(ctx.get(key + ":synced")) || 0) < 6e5) return;
				ctx.set(key + ":synced", Date.now());
				try {
					const res = await ctx.request(`/api/content/list-comments?uid=${uid}&page=1`, { signal: ctx.signal });
					let added = false;
					if (res?.success && Array.isArray(res.comments)) for (const comment of res.comments) if (add(Number(comment?.post_id), Number(comment?.floor_id))) added = true;
					if (added) {
						save();
						render();
					}
				} catch {}
			};
			// 更早的回帖慢慢补全（照 NodeSeek++「回帖足迹」的同步，不用手动点）：每次打开页面、距上次超过 1 分钟时
			// 往后多拉一页（第 2 页起，每页 15 条），拉到空页为止；每分钟最多一个请求
			const backfill = async () => {
				if (document.hidden || ctx.signal.aborted || ctx.get(key + ":done")) return;
				if (Date.now() - (Number(ctx.get(key + ":filled")) || 0) < 6e4) return;
				ctx.set(key + ":filled", Date.now());
				const page = Math.max(2, Number(ctx.get(key + ":cursor")) || 2);
				try {
					const res = await ctx.request(`/api/content/list-comments?uid=${uid}&page=${page}`, { signal: ctx.signal });
					if (!res?.success || !Array.isArray(res.comments)) return;
					if (!res.comments.length) {
						ctx.set(key + ":done", true);
						return;
					}
					let added = false;
					for (const comment of res.comments) if (add(Number(comment?.post_id), Number(comment?.floor_id))) added = true;
					ctx.set(key + ":cursor", page + 1);
					if (added) {
						save();
						render();
					}
				} catch {}
			};
			const stop = ctx.watch(render);
			const timer = setTimeout(async () => {
				await sync();
				await backfill();
			}, 2e3);
			document.addEventListener("visibilitychange", sync, { signal: ctx.signal });
			return () => {
				stop();
				clearTimeout(timer);
				for (const el of document.querySelectorAll(".nsmax-my-replies")) el.remove();
			};
		}
	};
	// 站点黑名单（/api/block-list/list）：资料卡的「屏蔽」按钮按它显示「屏蔽 / 已屏蔽」；一个页面只查一次，改过以后重查
	var nsmaxOfficialBlocksCache = null;
	function nsmaxOfficialBlocks() {
		if (!unsafeWindow$1.__config__?.user?.member_id) return Promise.resolve(null);
		return nsmaxOfficialBlocksCache ||= fetch("/api/block-list/list", { credentials: "same-origin" }).then((res) => res.json()).then((json) => {
			const rows = Array.isArray(json?.data) ? json.data : [];
			return { ids: new Set(rows.map((row) => String(row?.block_member_id ?? ""))), names: new Set(rows.map((row) => String(row?.block_member_name ?? ""))) };
		}).catch(() => {
			nsmaxOfficialBlocksCache = null;
			return null;
		});
	}
	// 资料卡数据存在本次会话里（sessionStorage，10 分钟）：换了页面再停在同一个人上，卡片马上就是完整的
	var NSMAX_PERSON_CACHE = "nsmax:person:";
	function nsmaxPersonCached(id) {
		try {
			const raw = JSON.parse(sessionStorage.getItem(NSMAX_PERSON_CACHE + id) || "null");
			if (raw && Date.now() - raw.at < 6e5 && raw.data && typeof raw.data === "object") return raw.data;
		} catch {}
		return null;
	}
	function nsmaxPersonStore(id, data) {
		try { sessionStorage.setItem(NSMAX_PERSON_CACHE + id, JSON.stringify({ at: Date.now(), data })); } catch {}
	}
	function nsmaxPersonForget(id) {
		try { sessionStorage.removeItem(NSMAX_PERSON_CACHE + id); } catch {}
	}
	// 管理记录（2026-10-18 第七批）：站点的管理记录页只给管理员按用户名搜，普通账号搜会提示「Not allowed to search」、页面空白。
	// 这里弹一个窗口，从最新的记录往前翻（接口每页 20 条，站点最多让翻 100 页 = 最近 2000 条），把和这个人有关的列出来：
	// 先翻 10 页（三页一起读），没找全可以「再往前查」；翻过的页这次打开页面期间记着，换一个人查时不重复读。管理员直接按名字搜
	var nsmaxRulingPages = new Map();
	async function nsmaxRulingPage(page, search = "") {
		const key = search ? `${page}?${search}` : String(page);
		const hit = nsmaxRulingPages.get(key);
		if (hit && Date.now() - hit.at < 3e5) return hit.rows;
		const res = await fetch(`/api/admin/ruling/page-${page}${search ? "?search=" + encodeURIComponent(search) : ""}`, { credentials: "same-origin" });
		const json = await res.json().catch(() => ({}));
		if (!res.ok || !json?.success) throw new Error(json?.message || `读取失败（${res.status}）`);
		const rows = Array.isArray(json.data) ? json.data : [];
		nsmaxRulingPages.set(key, { at: Date.now(), rows });
		return rows;
	}
	// 处理内容：和站点管理记录页（ruling.js 的 formatAction）同一套写法
	function nsmaxRulingLines(request) {
		let action;
		try { action = typeof request === "string" ? JSON.parse(request) : request || {}; } catch { return []; }
		const lines = [];
		const signed = (value) => `${Number(value) < 0 ? "" : "+"}${value}`;
		if (action.coin) lines.push(`因“${action.coin.reason || ""}”被${signed(action.coin.coin_diff)}鸡腿`);
		if (action.stardust) lines.push(`${signed(action.stardust.stardust_diff)}星辰币`);
		const summary = action.postSummary;
		if (summary) {
			if (summary.title) lines.push(`标题被改为${summary.title}`);
			if (summary.category) lines.push(`移动到 ${unsafeWindow$1.__config__?.allCategory?.find?.((item) => item.key === summary.category)?.cn_text || summary.category} 版块`);
			if (summary.rank !== undefined) lines.push(`阅读权限被改为${summary.rank}`);
			if (summary.locked !== undefined) lines.push(`${summary.locked ? "锁定" : "解锁"}修改`);
			if (summary.award !== undefined) lines.push(`${summary.award ? "" : "取消"}设为推荐阅读`);
		}
		if (action.hideComment) {
			const all = action.target?.uid ? "全部" : "";
			lines.push(`${action.target?.uid ? "用户被" : ""}${action.hideComment.status ? "隐藏" : "取消隐藏"}${all}内容`);
		}
		if (action.pinComment) lines.push(action.pinComment.status ? "置顶评论" : "取消置顶评论");
		if (action.suspend) lines.push(`用户被${action.suspend.status ? `禁言${action.suspend.value}天` : "取消禁言"}`);
		return lines;
	}
	function nsmaxRulingDialog(id, name) {
		document.querySelector("dialog.nsmax-ruling-dialog")?.close();
		const make = (tag, className, text) => {
			const el = document.createElement(tag);
			if (className) el.className = className;
			if (text !== undefined) el.textContent = text;
			return el;
		};
		const dialog = make("dialog", "nsmax-dialog nsmax-ruling-dialog");
		dialog.setAttribute("aria-label", `${name} 的管理记录`);
		// 头、脚用 div：站点给所有 header / footer 元素套了阴影、#333 灰底和 width:100%（脚栏比弹窗宽，右边的按钮被切掉）
		const head = make("div", "nsmax-dialog-head");
		const close = make("button", "nsmax-dialog-close");
		close.type = "button";
		close.setAttribute("aria-label", "关闭");
		close.append(toolIcon("close"));
		head.append(make("h3", "", `${name} 的管理记录`), close);
		const admin = !!unsafeWindow$1.__config__?.user?.isAdmin;
		const body = make("div", "nsmax-dialog-body");
		const intro = make("p", "nsmax-ruling-intro", admin ? "按用户名搜索站点的管理记录。" : "站点只给管理员按用户名搜，这里从最新的管理记录往前找（站点最多能翻到最近 2000 条）。");
		const list = make("ol", "nsmax-ruling-list");
		const empty = make("p", "nsmax-ruling-empty");
		empty.hidden = true;
		body.append(intro, list, empty);
		const foot = make("div", "nsmax-dialog-foot");
		const status = make("span", "nsmax-ruling-status", "正在查找…");
		status.setAttribute("role", "status");
		const more = make("button", "nsmax-dialog-button", "再往前查");
		more.type = "button";
		more.hidden = true;
		const page$ = make("a", "nsmax-dialog-button", "管理记录页");
		page$.href = "/ruling";
		page$.target = "_blank";
		page$.rel = "noopener";
		foot.append(status, more, page$);
		dialog.append(head, body, foot);
		document.body.append(dialog);
		let stopped = false;
		dialog.addEventListener("close", () => { stopped = true; dialog.remove(); });
		dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
		close.addEventListener("click", () => dialog.close());
		const pad = (n) => String(n).padStart(2, "0");
		const when = (value) => {
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		};
		const render = (row) => {
			const item = make("li", "nsmax-ruling-item");
			const meta = make("div", "nsmax-ruling-meta");
			const time = make("time", "", when(row.created_at));
			time.dateTime = row.created_at || "";
			meta.append(time, make("span", "", `管理员 ${row.admin_member_name || "—"}`));
			const postId = Number(row.post_id), floor = Number(row.floor_index);
			if (postId > 0) {
				const target = make("a", "", floor > 0 ? `帖子 #${floor}` : "帖子");
				target.href = `/post-${postId}-${Math.max(1, Math.ceil(floor / 10))}${floor > 0 ? "#" + floor : ""}`;
				target.target = "_blank";
				target.rel = "noopener";
				meta.append(target);
			}
			const lines = nsmaxRulingLines(row.request);
			const action = make("div", "nsmax-ruling-action");
			for (const line of lines.length ? lines : ["（站点没写处理内容）"]) action.append(make("div", "", line));
			item.append(meta, action);
			return item;
		};
		let page = 0, found = 0, scanned = 0, oldest = "", finished = false;
		const mine = (row) => String(row?.target_member_id) === String(id) || row?.target_member_name === name;
		const report = () => {
			const range = oldest ? `（到 ${when(oldest).slice(0, 10)}）` : "";
			status.textContent = `${finished ? "已查完" : "已查"}最近 ${scanned} 条${range}，找到 ${found} 条`;
			empty.hidden = !!found || !finished && page < 10;
			empty.textContent = finished ? "最近的管理记录里没有和 TA 有关的。" : "这段时间里没有和 TA 有关的管理记录，可以「再往前查」。";
		};
		const scan = async (pages) => {
			more.disabled = true;
			const until = Math.min(100, page + pages);
			try {
				while (page < until && !stopped) {
					const batch = [];
					for (let i = 0; i < 3 && page + batch.length < until; i++) batch.push(page + batch.length + 1);
					const results = await Promise.all(batch.map((p) => nsmaxRulingPage(p)));
					if (stopped) return;
					page += batch.length;
					for (const rows of results) {
						scanned += rows.length;
						for (const row of rows) {
							oldest = row.created_at || oldest;
							if (!mine(row)) continue;
							list.append(render(row));
							found++;
						}
					}
					if (results.some((rows) => rows.length < 20) || page >= 100) finished = true;
					report();
					if (finished) break;
				}
			} catch (error) {
				status.textContent = `读取失败：${error?.message || "请稍后再试"}`;
			} finally {
				more.disabled = false;
				more.hidden = finished || stopped;
			}
		};
		if (admin) {
			nsmaxRulingPage(1, name).then((rows) => {
				if (stopped) return;
				for (const row of rows) { list.append(render(row)); found++; }
				finished = true;
				page = 1;
				status.textContent = `找到 ${found} 条（站点按用户名搜索的第一页）`;
				empty.hidden = !!found;
				empty.textContent = "没有和 TA 有关的管理记录。";
			}).catch((error) => { status.textContent = `读取失败：${error?.message || "请稍后再试"}`; });
		} else scan(10);
		more.addEventListener("click", () => scan(10));
		if (typeof dialog.showModal === "function") nsmaxShowDialog(dialog);
		else dialog.setAttribute("open", "");
		return dialog;
	}
	// 鼠标没动、是页面滚动把链接带到鼠标下面的（浏览器补发的 pointerover / mouseenter）不算悬停（2026-10-23）：
	// 鼠标上一次真的移动以来页面滚过，就是滚动带过来的。比的是滚动位置，不看事件先后（补发的悬停可能比 scroll 事件还早到）。
	// 以前一边滚一边弹预览卡、资料卡，还预取滑过的每个链接，滚动时一下一下地卡。鼠标真的动了再算。
	// 各个悬停功能挂载时先调一次，记下那时的位置（打开页面后鼠标一直没动、只滚了滚轮的也算滚动带过来的）
	var nsmaxHoverState = null;
	// 滚动位置从鼠标事件本身算（pageY − clientY，事件发出时就定了）：以前在每次鼠标移动、划过时读 scrollX / scrollY，
	// 页面刚改过的话浏览器得当场排一遍版（2026-10-24 量到：切换编辑器后鼠标一动，划过处理里强制排版 440ms，CPU 4 倍降速），
	// 页面加载、整理期间鼠标一动就一帧排好几次版。只在第一次调用（模块启动）时读一次
	function nsmaxHoverFromScroll(event) {
		const offset = (e) => e ? [e.pageX - e.clientX, e.pageY - e.clientY] : [scrollX, scrollY];
		if (!nsmaxHoverState) {
			const [x, y] = offset(event);
			const state = nsmaxHoverState = { x, y };
			document.addEventListener("pointermove", (e) => {
				if (!e.movementX && !e.movementY) return;
				[state.x, state.y] = offset(e);
			}, { capture: true, passive: true });
		}
		if (!event) return false;
		const [x, y] = offset(event);
		return Math.abs(y - nsmaxHoverState.y) > 1 || Math.abs(x - nsmaxHoverState.x) > 1;
	}
	var personHoverFeature = { id: "sb-person-hover", defaults: { enabled: true }, mount(ctx) {
		const cache = new Map(); let pop, anchor, opening, closing, serial = 0;
		const matches = target => {
			const link = target instanceof Element ? target.closest('a[href*="/space/"]:not(.nsmax-person-head a):not(.nsmax-person-foot a):not(#fast-nav-button-group a),.avatar-wrapper a,.info-author a[href*="/space/"],.info-last-commenter a[href*="/space/"],.author-name[href*="/space/"],.post-author[href*="/space/"]') : null;
			if (!link || link.closest(".nsmax-person-pop, .hover-user-card, #fast-nav-button-group, .nsmax-sb-account, #nsk-right-panel-container, .nspp-user-card, .head-container")) return null;
			try { const url = new URL(link.href,location.href); return url.origin === location.origin && /^\/space\/\d+\/?$/.test(url.pathname) ? link : null; } catch { return null; }
		};
		const hide = () => { clearTimeout(opening); clearTimeout(closing); serial++; pop?.remove(); pop = null; anchor = null; document.documentElement.removeAttribute("data-nsmax-person-open"); };
		const closeSoon = () => { clearTimeout(opening); clearTimeout(closing); closing = setTimeout(hide,160); };
		const place = () => { if (!pop || !anchor) return; const box = anchor.getBoundingClientRect(); pop.style.left = Math.max(8,Math.min(box.left,innerWidth-pop.offsetWidth-8))+"px"; pop.style.top = Math.max(8,Math.min(box.bottom+8,innerHeight-pop.offsetHeight-8))+"px"; };
		const show = async link => {
			const url = new URL(link.href,location.href), id = url.pathname.match(/^\/space\/(\d+)\/?$/)?.[1];
			if (url.origin !== location.origin || !id) return;
			if (anchor === link && pop) { clearTimeout(closing); return; }
			hide(); anchor = link; const ticket = ++serial;
			const owner = link.closest(".content-item,.post-list-item,.user-head");
			const findAvatarSrc = () => {
				return link.querySelector("img")?.src
					|| owner?.querySelector(`a[href*="/space/${id}"] img`)?.src
					|| owner?.querySelector(".avatar-wrapper img, .avatar img, img.avatar")?.src
					|| document.querySelector(`a[href*="/space/${id}"] img, a[href="/space/${id}"] img`)?.src
					|| "";
			};
			let avatarSrc = findAvatarSrc();
			const linkText = link.textContent.trim();
			const name = (!link.querySelector("img") && linkText && !/^用户\s*\d+$/.test(linkText))
				? linkText
				: (owner?.querySelector(`a[href*="/space/${id}"]:not(:has(img)),.author-name,.info-author a,.Username`)?.textContent.trim()
					|| link.querySelector("img")?.alt
					|| "用户 " + id);
			pop = document.createElement("section"); pop.className = "nsmax-person-pop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",name+" 的资料");
			const header = document.createElement("div"); header.className = "nsmax-person-head";
			let avatar = null;
			if (avatarSrc) {
				avatar = document.createElement("img");
				avatar.src = avatarSrc;
				avatar.alt = "";
				header.append(avatar);
			} else {
				const fallback = document.createElement("div");
				fallback.className = "nsmax-person-avatar-fallback";
				fallback.textContent = (name || "U").trim().slice(0, 1).toUpperCase();
				header.append(fallback);
			}
			// sb.sb .user-card-pop：头部（44px 头像 + 名字，名字下面一行是等级徽章与注册时长；右上角等宽 UID）→
			// 名字那一列下面一排按钮（关注实底，其余细框）→ 3 列统计（1px 分隔线）。sb.sb 的烧饼 / 成长值 / 存款等换成 NodeSeek 有的数据
			const identity = document.createElement("div"); identity.className = "nsmax-person-id";
			const profile = document.createElement("a"); profile.href = "/space/"+id; profile.textContent = name;
			const meta = document.createElement("div"); meta.className = "nsmax-person-meta";
			identity.append(profile, meta);
			const uid = document.createElement("span"); uid.className = "nsmax-person-uid"; uid.textContent = "UID " + id;
			header.append(identity, uid);
			// 2026-10-18 第七批重排：名字下面一排三个一样宽的按钮（关注实底、私信、主页；看自己是 我的主页、个人设置），
			// 「管理记录」「屏蔽」挪到统计下面的底栏（小图标 + 弱化字），五个按钮不再挤在一排
			const actions = document.createElement("div"); actions.className = "nsmax-person-actions";
			const me = unsafeWindow$1.__config__?.user?.member_id;
			const self = !!me && String(me) === String(id);
			let follow = null;
			const setFollowed = on => { if (!follow) return; follow.textContent = on ? "已关注" : "关注"; follow.toggleAttribute("data-on", on); follow.setAttribute("aria-pressed", String(on)); };
			if (me && !self) {
				// 和 NodeSeek 自己的资料卡同一个接口：/api/fans/add 关注、/api/fans/del 取消关注
				follow = document.createElement("button"); follow.type = "button"; follow.className = "nsmax-person-follow"; follow.disabled = true;
				setFollowed(false);
				follow.addEventListener("click", async () => {
					const on = follow.hasAttribute("data-on");
					follow.disabled = true;
					try {
						const res = await fetch(on ? "/api/fans/del" : "/api/fans/add", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ followed_member_id: Number(id) }) });
						const json = await res.json().catch(() => ({}));
						if (!res.ok || json?.success === false) throw new Error(json?.message || "操作失败");
						setFollowed(!on);
						cache.delete(id);
						nsmaxPersonForget(id);
					} catch (error) {
						status.textContent = (on ? "取消关注" : "关注") + "失败：" + (error?.message || "请稍后再试");
						if (!status.isConnected) pop?.append(status);
					} finally { follow.disabled = false; }
				}, { signal: ctx.signal });
				actions.append(follow);
			}
			for (const [label, path] of self ? [["我的主页", "/space/" + id], ["个人设置", "/setting"]] : [["私信", "/notification#/message?mode=talk&to=" + id], ["主页", "/space/" + id]]) { const item = document.createElement("a"); item.href = path; item.textContent = label; actions.append(item); }
			actions.dataset.count = String(actions.childElementCount);
			const foot = document.createElement("div"); foot.className = "nsmax-person-foot";
			// 「管理记录」：站点的管理记录页只给管理员按用户名搜（普通账号会提示 Not allowed to search、页面空白）；
			// 点了弹一个窗口，从最新的管理记录往前找和这个人有关的（见 nsmaxRulingDialog）
			const ruling = document.createElement("button"); ruling.type = "button"; ruling.className = "nsmax-person-ruling";
			ruling.append(toolIcon("balance"), document.createTextNode("管理记录"));
			ruling.addEventListener("click", () => {
				const who = profile.textContent.trim() || name;
				hide();
				nsmaxRulingDialog(id, who);
			}, { signal: ctx.signal });
			foot.append(ruling);
			// 「屏蔽」：和站点的黑名单连在一起——站点黑名单里加上 / 去掉（/api/block-list/add 按用户名、/del 按 ID），
			// 脚本的屏蔽名单也同步改，他的帖子、回复马上藏起来；先问一句再动手
			if (me && !self) {
				const block = document.createElement("button"); block.type = "button"; block.className = "nsmax-person-block";
				const blockLabel = document.createElement("span");
				block.append(toolIcon("ban"), blockLabel);
				const setBlocked = (on) => { blockLabel.textContent = on ? "已屏蔽" : "屏蔽"; block.toggleAttribute("data-on", on); block.setAttribute("aria-pressed", String(on)); };
				const who = () => profile.textContent.trim() || name;
				setBlocked(!!nsmaxContentFilter?.blocksUser?.(name));
				nsmaxOfficialBlocks().then((list) => { if (list && block.isConnected) setBlocked(list.ids.has(String(id)) || list.names.has(who()) || !!nsmaxContentFilter?.blocksUser?.(who())); });
				block.addEventListener("click", () => {
					const on = block.hasAttribute("data-on");
					const target = who();
					const run = async () => {
						block.disabled = true;
						try {
							const res = await fetch(on ? "/api/block-list/del" : "/api/block-list/add", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(on ? { block_member_id: Number(id) } : { block_member_name: target }) });
							const json = await res.json().catch(() => ({}));
							if (!res.ok || json?.success === false) throw new Error(json?.message || "操作失败");
							nsmaxOfficialBlocksCache = null;
							const filter = nsmaxContentFilter;
							if (filter?.setUsers) {
								const users = filter.users().filter((user) => user !== target);
								filter.setUsers(on ? users : [...users, target]);
								if (on) filter.unblockOfficial(target); else filter.blockOfficial(target);
							}
							setBlocked(!on);
							nsmaxToast(on ? `已取消屏蔽 ${target}` : `已屏蔽 ${target}`);
						} catch (error) {
							nsmaxToast((on ? "取消屏蔽" : "屏蔽") + "失败：" + (error?.message || "请稍后再试"), { error: true });
						} finally { block.disabled = false; }
					};
					const confirm = unsafeWindow$1.mscConfirm;
					const title = on ? `取消屏蔽 ${target}？` : `屏蔽 ${target}？`;
					const subtitle = on ? "站点黑名单里去掉，他的帖子和回复重新显示。" : "站点黑名单里也会加上，他的帖子、回复和发给你的通知都会藏起来。";
					if (typeof confirm === "function") confirm({ title, subtitle, okText: on ? "取消屏蔽" : "屏蔽", cancelText: "取消", onOk: run, dismissOverlay: true, closeOnEscape: true });
					else if (window.confirm(title + subtitle)) run();
				}, { signal: ctx.signal });
				foot.append(block);
			}
			// 统计格先按最后的样子摆好（数字位置先放「…」），资料到了只换数字，卡片不变高
			const numbers = document.createElement("dl"); numbers.className = "nsmax-person-stats";
			const cells = {};
			for (const [label, key] of [["鸡腿", "coin"], ["星辰", "stardust"], ["主题", "nPost"], ["回复", "nComment"], ["关注", "follows"], ["粉丝", "fans"]]) {
				const item = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd");
				term.textContent = label; value.textContent = "…"; item.append(term, value); numbers.append(item); cells[key] = value;
			}
			const status = document.createElement("p"); status.className = "nsmax-person-status"; status.setAttribute("role","status");
			pop.append(header,actions,numbers,foot); pop.addEventListener("pointerenter",()=>clearTimeout(closing),{signal:ctx.signal}); pop.addEventListener("pointerleave",closeSoon,{signal:ctx.signal}); document.body.append(pop); document.documentElement.setAttribute("data-nsmax-person-open",""); place();
			try {
				const data = await personInfo(id);
				if (ticket !== serial || !pop) return;
				profile.textContent = data.member_name || name;
				const liveAvatar = data.avatar || data.avatar_url || findAvatarSrc();
				if (liveAvatar) {
					if (!avatar || !header.contains(avatar)) {
						avatar = document.createElement("img");
						avatar.alt = "";
						const fallback = header.querySelector(".nsmax-person-avatar-fallback");
						if (fallback) fallback.replaceWith(avatar);
						else header.prepend(avatar);
					}
					if (avatar.src !== liveAvatar) avatar.src = liveAvatar;
				}
				if (data.rank !== undefined) {
					const level = document.createElement("span");
					level.className = "nsmax-person-level";
					nsmaxApplyLevel(level, data.rank);
					meta.append(level);
				}
				// 头衔（活跃、管理、骗子、临时禁言……）：接口的 roles 是名称时直接用；页面上这位用户名字后面已有的头衔也算上；
				// 管理员没有对应头衔时补「管理」。最多 4 个，违规类红色、管理类黄色
				const rawRoles = data.roles;
				const roleNames = (Array.isArray(rawRoles) ? rawRoles : typeof rawRoles === "string" ? rawRoles.split(/[,，|\s]+/) : rawRoles && typeof rawRoles === "object" ? Object.values(rawRoles) : [])
					.map((role) => typeof role === "string" ? role : role?.name || role?.title || role?.role_name || role?.label || "")
					.concat(Array.from(owner?.querySelectorAll(".author-info > :is(.role-tag, .user-badge, .nsk-badge):not([data-nsmax-level])") || [], (tag) => tag.textContent))
					.map((text) => String(text).trim())
					.filter((text) => text && text.length <= 8 && !/^\d+$/.test(text) && !/^(楼主|Lv\.?\s*\d+)$/i.test(text));
				if (data.isAdmin && !roleNames.some((text) => /管理/.test(text))) roleNames.unshift("管理");
				for (const text of [...new Set(roleNames)].slice(0, 4)) {
					const role = document.createElement("span");
					role.className = "nsmax-person-role";
					role.dataset.tone = /骗|禁言|封禁|小黑屋|违规|拉黑/.test(text) ? "danger" : /管理|版主|官方/.test(text) ? "staff" : "plain";
					role.textContent = text;
					meta.append(role);
				}
				// 注册时长：created_at → 「注册 N 天 / N 个月 / N 年 M 个月」，悬停显示具体日期
				const created = Date.parse(data.created_at || "");
				if (created) {
					const days = Math.max(0, Math.floor((Date.now() - created) / 864e5)), months = Math.floor(days / 30.44);
					const age = document.createElement("span"); age.className = "nsmax-person-age";
					age.textContent = days < 31 ? `注册 ${days} 天` : months < 12 ? `注册 ${months} 个月` : `注册 ${Math.floor(months / 12)} 年${months % 12 ? ` ${months % 12} 个月` : ""}`;
					const d = new Date(created); age.title = `注册于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
					meta.append(age);
				}
				// Telegram 联系方式：优先用页面上这个人的签名里见到的，其次看接口返回的签名 / 简介里有没有 t.me 链接；
			// 有就放进资料卡底部一行（和「管理记录 / 屏蔽」同一排，点名字直接打开 Telegram，点「复制」拷到剪贴板）
			const addTelegram = (contacts) => {
				if (!contacts?.length || actions.querySelector(".nsmax-person-tg-btn")) return;
				const tgLink = document.createElement("a");
				tgLink.className = "nsmax-person-tg-btn";
				tgLink.href = contacts[0].href;
				tgLink.target = "_blank";
				tgLink.rel = "noopener noreferrer";
				tgLink.textContent = "TG";
				tgLink.setAttribute("aria-label", "Telegram");
				tgLink.title = contacts[0].handle ? "Telegram：@" + contacts[0].handle : "在 Telegram 里打开";
				const home = Array.from(actions.querySelectorAll("a")).find((item) => item.textContent.trim() === "主页");
				if (home) home.before(tgLink); else actions.append(tgLink);
				actions.dataset.count = String(actions.childElementCount);
				place();
			};
			const fromInfo = nsmaxTelegramContacts(data.signature || data.sign || data.signature_html || data.bio || data.readme || data.intro || "");
			const knownContacts = nsmaxTelegramCache.get(String(id));
			if (fromInfo.length) {
				nsmaxTelegramCache.set(String(id), fromInfo);
				addTelegram(fromInfo);
			} else if (knownContacts) addTelegram(knownContacts);
			// 本机还没记下这个人（列表页、个人主页里常见）：去读他最近一篇主帖的签名，读到了卡片还开着就补上按钮（2026-10-23）
			else nsmaxLookupTelegram(id).then((contacts) => { if (ticket === serial && pop?.isConnected) addTelegram(contacts); });
			if (data.bio && String(data.bio).trim()) { const bio = document.createElement("p"); bio.className = "nsmax-person-bio"; bio.textContent = String(data.bio).trim(); header.after(bio); }
				if (follow) { setFollowed(!!data.followed); follow.disabled = false; }
				const fmt = value => value === undefined || value === null ? "—" : Number(value) >= 1e5 ? (Number(value) / 1e3).toFixed(Number(value) >= 1e6 ? 0 : 1) + "K" : String(value);
				for (const [key, cell] of Object.entries(cells)) cell.textContent = fmt(data[key]);
				place();
			} catch {
				cache.delete(id);
				if (ticket === serial && pop) {
					for (const cell of Object.values(cells)) cell.textContent = "—";
					status.textContent = "暂时无法读取资料，可打开个人主页";
					numbers.after(status);
				}
			}
		};
		// 资料：同一个人 10 分钟内不重复读，存在本次会话里（换了页面再停在同一个人上马上出来）；
		// 直接读、不排进模块的请求队列（帖子页的作者栏同时在读一串资料时，悬停的这一个不用排在后面等）
		function personInfo(id) {
			let entry = cache.get(id);
			if (entry && Date.now() - entry.at < 6e5) return entry.promise;
			const stored = nsmaxPersonCached(id);
			const promise = stored ? Promise.resolve(stored) : fetch("/api/account/getInfo/" + id + "?readme=1", { credentials: "same-origin" }).then((res) => res.json()).then((json) => {
				const data = json?.detail || json?.data || {};
				if (json?.success === false || !data || typeof data !== "object") throw new Error(json?.message || "读取失败");
				nsmaxPersonStore(id, data);
				return data;
			});
			entry = { at: Date.now(), promise };
			promise.catch(() => { if (cache.get(id) === entry) cache.delete(id); });
			cache.set(id, entry);
			if (cache.size > 256) cache.delete(cache.keys().next().value);
			return promise;
		}
		// 页面滚动把头像、名字带到鼠标下面的不弹（见 nsmaxHoverFromScroll）：鼠标在上面真的动一下再弹
		nsmaxHoverFromScroll();
		let pendingOver = false;
		document.addEventListener("pointerover",event => {
			if (event.pointerType === "touch") return;
			pendingOver = nsmaxHoverFromScroll(event);
			if (!pendingOver) over(event);
		}, { signal:ctx.signal });
		document.addEventListener("pointermove",event => {
			if (!pendingOver || !(event.movementX || event.movementY) || event.pointerType === "touch") return;
			pendingOver = false;
			over(event);
		}, { passive:true, signal:ctx.signal });
		const over = event => {
			// 手指点按也会触发 pointerover：手机上点头像、名字是要打开主页，不弹资料卡（也不白白请求一次资料）
			if (event.pointerType === "touch") return;
			const link=matches(event.target);
			if (!link || pop?.contains(link) || link.contains(event.relatedTarget)) return;
			clearTimeout(opening);
			clearTimeout(closing);
			// 鼠标一停上去就开始读资料，60ms 后弹卡片（划过去的不弹）
			const match = link.href.match(/\/space\/(\d+)/);
			if (match) personInfo(match[1]).catch(() => {});
			opening=setTimeout(()=>show(link),60);
		};
		document.addEventListener("pointerout",event => { const link=matches(event.target); if (link && !link.contains(event.relatedTarget) && !pop?.contains(event.relatedTarget)) closeSoon(); }, { signal:ctx.signal });
		document.addEventListener("click",event => { if (pop && !pop.contains(event.target)) hide(); }, { signal:ctx.signal });
		document.addEventListener("keydown",event => { if (event.key==="Escape") hide(); }, { signal:ctx.signal });
		// 往返缓存会连同 DOM 和计时器一起保留；离开时收起卡片、取消尚未完成的弹出，返回后保留原页但不留浮层。
		window.addEventListener("pagehide",hide,{signal:ctx.signal});
		window.addEventListener("scroll",hide,{passive:true,signal:ctx.signal}); window.addEventListener("resize",place,{passive:true,signal:ctx.signal});
		return hide;
	} };
