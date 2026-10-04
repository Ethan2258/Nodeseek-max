"use strict";
// 模拟 NodeSeek 页面结构，仅供冒烟测试与截图。顶栏、版心、帖子列表、帖子页的结构照真实站点（2026-10 抓取）：
// header>#nsk-head(.site-title / ul.nav-menu / form.search-box / .color-theme-switcher)、section#nsk-frame>#nsk-body.nsk-container
// >(#nsk-left-panel-container, #nsk-body-left, #nsk-right-panel-container)。登录后才有的部分（用户卡片、编辑器、消息中心、设置页）
// 真实结构未知，按常见写法模拟。
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "site.css"), "utf8");
const AVATAR = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='#9aa5b1'/></svg>");

const categories = [["daily", "日常"], ["tech", "技术"], ["info", "情报"], ["review", "测评"], ["trade", "交易"], ["carpool", "拼车"], ["promotion", "推广"], ["life", "生活"], ["dev", "Dev"], ["photo-share", "贴图"], ["expose", "曝光"], ["inside", "内版"], ["sandbox", "沙盒"]];
const ICON = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'><circle cx='12' cy='12' r='8'/></svg>";
// 站点的图标是 iconpark 雪碧图（<use href="#名字">），主题按引用的名字换成线条图标
const iconpark = (name, style = "") => `<svg class="iconpark-icon"${style ? ` style="${style}"` : ""}><use href="#${name}"></use></svg>`;
const headerCategories = `<ul class="nav-menu"><!----> <!----> ${categories.slice(0, 7).map(([slug, name]) => `<li><a href="/categories/${slug}">${name}</a></li>`).join("")} <li><a href="https://www.deepflood.com" target="_blank">DeepFlood</a></li> <!----></ul>`;
const header = `<header><div id="nsk-head" class="nsk-container"><strong class="site-title"><a href="/"><img src="${AVATAR}" alt="logo" style="max-height: 36px;vertical-align: middle;"> <span class="title-text" style="vertical-align: middle;">NodeSeek</span><span class="beta-icon">beta</span></a></strong> ${headerCategories} <form method="get" action="https://www.google.com/search" class="search-box pure-form" style="display:block;"><input type="text" id="search-site" value="site:www.nodeseek.com" name="q" style="width: 0;height:0;display: none;"> <input type="text" id="search-site2" name="q" value="" placeholder="Search" accesskey="/" aria-label="Enter your search term" title="输入搜索内容" role="searchbox" style="height: 30px;"> <svg class="iconpark-icon search-icon" style="width: 17px;height: 17px;color:#666"><use href="#search"></use></svg> <input type="submit" value="" style="display: none;"> <div class="search-hint"><a href="javascript:void(0)" class="search4post">search for post</a> <a href="javascript:void(0)" class="search4people">search for people</a> <a href="javascript:void(0)" class="googleSearch">use google search</a></div></form> <div class="color-theme-switcher"><svg class="iconpark-icon" style="width: 17px;height: 17px;"><use href="#sun-one"></use></svg></div></div></header>`;
// 左侧版块栏：默认每项是链接；navMode: "div" 时是不带链接的 div（data-to），两种都要能识别。
const leftNavHtml = (mode) => `<div id="nsk-left-panel-container"><!----> <div class="nsk-panel category-list"><h4 aria-level="2">${ICON} <span>所有版块</span></h4> <ul>${categories.map(([slug, name]) => mode === "div" ? `<li><div data-to="/categories/${slug}">${ICON} <span>${name}</span></div></li>` : `<li><a href="/categories/${slug}">${ICON} <span>${name}</span></a></li>`).join("")}</ul></div> <!----></div>`;
const config = `window.__config__ = { pageType: "list", user: { member_id: 1, member_name: "tester" }, allCategory: ${JSON.stringify(categories.map(([key, cn_text]) => ({ key, cn_text, showInNav: true, adminOnly: false })))} };`;

