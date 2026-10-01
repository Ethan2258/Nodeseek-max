// 从 nodeseek-max.user.js 中的主题源码生成独立 CSS：
//   theme/nodeseek-max.css       纯 CSS，可用任意样式注入工具加载或自行修改
//   theme/nodeseek-max.user.css  Stylus 等扩展可直接安装的 UserCSS（支持自动更新）
// 用法：node scripts/build-css.mjs [--check]
//
// 脚本里的主题规则以 html[data-nsmax-theme] 开头，并用 html 上的属性表达设置项。
// 独立 CSS 没有脚本设置这些属性，所以这里按默认设置把属性条件解析掉：满足的条件替换为
// 等价优先级的 :root，不满足的规则直接丢弃；只能由脚本标记的元素改用站点自身的选择器，
// 无法映射的（阅读进度条、发帖按钮等）不输出。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const source = readFileSync(new URL("nodeseek-max.user.js", root), "utf8");
const version = source.match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
if (!version) throw new Error("未找到 @version");

// ---- 取出主题源码并求值 ---------------------------------------------------------
const start = source.indexOf("\tvar NSMAX_ACCENTS = {");
const end = source.indexOf("\tvar hot_sidebar_default = `");
if (start < 0 || end < 0 || end < start) throw new Error("未找到主题源码");
const context = {};
vm.runInNewContext(source.slice(start, end), context);
const themeCss = context.modern_theme_default;
const fonts = context.NSMAX_WEB_FONTS;
const latinRange = context.NSMAX_LATIN_RANGE;
if (typeof themeCss !== "string" || !Array.isArray(fonts)) throw new Error("主题源码求值失败");

