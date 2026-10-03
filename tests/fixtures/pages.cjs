"use strict";
// 模拟 NodeSeek 页面结构（类名取自站点与 NodeSeek++ 使用的选择器），仅供冒烟测试与截图。
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "site.css"), "utf8");
const AVATAR = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='#9aa5b1'/></svg>");

const categories = [["daily", "日常"], ["tech", "技术"], ["info", "情报"], ["review", "测评"], ["trade", "交易"], ["carpool", "拼车"], ["promotion", "推广"], ["life", "生活"], ["dev", "Dev"], ["photo-share", "贴图"], ["expose", "曝光"], ["inside", "内版"], ["sandbox", "沙盒"]];
const ICON = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'><circle cx='12' cy='12' r='8'/></svg>";
const headerCategories = categories.slice(0, 7).map(([slug, name]) => `<a href="/categories/${slug}">${name}</a>`).join("") + `<a href="https://www.deepflood.com/">DeepFlood</a>`;
// 默认导航条目是链接；navMode: "div" 时条目是不带链接的 div（站点真实结构未知，两种都要能识别）。
const leftNavHtml = (mode) => `<div id="nsk-left-panel-container"><div class="nsk-panel"><div class="category-list">${categories.map(([slug, name]) => mode === "div" ? `<div class="nav-item" data-to="/categories/${slug}">${ICON}<span>${name}</span></div>` : `<div class="nav-item"><a href="/categories/${slug}">${ICON}<span>${name}</span></a></div>`).join("")}</div></div></div>`;

