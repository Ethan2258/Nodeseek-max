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

function shell(title, main, { dark = false, navMode = "link" } = {}) {
	const leftNav = leftNavHtml(navMode);
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style>
<script>window.__config__ = { user: { member_id: 1, member_name: "tester" } };</script></head>
<body class="${dark ? "dark-layout" : ""}">
<div id="nsk-head"><div class="nsk-container"><a class="site-logo" href="/">NodeSeek</a>${headerCategories}</div></div>
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

const listPage = (options) => shell("NodeSeek", `<div id="nsk-left"><div class="list-head"><span>新评论 | 新帖子</span></div><ul class="post-list">${listItems}</ul><div class="nsk-pager"><span class="pager-cur">1</span><a class="pager-pos" href="/page-2">2</a><a class="pager-next" href="/page-2">下一页</a></div></div>${sidebar}`, options);

const content = `<h2>配置说明</h2><p>这是一段正文，包含 <a href="/jump?to=https%3A%2F%2Fexample.com%2Fdocs">外部链接</a> 和 <code>inline code</code>。</p>
<blockquote><p>引用别人的楼层内容。</p></blockquote>
<pre><code class="language-bash">curl -fsSL https://example.com/install.sh | bash</code></pre>
<table><thead><tr><th>套餐</th><th>价格</th></tr></thead><tbody><tr><td>1C1G</td><td>¥99/年</td></tr><tr><td>2C2G</td><td>¥199/年</td></tr></tbody></table>`;

const comment = (floor, uid, name, text) => `<li class="content-item" id="${floor}"><div class="nsk-content-meta-info"><a href="/space/${uid}"><img class="avatar-normal" src="${AVATAR}" alt="${name}"></a><div class="author-info"><a href="/space/${uid}">${name}</a> <span class="role-tag">Lv ${floor % 5 + 1}</span></div><span style="margin-left:auto"><a class="floor-link" href="#${floor}">#${floor}</a></span></div>
<article class="post-content"><p>${text}</p></article><div class="comment-menu"><div class="menu-item" title="引用">引用</div><div class="menu-item" title="回复">回复</div></div></li>`;

const postPage = (options) => shell("出一台香港 CN2 GIA 小鸡 - NodeSeek", `<div id="nsk-left"><div class="nsk-post-wrapper"><div class="post-title"><h1><a class="nspp-read" href="/post-1000-1">出一台香港 CN2 GIA 小鸡，年付 99</a></h1></div>
<div class="nsk-post"><div class="nsk-content-meta-info"><a href="/space/10"><img class="avatar-normal" src="${AVATAR}" alt="seller"></a><div class="author-info"><a href="/space/10">seller</a></div><span style="margin-left:auto"><a class="floor-link" href="#0">#0</a></span></div>
<article class="post-content">${content}</article><div class="signature">签名：机器不跑路</div></div>
<ul class="comments">${comment(1, 11, "buyer", "收了，私信你")}${comment(2, 12, "passerby", "价格不错，帮顶")}${comment(3, 13, "curious", "线路怎么样？晚高峰丢包吗？")}</ul>
<div class="md-editor"><div class="mde-toolbar"><span class="toolbar-item">B</span><span class="toolbar-item">I</span><span class="toolbar-item">链接</span><span class="toolbar-item right">预览</span></div><textarea placeholder="说点什么…"></textarea><div style="padding:8px;text-align:right"><button class="submit btn">发布评论</button></div></div>
</div></div>${sidebar}`, options);

const notificationPage = (options) => shell("通知 - NodeSeek", `<div id="nsk-left"><ul class="notification-list">
<li class="notification-item"><a href="/space/42">spammer</a> 在 <a href="/post-2001-1">某帖</a> 中 @了你</li>
<li class="notification-item"><a href="/space/7">friend</a> 回复了你的主题 <a href="/post-2002-1">另一帖</a></li>
<li class="notification-item"><a href="/notification#/message?mode=talk&to=42">来自 spammer 的私信</a></li>
</ul></div>${sidebar}`, options);

module.exports = {
	listPage,
	postPage,
	notificationPage
};