// ---- 默认设置对应的 html 属性（与 applyThemeAttributes 一致）--------------------------
const defaults = source.match(/id: "modern-theme",[\s\S]*?defaults: (\{[\s\S]*?\n\t\t\})/)?.[1];
const options = vm.runInNewContext(`(${defaults})`);
const attributes = new Map([
	["data-nsmax-theme", ""],
	["data-nsmax-list", options.layout],
	["data-nsmax-radius", options.radius],
	["data-nsmax-density", options.density],
	["data-nsmax-font", options.font],
	["data-nsmax-size", options.fontSize],
	["data-nsmax-style", "flat"],
	["data-nsmax-accent", options.accent === "mono" ? "mono" : options.accent === "site" ? "site" : "color"]
]);
for (const [option, attribute] of [["grid", "data-nsmax-grid"], ["glassHeader", "data-nsmax-glass"], ["typography", "data-nsmax-type"], ["motion", "data-nsmax-motion"], ["scrollbar", "data-nsmax-scrollbar"]]) if (options[option]) attributes.set(attribute, "");
// 页面类型由脚本按网址设置：独立 CSS 中这些规则只会命中对应页面才有的元素，直接视为满足；
// 设置页的规则用的是通用表单选择器，放进独立 CSS 会影响所有页面，直接丢弃。
const runtimeAttributes = new Set(["data-nsmax-page"]);
const scriptOnlyPages = new Set(["setting"]);
// 只能由脚本标记的元素：能映射的换成站点选择器，其余规则丢弃。
const markers = new Map([
	["[data-nsmax-header]", "#nsk-head"],
	["[data-nsmax-stat]", ".user-stat"],
	["[data-nsmax-usercard]", ".user-card"]
]);
const unmappable = /\[data-nsmax-(?:cta|members|members-row|member|sticky|scrolled|sticky-header|sidenav|hidden|dup|booting)\b|#nsmax-progress|\.nsmax-/;

// ---- 极简 CSS 解析：规则块与 @media 等嵌套块 -----------------------------------------
function parseBlocks(css) {
	const blocks = [];
	let index = 0;
	while (index < css.length) {
		const open = css.indexOf("{", index);
		if (open < 0) break;
		const prelude = css.slice(index, open).trim();
		let depth = 1, cursor = open + 1;
		while (depth && cursor < css.length) {
			if (css[cursor] === "{") depth++;
			else if (css[cursor] === "}") depth--;
			cursor++;
		}
		const body = css.slice(open + 1, cursor - 1);
		blocks.push(/^@(media|supports|layer)\b/.test(prelude) ? { prelude, children: parseBlocks(body) } : { prelude, body: body.trim() });
		index = cursor;
	}
	return blocks;
}
function splitTopLevel(text, separator = ",") {
	const parts = [];
	let depth = 0, current = "";
	for (const char of text) {
		if (char === "(" || char === "[") depth++;
		else if (char === ")" || char === "]") depth--;
		if (char === separator && depth === 0) {
			parts.push(current);
			current = "";
		} else current += char;
	}
	parts.push(current);
	return parts.map((part) => part.trim()).filter(Boolean);
}
// 计算一个属性/伪类简单选择器在默认设置下是否成立；返回 null 表示需要在运行时判断（保留）。
function evaluate(simple) {
	let match = simple.match(/^\[([\w-]+)(?:=([^\]]+))?\]$/);
	if (match) {
		const [, name, raw] = match;
		if (runtimeAttributes.has(name)) return !scriptOnlyPages.has(raw?.replace(/^["']|["']$/g, ""));
		if (!name.startsWith("data-nsmax-")) return null;
		const value = raw?.replace(/^["']|["']$/g, "");
		return raw === void 0 ? attributes.has(name) : attributes.get(name) === value;
	}
	match = simple.match(/^:(not|is)\((.*)\)$/);
	if (match) {
		const results = splitTopLevel(match[2]).map(evaluate);
		if (results.some((result) => result === null)) return null;
		return match[1] === "not" ? !results.some(Boolean) : results.some(Boolean);
	}
	return null;
}
function rewriteSelector(selector) {
	if (!selector.startsWith("html[data-nsmax-theme]")) return unmappable.test(selector) ? null : selector;
	let rest = selector.slice(4);
	const kept = [];
	let satisfied = 0;
	while (rest && !/^[\s>+~]/.test(rest)) {
		let token;
		if (rest[0] === "[") token = rest.slice(0, rest.indexOf("]") + 1);
		else if (rest[0] === ":") {
			const name = rest.match(/^:[\w-]+/)[0];
			if (rest[name.length] === "(") {
				let depth = 0, cursor = name.length;
				do {
					if (rest[cursor] === "(") depth++;
					else if (rest[cursor] === ")") depth--;
					cursor++;
				} while (depth && cursor < rest.length);
				token = rest.slice(0, cursor);
			} else token = name;
		} else break;
		rest = rest.slice(token.length);
		const result = evaluate(token);
		if (result === false) return null;
		if (result === true) satisfied++;
		else kept.push(token);
	}
	for (const [marker, replacement] of markers) rest = rest.split(marker).join(replacement);
	if (unmappable.test(rest)) return null;
	return `html${":root".repeat(satisfied)}${kept.join("")}${rest}`;
}
function render(blocks, indent = "") {
	const out = [];
	for (const block of blocks) {
		if (block.children) {
			const inner = render(block.children, `${indent}\t`);
			if (inner.trim()) out.push(`${indent}${block.prelude} {\n${inner}\n${indent}}`);
			continue;
		}
		if (block.prelude.startsWith("@") || /^(from|to|\d+%)/.test(block.prelude)) {
			out.push(`${indent}${block.prelude} {${block.body}}`);
			continue;
		}
		const selectors = splitTopLevel(block.prelude).map(rewriteSelector).filter(Boolean);
		if (!selectors.length || !block.body) continue;
		const declarations = splitTopLevel(block.body, ";").map((declaration) => `${indent}\t${declaration};`).join("\n");
		out.push(`${indent}${selectors.join(`,\n${indent}`)} {\n${declarations}\n${indent}}`);
	}
	return out.join("\n");
}
const resolved = render(parseBlocks(themeCss));

const fontFaces = fonts.map((font) => `@font-face {
	font-family: "${font.family}";
	font-style: normal;
	font-weight: ${font.weight};
	font-display: swap;
	src: url("${font.url}") format("woff2");
	unicode-range: ${latinRange};
}`).join("\n");

const banner = (kind) => `/*
 * NodeSeek Max 主题 v${version}（${kind}）
 * 由 scripts/build-css.mjs 从 nodeseek-max.user.js 自动生成，请勿手动修改；
 * 主题源码在脚本的 modern_theme_default 中。默认设置：简洁风格、黑白强调色、分隔行布局、Inter 字体。
 * 已安装 NodeSeek Max 脚本时无需再加载本文件（脚本内已包含同一套主题，并可在设置里调整）。
 * https://github.com/Ethan2258/Nodeseek-max · GPL-3.0-only
 */`;

const plain = `${banner("纯 CSS")}\n${fontFaces}\n${resolved}\n`;
const userCss = `/* ==UserStyle==
@name           NodeSeek Max 主题
@namespace      github.com/Ethan2258/Nodeseek-max
@version        ${version}
@description    NodeSeek / DeepFlood 现代化主题：黑白灰配色、大圆角卡片、Inter + JetBrains Mono 字体、优化排版。
@author         Ethan
@license        GPL-3.0-only
@homepageURL    https://github.com/Ethan2258/Nodeseek-max
@supportURL     https://github.com/Ethan2258/Nodeseek-max/issues
@updateURL      https://raw.githubusercontent.com/Ethan2258/Nodeseek-max/main/theme/nodeseek-max.user.css
==/UserStyle== */
${banner("UserCSS")}
@-moz-document domain("www.nodeseek.com"), domain("www.deepflood.com") {
${`${fontFaces}\n${resolved}`.split("\n").map((line) => (line ? `\t${line}` : line)).join("\n")}
}
`;

const outputs = [
	["theme/nodeseek-max.css", plain],
	["theme/nodeseek-max.user.css", userCss]
];
if (process.argv.includes("--check")) {
	let stale = false;
	for (const [path, content] of outputs) {
		let current = "";
		try {
			current = readFileSync(new URL(path, root), "utf8");
		} catch {}
		if (current !== content) {
			console.error(`${path} 与脚本中的主题不一致，请运行 npm run css`);
			stale = true;
		}
	}
	if (stale) process.exit(1);
	console.log(`主题 CSS 已同步（v${version}）`);
} else {
	mkdirSync(new URL("theme/", root), { recursive: true });
	for (const [path, content] of outputs) writeFileSync(new URL(path, root), content);
	console.log(`已生成 theme/nodeseek-max.css、theme/nodeseek-max.user.css（v${version}）`);
}