function shell(title, main, { dark = false, navMode = "link", leftNav: withLeftNav = true, postData, standalone = false } = {}) {
	const leftNav = withLeftNav ? leftNavHtml(navMode) : "";
	return `<!doctype html><html data-server-rendered="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style>
<script>${config}${postData ? `window.__config__.postData = ${JSON.stringify(postData)};` : ""}</script></head>
<body class="bg1 ${dark ? "dark-layout" : "light-layout"}">
<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><symbol id="star" viewBox="0 0 48 48" fill="none"><path stroke-linejoin="round" stroke-width="4" stroke="currentColor" d="m23.999 5-6.113 12.478L4 19.49l10.059 9.834L11.654 43 24 36.42 36.345 43 33.96 29.325 44 19.491l-13.809-2.013L24 5Z"></path></symbol></svg>
${header}
<section id="nsk-frame">${standalone ? main : `<div id="nsk-frame-block"></div><div id="nsk-body" class="nsk-container">${leftNav}${main}</div><div id="nsk-frame-block"></div>`}</section>
<div id="fast-nav-button-group"><div id="back-to-top" class="nav-item-btn" style="display: none;">${iconpark("up")}</div> <div id="back-to-bottom" class="nav-item-btn" style="display: flex;">${iconpark("down")}</div></div>
<footer><div class="contain"><div class="col"><div class="group-head-link">相关网站</div><ul><a href="https://example.org"><li>LowEndTalk</li></a></ul></div><div class="col"><div class="group-head-link">站内导航</div><ul><a href="/about"><li>关于本站</li></a></ul></div></div></footer>
</body></html>`;
}

const members = ["泡泡mercy", "vader", "weseeker", "cwavguy", "NewYork", "Luna10", "dogixhgeyk", "elankey"];
// 右侧栏：用户卡片与发帖按钮是登录后的结构（未知，按常见写法模拟）；快捷功能区与欢迎新用户照真实结构。
const sidebar = `<div id="nsk-right-panel-container">
<div class="user-card"><div class="user-head"><a href="/space/1"><img class="avatar-normal" src="${AVATAR}" alt="tester"></a><div class="menu"><a class="Username" href="/space/1">tester</a><div class="user-actions"><a href="/board" title="签到">${ICON}</a><a href="/setting" title="设置">${ICON}</a><a href="/logout" title="退出">${ICON}</a></div></div></div>
<div class="user-stat"><div class="stat-block"><div>${ICON}<span>等级 Lv 6</span></div><div>${ICON}<span>鸡腿 4132</span></div><a href="/notification#/message?mode=list">${ICON}<span>私信 </span><span class="notify-count">1</span></a></div><div class="stat-block"><div>${ICON}<span>主题帖 221</span></div><div>${ICON}<span>评论数 3945</span></div><a href="/notification#/atMe">${ICON}<span>@我 </span><span class="notify-count">5</span></a></div></div></div>
<a class="btn-post" href="/new-discussion">+ 发帖</a>
<div class="nsk-panel quick-access"><h4 aria-level="2">${iconpark("rocket-one")} <span>快捷功能区</span></h4> <ul role="nav"><li><a href="/award">${iconpark("diamonds")} <span>推荐阅读</span></a></li> <li><a href="/ruling">${iconpark("balance-two")} <span>管理记录</span></a></li> <li><a href="/lucky">${iconpark("optimize")} <span>幸运抽奖</span></a></li></ul></div>
<div class=""></div> <div class="nsk-panel"><h4 aria-level="2">📈用户数目📈</h4> <div style="padding: 5px 20px;"> 目前论坛共有72254位seeker </div> <h4 aria-level="2">🎉欢迎新用户🎉</h4> <div class="nsk-new-member-board">${members.map((name, index) => `${index === 4 ? `<div style="width:100%;margin:5px 0"></div>` : ""}<a href="/space/${200 + index}" class="new-member-item"><img src="${AVATAR}" alt="${name}" class="avatar-normal"> <div title="${name}"> ${name} </div></a>`).join("")}</div></div>
</div>`;

