	function nsmaxPrepareSpace() {
		if (!/^\/space\/\d+/.test(location.pathname)) return;
		for (const item of document.querySelectorAll(".card-block > .card-item")) item.toggleAttribute("data-nsmax-obsolete-stat", !item.textContent.trim() || /加入天数|注册天数|信用分|信任分/.test(item.textContent));
		for (const readme of document.querySelectorAll(".readme")) {
			const text = readme.textContent.trim();
			const hasWatermark = !!readme.querySelector("img[src*='logo'], img[src*='nodeseek'], svg");
			const isEmpty = !text || /^(没有找到readme|暂无简介|暂无介绍|NodeSeek)$/i.test(text) || (hasWatermark && text.length < 20);
			readme.toggleAttribute("data-nsmax-empty-readme", isEmpty);
			if (isEmpty) readme.style.setProperty("display", "none", "important");
		}
		const head = document.querySelector(".head-container"), stats = document.querySelector(".card-block");
		if (!head) return;

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
			const onlineSpan = document.createElement("span");
			onlineSpan.className = "nsmax-space-online";
			onlineSpan.innerHTML = '<span class="nsmax-online-dot"></span>在线';
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
			const rawDesc = descEl?.textContent.trim() || "";
			const lastActive = document.createElement("span");
			lastActive.className = "nsmax-space-last";
			lastActive.textContent = /最后在线/.test(rawDesc) ? rawDesc : "最后在线 刚刚";

			meta.append(onlineSpan, uidSpan, joinSpan, lastActive);
			identity.append(titleRow, meta);

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

		// Clean and mirror stats safely: DO NOT remove stats from Vue's original parent (.selector-right-side)
		// to avoid breaking Vue's component teardown / router view change.
		let headStats = head.querySelector(":scope > .card-block");
		const origStats = document.querySelector(".selector .card-block, .selector-right-side .card-block");
		if (origStats) {
			if (!headStats) {
				headStats = origStats.cloneNode(true);
				head.append(headStats);
			}
		}
		for (const extraCard of document.querySelectorAll(".selector .card-block, .selector-right-side .card-block")) {
			extraCard.style.setProperty("display", "none", "important");
		}
		if (headStats) {
			headStats.removeAttribute("style");
			for (const item of headStats.querySelectorAll(".card-item")) {
				item.querySelectorAll("svg").forEach(s => s.remove());
				const text = item.textContent.trim();
				if (!text || /加入天数|注册天数|信用分|信任分/.test(text)) {
					item.setAttribute("data-nsmax-obsolete-stat", "true");
					item.style.setProperty("display", "none", "important");
					continue;
				}
				item.removeAttribute("data-nsmax-obsolete-stat");
				item.style.removeProperty("display");
				const divs = Array.from(item.querySelectorAll("div, span, dt, dd")).filter(el => el.children.length === 0 && el.textContent.trim());
				let label = "", val = "";
				if (divs.length >= 2) {
					label = divs[0].textContent.trim();
					val = divs[divs.length - 1].textContent.trim();
				} else {
					const m = text.match(/^([^\d]+)\s*[:：]?\s*(\d+.*)$/);
					if (m) {
						label = m[1].trim();
						val = m[2].trim();
					} else {
						label = text;
					}
				}
				label = label.replace("数目", "").replace("帖数", "").replace("数", "").trim();
				item.innerHTML = `<div class="nsmax-stat-label">${label}</div><div class="nsmax-stat-val">${val}</div>`;
				if (/等级/.test(label) && Number(val) >= 6) {
					item.setAttribute("data-nsmax-lv6-stat", "true");
				}
			}
		}

		let progress = head.querySelector(":scope > .nsmax-space-progress");
		const statsSource = headStats || stats;
		if (!progress && statsSource) {
			const levelText = Array.from(statsSource.querySelectorAll(".card-item")).find(item => /等级/.test(item.textContent))?.textContent.match(/\d+/)?.[0];
			if (levelText) {
				const level = Number(levelText);
				progress = document.createElement("div");
				progress.className = "nsmax-space-progress";
				progress.innerHTML = '<span class="nsmax-space-progress-level"></span><strong class="nsmax-space-progress-percent"></strong><span class="nsmax-space-progress-next"></span><i><b></b></i>';

				const titles = {
					0: ["初来乍到", "初露锋芒"],
					1: ["初露锋芒", "小有收获"],
					2: ["小有收获", "渐入佳境"],
					3: ["渐入佳境", "小有成就"],
					4: ["小有成就", "经常露面"],
					5: ["经常露面", "登峰造极"],
					6: ["登峰造极", "已达最高等级"]
				};

				if (level >= 6) {
					progress.setAttribute("data-nsmax-level-max", "");
					progress.classList.add("nsmax-space-progress-max");
					progress.querySelector(".nsmax-space-progress-level").textContent = `Lv.6 登峰造极`;
					progress.querySelector(".nsmax-space-progress-percent").textContent = `MAX`;
					progress.querySelector(".nsmax-space-progress-next").textContent = `已达最高等级`;
					progress.querySelector("b").style.width = `100%`;

					const titleRow = head.querySelector(".nsmax-space-title-row");
					if (titleRow && !titleRow.querySelector(".nsmax-space-vip")) {
						const vipBadge = document.createElement("span");
						vipBadge.className = "nsmax-space-vip";
						vipBadge.setAttribute("data-nsmax-lv6", "true");
						vipBadge.textContent = "Lv 6";
						titleRow.append(vipBadge);
					}
				} else {
					const cur = titles[level]?.[0] || "当前等级";
					const nxt = titles[level]?.[1] || "下一等级";
					const percent = Math.max(0, Math.min(100, (level % 10) * 10 || 50));
					progress.querySelector(".nsmax-space-progress-level").textContent = `Lv.${level} ${cur}`;
					progress.querySelector(".nsmax-space-progress-percent").textContent = `${percent}%`;
					progress.querySelector(".nsmax-space-progress-next").textContent = `Lv.${level + 1} ${nxt}`;
					progress.querySelector("b").style.width = `${percent}%`;
				}
				head.append(progress);
			}
		}

		// Align tabs with sb.sb: ensure "主题", "回帖", "收藏", hide "概况/资料", remove "设置" button
		const selectorNav = document.querySelector(".selector");
		if (selectorNav && !selectorNav.hasAttribute("data-nsmax-tabs-ready")) {
			selectorNav.setAttribute("data-nsmax-tabs-ready", "true");
			const settingBtn = selectorNav.querySelector(".nsmax-space-setting-btn");
			if (settingBtn) settingBtn.remove();

			let tabs = Array.from(selectorNav.querySelectorAll("a.select-item"));
			const visibleTabs = [];
			const hiddenTabs = [];

			// 检查是否已包含主题/讨论相关 tab，若原生未提供则自动补齐
			let topicTab = tabs.find(tab => /主题|讨论|帖子|discussions|posts|topics/i.test(tab.textContent) || /#\/(?:discussions|posts|topics)/i.test(tab.getAttribute("href") || ""));
			if (!topicTab) {
				topicTab = document.createElement("a");
				topicTab.className = "select-item";
				topicTab.href = "#/posts";
				topicTab.textContent = "主题";
				tabs.unshift(topicTab);
			}

			for (const tab of tabs) {
				const text = tab.textContent.trim();
				const href = tab.getAttribute("href") || "";
				if (/概况|资料/i.test(text) || /#\/(?:info|profile)$/i.test(href)) {
					tab.style.setProperty("display", "none", "important");
					tab.setAttribute("hidden", "");
					tab.classList.remove("active");
					hiddenTabs.push(tab);
					continue;
				}
				tab.removeAttribute("hidden");
				tab.style.removeProperty("display");
				if (/主题|讨论|帖子|discussions|posts|topics/i.test(text) || /#\/(?:discussions|posts|topics)/i.test(href)) {
					tab.textContent = "主题";
					tab.setAttribute("href", "#/posts");
				} else if (/评论|回帖|回复|comments/i.test(text) || /#\/comments/i.test(href)) {
					tab.textContent = "回帖";
					tab.setAttribute("href", "#/comments");
				} else if (/收藏|fav|collections/i.test(text) || /#\/(?:collections|fav)/i.test(href)) {
					tab.textContent = "收藏";
					tab.setAttribute("href", "#/fav");
				}
				visibleTabs.push(tab);
			}

			const orderMap = { "主题": 1, "回帖": 2, "收藏": 3 };
			visibleTabs.sort((a, b) => {
				const valA = orderMap[a.textContent.trim()] || 99;
				const valB = orderMap[b.textContent.trim()] || 99;
				return valA - valB;
			});

			const rightSide = selectorNav.querySelector(".selector-right-side, .discussion-wrapper, .comments-list");
			for (const tab of visibleTabs) {
				if (rightSide) selectorNav.insertBefore(tab, rightSide);
				else selectorNav.append(tab);
			}
			for (const tab of hiddenTabs) {
				selectorNav.append(tab);
			}
			selectorNav.scrollLeft = 0;
		}

		// 同步当前激活状态，避免反复 click 导致无限闪烁
		const syncActiveTabs = () => {
			const hash = location.hash || "#/posts";
			for (const tab of document.querySelectorAll(".selector a.select-item")) {
				const href = tab.getAttribute("href") || "";
				const isActive = ((hash.includes("posts") || hash.includes("discussions")) && (href.includes("posts") || href.includes("discussions"))) ||
					(hash.includes("comments") && href.includes("comments")) ||
					((hash.includes("collections") || hash.includes("fav")) && (href.includes("collections") || href.includes("fav")));
				tab.classList.toggle("active", isActive);
				tab.classList.toggle("router-link-active", isActive);
			}
		};

		// 首次进入空间时，如果是概况则平滑切换至主题
		if (!window.__nsmax_space_switched) {
			const currentHash = location.hash;
			if (!currentHash || currentHash === "#/info" || currentHash === "#" || currentHash.includes("info") || currentHash.includes("profile")) {
				window.__nsmax_space_switched = true;
				location.hash = "#/posts";
			}
		}
		syncActiveTabs();

		// 为 tab 绑定点击时同步状态
		for (const item of document.querySelectorAll(".selector a.select-item")) {
			if (!item.hasAttribute("data-nsmax-bound")) {
				item.setAttribute("data-nsmax-bound", "true");
				item.addEventListener("click", () => {
					setTimeout(syncActiveTabs, 50);
				});
			}
		}
	}
	function nsmaxCleanPostActions() {
		const names = { "good-one": ["点赞","thumbup"], "chicken-leg": ["加鸡腿","drumstick"], "bad-one": ["反对","thumbdown"], "quote": ["引用","quote"], "back": ["回复","reply"] };
		for (const menu of document.querySelectorAll(".comment-menu")) {
			const seen = new Set();
			for (const action of Array.from(menu.querySelectorAll(":scope > .menu-item"))) {
			const href = action.querySelector("svg use")?.getAttribute("href")?.slice(1);
			const label = action.title || Array.from(action.querySelectorAll("span")).map(span=>span.textContent.trim()).find(text=>/^(点赞|加鸡腿|反对|收藏|引用|回复)$/.test(text)) || names[href]?.[0];
			const icon = ({ "点赞":"thumbup","加鸡腿":"drumstick","反对":"thumbdown","收藏":"star","引用":"quote","回复":"reply" })[label];
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
	function nsmaxUpdateNavEssence() {
		const navMenus = document.querySelectorAll("ul.nav-menu");
		for (const navMenu of navMenus) {
			for (const item of navMenu.querySelectorAll(":scope > li")) {
				const a = item.querySelector("a");
				if (!a) continue;
				if (a.textContent.includes("推广") || (a.getAttribute("href") || "").includes("/categories/promotion")) {
					item.style.setProperty("display", "none", "important");
					item.setAttribute("data-nsmax-own-hide", "");
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
				essenceLi.querySelector("a")?.setAttribute("aria-current", "page");
				essenceLi.querySelector("a")?.setAttribute("data-nsmax-header-cat-on", "");
			}
			if (essenceLi.nextElementSibling) {
				navMenu.append(essenceLi);
			}
		}
	}
	function nsmaxMarkLevel6() {
		const candidates = document.querySelectorAll(
			".role-tag, .nspp-level, .user-badge, .badge, .author-info > span, .nsk-content-meta-info > span, .nsmax-account-rank, .nsmax-person-level, .hover-user-card [class*='level']"
		);
		for (const el of candidates) {
			if (el.hasAttribute("data-nsmax-lv6")) continue;
			const text = el.textContent?.trim() || "";
			if (/(?:^|\b|\s)(?:Lv\.?\s*6|Level\s*6)(?:\b|\s|$)/i.test(text) || /^等级\s*6$/i.test(text.replace(/\s+/g, ""))) {
				el.setAttribute("data-nsmax-lv6", "true");
				el.textContent = "Lv 6";
			}
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
				pagerWrapper.classList.add("nsmax-detached-pager");
				pagerWrapper.style.setProperty("background", "transparent", "important");
				pagerWrapper.style.setProperty("border", "none", "important");
				pagerWrapper.style.setProperty("box-shadow", "none", "important");
				if (pagerWrapper.parentElement === commentContainer) {
					commentContainer.after(pagerWrapper);
				}
			}
		}
		for (const detached of document.querySelectorAll(".nsmax-detached-pager, .post-bottom-pager, div:has(>.post-bottom-pager)")) {
			detached.style.setProperty("background", "transparent", "important");
			detached.style.setProperty("border", "none", "important");
			detached.style.setProperty("box-shadow", "none", "important");
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
			const tabGroups = container.querySelectorAll(".tabs, .tabset, .markdown-tabs, .tab-container, .tabs-container, [class*='tab-set'], [class*='tabs-component'], div:has(> .tab-item), div:has(> [class*='tab-nav']), div:has(> ul.nav-tabs)");
			for (const group of tabGroups) {
				if (group.hasAttribute("data-nsmax-tabs-ready")) continue;
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
	function mountLeanUi(ctx) {
		const editors = new Map();
		const processed = new WeakSet();
		const images = new WeakSet();
		const scan = () => {
			const currentPage = /^\/post-\d+/.test(location.pathname) ? "post" : location.pathname === "/notification" ? "notification" : /^\/space\//.test(location.pathname) ? "space" : /^\/setting(?:\/|$)/.test(location.pathname) ? "setting" : /^\/(?:new|edit)-discussion(?:\/|$)/.test(location.pathname) ? "new" : /^\/board(?:\/|$)/.test(location.pathname) ? "board" : "list";
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
			nsmaxMarkLevel6();
			nsmaxSetupMarkdownTabs();
			const controller = document.querySelector(".post-list-controler");
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
			nsmaxProcessPostListRows();
			nsmaxPrepareSpace();
			nsmaxPrepareBoard();
			nsmaxCleanBadgesAndNotifications();
			const isPost = /^\/post-\d+/.test(location.pathname);
			if (isPost) {
				nsmaxDecoratePostDetail();
			}
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
			if (isPost) for (const item of document.querySelectorAll("ul.comments li.content-item")) {
				const menu = item.querySelector(":scope > .comment-menu");
				const floor = item.querySelector(":scope > .nsk-content-meta-info > .floor-link-wrapper");
				let actions = item.querySelector(":scope > .nsmax-floor-actions");
				if (!actions && menu && floor) {
					actions = document.createElement("div"); actions.className = "nsmax-floor-actions";
					item.append(actions); actions.append(menu, floor);
				}
				if (!actions) continue;
				for (const action of actions.querySelectorAll(".menu-item:not([data-nsmax-compact-action])")) {
					const label = action.title || Array.from(action.querySelectorAll("span")).map(span => span.textContent.trim()).find(text => /^(点赞|加鸡腿|反对|收藏|引用|回复|举报)$/.test(text));
					if (label) { if (!action.title) action.title = label; if (!action.hasAttribute("aria-label")) action.setAttribute("aria-label", label); }
					for (const span of action.querySelectorAll(":scope > span")) {
						const text = span.textContent.trim();
						if (/^[\d.,]+(?:[kKwW万千])?$/.test(text)) span.setAttribute("data-nsmax-action-count", "");
						else span.setAttribute("data-nsmax-action-label", "");
					}
					action.setAttribute("data-nsmax-compact-action", "");
				}
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
					if (previewing) preview.replaceChildren(renderMessageMarkdown(cm ? cm.getValue() : input.value));
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
				const setHeight = height => {
					const value = Math.max(120, Math.min(1200, height));
					editor.style.setProperty("--nsmax-editor-height", value + "px");
					if (surface) surface.style.setProperty("height", value + "px", "important");
					const cmWrap = cm?.getWrapperElement?.() || editor.querySelector(".CodeMirror");
					if (cmWrap) cmWrap.style.setProperty("height", value + "px", "important");
					if (input) input.style.setProperty("height", value + "px", "important");
					if (preview) preview.style.setProperty("height", value + "px", "important");
					resize.setAttribute("aria-valuenow", String(Math.round(value)));
					cm?.refresh();
				};
				const beginDrag = event => {
					if (event.button !== undefined && event.button !== 0) return;
					event.preventDefault();
					event.stopPropagation();
					drag = { y: event.clientY ?? event.touches?.[0]?.clientY ?? 0, height: surface.getBoundingClientRect().height };
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
				resize.addEventListener("keydown",event=>{ if (["ArrowDown","ArrowUp"].includes(event.key)) { event.preventDefault(); setHeight(surface.getBoundingClientRect().height+(event.key==="ArrowDown"?30:-30)); } },{signal:ctx.signal});
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
				const adjustInputHeight = () => {
					if (input && !editor.style.getPropertyValue("--nsmax-editor-height")) {
						input.style.setProperty("height", "auto", "important");
						const scrollH = input.scrollHeight;
						if (scrollH > 150) {
							const h = Math.min(800, scrollH + 36);
							input.style.setProperty("height", h + "px", "important");
							if (surface) surface.style.setProperty("height", h + "px", "important");
						} else {
							input.style.setProperty("height", "150px", "important");
							if (surface) surface.style.setProperty("height", "150px", "important");
						}
					}
				};
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
			if (!link || link.closest(".nsmax-person-pop, .hover-user-card, #fast-nav-button-group")) return null;
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
			const identity = document.createElement("div"), profile = document.createElement("a"); profile.href = "/space/"+id; profile.textContent = name; identity.append(profile); header.append(identity);
			const numbers = document.createElement("dl"), status = document.createElement("p"); status.textContent = "正在读取资料…"; status.setAttribute("role","status");
			const foot = document.createElement("div"); foot.className = "nsmax-person-foot";
			for (const [label,path] of [["个人主页","/space/"+id],["私信","/notification#/message?mode=talk&to="+id]]) { const item = document.createElement("a"); item.href = path; item.textContent = label; foot.append(item); }
			pop.append(header,numbers,status,foot); pop.addEventListener("pointerenter",()=>clearTimeout(closing),{signal:ctx.signal}); pop.addEventListener("pointerleave",closeSoon,{signal:ctx.signal}); document.body.append(pop); document.documentElement.setAttribute("data-nsmax-person-open",""); place();
			try {
				let entry = cache.get(id);
				if (!entry || Date.now()-entry.at>3e5) { const promise = ctx.request("/api/account/getInfo/"+id).then(data => data?.detail || data?.data || {}); entry = { at:Date.now(), promise }; cache.set(id,entry); if (cache.size>32) cache.delete(cache.keys().next().value); }
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
					level.textContent = "Lv " + data.rank;
					if (Number(data.rank) >= 6) level.setAttribute("data-nsmax-lv6", "true");
					identity.append(level);
				}
				for (const [label,key] of [["鸡腿","coin"],["主题","nPost"],["回复","nComment"],["粉丝","fans"]]) { const item = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd"); term.textContent = label; value.textContent = data[key] === undefined ? "—" : String(data[key]); item.append(term,value); numbers.append(item); }
				status.remove(); place();
			} catch { cache.delete(id); if (ticket === serial && pop) status.textContent = "暂时无法读取资料，可打开个人主页"; }
		};
		document.addEventListener("pointerover",event => { const link=matches(event.target); if (!link || pop?.contains(link) || link.contains(event.relatedTarget)) return; clearTimeout(opening); clearTimeout(closing); opening=setTimeout(()=>show(link),180); }, { signal:ctx.signal });
		document.addEventListener("pointerout",event => { const link=matches(event.target); if (link && !link.contains(event.relatedTarget) && !pop?.contains(event.relatedTarget)) closeSoon(); }, { signal:ctx.signal });
		document.addEventListener("click",event => { const link=matches(event.target); if (link && !pop?.contains(link)) { event.preventDefault(); event.stopImmediatePropagation(); void show(link); } else if (pop && !pop.contains(event.target)) hide(); }, { capture:true, signal:ctx.signal });
		document.addEventListener("keydown",event => { if (event.key==="Escape") hide(); }, { signal:ctx.signal });
		window.addEventListener("scroll",hide,{passive:true,signal:ctx.signal}); window.addEventListener("resize",place,{passive:true,signal:ctx.signal});
		return hide;
	} };
