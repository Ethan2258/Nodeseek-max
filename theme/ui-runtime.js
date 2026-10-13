	// 这些整理函数在每次扫描（页面有增删节点后）都会再跑一遍：只在值真的不同时才写 DOM。
	// 无条件写（哪怕写的是同一个值）也会产生 DOM 变动 → 观察器 → 再扫描 → 再写，形成循环：元素被反复替换，
	// 悬停闪烁、点击落空（个人空间「主题 / 回帖 / 收藏」切不动就是这样来的）。
	function nsmaxSetText(el, text) {
		if (el && el.textContent !== text) el.textContent = text;
	}
	// 页面类型：主题 CSS 按 html[data-nsmax-page] 分页面排版；搜索、账簿这类结构和列表页相同的页面都算 list
	function nsmaxPageKind(path = location.pathname) {
		return /^\/post-\d+/.test(path) ? "post" : /^\/notifications?(?:\/|$)/.test(path) ? "notification" : /^\/space\//.test(path) ? "space" : /^\/setting(?:\/|$)/.test(path) ? "setting" : /^\/(?:new|edit)-discussion(?:\/|$)/.test(path) ? "new" : /^\/board(?:\/|$)/.test(path) ? "board" : /^\/fans(?:\/|$)/.test(path) ? "fans" : "list";
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
	function nsmaxPrepareSpace() {
		if (!/^\/space\/\d+/.test(location.pathname)) return;
		// 资料卡里那一组统计由下面的 renderStatsAndProgress 管，这里只标记原站其余位置的过时统计
		for (const item of document.querySelectorAll(".card-block > .card-item")) {
			if (item.closest(".head-container")) continue;
			item.toggleAttribute("data-nsmax-obsolete-stat", !item.textContent.trim() || /加入天数|注册天数|信用分|信任分/.test(item.textContent));
		}
		for (const readme of document.querySelectorAll(".readme")) {
			const text = readme.textContent.trim();
			const hasWatermark = !!readme.querySelector("img[src*='logo'], img[src*='nodeseek'], svg");
			const isEmpty = !text || /^(没有找到readme|暂无简介|暂无介绍|NodeSeek)$/i.test(text) || (hasWatermark && text.length < 20);
			readme.toggleAttribute("data-nsmax-empty-readme", isEmpty);
			if (isEmpty) nsmaxHideEl(readme);
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
				joinSpan.textContent = "近期加入";
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

		const renderStatsAndProgress = (lvl, coin, nPost, nComment) => {
			if (!headStats) return;
			nsmaxDropAttr(headStats, "style");
			const levelVal = lvl !== undefined ? Number(lvl) : 1;
			const statItems = [
				["等级", lvl !== undefined ? String(lvl) : "—", levelVal >= 6],
				["鸡腿", coin !== undefined ? String(coin) : "—", false],
				["主题", nPost !== undefined ? String(nPost) : "—", false],
				["回帖", nComment !== undefined ? String(nComment) : "—", false]
			];
			let existingItems = Array.from(headStats.querySelectorAll(":scope > .card-item"));
			if (existingItems.length < 4) {
				headStats.innerHTML = "";
				for (let i = 0; i < 4; i++) {
					const item = document.createElement("div");
					item.className = "card-item";
					headStats.append(item);
				}
				existingItems = Array.from(headStats.querySelectorAll(":scope > .card-item"));
			}
			for (let i = 0; i < 4; i++) {
				const item = existingItems[i];
				const [label, val, isLv6] = statItems[i];
				const html = `<div class="nsmax-stat-label">${label}</div><div class="nsmax-stat-val">${val}</div>`;
				if (item.innerHTML !== html) item.innerHTML = html;
				item.toggleAttribute("data-nsmax-lv6-stat", isLv6);
				nsmaxDropAttr(item, "data-nsmax-obsolete-stat");
				nsmaxShowEl(item);
			}
			for (let i = 4; i < existingItems.length; i++) {
				nsmaxSetAttr(existingItems[i], "data-nsmax-obsolete-stat", "true");
				nsmaxHideEl(existingItems[i]);
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
				const percent = Math.max(10, Math.min(100, (levelVal % 10) * 10 || 50));
				setLevelLabel(levelVal, cur);
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-percent"), `${percent}%`);
				nsmaxSetText(progress.querySelector(".nsmax-space-progress-next"), `Lv.${levelVal + 1} ${nxt}`);
				setBar(`${percent}%`);
			}
		};

		// 1. 从已有 DOM 中读取统计数字
		let parsedLevel, parsedCoin, parsedPost, parsedComment;
		const parseSource = headStats || origStats || stats;
		if (parseSource) {
			for (const item of parseSource.querySelectorAll(".card-item")) {
				const t = item.textContent.trim();
				if (/等级/.test(t)) {
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
		if (parsedLevel !== undefined) {
			renderStatsAndProgress(parsedLevel, parsedCoin, parsedPost, parsedComment);
		}

		// 2. 通过 API 保证异步获取完整数据（支持直达非概况页面）
		if (uid && (parsedLevel === undefined || !head.querySelector(".nsmax-space-progress"))) {
			if (!window.__nsmax_space_api_cache) window.__nsmax_space_api_cache = new Map();
			let reqPromise = window.__nsmax_space_api_cache.get(uid);
			if (!reqPromise) {
				reqPromise = fetch("/api/account/getInfo/" + uid, { headers: { "Accept": "application/json" } })
					.then(res => res.json())
					.then(data => data?.detail || data?.data || {})
					.catch(() => ({}));
				window.__nsmax_space_api_cache.set(uid, reqPromise);
			}
			reqPromise.then(info => {
				if (!info || typeof info !== "object") return;
				const l = info.rank !== undefined ? Number(info.rank) : (parsedLevel || 1);
				const c = info.coin !== undefined ? Number(info.coin) : (parsedCoin || 0);
				const p = info.nPost !== undefined ? Number(info.nPost) : (parsedPost || 0);
				const cm = info.nComment !== undefined ? Number(info.nComment) : (parsedComment || 0);
				renderStatsAndProgress(l, c, p, cm);
				if (info.created_at) {
					try {
						const d = new Date(info.created_at);
						const jEl = head.querySelector(".nsmax-space-join");
						if (jEl && !/加入/.test(jEl.textContent)) {
							jEl.textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 加入`;
						}
					} catch {}
				}
			});
		}

		// 对齐空间页 Tab：固定【主题】、【回帖】、【收藏】三项，置于卡片顶部，隐藏概况/资料/设置
		const selectorNav = document.querySelector(".selector");
		if (selectorNav) {
			const settingBtn = selectorNav.querySelector(".nsmax-space-setting-btn");
			if (settingBtn) settingBtn.remove();

			// 隐藏概况/资料 Tab
			for (const tab of selectorNav.querySelectorAll("a.select-item")) {
				const text = tab.textContent.trim();
				const href = tab.getAttribute("href") || "";
				if (/概况|资料/i.test(text) || href.includes("general") || href.includes("info") || href.includes("profile")) {
					nsmaxHideEl(tab);
					nsmaxSetAttr(tab, "hidden");
					if (tab.classList.contains("active")) tab.classList.remove("active");
					if (tab.classList.contains("router-link-active")) tab.classList.remove("router-link-active");
				}
			}

			const tabDefs = [
				{ key: "discussions", text: "主题", href: "#/discussions", match: /主题|讨论|帖子|discussions/i },
				{ key: "comments", text: "回帖", href: "#/comments", match: /评论|回帖|回复|comments/i },
				{ key: "collections", text: "收藏", href: "#/collections", match: /收藏|collections|fav/i }
			];

			const orderedTabs = [];
			for (const def of tabDefs) {
				let tab = Array.from(selectorNav.querySelectorAll("a.select-item")).find(t => 
					t.getAttribute("data-nsmax-tab") === def.key || 
					def.match.test(t.textContent.trim()) || 
					(t.getAttribute("href") || "").includes(def.key)
				);
				if (!tab) {
					tab = document.createElement("a");
					tab.className = "select-item";
					selectorNav.append(tab);
				}
				nsmaxSetText(tab, def.text);
				nsmaxSetAttr(tab, "href", def.href);
				nsmaxSetAttr(tab, "data-nsmax-tab", def.key);
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
				const hash = location.hash || "#/discussions";
				for (const tab of orderedTabs) {
					const key = tab.getAttribute("data-nsmax-tab");
					let isActive = false;
					if (key === "discussions" && (/discussions|posts/.test(hash) || !hash || hash === "#" || hash.includes("general") || hash.includes("info"))) {
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

			// 首次进入空间时，如果是概况/空hash则平滑切换至主题
			const currentHash = location.hash;
			if (!currentHash || currentHash === "#" || currentHash === "#/general" || currentHash.startsWith("#/general") || currentHash.includes("info") || currentHash.includes("profile")) {
				location.hash = "#/discussions";
			}
			syncActiveTabs();
		}

		if (!window.__nsmax_space_hash_bound) {
			window.__nsmax_space_hash_bound = true;
			window.addEventListener("hashchange", () => {
				nsmaxPrepareSpace();
			});
		}
	}
	function nsmaxCleanPostActions() {
		const names = { "good-one": ["点赞","thumbup"], "chicken-leg": ["加鸡腿","drumstick"], "bad-one": ["反对","thumbdown"], "quote": ["引用","quote"], "back": ["回复","reply"], "edit": ["编辑","edit"] };
		for (const menu of document.querySelectorAll(".comment-menu")) {
			const seen = new Set();
			for (const action of Array.from(menu.querySelectorAll(":scope > .menu-item"))) {
			const href = action.querySelector("svg use")?.getAttribute("href")?.slice(1);
			const label = action.title || Array.from(action.querySelectorAll("span")).map(span=>span.textContent.trim()).find(text=>/^(点赞|加鸡腿|反对|收藏|引用|回复|编辑)$/.test(text)) || names[href]?.[0];
			const icon = ({ "点赞":"thumbup","加鸡腿":"drumstick","反对":"thumbdown","收藏":"star","引用":"quote","回复":"reply","编辑":"edit" })[label];
			if (!icon) continue;
			if (seen.has(icon)) { action.remove(); continue; }
			seen.add(icon);
			action.dataset.nsmaxAction = icon;
			if (!action.title) action.title = label;
			if (!action.hasAttribute("aria-label")) action.setAttribute("aria-label",label);
			for (const svg of action.querySelectorAll(":scope > svg")) { svg.setAttribute("data-nsmax-action-original",""); svg.style.setProperty("display","none","important"); }
			for (const span of action.querySelectorAll(":scope > span")) {
				const text = span.textContent.trim();
				if (/^[\d.,]+(?:[kKwW万千])?$/.test(text)) {
					span.setAttribute("data-nsmax-action-count", "");
					span.toggleAttribute("hidden", /^0+(?:\.0+)?$/.test(text.replace(/[kKwW万千]/gi, "")));
				} else span.setAttribute("data-nsmax-action-label", "");
			}
			}
		}
	}
	function nsmaxPrizeBadges() {
		for (const title of document.querySelectorAll(".post-list-item .post-title,.nsk-post>.post-title h1")) {
			const link = title.querySelector("a");
			if (!link) continue;
			const giveaway = /抽奖/.test(link.textContent);
			let badge = title.querySelector(":scope > .nsmax-prize-badge");
			if (giveaway && !badge) { badge = document.createElement("span"); badge.className = "nsmax-prize-badge"; badge.textContent = "抽奖"; link.before(badge); }
			else if (!giveaway && badge) badge.remove();
		}
	}
	function nsmaxCleanBadgesAndNotifications() {
		for (const el of document.querySelectorAll(".notify-count, .unread-count, .nspp-messages-count, .nspp-messages-unread")) {
			// 消息中心自己的未读数由它自己用 hidden 管理（拿到数字后才显示）。这里要是在数字到之前把它写死成隐藏，
			// 之后数字到了也不会再整理（消息中心内部的变化不触发重新整理），未读数就一直不显示
			if (el.closest(".nspp-messages")) {
				if (el.getAttribute("data-empty") === "true") {
					el.removeAttribute("data-empty");
					el.style.removeProperty("display");
				}
				continue;
			}
			const text = (el.textContent || "").trim();
			if (!text || text === "0") {
				el.setAttribute("data-empty", "true");
				el.style.setProperty("display", "none", "important");
			} else {
				el.removeAttribute("data-empty");
				el.style.removeProperty("display");
			}
		}
	}
	function nsmaxCleanSearchOverlay() {
		for (const link of document.querySelectorAll(".search-overlay .googleSearch,.search-overlay [data-tab=google],.search-overlay [data-type=google]")) link.remove();
		for (const element of document.querySelectorAll(".search-overlay .tab-btn")) if (/谷歌|google/i.test(element.textContent.trim())) element.remove();
	}
	const nsmaxProcessedRows = new WeakSet();
	function nsmaxProcessPostListRows() {
		for (const row of document.querySelectorAll("ul.post-list:not(.topic-carousel-panel)>li.post-list-item")) {
			if (nsmaxProcessedRows.has(row)) continue;
			nsmaxProcessedRows.add(row);
			const icons = [[".info-author","user"],[".nsmax-inline-category","board"],[".info-views","eye"],[".info-comments-count","comment"],[".info-last-commenter","user"]];
			for (const [selector,name] of icons) {
				const item = row.querySelector(selector); if (!item) continue;
				for (const svg of item.querySelectorAll("svg:not(.nsmax-meta-icon), .iconpark-icon:not(.nsmax-meta-icon)")) {
					svg.setAttribute("data-nsmax-meta-original","");
					svg.style.setProperty("display","none","important");
					svg.remove();
				}
				const existing = item.querySelectorAll(".nsmax-meta-icon");
				if (existing.length > 1) {
					for (let i = 1; i < existing.length; i++) existing[i].remove();
				} else if (existing.length === 0) {
					const icon = toolIcon(name); icon.classList.add("nsmax-meta-icon"); item.prepend(icon);
				}
			}
			if (row.hasAttribute("data-nsmax-meta-ordered")) continue;
			const info = row.querySelector(".post-info");
			if (!info) continue;
			const author = info.querySelector(".info-author"), time = info.querySelector(".info-last-comment-time"), views = info.querySelector(".info-views"), count = info.querySelector(".info-comments-count"), last = info.querySelector(".info-last-commenter");
			const category = info.querySelector(".post-category");
			const inline = category?.cloneNode(true);
			if (inline) {
				inline.className = "nsmax-inline-category";
				inline.querySelectorAll("svg, .iconpark-icon").forEach(s => s.remove());
				const categoryIcon = toolIcon("board"); categoryIcon.classList.add("nsmax-meta-icon"); inline.prepend(categoryIcon);
			}
			for (const item of [author, time, inline, views, count, last, category]) if (item) info.append(item);
			row.setAttribute("data-nsmax-meta-ordered", "");
		}
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
		const units = {
			y: "年",
			mo: "月",
			d: "天",
			h: "小时",
			min: "分钟",
			s: "秒"
		};
				const translated = (old || "").replace(/just now/gi, "刚刚").replace(/^edited\s*/i, "编辑于 ").replace(/(\d+)\s*(mo(?:nths?)?|min(?:utes?)?|y(?:ears?)?|d(?:ays?)?|h(?:ours?)?|s(?:econds?)?)\b/gi, (_, n, unit) => `${n}${units[unit.toLowerCase().startsWith("mo") ? "mo" : unit.toLowerCase().startsWith("min") ? "min" : unit[0].toLowerCase()]}`).replace(/\s*ago/gi, "前");
		const value = forumTime(el.getAttribute("datetime") || old || "")?.text || translated;
		return old !== value ? value : null;
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
			if (el.children.length || el.hasAttribute("data-nsmax-time-done") || parsed && !parsed(el)) continue;
			el.setAttribute("data-nsmax-time-done", "");
			const value = nsmaxChineseTimeText(el);
			if (value === null) continue;
			el.setAttribute("data-nsmax-time-orig", el.textContent);
			el.textContent = value;
		}
	}
	var nsmaxChineseTimeEnabled = null;
	// 列表上方排序栏的 NQ（NodeQuality）入口：站点自己有就不加。排序栏还没解析完时先不加（不然站点后面的元素会排到它后面）。
	function nsmaxEnsureNqEntry(parsed) {
		const controller = document.querySelector(".post-list-controler");
		if (controller && parsed && !parsed(controller)) return;
		if (controller) {
			const hasNativeNq = Array.from(controller.querySelectorAll("a:not(.nsmax-nq-entry)")).some(a => /nodequality/i.test(a.href) || /^N$/i.test(a.textContent.trim()));
			const customNq = controller.querySelector(".nsmax-nq-entry");
			if (hasNativeNq) {
				if (customNq) customNq.remove();
			} else if (!customNq) {
				const link = document.createElement("a");
				link.className = "nsmax-nq-entry";
				link.href = "https://nodequality.com";
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.title = "NodeQuality 测机";
				link.innerHTML = `<img class="nsmax-nq-icon" alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAABaFBMVEX///95v5gJiUIJi0RGh1PBJSLDCgrCDAzjjo72/PlSyYcIslRw0pz+/v5fsoMAhDkAhz0pazC1CQTBAAC/AADdc3Pv+vQ1wHMAr01fzZH+//5fsoQAhDoAiD4pbDG2CQQAr04pbTK1CQW+AADccG7+9e398ur+9vH///4AhjwxjVLRenXca2vbbm/pknfwkVDwj03yoGj98ekAhDs1n2Tv+PP3xKLtey3tey7uhkD86Ns1nmTv9/LtfC/tfDDuiEL86dz3xqTuikXo47/f883f8szw+eb97OH5za75zK7y07Kp1nCU0VOT0VHB5Jz1+++j12uRz06Qz02+45b1+u6R0E6+45fw+vT2+/Gm2XCS0E2S1ZaG2vqF2vmE2e4iunP+/v3j89LV7bza77yB1dYAr/AAsOcBsHEAsE6X3vkAsPEAsHGW3vk0nmNuupAAhTtCpW70+fad4PkCsPAAsPARtescuH1n0Jb3nMn7AAAAAWJLR0QAiAUdSAAAAAd0SU1FB+kDFxUCHTwsmtwAAADQSURBVDjLY2AAAUYmZhZWNnYOBhjg5OLm5oHzGHj5+AUEhYRFROEiYuISEpJSCAXSMrJy8qgKFAajAkUlEWUVVTV1DRwKNLW0dXT19A0MjXAoMDYxZWAwM7ewtMKlwNoGqMDWzt5hsCtwtLV1cnZxdcOpwN3D08vbx9cPpwIg8A8IDArGpyAkIDQobBAoADoyHKeCiMjQqOiY2Lh4XAoSEpOSU1JT09IzcCgAgczUrLRsfApyBkQBn4xxLj4FDHn5+QWFcF5RcUlpWYZCOZgDAFNzXYZTvYTRAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI1LTAzLTIzVDIxOjAxOjIxKzAwOjAwLt9JcQAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNS0wMy0yM1QyMTowMToyMSswMDowMF+C8c0AAAAgdEVYdHNvZnR3YXJlAGh0dHBzOi8vaW1hZ2VtYWdpY2sub3JnvM8dnQAAABh0RVh0VGh1bWI6OkRvY3VtZW50OjpQYWdlcwAxp/+7LwAAABh0RVh0VGh1bWI6OkltYWdlOjpIZWlnaHQAMTkyQF1xVQAAABd0RVh0VGh1bWI6OkltYWdlOjpXaWR0aAAxOTLTrCEIAAAAGXRFWHRUaHVtYjo6TWltZXR5cGUAaW1hZ2UvcG5nP7JWTgAAABd0RVh0VGh1bWI6Ok1UaW1lADE3NDI3NjM2ODE9AtgpAAAAD3RFWHRUaHVtYjo6U2l6ZQAwQkKUoj7sAAAAVnRFWHRUaHVtYjo6VVJJAGZpbGU6Ly8vbW50bG9nL2Zhdmljb25zLzIwMjUtMDMtMjMvY2UzZTUwZjg4YjEzOGFiYTY3ODJlMjdmZjk2OTYzYjUuaWNvLnBuZ/HFgxIAAAAASUVORK5CYII="><span>NQ</span>`;
				controller.append(link);
			}
		}
	}
	// 分页：只留首页、末页和当前页前后，中间用省略号；「上一页 / 下一页」写成文字。
	function nsmaxTidyPagers() {
		for (const pager of document.querySelectorAll(".nsk-pager")) {
			const current = Number(pager.querySelector(".pager-cur,[aria-current=page]:not(a)")?.textContent) || 1;
			const pages = Array.from(pager.querySelectorAll(".pager-pos"));
			const number = element => Number(element.textContent.match(/(\d+)\s*$/)?.[1]);
			const last = Math.max(...pages.map(number).filter(Number.isFinite));
			let previous;
			const seenPages = new Set();
			for (const page of pages) {
				const n = number(page);
				const keep = !seenPages.has(n) && (n === 1 || n === last || (current <= 2 ? n <= 3 : Math.abs(n - current) <= 1));
				seenPages.add(n);
				page.toggleAttribute("data-nsmax-page-skip", !keep);
				for (const ellipsis of page.querySelectorAll(".ellipsis")) ellipsis.hidden = true;
				if (keep && previous && n - previous > 1 && !page.previousElementSibling?.matches(".nsmax-pager-ellipsis")) {
					const dots = document.createElement("span"); dots.className = "nsmax-pager-ellipsis"; dots.textContent = "…"; page.before(dots);
				}
				if (keep) previous = n;
			}
			for (const [selector, label] of [["a.pager-next", "下一页"], ["a.pager-prev", "上一页"]]) {
				const link = pager.querySelector(selector);
				if (link && link.textContent !== label) link.textContent = label;
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
		const links = root ? root.querySelectorAll("a") : document.querySelectorAll("article.post-content a, .nspp-preview-content a, .nsmax-editor-preview a, a.post-image-link");
		for (const a of links) {
			const has = !!a.querySelector("img");
			if (has !== a.hasAttribute("data-nsmax-imglink")) a.toggleAttribute("data-nsmax-imglink", has);
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
		}
		nsmaxTagImageLinks();
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
		if (!/^\/post-\d+/.test(location.pathname)) return;
		nsmaxGroupFloorActions(parsed);
		nsmaxWrapCodeBlocks(parsed);
		// 统计（浏览数、回复数）要等评论区解析完才准，不然先显示一个偏小的回复数再变
		const comments = document.querySelector(".comment-container");
		if (!parsed || document.readyState !== "loading" || comments && parsed(comments)) nsmaxDecoratePostDetail();
	}
	// 正文代码块包进 .nsmax-code（对应 sb.sb 的 .code-block）：「内容增强」的复制按钮放在外层右上角，
	// 代码横向滚动时按钮不跟着跑。页面解析阶段就包好，之后放进按钮不会让内容跳动。
	function nsmaxWrapCodeBlocks(parsed) {
		for (const pre of document.querySelectorAll("article.post-content pre:not(.nsmax-code > pre)")) {
			if (parsed && !parsed(pre)) continue;
			// NodeSeek 会把 ANSI 输出（code.language-ansi）整块换成 xterm 终端，这种不包
			if (pre.querySelector(":scope > code.language-ansi")) continue;
			const wrap = document.createElement("div");
			wrap.className = "nsmax-code";
			const copy = pre.querySelector(":scope > [data-nspp-copy]");
			pre.before(wrap);
			wrap.append(pre);
			if (copy) wrap.append(copy);
		}
	}
	function nsmaxUpdateNavEssence() {
		const navMenus = document.querySelectorAll("ul.nav-menu");
		for (const navMenu of navMenus) {
			for (const item of navMenu.querySelectorAll(":scope > li")) {
				const a = item.querySelector("a");
				if (!a) continue;
				if (a.textContent.includes("推广") || (a.getAttribute("href") || "").includes("/categories/promotion")) {
					nsmaxHideEl(item);
					nsmaxSetAttr(item, "data-nsmax-own-hide");
				}
			}
			let essenceLi = navMenu.querySelector(":scope > li.nsmax-essence-tab-item");
			if (!essenceLi) {
				essenceLi = document.createElement("li");
				essenceLi.className = "nsmax-essence-tab-item";
				const link = document.createElement("a");
				link.href = "/award";
				link.className = "nsmax-essence-tab";
				link.dataset.nsmaxNav = "award";
				const badge = document.createElement("span");
				badge.className = "nsmax-essence-badge";
				badge.textContent = "精";
				const text = document.createElement("span");
				text.textContent = "精华";
				link.append(badge, text);
				essenceLi.append(link);
				navMenu.append(essenceLi);
			}
			if (location.pathname === "/award") {
				nsmaxSetAttr(essenceLi.querySelector("a"), "aria-current", "page");
				nsmaxSetAttr(essenceLi.querySelector("a"), "data-nsmax-header-cat-on");
			}
			if (essenceLi.nextElementSibling) {
				navMenu.append(essenceLi);
			}
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
	function nsmaxMarkLevels() {
		const candidates = document.querySelectorAll(
			".role-tag, .nspp-level, .user-badge, .badge, .author-info > span, .nsk-content-meta-info > span, .nsmax-account-rank, .nsmax-person-level, .nsmax-space-vip, .hover-user-card [class*='level']"
		);
		for (const el of candidates) {
			if (el.children.length) continue;
			const text = (el.textContent || "").replace(/\s+/g, "");
			const match = text.match(/^(?:Lv\.?|Level|等级)(\d)$/i);
			if (match) nsmaxApplyLevel(el, match[1]);
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

		const opPost = document.querySelector(".nsk-post") || document.querySelector("#nsk-body-left .content-item#0") || document.querySelector(".content-item#0");
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
				let views = "";
				const viewsEl = postTitle.querySelector(".views, [title*='views'], [title*='浏览']") || document.querySelector(".info-views");
				if (viewsEl) views = viewsEl.textContent.replace(/[^\d.,kKwW万千]/g, "").trim();
				if (!views && typeof window !== "undefined" && window.postData?.views) {
					views = String(window.postData.views);
				}
				if (!views) {
					const m = document.body.textContent.match(/(\d+)\s*(?:次)?浏览/);
					if (m) views = m[1];
				}
				if (!views) views = "1";

				let replies = "";
				const headText = document.querySelector(".comment-head, .comment-container")?.textContent || "";
				const repliesMatch = headText.match(/(\d+)\s*条回复/);
				if (repliesMatch) {
					replies = repliesMatch[1];
				} else {
					replies = String(document.querySelectorAll("ul.comments li.content-item").length);
				}

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
				const replySpan = stats.querySelector(".nsmax-post-stat-item:last-child span");
				if (replySpan) {
					const headText = document.querySelector(".comment-head, .comment-container")?.textContent || "";
					const repliesMatch = headText.match(/(\d+)\s*条回复/);
					const currentCount = repliesMatch ? repliesMatch[1] : String(document.querySelectorAll("ul.comments li.content-item").length);
					if (currentCount && currentCount !== "0" && replySpan.textContent.trim() !== currentCount.trim()) {
						replySpan.textContent = currentCount;
					}
				}
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
				const { editor, cm, input } = getEditor();
				if (editor) {
					editor.scrollIntoView({ behavior: "smooth" });
					(cm || input)?.focus();
				}
			});

			actions.querySelector(".nsmax-op-reply").addEventListener("click", () => {
				const { editor, cm, input } = getEditor();
				if (editor) {
					editor.scrollIntoView({ behavior: "smooth" });
					(cm || input)?.focus();
				}
			});

			actions.querySelector(".nsmax-op-report").addEventListener("click", () => {
				const { editor, cm, input, submit } = getEditor();
				if (editor) {
					const reportText = "@admin ";
					if (cm) {
						cm.setValue(reportText);
						cm.focus();
						cm.setCursor(cm.lineCount(), 0);
						cm.refresh();
					} else if (input) {
						const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
						setter?.call(input, reportText);
						input.value = reportText;
						input.dispatchEvent(new Event("input", { bubbles: true }));
						input.dispatchEvent(new Event("change", { bubbles: true }));
						input.focus();
					}
					setTimeout(() => {
						const btn = editor.querySelector("button.submit, button[type=submit], .submit-row button, .topic-select button") || submit || Array.from(document.querySelectorAll("button")).find(b => /发布|回复/.test(b.textContent));
						btn?.click();
					}, 50);
				}
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
		const postContainers = document.querySelectorAll(".post-content, .markdown-body, .comment-content, article");
		if (!postContainers.length) return;

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
	function nsmaxPrepareFans() {
		if (!/^\/fans(?:\/|$)/.test(location.pathname)) return;
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
			const line = document.createElement("span");
			line.className = "nsmax-member-stats";
			for (const [label, value] of [["鸡腿", stats.coin], ["星辰", stats.star], ["主题", stats.post], ["评论", stats.comment], ["粉丝", stats.fans]]) {
				if (value === undefined) continue;
				const item = document.createElement("span");
				const b = document.createElement("b");
				b.textContent = value;
				item.append(label + " ", b);
				line.append(item);
			}
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
	function mountLeanUi(ctx) {
		const editors = new Map();
		const processed = new WeakSet();
		const images = new WeakSet();
		const scan = () => {
			const currentPage = nsmaxPageKind();
			if (document.documentElement.dataset.nsmaxPage !== currentPage) {
				document.documentElement.dataset.nsmaxPage = currentPage;
			}
			if (typeof nsmaxBuildAccountCard === "function") {
				nsmaxBuildAccountCard();
			}
			nsmaxPrizeBadges();
			nsmaxCleanSearchOverlay();
			nsmaxCleanPostActions();
			nsmaxUpdateNavEssence();
			nsmaxMarkLevels();
			nsmaxSetupMarkdownTabs();
			nsmaxEnsureNqEntry();
			nsmaxTidyPagers();
			nsmaxProcessPostListRows();
			nsmaxPrepareSpace();
			nsmaxPrepareBoard();
			nsmaxPrepareFans();
			nsmaxPrepareCredit();
			nsmaxCleanNotifications();
			nsmaxCleanBadgesAndNotifications();
			const isPost = /^\/post-\d+/.test(location.pathname);
			if (isPost) {
				nsmaxDecoratePostDetail();
			}
			nsmaxTagStructure();
			nsmaxBuildFooter();
			if (!isPost && !/^\/(?:new|edit)-discussion/.test(location.pathname)) return;
			for (const image of document.querySelectorAll(".nsk-post article.post-content img,ul.comments article.post-content img")) {
				if (images.has(image)) continue; images.add(image);
				const classify = () => {
					const emoji = /emoji|smoji|expression|emoticon|yct\d|xhj\d|表情/i.test(image.className+" "+image.alt+" "+image.src);
					const standalone = image.parentElement?.matches("p,a") && !image.parentElement.textContent.trim();
					if (!emoji && standalone && image.naturalWidth>96 && image.naturalHeight>96) {
						image.classList.add("nsmax-post-image");
						if (image.parentElement?.tagName === "A") image.parentElement.classList.add("post-image-link", "post-image-break");
						image.closest("p")?.classList.add("nsmax-image-paragraph");
					}
				};
				if (image.complete) classify(); else image.addEventListener("load",classify,{once:true,signal:ctx.signal});
			}
			if (isPost) {
				nsmaxGroupFloorActions();
				nsmaxWrapCodeBlocks();
			}
			for (const editor of document.querySelectorAll(".md-editor")) {
				if (editors.has(editor)) continue;
				const body = editor.querySelector("#editor-body") || editor;
				const cm = editor.querySelector(".CodeMirror")?.CodeMirror;
				const input = editor.querySelector("textarea:not(.CodeMirror textarea)");
				if (!cm && !input) continue;
				editor.classList.add("nsmax-compact-reply");
				const heading = document.createElement("h2");
				heading.className = "nsmax-editor-heading";
				heading.textContent = isPost ? "发表回复" : "编辑正文";
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
						const start = input.selectionStart || 0;
						const end = input.selectionEnd || 0;
						const text = input.value || "";
						const selection = text.slice(start, end);
						const replacement = selection ? `${prefix}${selection}${suffix}` : `${prefix}${defaultText}${suffix}`;
						const newText = text.slice(0, start) + replacement + text.slice(end);
						const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
						setter?.call(input, newText);
						input.dispatchEvent(new Event("input", { bubbles: true }));
						input.focus();
						if (selection) {
							input.setSelectionRange(start + prefix.length, end + prefix.length);
						} else if (defaultText) {
							input.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
						} else {
							input.setSelectionRange(start + replacement.length, start + replacement.length);
						}
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
				function nsmaxOpenLuckyModal(titleEl, setValueFn, cmInst, inputEl) {
					let dialog = document.querySelector("dialog.nsmax-lucky-modal");
					if (!dialog) {
						dialog = document.createElement("dialog");
						dialog.className = "nsmax-lucky-modal";
						dialog.innerHTML = `
							<div class="nsmax-lucky-head">
								<h3>🎁 快捷抽奖配置</h3>
								<button type="button" class="nsmax-lucky-close" aria-label="关闭">&times;</button>
							</div>
							<div class="nsmax-lucky-body">
								<label class="nsmax-lucky-field">
									<span>奖品名称</span>
									<input type="text" class="nsmax-lucky-prize" placeholder="例如：50 鸡腿 / 香港轻量云 / 专属兑换码" value="50 鸡腿">
								</label>
								<div class="nsmax-lucky-row">
									<label class="nsmax-lucky-field">
										<span>中奖人数 (份)</span>
										<input type="number" class="nsmax-lucky-count" min="1" max="100" value="1">
									</label>
									<label class="nsmax-lucky-field">
										<span>开奖时间</span>
										<input type="text" class="nsmax-lucky-time" value="24 小时后自动开奖">
									</label>
								</div>
								<div class="nsmax-lucky-presets">
									<span>快捷时间：</span>
									<button type="button" data-preset="24 小时后">24小时后</button>
									<button type="button" data-preset="48 小时后">48小时后</button>
									<button type="button" data-preset="今晚 20:00">今晚20:00</button>
									<button type="button" data-preset="手动开奖">手动开奖</button>
								</div>
								<label class="nsmax-lucky-field">
									<span>参与方式</span>
									<select class="nsmax-lucky-rule">
										<option value="任意回复即可参与">任意回复即可参与</option>
										<option value="回复指定关键词参与">回复指定关键词参与</option>
										<option value="点赞或加鸡腿参与">点赞或加鸡腿参与</option>
									</select>
								</label>
								<div class="nsmax-lucky-field">
									<span>Markdown 正文预览</span>
									<pre class="nsmax-lucky-preview"></pre>
								</div>
							</div>
							<div class="nsmax-lucky-foot">
								<button type="button" class="nsmax-lucky-cancel">取消</button>
								<button type="button" class="nsmax-lucky-confirm primary">确认插入抽奖信息</button>
							</div>
						`;
						document.body.append(dialog);

						const prizeInput = dialog.querySelector(".nsmax-lucky-prize");
						const countInput = dialog.querySelector(".nsmax-lucky-count");
						const timeInput = dialog.querySelector(".nsmax-lucky-time");
						const ruleSelect = dialog.querySelector(".nsmax-lucky-rule");
						const previewEl = dialog.querySelector(".nsmax-lucky-preview");

						const updatePreview = () => {
							const prize = prizeInput.value.trim() || "奖品名称";
							const count = countInput.value.trim() || "1";
							const time = timeInput.value.trim() || "24 小时后";
							const rule = ruleSelect.value;
							const md = `# 🎁 抽奖信息\n\n- **奖品**：${prize} × ${count} 份\n- **参与方式**：${rule}\n- **开奖时间**：${time}\n- **开奖说明**：请按规则在本帖回复参与，开奖后会在本帖公布中奖楼层与名单。\n- **开奖链接**：[点此查看开奖结果](__POST_ID__) *(发布后替换为本帖链接)*\n\n---\n`;
							previewEl.textContent = md;
							return { prize, count, time, rule, md };
						};

						dialog.querySelectorAll(".nsmax-lucky-presets button").forEach(btn => {
							btn.addEventListener("click", () => {
								timeInput.value = btn.dataset.preset;
								updatePreview();
							});
						});

						[prizeInput, countInput, timeInput, ruleSelect].forEach(el => {
							el.addEventListener("input", updatePreview);
							el.addEventListener("change", updatePreview);
						});

						const close = () => {
							if (typeof dialog.close === "function") dialog.close();
							else dialog.removeAttribute("open");
						};

						dialog.querySelector(".nsmax-lucky-close").addEventListener("click", close);
						dialog.querySelector(".nsmax-lucky-cancel").addEventListener("click", close);

						dialog.querySelector(".nsmax-lucky-confirm").addEventListener("click", () => {
							const { prize, md } = updatePreview();
							const activeTitle = titleEl || document.querySelector(".post-title-input,[name=title],input[placeholder*='标题']");
							if (activeTitle && !/抽奖/.test(activeTitle.value)) {
								const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
								setter?.call(activeTitle, `抽奖：${activeTitle.value.trim() || prize}`);
								activeTitle.dispatchEvent(new Event("input", { bubbles: true }));
							}
							const current = cmInst ? cmInst.getValue() : inputEl?.value || "";
							if (!/开奖链接/.test(current)) {
								const combined = current.trim() ? `${md}\n${current.trim()}` : md;
								setValueFn(combined);
							}
							close();
						});

						dialog.addEventListener("keydown", e => {
							if (e.key === "Escape") close();
						});
						dialog._updatePreview = updatePreview;
					}

					dialog._updatePreview();
					if (typeof dialog.showModal === "function") dialog.showModal();
					else dialog.setAttribute("open", "");
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
					render();
					if (!previewing) { cm?.refresh(); (cm || input).focus(); }
				});
				const surface = document.createElement("div");
				surface.className = "nsmax-editor-surface";
				const nativeInput = editor.querySelector(".CodeMirror") || input;
				let pane = nativeInput;
				while (pane.parentElement && pane.parentElement !== body && pane.parentElement !== editor) pane = pane.parentElement;
				if (pane !== body && pane !== editor) { pane.setAttribute("data-nsmax-editor-pane", ""); pane.before(surface); surface.append(pane, preview); }
				else { body.append(surface); surface.append(preview); }
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
				const previewButton = controls.lastElementChild;
				previewButton.addEventListener("click", () => contentButton.setAttribute("aria-pressed",String(!previewing)), { signal:ctx.signal });
				const contentButton = document.createElement("button"); contentButton.type = "button"; contentButton.setAttribute("aria-pressed","true"); contentButton.textContent = "内容"; contentButton.setAttribute("aria-label", "内容");
				contentButton.addEventListener("click", () => { if (previewing) previewButton.click(); }, { signal: ctx.signal });
				head.append(contentButton, previewButton);
				surface.before(controls, mdeToolbar);
				body.prepend(head);
				const submit = editor.querySelector(".topic-select,.submit-row");
				if (isPost) { const button = editor.querySelector("button.submit,button[type=submit]"); if (button) button.textContent="回复"; }
				if (!submit) { const footer = document.createElement("div"); footer.className = "submit-row"; editor.append(footer); }
				const submitBtn = editor.querySelector("button.submit,button[type=submit]");
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
			// Only group explicit replies to an earlier floor already present on this page.
			// Moving the existing node preserves native actions, anchors and drafts.
			const list = document.querySelector("ul.comments");
			if (!list || !isPost) return;
			const floors = new Map(Array.from(list.querySelectorAll("li.content-item[id]"), item => [item.id, item]));
			for (const [id, item] of floors) {
				if (processed.has(item)) continue;
				const paragraph = item.querySelector("article.post-content > p:first-child");
				if (!paragraph || !/^\s*@/.test(paragraph.textContent)) continue;
				const link = Array.from(paragraph.querySelectorAll("a[href]")).find(anchor => {
					try { const url = new URL(anchor.href, location.href); return url.origin === location.origin && /^\/post-\d+-\d+$/.test(url.pathname) && /^#\d+$/.test(url.hash); } catch { return false; }
				});
				if (!link) continue;
				const url = new URL(link.href, location.href);
				const parentId = url.hash.slice(1);
				const post = location.pathname.match(/^\/post-(\d+)-/);
				if (url.origin !== location.origin || !url.pathname.startsWith("/post-" + post?.[1] + "-") || !/^\d+$/.test(parentId) || Number(parentId) >= Number(id)) continue;
				const parent = floors.get(parentId);
				if (!parent || parent === item || item.contains(parent)) continue;
				// 将多轮回复平铺在所属主楼层下（深度上限为 1），彻底杜绝多次对话后层层缩进导致内容被挤成极窄条的问题
				let rootFloor = parent;
				while (rootFloor && rootFloor.parentElement && rootFloor.parentElement !== list) {
					const ancestor = rootFloor.parentElement.closest("li.content-item");
					if (ancestor) rootFloor = ancestor;
					else break;
				}
				if (!rootFloor || rootFloor === item || item.contains(rootFloor)) continue;
				let replies = rootFloor.querySelector(":scope > .nsmax-nested-replies");
				if (!replies) {
					replies = document.createElement("ul");
					replies.className = "nsmax-nested-replies";
					replies.setAttribute("aria-label", "楼中楼回复");
					rootFloor.append(replies);
				}
				replies.append(item);
				processed.add(item);
			}
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
			for (const dispose of editors.values()) dispose();
			editors.clear();
		};
	}
	var leanUiFeature = { id: "sb-page-controls", defaults: { enabled: true }, mount: mountLeanUi };

	var recentVisitsFeature = {
		id: "sb-recent-visits", defaults: { enabled: true }, mount(ctx) {
			const account = unsafeWindow$1.__config__?.user?.member_id || "guest";
			const key = "nsmax:recent:" + account;
			let records = [];
			const read = () => {
				try { const value = JSON.parse(localStorage.getItem(key) || "[]"); records = Array.isArray(value) ? value.filter(item => typeof item?.title === "string" && /^\/post-\d+-\d+$/.test(item.path)).slice(0,10) : []; } catch { records = []; }
			};
			read();
			const match = location.pathname.match(/^\/post-(\d+)(?:-\d+)?$/);
			const title = document.querySelector(".nsk-post .post-title-link,.nsk-post h1")?.textContent.trim();
			if (match && title) {
				const path = "/post-" + match[1] + "-1";
				records = [{ path, title: title.slice(0,200) }, ...records.filter(item => item.path !== path)].slice(0,10);
				try { localStorage.setItem(key, JSON.stringify(records)); } catch {}
			}
			let panel, signature;
			const render = () => {
				const sidebar = document.getElementById("nsk-right-panel-container");
				if (!sidebar || !records.length) return;
				if (!panel) { panel = document.createElement("section"); panel.className = "nsmax-recent-panel"; const head = document.createElement("h2"); head.textContent = "最近浏览"; panel.append(head,document.createElement("ul")); }
				const hot = sidebar.querySelector(".nsmax-hot-panel");
				if (hot && hot.nextElementSibling !== panel) hot.after(panel);
				else if (!panel.isConnected) sidebar.append(panel);
				const next = JSON.stringify(records);
				if (next === signature) return;
				signature = next;
				const list = panel.querySelector("ul"); list.replaceChildren();
				for (const record of records) { const item = document.createElement("li"), link = document.createElement("a"); link.href = record.path; link.textContent = record.title; link.title = record.title; item.append(link); list.append(item); }
			};
			const stop = ctx.watch(render);
			window.addEventListener("storage", event => { if (event.key === key) { read(); render(); } }, { signal: ctx.signal });
			return () => { stop(); panel?.remove(); };
		}
	};

	var personHoverFeature = { id: "sb-person-hover", defaults: { enabled: true }, mount(ctx) {
		const cache = new Map(); let pop, anchor, opening, closing, serial = 0;
		const matches = target => {
			const link = target instanceof Element ? target.closest('a[href*="/space/"]:not(.nsmax-person-head a):not(.nsmax-person-foot a):not(#fast-nav-button-group a),.avatar-wrapper a,.info-author a[href*="/space/"],.info-last-commenter a[href*="/space/"],.author-name[href*="/space/"],.post-author[href*="/space/"]') : null;
			if (!link || link.closest(".nsmax-person-pop, .hover-user-card, #fast-nav-button-group, .nsmax-sb-account, #nsk-right-panel-container, .user-card, .nspp-user-card, .head-container")) return null;
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
			const actions = document.createElement("div"); actions.className = "nsmax-person-actions";
			const me = unsafeWindow$1.__config__?.user?.member_id;
			let follow = null;
			const setFollowed = on => { if (!follow) return; follow.textContent = on ? "已关注" : "关注"; follow.toggleAttribute("data-on", on); follow.setAttribute("aria-pressed", String(on)); };
			if (me && String(me) !== String(id)) {
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
					} catch (error) {
						status.textContent = (on ? "取消关注" : "关注") + "失败：" + (error?.message || "请稍后再试");
						if (!status.isConnected) pop?.append(status);
					} finally { follow.disabled = false; }
				}, { signal: ctx.signal });
				actions.append(follow);
			}
			for (const [label,path] of [["私信","/notification#/message?mode=talk&to="+id],["主页","/space/"+id]]) { const item = document.createElement("a"); item.href = path; item.textContent = label; actions.append(item); }
			const numbers = document.createElement("dl"); numbers.className = "nsmax-person-stats";
			const status = document.createElement("p"); status.className = "nsmax-person-status"; status.textContent = "正在读取资料…"; status.setAttribute("role","status");
			pop.append(header,actions,numbers,status); pop.addEventListener("pointerenter",()=>clearTimeout(closing),{signal:ctx.signal}); pop.addEventListener("pointerleave",closeSoon,{signal:ctx.signal}); document.body.append(pop); document.documentElement.setAttribute("data-nsmax-person-open",""); place();
			try {
				let entry = cache.get(id);
				if (!entry || Date.now()-entry.at>6e5) { const promise = ctx.request("/api/account/getInfo/"+id).then(data => data?.detail || data?.data || {}); entry = { at:Date.now(), promise }; cache.set(id,entry); if (cache.size>256) cache.delete(cache.keys().next().value); }
				const data = await entry.promise;
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
				if (data.bio && String(data.bio).trim()) { const bio = document.createElement("p"); bio.className = "nsmax-person-bio"; bio.textContent = String(data.bio).trim(); header.after(bio); }
				if (follow) { setFollowed(!!data.followed); follow.disabled = false; }
				const fmt = value => value === undefined || value === null ? "—" : Number(value) >= 1e5 ? (Number(value) / 1e3).toFixed(Number(value) >= 1e6 ? 0 : 1) + "K" : String(value);
				for (const [label,key] of [["鸡腿","coin"],["星辰","stardust"],["主题","nPost"],["回复","nComment"],["关注","follows"],["粉丝","fans"]]) { const item = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd"); term.textContent = label; value.textContent = fmt(data[key]); item.append(term,value); numbers.append(item); }
				status.remove(); place();
			} catch { cache.delete(id); if (ticket === serial && pop) status.textContent = "暂时无法读取资料，可打开个人主页"; }
		};
		document.addEventListener("pointerover",event => {
			const link=matches(event.target);
			if (!link || pop?.contains(link) || link.contains(event.relatedTarget)) return;
			clearTimeout(opening);
			clearTimeout(closing);
			const match = link.href.match(/\/space\/(\d+)/);
			if (match) {
				const id = match[1];
				if (!cache.has(id)) {
					const promise = ctx.request("/api/account/getInfo/"+id).then(data => data?.detail || data?.data || {}).catch(() => ({}));
					cache.set(id, { at: Date.now(), promise });
					if (cache.size > 256) cache.delete(cache.keys().next().value);
				}
			}
			opening=setTimeout(()=>show(link),90);
		}, { signal:ctx.signal });
		document.addEventListener("pointerout",event => { const link=matches(event.target); if (link && !link.contains(event.relatedTarget) && !pop?.contains(event.relatedTarget)) closeSoon(); }, { signal:ctx.signal });
		document.addEventListener("click",event => { if (pop && !pop.contains(event.target)) hide(); }, { signal:ctx.signal });
		document.addEventListener("keydown",event => { if (event.key==="Escape") hide(); }, { signal:ctx.signal });
		window.addEventListener("scroll",hide,{passive:true,signal:ctx.signal}); window.addEventListener("resize",place,{passive:true,signal:ctx.signal});
		return hide;
	} };