const titles = ["出一台香港 CN2 GIA 小鸡，年付 99", "求推荐稳定的美西 VPS", "分享一个 Docker 一键部署脚本", "今天的 NodeSeek 签到抽奖结果", "Cloudflare Tunnel 踩坑记录", "【收】日本原生 IP 机器"];
const listItems = (count = titles.length) => Array.from({length:count},(_,i)=>titles[i%titles.length]).map((title, index) => `<li class="post-list-item"><a href="/space/${10 + index}"><img src="${AVATAR}" alt="user${index}" data-uid="${10 + index}" class="avatar-normal"></a> <div class="post-list-content"><div role="heading" aria-level="3" class="post-title"><a href="/post-${1000 + index}-1"${index === 1 ? ' class="nspp-read"' : ""} target="">${title}</a> <!----> <!----></div> <div class="post-info"><span class="info-item info-author">${iconpark("user")} <a href="/space/${10 + index}">user${index}</a></span> <span class="info-item info-views">${iconpark("eyes")} <span title="${120 + index * 7} views">${120 + index * 7}</span></span> <span title="${index * 3} comments" class="info-item info-comments-count">${iconpark("comments")} <span title="${index * 3 + 1} comments">${index * 3}</span></span> <span class="info-item info-last-commenter">${iconpark("lightning")} <a href="/space/${20 + index}">replier${index}</a></span> <a href="/post-${1000 + index}-1#${index * 3}" class="info-item info-last-comment-time"><time title="2026-10-03 12:0${index}:00" datetime="2026-10-03T04:0${index}:00.000Z">${index + 1} 分钟前</time></a> <a href="/categories/${categories[index % 5][0]}" class="info-item post-category"> ${categories[index % 5][1]} </a></div></div></li>`).join("");

// 分页：默认照真实结构（上一页是 span 里的三角、当前页是 span.pager-pos.pager-cur、最后一页前有省略号）；
// pagerMode: "wrapped" 时用多层包裹、当前页标记不规范的写法，两种都要能识别。
const pagerHtml = (mode, page = 1, last = 100) => mode === "wrapped"
	? `<span class="pager-prev"><div class="triangle-left"></div></span><span class="pager-group"><a class="pager-pos active" href="/page-1">1</a><a class="pager-pos active" href="/page-2">2</a><a class="pager-pos active" href="/page-3">3</a></span><span class="pager-more"><span>..</span><a class="pager-pos" href="/page-${last}"><span>${last}</span></a></span><a class="pager-next" href="/page-2"><div class="triangle-right"></div></a>`
	: `<div role="navigation" aria-label="pagination"><span aria-disabled="true" class="pager-prev"><div class="triangle-left"></div></span> <!----> <span href="/page-${page}" aria-label="page${page}" aria-current="page" class="pager-pos pager-cur">${page}</span><a href="/page-2" aria-label="page2" aria-current="page" class="pager-pos">2</a><a href="/page-3" aria-label="page3" aria-current="page" class="pager-pos">3</a> <a href="/page-${last}" class="pager-pos"><span class="ellipsis">..</span>${last}</a> <a href="/page-2" rel="next" class="pager-next"><div class="triangle-right"></div></a></div>`;
const controller = (mode) => `<div class="post-list-controler"><div class="sorter"><a data-sort="replyTime" class="selected">新评论</a><a data-sort="postTime">新帖子</a></div> <div class="nsk-pager pager-top">${pagerHtml(mode)}</div></div>`;
const listPage = (options = {}) => shell("NodeSeek", `<div id="nsk-body-left">${controller(options.pagerMode)} <ul class="post-list">${listItems(options.count)}</ul> <div style="padding: 2px 0;display: flex;justify-content: flex-end;"><div class="nsk-pager pager-bottom">${pagerHtml(options.pagerMode)}</div></div> <div id="nsk-body-left-block"></div></div>${sidebar}`, options);

