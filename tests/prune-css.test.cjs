"use strict";
// 构建时去掉永远轮不到的声明（scripts/prune-css.mjs）：该删的删、兜底写法和条件更窄的留着（2026-11-27）
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const postcss = require("postcss");
const source = fs.readFileSync(path.join(__dirname, "..", "nodeseek-max.user.js"), "utf8");
// 和 build-sb.mjs 用同一个特异度算法
const optimize = {};
vm.runInNewContext(source.slice(source.indexOf("\tfunction nsmaxSplitTop"), source.indexOf("\tvar __create")), optimize);
// chunks：第几条规则（按出现顺序）放在哪一段，没写就是 base
const run = async (css, { chunks = [], wide = true } = {}) => {
	const { pruneOverridden } = await import("../scripts/prune-css.mjs");
	const root = postcss.parse(css);
	const order = [];
	root.walkRules((rule) => { order.push(rule); });
	const stats = pruneOverridden(root, (rule) => new Map(rule.selectors.map((selector) => [selector, chunks[order.indexOf(rule)] || "base"])), wide ? (selector) => optimize.nsmaxSpecificity(selector) : null);
	return { css: root.toString(), stats };
};

test("同一选择器后面又写了同一属性：前面那条删掉，删空的规则和 @media 一起去掉", async () => {
	assert.equal((await run(".a{color:red;margin:0}.a{color:blue}")).css, ".a{margin:0}.a{color:blue}");
	assert.equal((await run(".a{color:red}.b{x:1}.a{color:blue}")).css, ".b{x:1}.a{color:blue}");
	assert.equal((await run(".a{color:red;color:blue}")).css, ".a{color:blue}");
	assert.equal((await run("@media (max-width:700px){.a{color:red}}.a{color:blue}")).css, ".a{color:blue}");
	assert.equal((await run(".a{--x:1px}.a{--x:2px}")).css, ".a{--x:2px}");
	assert.equal((await run(".a{color:red}.a{color:blue!important}")).css, ".a{color:blue!important}");
	// 后面的值里有 var()：属性认识就一定接受
	assert.equal((await run(".a{height:100vh}.a{height:var(--h,100dvh)}")).css, ".a{height:var(--h,100dvh)}");
});

test("赢不了的情况都留着：!important、条件更窄、只盖住一部分选择器、后面的值是兼容写法、@keyframes 里", async () => {
	for (const css of [
		".a{color:red!important}.a{color:blue}",
		".a{color:red}@media (max-width:700px){.a{color:blue}}",
		"@media (hover:hover){.a{color:red}}@media (max-width:700px){.a{color:blue}}",
		".a,.b{color:red}.a{color:blue}",
		".a{height:100vh}.a{height:100dvh}",
		".a{background:#fff}.a{background:color-mix(in srgb,#fff 50%,#000)}",
		".a{width:100%}.a{width:-webkit-fill-available}",
		".a{width:100%}.a{width:stretch}",
		"@keyframes k{0%{color:red}0%{color:blue}}",
	]) assert.equal((await run(css)).css, css);
});

test("只差特异度垫片：特异度高的不管先后都赢，一样高的看先后；真的多了条件不算", async () => {
	const pad = "html[data-nsmax-theme]:is(:root,#x#x#x)";
	assert.equal((await run(`html[data-nsmax-theme] .a{color:red}${pad} .a{color:blue}`)).css, `${pad} .a{color:blue}`);
	// 前面那条特异度更高：后面那条才是永远轮不到的
	assert.equal((await run(`${pad} .a{color:blue}html[data-nsmax-theme] .a{color:red}`)).css, `${pad} .a{color:blue}`);
	assert.equal((await run(".a:is(#x, *){color:blue}.a{color:red}")).css, ".a:is(#x, *){color:blue}");
	assert.equal((await run("html[data-nsmax-theme]:root:root:root .a{color:blue}html[data-nsmax-theme] .a{color:red}")).css, "html[data-nsmax-theme]:root:root:root .a{color:blue}");
	// 只认完全相同的选择器时不动
	const strict = `html[data-nsmax-theme] .a{color:red}${pad} .a{color:blue}`;
	assert.equal((await run(strict, { wide: false })).css, strict);
	for (const css of [".a{color:red}.a.b:is(#x, *){color:blue}", "html .a{color:red}html.dark:is(:root,#x#x#x) .a{color:blue}"]) assert.equal((await run(css)).css, css);
});

test("分段：它在的时候盖住它的那段一定注入了，靠先后定输赢的还要在同一张样式表里", async () => {
	// 后面那条在 base（每页都有）：页面段里的被盖住
	assert.equal((await run(".a{color:red}.a{color:blue}", { chunks: ["post"] })).css, ".a{color:blue}");
	// 后面那条在页面段、前面在 base：别的页面没有那段，留着
	assert.equal((await run(".a{color:red}.a{color:blue}", { chunks: ["base", "post"] })).stats.declarations, 0);
	// 前面在浮层段（晚注入的另一张样式表，层叠里排在后面）、后面在 base：特异度一样时前面那条反而赢，留着
	assert.equal((await run(".a{color:red}.a{color:blue}", { chunks: ["overlay", "base"] })).stats.declarations, 0);
	// 特异度更高就不看先后：浮层段里的被 base 段里特异度更高的盖住
	assert.equal((await run(".a{color:red}.a:is(#x, *){color:blue}", { chunks: ["overlay", "base"] })).css, ".a:is(#x, *){color:blue}");
	// 组合段「post+touch」被 post 段盖住：注入组合段时 post 段一定在；反过来不行
	assert.equal((await run(".a{color:red}.a{color:blue}", { chunks: ["post+touch", "post"] })).css, ".a{color:blue}");
	assert.equal((await run(".a{color:red}.a{color:blue}", { chunks: ["post", "post+touch"] })).stats.declarations, 0);
});