function shell(title, main, { dark = false, navMode = "link", leftNav: withLeftNav = true } = {}) {
	const leftNav = withLeftNav ? leftNavHtml(navMode) : "";
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style>
<script>window.__config__ = { user: { member_id: 1, member_name: "tester" } };</script></head>
<body class="bg1${dark ? " dark-layout" : ""}">
<div id="nsk-head"><div class="nsk-container"><a class="site-logo" href="/"><img src="${AVATAR}" width="24" height="24" alt="">NodeSeek</a><sup class="beta">beta</sup>${headerCategories}<div class="header-right"><div class="search-box"><input type="text" id="search-site2" name="q" placeholder="搜索 ( / 或 ctrl + / )"><svg class="search-icon" viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor"/></svg></div><span class="tool-btn"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg></span></div></div></div>
<div id="nsk-body" class="nsk-container">${leftNav}${main}</div>
</body></html>`;
}

const sidebar = `<div id="nsk-right-panel-container">
<div class="nsk-panel user-card"><div class="user-head"><a href="/space/1"><img class="avatar-normal" src="${AVATAR}" alt="tester"></a><div><a class="user-name" href="/space/1">tester</a><div class="user-actions"><a href="/board" title="签到">${ICON}</a><a href="/setting" title="设置">${ICON}</a><a href="/logout" title="退出">${ICON}</a></div></div></div>
<div class="user-stat"><div class="stat-block"><div>${ICON}<span>等级 Lv 6</span></div><div>${ICON}<span>鸡腿 4132</span></div><a href="/notification#/message?mode=list">${ICON}<span>私信 </span><span class="notify-count">1</span></a></div><div class="stat-block"><div>${ICON}<span>主题帖 221</span></div><div>${ICON}<span>评论数 3945</span></div><a href="/notification#/atMe">${ICON}<span>@我 </span><span class="notify-count">5</span></a></div></div></div>
<a class="btn-post" href="/new-discussion">+ 发帖</a>
<div class="nsk-panel nsk-new-member-board"><div class="board-title">🎉 欢迎新用户 🎉</div><div class="member-row">${["泡泡mercy", "vader", "weseeker"].map((name, index) => `<div class="member"><a href="/space/${200 + index}"><img src="${AVATAR}" alt=""></a><span>${name}</span></div>`).join("")}</div><div class="member-row">${["cwavguy", "NewYork", "Luna10"].map((name, index) => `<div class="member"><a href="/space/${210 + index}"><img src="${AVATAR}" alt=""></a><span>${name}</span></div>`).join("")}</div></div>
<div class="nsk-panel quick-access"><strong>快捷入口</strong><div><a href="/notification">通知</a> · <a href="/new-discussion">发帖</a></div></div>
</div>`;

const titles = ["出一台香港 CN2 GIA 小鸡，年付 99", "求推荐稳定的美西 VPS", "分享一个 Docker 一键部署脚本", "今天的 NodeSeek 签到抽奖结果", "Cloudflare Tunnel 踩坑记录", "【收】日本原生 IP 机器"];
const listItems = titles.map((title, index) => `<li class="post-list-item"><a href="/space/${10 + index}"><img class="avatar-normal" src="${AVATAR}" alt="user${index}"></a>
<div class="post-list-content"><div class="post-title"><a href="/post-${1000 + index}-1"${index === 1 ? ' class="nspp-read"' : ""}>${title}</a></div>
<div class="post-info"><a class="info-item info-author" href="/space/${10 + index}">user${index}</a><span class="info-item info-views">${120 + index * 7} 浏览</span><span class="info-item info-comments-count">${index * 3} 回复</span><span class="info-item info-last-comment-time">${index + 1} 分钟前</span></div></div><a class="post-category" href="/categories/${categories[index % 5][0]}">${categories[index % 5][1]}</a></li>`).join("");

// 列表顶部：排序切换与顶部分页（真实结构未知；pagerMode: "wrapped" 时用多层包裹、全是 span 的写法，两种都要能识别）。
const ARROW = (d) => `<svg viewBox="0 0 24 24" width="14" height="14"><path d="${d}" fill="currentColor"/></svg>`;
const topPager = (mode) => mode === "wrapped"
	? `<div class="nsk-pager pager-top"><span class="pager-prev">${ARROW("M15 5 7 12l8 7z")}</span><span class="pager-group"><a class="pager-pos active" href="/page-1">1</a><a class="pager-pos active" href="/page-2">2</a><a class="pager-pos active" href="/page-3">3</a></span><span class="pager-more"><span>..</span><a class="pager-pos" href="/page-100"><span>100</span></a></span><a class="pager-next" href="/page-2">${ARROW("M9 5l8 7-8 7z")}</a></div>`
	: `<div class="nsk-pager pager-top"><a class="pager-prev" href="/page-1">${ARROW("M15 5 7 12l8 7z")}</a><a class="pager-pos pager-cur" href="/page-1">1</a><a class="pager-pos" href="/page-2">2</a><a class="pager-pos" href="/page-3">3</a><span class="pager-pos">..</span><a class="pager-pos" href="/page-100">100</a><a class="pager-next" href="/page-2">${ARROW("M9 5l8 7-8 7z")}</a></div>`;
const listHead = (mode) => `<div class="list-head"><div class="post-sort"><a class="sort-item" href="/">新评论</a><span class="sort-split">|</span><a class="sort-item" href="/?sortBy=postTime">新帖子</a></div>${topPager(mode)}</div>`;
const listPage = (options = {}) => shell("NodeSeek", `<div id="nsk-left">${listHead(options.pagerMode)}<ul class="post-list">${listItems}</ul><div class="nsk-pager"><span class="pager-cur">1</span><a class="pager-pos" href="/page-2">2</a><a class="pager-next" href="/page-2">下一页</a></div></div>${sidebar}`, options);

const content = `<h2>配置说明</h2><p>这是一段正文，包含 <a href="/jump?to=https%3A%2F%2Fexample.com%2Fdocs">外部链接</a> 和 <code>inline code</code>。</p>
<blockquote><p>引用别人的楼层内容。</p></blockquote>
<pre><code class="language-bash">curl -fsSL https://example.com/install.sh | bash</code></pre>
<table><thead><tr><th>套餐</th><th>价格</th></tr></thead><tbody><tr><td>1C1G</td><td>¥99/年</td></tr><tr><td>2C2G</td><td>¥199/年</td></tr></tbody></table>`;

const comment = (floor, uid, name, text) => `<li class="content-item" id="${floor}"><div class="nsk-content-meta-info"><a href="/space/${uid}"><img class="avatar-normal" src="${AVATAR}" alt="${name}"></a><div class="author-info"><a href="/space/${uid}">${name}</a> <span class="role-tag">Lv ${floor % 5 + 1}</span></div><span style="margin-left:auto"><a class="floor-link" href="#${floor}">#${floor}</a></span></div>
<article class="post-content"><p>${text}</p></article><div class="comment-menu"><div class="menu-item" title="引用">引用</div><div class="menu-item" title="回复">回复</div></div></li>`;

const EDITOR_TOOLS = [["text-bold", "加粗"], ["text-italic", "斜体"], ["strikethrough", "删除线"], ["h", "标题"], ["list-two", "无序列表"], ["ordered-list", "有序列表"], ["quote", "引用"], ["link-one", "链接"], ["pic", "图片"], ["code", "代码"], ["table-file", "表格"], ["minus", "分割线"], ["undo", "撤销"], ["redo", "重做"], ["clear-format", "清空"]];
// 编辑器：工具按钮之间有分组竖线（空元素），工具栏右侧是「支持markdown语法」提示和几个纯图标按钮。
// editorMode: "wrapped" 时「内容 / 预览 / 对照」标签与工具栏包在同一个容器里、标签行右侧带图标按钮（站点真实结构未知，两种都要能排好）。
const SPLIT_AFTER = new Set(["h", "quote", "code", "minus"]);
const toolIcon = (name, title) => `<span class="toolbar-item i-icon i-icon-${name}" title="${title}"><svg viewBox="0 0 48 48" width="16" height="16"><rect x="10" y="10" width="28" height="28" fill="currentColor"/></svg></span>`;
const toolButtons = EDITOR_TOOLS.map(([name, title]) => toolIcon(name, title) + (SPLIT_AFTER.has(name) ? `<span class="toolbar-split"></span>` : "")).join("");
const asideIcons = [["list-numbers", "目录"], ["toolkit", "工具箱"], ["full-screen", "全屏"]].map(([name, title]) => `<span class="i-icon i-icon-${name}" title="${title}"><svg viewBox="0 0 48 48" width="16" height="16"><circle cx="24" cy="24" r="14" fill="currentColor"/></svg></span>`).join("");
const editorTabs = `<span class="tab active">内容</span><span class="tab">预览</span><span class="tab">对照</span>`;
const editorRest = `<textarea placeholder="说点什么…"></textarea><div class="expression"><div class="exp-item current-group">AC娘</div><div class="exp-item">洋葱头</div><div class="exp-item">小黄鸡</div></div><div class="exp-container"><!----></div><div class="submit-row" style="padding:8px;text-align:right"><button class="submit btn">发布评论</button></div></div>`;
const editorFor = (mode) => mode === "wrapped"
	? `<div class="md-editor"><div class="editor-head"><div class="tab-bar">${editorTabs}<div class="tab-aside"><span>支持markdown语法</span>${asideIcons}</div></div><div class="mde-toolbar">${toolButtons}</div></div>${editorRest}`
	: `<div class="md-editor"><div class="tab-select">${editorTabs}</div><div class="mde-toolbar">${toolButtons}<span class="toolbar-item right">支持markdown语法</span>${asideIcons}</div>${editorRest}`;
const editor = editorFor();
const postPage = (options) => shell("出一台香港 CN2 GIA 小鸡 - NodeSeek", `<div id="nsk-left"><div class="nsk-post-wrapper"><div class="post-title"><h1><a class="nspp-read" href="/post-1000-1">出一台香港 CN2 GIA 小鸡，年付 99</a></h1></div>
<div class="nsk-post"><div class="nsk-content-meta-info"><a href="/space/10"><img class="avatar-normal" src="${AVATAR}" alt="seller"></a><div class="author-info"><a href="/space/10">seller</a></div><span style="margin-left:auto"><a class="floor-link" href="#0">#0</a></span></div>
<article class="post-content">${content}</article><div class="signature">签名：机器不跑路 <a href="https://example.com/x" style="color:#2ea44f">Xmanager</a> | <span style="color:#3fb950">Xshell</span></div><div class="comment-menu">${[["点赞", "good-one", "12"], ["加鸡腿", "chicken-leg", "3"], ["反对", "bad-one", "0"]].map(([title, icon, count]) => `<div class="menu-item" title="${title}"><svg class="iconpark-icon"><use href="#${icon}"></use></svg><span>${count}</span></div>`).join("")}<div class="menu-item" title="引用">引用</div><div class="menu-item" title="回复">回复</div></div></div>
<ul class="comments">${comment(1, 11, "buyer", "收了，私信你")}${comment(2, 12, "passerby", "价格不错，帮顶")}${comment(3, 13, "curious", "线路怎么样？晚高峰丢包吗？")}</ul>
${editorFor(options?.editorMode)}
</div></div>${sidebar}`, options);

const notificationPage = (options) => shell("通知 - NodeSeek", `<div id="nsk-left"><ul class="notification-list">
<li class="notification-item"><a href="/space/42">spammer</a> 在 <a href="/post-2001-1">某帖</a> 中 @了你</li>
<li class="notification-item"><a href="/space/7">friend</a> 回复了你的主题 <a href="/post-2002-1">另一帖</a></li>
<li class="notification-item"><a href="/notification#/message?mode=talk&to=42">来自 spammer 的私信</a></li>
</ul></div>${sidebar}`, options);

// 消息中心页：原生通知页的「@我 / 回复主题 / 私信」标签，NodeSeek++ 紧凑消息中心据此找到容器并接管（私信与通知都在里面）。
const messageCenterPage = (options) => shell("通知 - NodeSeek", `<div id="nsk-left"><div class="nsk-panel notification-panel">
<div class="tabs"><a href="/notification#/atMe">@我</a><a href="/notification#/reply">回复主题</a><a href="/notification#/message?mode=list">私信</a></div>
<div class="notification-content"><img src="${AVATAR}" alt=""><span>正在加载…</span></div>
</div></div>${sidebar}`, { ...options, leftNav: false });

// 设置页：真实结构未知，这里用常见的表单写法（hash 路由子导航、文本框、下拉框、复选框、提交按钮、表格）。
const settingPage = (options) => shell("设置 - NodeSeek", `<div id="nsk-left"><div class="nsk-panel setting-panel">
<nav class="setting-nav"><a href="#/profile" class="router-link-active">个人资料</a><a href="#/security">账号安全</a><a href="#/block">屏蔽列表</a></nav>
<form class="setting-form"><h2>个人资料</h2>
<label>签名<textarea name="signature" placeholder="一句话介绍自己"></textarea></label>
<label>邮箱<input type="email" name="email" value="tester@example.com"></label>
<label>主页可见范围<select name="visibility"><option>所有人</option><option>仅登录用户</option></select></label>
<label class="check"><input type="checkbox" name="public" checked> 公开我的回复记录</label>
<div class="actions"><button type="button" class="btn">取消</button><button type="submit" class="btn">保存</button></div></form>
<table><thead><tr><th>用户</th><th>屏蔽时间</th></tr></thead><tbody><tr><td>spammer</td><td>2026-09-01</td></tr></tbody></table>
</div></div>${sidebar}`, options);

// 发帖页：真实结构未知，这里用常见写法（标题输入框、分类下拉框、与评论框同一个编辑器、「发布帖子」按钮）。
const newPostPage = (options) => shell("发帖 - NodeSeek", `<div id="nsk-left"><div class="nsk-panel new-discussion">
<div class="title-row"><input type="text" class="post-title-input" placeholder="标题（最多 80 字）" maxlength="80"></div>
<div class="category-row"><select class="category-select">${categories.slice(0, 7).map(([slug, name]) => `<option value="${slug}">${name}</option>`).join("")}</select></div>
${editor.replace("说点什么…", "正文，支持 Markdown").replace("发布评论", "发布帖子")}
</div></div>${sidebar}`, options);

module.exports = {
	newPostPage,
	listPage,
	postPage,
	notificationPage,
	messageCenterPage,
	settingPage
};