const content = `<h2>配置说明</h2><p>这是一段正文，包含 <a href="/jump?to=https%3A%2F%2Fexample.com%2Fdocs">外部链接</a> 和 <code>inline code</code>。</p>
<blockquote><p>引用别人的楼层内容。</p></blockquote>
<pre><code class="language-bash">curl -fsSL https://example.com/install.sh | bash</code></pre>
<table><thead><tr><th>套餐</th><th>价格</th></tr></thead><tbody><tr><td>1C1G</td><td>¥99/年</td></tr><tr><td>2C2G</td><td>¥199/年</td></tr></tbody></table>`;

const menuItems = (items) => items.map(([title, icon, count]) => `<div class="menu-item" title="${title}">${iconpark(icon)}<span>${count}</span></div>`).join("");
// 楼层：照真实结构，头像在 .avatar-wrapper 里，名字与身份在 .author-info，时间在 .content-info，楼号在 .floor-link-wrapper
const entry = (tag, floor, uid, name, body, { op = false, extra = "" } = {}) => `<${tag} class="content-item" id="${floor}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><a href="/space/${uid}"><img src="${AVATAR}" alt="${name}" data-uid="${uid}" class="avatar-normal"></a></div> <div><div class="author-info"><a href="/space/${uid}" class="author-name">${name}</a>${op ? `<span class="is-poster role-tag nsk-badge">楼主</span>` : ""}<span class="role-tag">Lv ${floor % 5 + 1}</span></div> <div class="content-info"><span class="date-created"><time title="2026-10-03 12:00:00" datetime="2026-10-03T04:00:00.000Z">${floor + 1}h ago</time></span>${op ? ` <span class="content-category"> in <a href="/categories/trade">交易</a></span>` : ""}</div></div> <div class="floor-link-wrapper"><a href="#${floor}" class="floor-link">#${floor}</a></div></div> <article class="post-content">${body}</article>${extra} <div class="topic-warning"></div> <div class="comment-menu">${menuItems(op ? [["点赞", "good-one", "12"], ["加鸡腿", "chicken-leg", "3"], ["反对", "bad-one", "0"], ["收藏", "star", "5"]] : [["点赞", "good-one", "1"], ["加鸡腿", "chicken-leg", "0"], ["反对", "bad-one", "0"], ["引用", "quote", ""], ["回复", "back", ""]])}</div></${tag}>`;
const comment = (floor, uid, name, text) => entry("li", floor, uid, name, `<p>${text}</p>`);

