	function nsmaxPrepareSpace() {
		if (!/^\/space\/\d+/.test(location.pathname)) return;
		for (const item of document.querySelectorAll(".card-block > .card-item")) item.toggleAttribute("data-nsmax-obsolete-stat", !item.textContent.trim() || /加入天数|注册天数|信用分|信任分/.test(item.textContent));
		for (const readme of document.querySelectorAll(".readme")) readme.toggleAttribute("data-nsmax-empty-readme", /^(没有找到readme|暂无简介|暂无介绍)/i.test(readme.textContent.trim()));
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

			meta.append(uidSpan, joinSpan, lastActive);
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
		if (stats) {
			for (const item of stats.querySelectorAll(".card-item")) {
				const first = item.querySelector(":scope > div, :scope > span");
				if (first) {
					first.textContent = first.textContent.replace("数目", "").replace("帖数", "");
				}
			}
			if (!headStats) {
				headStats = stats.cloneNode(true);
				head.append(headStats);
			} else {
				for (const item of headStats.querySelectorAll(".card-item")) {
					const first = item.querySelector(":scope > div, :scope > span");
					if (first) first.textContent = first.textContent.replace("数目", "").replace("帖数", "");
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

					for (const container of [headStats, stats].filter(Boolean)) {
						const levelItem = Array.from(container.querySelectorAll(".card-item")).find(item => /等级/.test(item.textContent));
						if (levelItem) {
							levelItem.setAttribute("data-nsmax-lv6-stat", "true");
							levelItem.querySelector("div:last-child, span:last-child")?.setAttribute("data-nsmax-lv6", "true");
						}
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

		// Ensure space tabs remain responsive and do not get blocked
		for (const item of document.querySelectorAll(".selector a.select-item")) {
			if (!item.hasAttribute("data-nsmax-bound")) {
				item.setAttribute("data-nsmax-bound", "true");
				item.addEventListener("click", () => {
					setTimeout(() => {
						const hash = location.hash || "#/info";
						for (const tab of document.querySelectorAll(".selector a.select-item")) {
							const href = tab.getAttribute("href") || "";
							const on = href.includes(hash) || (hash === "#/info" && (href.endsWith("/info") || href.endsWith("#")));
							tab.classList.toggle("active", on);
						}
					}, 50);
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
			if (inline) { inline.className = "nsmax-inline-category"; const categoryIcon = toolIcon("board"); categoryIcon.classList.add("nsmax-meta-icon"); inline.prepend(categoryIcon); }
			for (const item of [author, time, inline, views, count, last, category]) if (item) info.append(item);
			row.setAttribute("data-nsmax-meta-ordered", "");
		}
	}
	function nsmaxPrepareBoard() {
		if (!/^\/board(?:\/|$)/.test(location.pathname)) return;
		const container = document.querySelector("#nsk-body, .board-container, section#nsk-frame");
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
			}
		}
	}
	function mountLeanUi(ctx) {
		const editors = new Map();
		const processed = new WeakSet();
		const images = new WeakSet();
		const scan = () => {
			nsmaxPrizeBadges();
			nsmaxCleanSearchOverlay();
			nsmaxCleanPostActions();
			nsmaxUpdateNavEssence();
			nsmaxMarkLevel6();
			const controller = document.querySelector(".post-list-controler");
			if (controller && !controller.querySelector(".nsmax-nq-entry")) {
				const link = document.createElement("a");
				link.className = "nsmax-nq-entry";
				link.href = "https://nodequality.com";
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.title = "NodeQuality 测机";
				link.textContent = "NQ";
				controller.append(link);
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
			const isPost = /^\/post-\d+/.test(location.pathname);
			if (!isPost && !/^\/(?:new|edit)-discussion/.test(location.pathname)) return;
			for (const image of document.querySelectorAll(".nsk-post article.post-content img,ul.comments article.post-content img")) {
				if (images.has(image)) continue; images.add(image);
				const classify = () => {
					const emoji = /emoji|smoji|expression|emoticon|yct\d|xhj\d|表情/i.test(image.className+" "+image.alt+" "+image.src);
					const standalone = image.parentElement?.matches("p,a") && !image.parentElement.textContent.trim();
					if (!emoji && standalone && image.naturalWidth>96 && image.naturalHeight>96) { image.classList.add("nsmax-post-image"); image.closest("p")?.classList.add("nsmax-image-paragraph"); }
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
				action("Markdown", "code", button => {
					const on = editor.classList.toggle("nsmax-editor-tools");
					button.setAttribute("aria-pressed", String(on));
					button.title = on ? "切换到纯文本" : "使用 Markdown 编辑器";
					button.setAttribute("aria-label", button.title);
					button.querySelector(".nsmax-action-label").textContent = button.title;
					cm?.refresh();
				});
				if (!isPost && /^\/new-discussion$/.test(location.pathname)) action("抽奖", "gift", () => {
					const titleInput = document.querySelector(".post-title-input,[name=title],input[placeholder*='标题']");
					if (titleInput && !/抽奖/.test(titleInput.value)) {
						const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
						setter?.call(titleInput, `抽奖：${titleInput.value.trim() || "奖品名称"}`);
						titleInput.dispatchEvent(new Event("input", { bubbles: true }));
					}
					const current = cm ? cm.getValue() : input?.value || "";
					if (!/开奖链接/.test(current)) setEditorValue(`${current.trim()}${current.trim() ? "\\n\\n" : ""}抽奖规则：\\n- 奖品：\\n- 开奖时间：\\n- 参与方式：\\n- 开奖链接：请在发布后替换为本帖链接\\n`);
				});
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
				const setHeight = height => { const value = Math.max(150,Math.min(1000,height)); editor.style.setProperty("--nsmax-editor-height",value+"px"); resize.setAttribute("aria-valuenow",String(Math.round(value))); cm?.refresh(); };
				const beginDrag = event => { if (event.button !== 0) return; event.preventDefault(); drag={ y:event.clientY,height:surface.getBoundingClientRect().height }; resize.setPointerCapture?.(event.pointerId); };
				const moveDrag = event => { if (drag) { event.preventDefault(); setHeight(drag.height+event.clientY-drag.y); } };
				const endDrag = () => { drag=undefined; };
				resize.addEventListener("pointerdown", beginDrag, { signal:ctx.signal });
				resize.addEventListener("pointermove", moveDrag, { signal:ctx.signal });
				resize.addEventListener("mousedown", beginDrag, { signal:ctx.signal });
				for (const type of ["pointermove","mousemove"]) document.addEventListener(type, moveDrag, { signal:ctx.signal, passive:false });
				for (const type of ["pointerup","pointercancel","mouseup","lostpointercapture"]) document.addEventListener(type,endDrag,{signal:ctx.signal});
				resize.addEventListener("keydown",event=>{ if (["ArrowDown","ArrowUp"].includes(event.key)) { event.preventDefault(); setHeight(surface.getBoundingClientRect().height+(event.key==="ArrowDown"?30:-30)); } },{signal:ctx.signal});
				surface.append(resize);
				const previewButton = controls.lastElementChild;
				previewButton.addEventListener("click", () => contentButton.setAttribute("aria-pressed",String(!previewing)), { signal:ctx.signal });
				const contentButton = document.createElement("button"); contentButton.type = "button"; contentButton.setAttribute("aria-pressed","true"); contentButton.textContent = "内容"; contentButton.setAttribute("aria-label", "内容");
				contentButton.addEventListener("click", () => { if (previewing) previewButton.click(); }, { signal: ctx.signal });
				head.append(contentButton, previewButton);
				surface.before(controls);
				body.prepend(head);
				const submit = editor.querySelector(".topic-select,.submit-row");
				if (isPost) { const button = editor.querySelector("button.submit,button[type=submit]"); if (button) button.textContent="回复"; }
				if (!submit) { const footer = document.createElement("div"); footer.className = "submit-row"; editor.append(footer); }
				if (cm) cm.on("change", render);
				else input.addEventListener("input", render, { signal: ctx.signal });
				editors.set(editor, () => { cm?.off("change", render); head.remove(); controls.remove(); preview.remove(); });
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
		return () => { stop(); for (const dispose of editors.values()) dispose(); editors.clear(); };
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
			const link = target instanceof Element ? target.closest('a[href*="/space/"]:has(img),.avatar-wrapper a,.info-author a[href*="/space/"],.info-last-commenter a[href*="/space/"],.author-name[href*="/space/"],.post-author[href*="/space/"]') : null;
			if (!link) return null;
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
			const img = link.querySelector("img"), owner = link.closest(".content-item,.post-list-item,.user-head");
			const name = owner?.querySelector(".author-name,.info-author a,.Username")?.textContent.trim() || img?.alt || "用户 " + id;
			pop = document.createElement("section"); pop.className = "nsmax-person-pop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label",name+" 的资料");
			const header = document.createElement("div"); header.className = "nsmax-person-head";
			if (img) { const avatar = document.createElement("img"); avatar.src = img.src; avatar.alt = ""; header.append(avatar); }
			const identity = document.createElement("div"), profile = document.createElement("a"); profile.href = "/space/"+id; profile.textContent = name; identity.append(profile); header.append(identity);
			const numbers = document.createElement("dl"), status = document.createElement("p"); status.textContent = "正在读取资料…"; status.setAttribute("role","status");
			const foot = document.createElement("div"); foot.className = "nsmax-person-foot";
			for (const [label,path] of [["个人主页","/space/"+id],["私信","/notification#/message?mode=talk&to="+id]]) { const link = document.createElement("a"); link.href = path; link.textContent = label; foot.append(link); }
			pop.append(header,numbers,status,foot); pop.addEventListener("pointerenter",()=>clearTimeout(closing),{signal:ctx.signal}); pop.addEventListener("pointerleave",closeSoon,{signal:ctx.signal}); document.body.append(pop); document.documentElement.setAttribute("data-nsmax-person-open",""); place();
			try {
				let entry = cache.get(id);
				if (!entry || Date.now()-entry.at>3e5) { const promise = ctx.request("/api/account/getInfo/"+id).then(data => data?.detail || data?.data || {}); entry = { at:Date.now(), promise }; cache.set(id,entry); if (cache.size>32) cache.delete(cache.keys().next().value); }
				const data = await entry.promise;
				if (ticket !== serial || !pop) return;
				profile.textContent = data.member_name || name;
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