const EDITOR_TOOLS = [["text-bold", "加粗"], ["text-italic", "斜体"], ["strikethrough", "删除线"], ["h", "标题"], ["list-two", "无序列表"], ["ordered-list", "有序列表"], ["quote", "引用"], ["link-one", "链接"], ["pic", "图片"], ["code", "代码"], ["table-file", "表格"], ["minus", "分割线"], ["undo", "撤销"], ["redo", "重做"], ["clear-format", "清空"]];
// 编辑器（登录后才有，真实结构未知）：工具按钮之间有分组竖线（空元素），工具栏右侧是「支持markdown语法」提示和几个纯图标按钮。
// editorMode: "wrapped" 时「内容 / 预览 / 对照」标签与工具栏包在同一个容器里、标签行右侧带图标按钮，两种都要能排好。
const SPLIT_AFTER = new Set(["h", "quote", "code", "minus"]);
const toolIcon = (name, title) => `<span class="toolbar-item i-icon i-icon-${name}" title="${title}"><svg viewBox="0 0 48 48" width="16" height="16"><rect x="10" y="10" width="28" height="28" fill="currentColor"/></svg></span>`;
const toolButtons = EDITOR_TOOLS.map(([name, title]) => toolIcon(name, title) + (SPLIT_AFTER.has(name) ? `<span class="toolbar-split"></span>` : "")).join("");
const asideIcons = [["list-numbers", "目录"], ["toolkit", "工具箱"], ["full-screen", "全屏"]].map(([name, title]) => `<span class="i-icon i-icon-${name}" title="${title}"><svg viewBox="0 0 48 48" width="16" height="16"><circle cx="24" cy="24" r="14" fill="currentColor"/></svg></span>`).join("");
const editorTabs = `<span class="tab active">内容</span><span class="tab">预览</span><span class="tab">对照</span>`;
const editorRest = `<textarea placeholder="说点什么…" aria-label="回复内容"></textarea><div class="expression"><div class="exp-item current-group">AC娘</div><div class="exp-item">洋葱头</div><div class="exp-item">小黄鸡</div></div><div class="exp-container"><!----></div><div class="submit-row" style="padding:8px;text-align:right"><button class="submit btn">发布评论</button></div></div>`;
const editorFor = (mode) => mode === "native"
  ? `<div class="md-editor"><div id="editor-body"><div class="tab-select window_header"><div style="display:flex"><div class="tab-option tab-option-item-0" style="border-bottom:3px solid black">内容</div><div class="tab-option tab-option-item-1">预览</div><div class="tab-option tab-option-item-2">对照</div></div><div style="margin-left:auto">支持<a href="#">markdown语法</a></div>${asideIcons}</div><div class="mde-toolbar">${toolButtons}</div>${editorRest}</div>`
  : mode === "wrapped"
	? `<div class="md-editor"><div class="editor-head"><div class="tab-bar">${editorTabs}<div class="tab-aside"><span>支持markdown语法</span>${asideIcons}</div></div><div class="mde-toolbar">${toolButtons}</div></div>${editorRest}`
	: `<div class="md-editor"><div class="tab-select">${editorTabs}</div><div class="mde-toolbar">${toolButtons}<span class="toolbar-item right">支持markdown语法</span>${asideIcons}</div>${editorRest}`;
const editor = editorFor();
const codeMirrorEditor = `<div class="md-editor"><div id="editor-body"><div class="tab-select window_header"><div class="tab-option">内容</div><div class="tab-option">预览</div></div><div class="mde-toolbar">${toolButtons}</div><div class="vue-codemirror"><div class="CodeMirror"><div style="overflow:hidden;position:relative;width:3px;height:0"><textarea style="position:absolute;bottom:-1em;padding:0;width:1000px;height:1em;min-height:1em"></textarea></div><div class="CodeMirror-scroll"><div class="CodeMirror-lines"><div class="CodeMirror-code" contenteditable="true" role="textbox" aria-label="CodeMirror 回复">鼓励友善发言，禁止人身攻击</div></div></div></div></div><div class="expression"><div class="exp-item">AC娘</div></div></div><div class="topic-select"><div></div><button class="submit btn">发布评论</button></div></div>`;
const postData = { category: "trade", categoryWord: "交易", categoryLink: "/categories/trade", postId: 1000, postPage: 1, title: "出一台香港 CN2 GIA 小鸡，年付 99", views: "1234", postPageCount: 1, collectionCount: 5 };
const signature = `<div class="signature">签名：机器不跑路 <a href="https://example.com/x" style="color:#2ea44f">Xmanager</a> | <span style="color:#3fb950">Xshell</span></div>`;
const postPage = (options = {}) => shell("出一台香港 CN2 GIA 小鸡 - NodeSeek", `<div id="nsk-body-left"><div class="nsk-post-wrapper"><div class="nsk-post"><div class="post-title"><h1><a href="/post-1000-1" class="post-title-link nspp-read">出一台香港 CN2 GIA 小鸡，年付 99</a></h1></div> ${entry("div", 0, 10, "seller", content, { op: true, extra: signature })}</div> <div class="comment-container"><div><div class="nsk-pager post-top-pager">${pagerHtml(undefined, 1, 3)}</div></div> <ul class="comments">${comment(1, 11, "buyer", "收了，私信你")}${comment(2, 12, "passerby", "价格不错，帮顶")}${comment(3, 13, "curious", "线路怎么样？晚高峰丢包吗？")}</ul> <div><div class="nsk-pager post-bottom-pager">${pagerHtml(undefined, 1, 3)}</div></div></div>
${options.editorMode === "codemirror" ? codeMirrorEditor : editorFor(options.editorMode || "native")}
</div></div>${sidebar}`, { ...options, postData });

const notificationPage = (options = {}) => shell("通知 - NodeSeek", `<div id="nsk-body-left"><div class="nsk-notification">
<div class="app-switch"><a class="app-title router-link-exact-active router-link-active" href="#/atMe">@我</a><a class="app-title" href="#/reply">回复主题</a><a class="app-title" href="#/message?mode=list">私信 1</a></div>
<div><button>全部标为已读</button><div class="reply-container">
<div class="reply-item"><div style="position:relative"><img class="avatar" src="${AVATAR}" alt="头像"><div class="unviewed"></div></div><div style="flex:1"><a href="/space/42">spammer</a> 在帖子 <a href="/post-2001-1">某帖</a> 中@了我 <span>2026/10/3 17:43:53</span></div><div><div>${iconpark("check")}</div></div></div>
<div class="reply-item"><div style="position:relative"><img class="avatar" src="${AVATAR}" alt="头像"></div><div style="flex:1"><a href="/space/7">friend</a> 回复了主题 <a href="/post-2002-1">另一帖</a> <span>2026/10/3 17:40:00</span></div><div><div>${iconpark("check")}</div></div></div>
</div></div></div></div>${sidebar}`, options);

const nativeTabs = `<div class="app-switch"><a class="app-title" href="#/atMe"><span>@我</span><span class="unread-count">1</span></a><a class="app-title" href="#/reply"><span>回复主题</span></a><a class="app-title router-link-active" href="#/message?mode=list"><span>私信</span><span class="unread-count">1</span></a></div>`;
const nativeMessagePage = (options = {}) => shell("NodeSeek Message", `<div class="nsk-container container nsk-notification" data-v-9b5d0f04>${nativeTabs}<div style="position:relative;background-color:rgb(73,73,73)" data-v-40fbaa7e><div style="text-align:right;padding:5px;position:absolute;top:-36px;right:0"><button class="btn">全部标为已读</button></div><div class="talk-list">${Array.from({length:12},(_,i)=>`<a href="#/message?mode=talk&to=${i+10}"><div class="talk-item"><div style="position:relative"><img class="avatar" src="${AVATAR}" alt="头像"><div class="unviewed"></div></div><div class="middle"><div class="name">用户 ${i+1}</div><div class="content">测试私信内容，长标题不会与时间重叠。</div></div><div class="right"><div>2026/10/4 21:56:09</div></div></div></a>`).join("")}</div></div></div>`,{...options,standalone:true});
const nativeTalkPage = (options = {}) => shell("NodeSeek Message", `<div class="nsk-container container nsk-notification" data-v-9b5d0f04>${nativeTabs}<div style="position:relative;background-color:rgb(73,73,73)" data-v-40fbaa7e><div style="text-align:right;padding:5px;position:absolute;top:-36px;right:0"><button class="btn">全部标为已读</button></div><div class="app-switch"><div class="app-title" style="flex:1">用户 1 的对话</div><a href="#/message?mode=list">返回</a></div><div class="message-wrapper"><div class="message-item"><a href="/space/10" style="order:0"><img class="avatar" src="${AVATAR}" alt="头像"></a><div class="content-column" style="text-align:left"><div class="content markdown-content post-content"><p>私信内容</p><img src="${AVATAR}" style="width:1600px;height:600px" alt="测试图片"></div><div class="msg-time">2026/10/4 21:56:09</div></div><div class="avatar-blank" style="order:2"></div></div></div><div class="message-input"><textarea class="input-area" aria-label="私信内容"></textarea><div class="input-area" style="display:none"><div class="mde-toolbar" style="background-color:var(--bg-sub-color)">${toolButtons}</div><div class="cm-wrapper"><div class="CodeMirror"></div></div></div><div style="display:flex;justify-content:space-between;padding:0 15px;align-items:center;height:40px"><span style="color:var(--bg-main-color)">Markdown</span><label class="vue-js-switch toggled" style="margin:0 auto 0 10px"><input class="v-switch-input" type="checkbox"><div class="v-switch-core" style="width:50px;height:22px;background-color:rgb(76,175,80);border-radius:11px"></div><span class="v-switch-label">On</span></label><button class="btn">发送</button></div></div></div></div>`,{...options,standalone:true});

// 消息中心页：原生通知页的「@我 / 回复主题 / 私信」标签，NodeSeek++ 紧凑消息中心据此找到容器并接管（私信与通知都在里面）。
const messageCenterPage = (options) => shell("通知 - NodeSeek", `<div id="nsk-body-left"><div class="nsk-panel notification-panel">
<div class="tabs"><a href="/notification#/atMe">@我</a><a href="/notification#/reply">回复主题</a><a href="/notification#/message?mode=list">私信</a></div>
<div class="notification-content"><img src="${AVATAR}" alt=""><span>正在加载…</span></div>
</div></div>${sidebar}`, { ...options, leftNav: false });

// 设置页：按真实 NodeSeek 当前结构模拟（.user-setting-panel、用户头部、侧边导航和表单内容）。
const settingPage = (options = {}) => shell("设置 - NodeSeek", `<div id="nsk-body-left"><div id="user-setting-panel">
<div class="head-container"><div class="avatar-wrapper"><img class="avatar" src="${AVATAR}" alt="avatar of user"><svg class="setting-icon"></svg></div><div class="word"><h1 class="username">tester</h1></div></div>
<div class="selector"><div class="selector-left-side"><div class="selector-item-wrapper"><a href="#introduction" class="select-item selected">个人信息</a><a href="#security" class="select-item">安全</a><a href="#2fa" class="select-item">双因素验证</a><a href="#contact" class="select-item">联系方式</a><a href="#block" class="select-item">屏蔽用户</a><a href="#preference" class="select-item">常用偏好</a><a href="#homepage" class="select-item">首页版块</a><a href="#extend" class="select-item">论坛扩展</a></div><div class="expend-left"></div></div>
<div class="selector-right-side"><form class="personal-info"><fieldset><h2>头像</h2><div class="set-avatar"><img class="avatar" src="${AVATAR}" alt="avatar"><a class="btn">设置头像</a></div></fieldset><fieldset><h2>Bio</h2><input type="text" placeholder="请用一句话介绍自己"></fieldset><fieldset><h2>签名</h2><textarea placeholder="帖子内容下显示；支持markdown"></textarea></fieldset><fieldset><h2>Readme</h2><textarea placeholder="用户主页中显示；支持markdown"></textarea></fieldset><div style="text-align:right"><button class="btn">确定</button></div></form></div></div>
</div></div>${sidebar}`, options);

// 发帖页：真实结构未知，这里用常见写法（标题输入框、分类下拉框、与评论框同一个编辑器、「发布帖子」按钮）。
const newPostPage = (options) => shell("发帖 - NodeSeek", `<div id="nsk-body-left"><div class="nsk-panel new-discussion">
<div class="title-row"><input type="text" class="post-title-input" placeholder="标题（最多 80 字）" maxlength="80"></div>
<div class="category-row"><select class="category-select">${categories.slice(0, 7).map(([slug, name]) => `<option value="${slug}">${name}</option>`).join("")}</select></div>
${editor.replace("说点什么…", "正文，支持 Markdown").replace("发布评论", "发布帖子")}
</div></div>${sidebar}`, options);

module.exports = {
	newPostPage,
	listPage,
	postPage,
	notificationPage,
	nativeMessagePage,
	nativeTalkPage,
	messageCenterPage,
	settingPage
};
